import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  STATE_BACKUP_V2_KEY,
  STATE_MIGRATION_IN_PROGRESS_KEY,
  STORAGE_KEY,
  STORAGE_VERSION,
  type ItemScope,
  type ShoppingItem,
  type SortKey,
} from "../types";
import { useListsStore } from "./listsStore";

type ShoppingState = {
  items: ShoppingItem[];
  sort: SortKey;
  hasOnboarded: boolean;
};

type ShoppingActions = {
  addItem: (name: string, listId: string, scope?: ItemScope) => void;
  addItems: (names: string[], listId: string, scope?: ItemScope) => void;
  togglePurchased: (id: string) => void;
  moveScope: (id: string, scope: ItemScope) => void;
  reorderItems: (scope: ItemScope, orderedIds: string[]) => void;
  deleteItem: (id: string) => void;
  /** アイテム名のみを編集する。`updatedAt` も更新（Phase 9 同期 LWW 用） */
  updateItemName: (id: string, name: string) => void;
  setSort: (sort: SortKey) => void;
  setHasOnboarded: (value: boolean) => void;
  reset: () => void;
  /** 同期サービスがサーバー全件で上書きする時に使う（マージ完了時など） */
  setItems: (items: ShoppingItem[]) => void;
  /** 同期サービスがサーバー差分を反映する時に使う（reconcile 結果の適用） */
  applyServerChanges: (params: {
    upserts: ShoppingItem[];
    deletes: string[];
  }) => void;
  /** 移動モード決定時にアイテムの listId を一括書き換え */
  relocateItems: (ids: string[], targetListId: string) => void;
  /** リスト削除時に当該リストのアイテムを未分類へ移動 */
  applyListDeleted: (deletedListId: string, unclassifiedId: string) => void;
  /** マージで未分類が複数あった場合に listId を統一 */
  remapListIds: (fromIds: string[], toId: string) => void;
};

const initialState: ShoppingState = {
  items: [],
  sort: "CREATED_AT",
  hasOnboarded: false,
};

const nextOrder = (items: ShoppingItem[], scope: ItemScope): number => {
  let max = -1;
  for (const item of items) {
    if (item.scope === scope && item.order > max) max = item.order;
  }
  return max + 1;
};

const buildItem = (
  name: string,
  listId: string,
  scope: ItemScope,
  order: number,
  now: string,
): ShoppingItem => ({
  id: crypto.randomUUID(),
  listId,
  name,
  scope,
  status: "PENDING",
  order,
  createdAt: now,
  updatedAt: now,
  purchasedAt: null,
});

type LegacyV1Item = Omit<ShoppingItem, "order" | "listId"> & {
  order?: number;
};
type LegacyV2Item = Omit<ShoppingItem, "listId">;
type LegacyPersistedState = Partial<ShoppingState> & {
  items?: Array<LegacyV1Item | LegacyV2Item | ShoppingItem>;
};

const migrateToV2 = (
  persistedState: unknown,
): Partial<ShoppingState> | undefined => {
  if (!persistedState || typeof persistedState !== "object") {
    return persistedState as Partial<ShoppingState> | undefined;
  }
  const state = persistedState as LegacyPersistedState;
  const legacyItems = (state.items ?? []) as LegacyV1Item[];

  const byScope: Record<ItemScope, LegacyV1Item[]> = { TODAY: [], LATER: [] };
  for (const item of legacyItems) {
    byScope[item.scope].push(item);
  }

  const migratedItems: LegacyV2Item[] = [];
  (Object.keys(byScope) as ItemScope[]).forEach((scope) => {
    byScope[scope]
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((item, idx) => {
        migratedItems.push({ ...item, order: idx } as LegacyV2Item);
      });
  });

  return { ...state, items: migratedItems as unknown as ShoppingItem[] };
};

/**
 * v2 → v3 マイグレーション。
 * 全アイテムに「未分類」リストの listId を埋める。
 * 失敗時の復元のため `STATE_BACKUP_V2_KEY` にバックアップを保存。
 */
const migrateToV3 = (
  persistedState: unknown,
): Partial<ShoppingState> | undefined => {
  if (!persistedState || typeof persistedState !== "object") {
    return persistedState as Partial<ShoppingState> | undefined;
  }
  const state = persistedState as LegacyPersistedState;
  const items = state.items ?? [];

  // 既に listId が付いているアイテムが 1 件でもあれば v3 化済み
  const isAlreadyV3 =
    items.length === 0 ||
    items.every(
      (it) =>
        typeof (it as { listId?: unknown }).listId === "string" &&
        (it as { listId: string }).listId.length > 0,
    );

  // バックアップ保存（既に存在しない場合のみ）
  try {
    if (!localStorage.getItem(STATE_BACKUP_V2_KEY)) {
      localStorage.setItem(STATE_BACKUP_V2_KEY, JSON.stringify(persistedState));
    }
    localStorage.setItem(STATE_MIGRATION_IN_PROGRESS_KEY, "1");
  } catch {
    // QuotaExceeded 等は許容（マイグレーションを止めない）
  }

  // 未分類リストを ensure
  const unclassifiedId = useListsStore.getState().ensureUnclassified();

  const v3Items: ShoppingItem[] = items.map((it) => ({
    ...(it as ShoppingItem),
    listId:
      typeof (it as { listId?: unknown }).listId === "string" &&
      (it as { listId: string }).listId.length > 0
        ? (it as ShoppingItem).listId
        : unclassifiedId,
  }));

  // 完了フラグ削除
  try {
    localStorage.removeItem(STATE_MIGRATION_IN_PROGRESS_KEY);
  } catch {
    // 無視
  }

  if (isAlreadyV3) {
    return { ...state, items: items as ShoppingItem[] };
  }
  return { ...state, items: v3Items };
};

