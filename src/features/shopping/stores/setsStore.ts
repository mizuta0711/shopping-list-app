import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useSyncStore } from "@/features/sync/stores/syncStore";
import { migrateSetsV1ToV2 } from "../migrations/v1ToV2";
import {
  SETS_STORAGE_KEY,
  SETS_STORAGE_VERSION,
  SET_ITEMS_MAX_COUNT,
  SET_ITEM_NAME_MAX_LENGTH,
  SET_NAME_MAX_LENGTH,
  type ShoppingSet,
} from "../types";

type SetsState = {
  sets: ShoppingSet[];
};

type SetsActions = {
  /** セットを追加し、生成した ID を返す */
  addSet: (name: string, items: string[], listId: string) => string;
  /** セットを更新（listId も変更可） */
  updateSet: (
    id: string,
    patch: { name?: string; items?: string[]; listId?: string },
  ) => void;
  deleteSet: (id: string) => void;
  reset: () => void;
  /** Phase 10.1b: 同期サービスがサーバー全件で上書きする時に使う（マージ完了時など） */
  setSets: (sets: ShoppingSet[]) => void;
  /** Phase 10.1b: 同期サービスがサーバー差分を反映する時に使う（reconcile 結果の適用） */
  applyServerChanges: (params: {
    upserts: ShoppingSet[];
    deletes: string[];
  }) => void;
  /** Phase 10.4: リスト削除時の連鎖。対象 listId を持つ全セットを未分類へ移動 */
  applyListDeleted: (deletedListId: string, unclassifiedId: string) => void;
  /** Phase 10.4: 初回マージ時の listId リマップ（Phase 10.2 の useShoppingStore.remapListIds と同パターン） */
  remapListIds: (remappedIds: Record<string, string>) => void;
  /**
   * v1→v2 マイグレーション後補正。
   * listId が "" のセットに unclassifiedId を埋め、同期キューへ登録する。
   * SyncProvider / onRehydrateStorage で listsStore リハイドレート後に呼ぶ。
   */
  repairMissingListIds: (unclassifiedId: string) => void;
};

const initialState: SetsState = { sets: [] };

const sanitizeItems = (raw: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const r of raw) {
    const t = r.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    result.push(t.slice(0, SET_ITEM_NAME_MAX_LENGTH));
    if (result.length >= SET_ITEMS_MAX_COUNT) break;
  }
  return result;
};

const sanitizeName = (name: string): string =>
  name.trim().slice(0, SET_NAME_MAX_LENGTH);

export const useSetsStore = create<SetsState & SetsActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      addSet: (name, items, listId) => {
        const trimmedName = sanitizeName(name);
        const cleanItems = sanitizeItems(items);
        if (!trimmedName || cleanItems.length === 0) return "";
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        set((state) => ({
          sets: [
            ...state.sets,
            {
              id,
              listId,
              name: trimmedName,
              items: cleanItems,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return id;
      },

      updateSet: (id, patch) => {
        const now = new Date().toISOString();
        set((state) => ({
          sets: state.sets.map((s) => {
            if (s.id !== id) return s;
            const trimmedName =
              patch.name !== undefined
                ? sanitizeName(patch.name)
                : s.name;
            const cleanItems =
              patch.items !== undefined
                ? sanitizeItems(patch.items)
                : s.items;
            // name/items のバリデーションが失敗する場合は更新しない
            if (patch.name !== undefined && !trimmedName) return s;
            if (patch.items !== undefined && cleanItems.length === 0) return s;
            return {
              ...s,
              name: trimmedName,
              items: cleanItems,
              listId: patch.listId !== undefined ? patch.listId : s.listId,
              updatedAt: now,
            };
          }),
        }));
      },

      deleteSet: (id) => {
        set((state) => ({ sets: state.sets.filter((s) => s.id !== id) }));
      },

      reset: () => set(initialState),

      setSets: (sets) => set({ sets }),

      applyServerChanges: ({ upserts, deletes }) => {
        set((state) => {
          const map = new Map(state.sets.map((s) => [s.id, s] as const));
          for (const u of upserts) map.set(u.id, u);
          for (const id of deletes) map.delete(id);
          return { sets: Array.from(map.values()) };
        });
      },

      applyListDeleted: (deletedListId, unclassifiedId) => {
        const toMove = get().sets.filter((s) => s.listId === deletedListId);
        if (toMove.length === 0) return;
        const now = new Date().toISOString();
        set((state) => ({
          sets: state.sets.map((s) =>
            s.listId === deletedListId
              ? { ...s, listId: unclassifiedId, updatedAt: now }
              : s,
          ),
        }));
        toMove.forEach((s) => useSyncStore.getState().markSetUpsert(s.id));
      },

      remapListIds: (remappedIds) => {
        const entries = Object.entries(remappedIds);
        if (entries.length === 0) return;
        const now = new Date().toISOString();
        set((state) => ({
          sets: state.sets.map((s) => {
            const newId = remappedIds[s.listId];
            return newId !== undefined
              ? { ...s, listId: newId, updatedAt: now }
              : s;
          }),
        }));
      },

      repairMissingListIds: (unclassifiedId) => {
        const toRepair = get().sets.filter((s) => s.listId === "");
        if (toRepair.length === 0) return;
        const now = new Date().toISOString();
        set((state) => ({
          sets: state.sets.map((s) =>
            s.listId === ""
              ? { ...s, listId: unclassifiedId, updatedAt: now }
              : s,
          ),
        }));
        toRepair.forEach((s) => useSyncStore.getState().markSetUpsert(s.id));
      },
    }),
    {
      name: SETS_STORAGE_KEY,
      version: SETS_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sets: state.sets }),
      migrate: (persistedState: unknown, version: number): SetsState => {
        let state = persistedState;
        if (version < 2) {
          state = migrateSetsV1ToV2(state);
        }
        return state as SetsState;
      },
    },
  ),
);