export const useShoppingStore = create<ShoppingState & ShoppingActions>()(
  persist(
    (set) => ({
      ...initialState,

      addItem: (name, listId, scope = "TODAY") => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const now = new Date().toISOString();
        set((state) => {
          const isDuplicate = state.items.some(
            (item) =>
              item.listId === listId &&
              item.name === trimmed &&
              item.scope === scope &&
              item.status === "PENDING",
          );
          if (isDuplicate) return state;
          return {
            items: [
              ...state.items,
              buildItem(
                trimmed,
                listId,
                scope,
                nextOrder(state.items, scope),
                now,
              ),
            ],
          };
        });
      },

      addItems: (names, listId, scope = "TODAY") => {
        const now = new Date().toISOString();
        set((state) => {
          const existingPendingNames = new Set(
            state.items
              .filter(
                (i) =>
                  i.listId === listId &&
                  i.scope === scope &&
                  i.status === "PENDING",
              )
              .map((i) => i.name),
          );
          const seenInBatch = new Set<string>();
          const trimmedFiltered: string[] = [];
          for (const raw of names) {
            const n = raw.trim();
            if (n.length === 0) continue;
            if (existingPendingNames.has(n)) continue;
            if (seenInBatch.has(n)) continue;
            seenInBatch.add(n);
            trimmedFiltered.push(n);
          }
          if (trimmedFiltered.length === 0) return state;

          const startOrder = nextOrder(state.items, scope);
          const newItems = trimmedFiltered.map((n, i) =>
            buildItem(n, listId, scope, startOrder + i, now),
          );
          return { items: [...state.items, ...newItems] };
        });
      },

      togglePurchased: (id) => {
        const now = new Date().toISOString();
        set((state) => ({
          items: state.items.map((item) => {
            if (item.id !== id) return item;
            const isPurchasing = item.status === "PENDING";
            return {
              ...item,
              status: isPurchasing ? "PURCHASED" : "PENDING",
              purchasedAt: isPurchasing ? now : null,
              updatedAt: now,
            };
          }),
        }));
      },

      moveScope: (id, scope) => {
        const now = new Date().toISOString();
        set((state) => {
          const target = state.items.find((item) => item.id === id);
          if (!target || target.scope === scope) return state;

          const newOrder = nextOrder(state.items, scope);
          return {
            items: state.items.map((item) =>
              item.id === id
                ? { ...item, scope, order: newOrder, updatedAt: now }
                : item,
            ),
          };
        });
      },

      reorderItems: (scope, orderedIds) => {
        const now = new Date().toISOString();
        const orderMap = new Map<string, number>();
        orderedIds.forEach((id, idx) => orderMap.set(id, idx));

        set((state) => ({
          items: state.items.map((item) => {
            if (item.scope !== scope || item.status !== "PENDING") return item;
            const newOrder = orderMap.get(item.id);
            if (newOrder === undefined) return item;
            if (newOrder === item.order) return item;
            return { ...item, order: newOrder, updatedAt: now };
          }),
        }));
      },

      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      updateItemName: (id, name) => {
        const trimmed = name.trim().slice(0, 50);
        if (!trimmed) return;
        const now = new Date().toISOString();
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, name: trimmed, updatedAt: now } : i,
          ),
        }));
      },

      setSort: (sort) => set({ sort }),

      setHasOnboarded: (value) => set({ hasOnboarded: value }),

      reset: () => set(initialState),

      setItems: (items) => set({ items }),

      applyServerChanges: ({ upserts, deletes }) => {
        set((state) => {
          const map = new Map(state.items.map((i) => [i.id, i]));
          for (const item of upserts) map.set(item.id, item);
          for (const id of deletes) map.delete(id);
          return { items: Array.from(map.values()) };
        });
      },

      relocateItems: (ids, targetListId) => {
        if (ids.length === 0) return;
        const idSet = new Set(ids);
        const now = new Date().toISOString();
        set((state) => ({
          items: state.items.map((it) =>
            idSet.has(it.id)
              ? { ...it, listId: targetListId, updatedAt: now }
              : it,
          ),
        }));
      },

      applyListDeleted: (deletedListId, unclassifiedId) => {
        const now = new Date().toISOString();
        set((state) => ({
          items: state.items.map((it) =>
            it.listId === deletedListId
              ? { ...it, listId: unclassifiedId, updatedAt: now }
              : it,
          ),
        }));
      },

      remapListIds: (fromIds, toId) => {
        if (fromIds.length === 0) return;
        const fromSet = new Set(fromIds);
        const now = new Date().toISOString();
        set((state) => ({
          items: state.items.map((it) =>
            fromSet.has(it.listId)
              ? { ...it, listId: toId, updatedAt: now }
              : it,
          ),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) => {
        let s: unknown = persistedState;
        if (version < 2) s = migrateToV2(s);
        if (version < 3) s = migrateToV3(s);
        return s as ShoppingState & ShoppingActions;
      },
      partialize: (state) => ({
        items: state.items,
        sort: state.sort,
        hasOnboarded: state.hasOnboarded,
      }),
    },
  ),
);
