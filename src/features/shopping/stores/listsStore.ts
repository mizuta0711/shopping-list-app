import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  LISTS_STORAGE_KEY,
  LISTS_STORAGE_VERSION,
  LIST_NAME_MAX_LENGTH,
  SYSTEM_LIST_EMOJI,
  SYSTEM_LIST_NAME,
  USER_LIST_MAX_COUNT,
  type ShoppingList,
} from "../types";

type ListsState = {
  /** 未分類 (system: true) を先頭に + ユーザー作成リスト */
  lists: ShoppingList[];
};

type ListsActions = {
  /** 新規リストを追加し、その ID を返す。上限超過時は throw */
  addList: (name: string, emoji: string | null) => string;
  /** 名前 / 絵文字を更新。system: true は無視 */
  updateList: (
    id: string,
    patch: { name?: string; emoji?: string | null },
  ) => void;
  /** リストを削除（system: true は無視）。所属アイテムの未分類移動はアクション内で連鎖 */
  deleteList: (id: string) => void;
  /** 同期サービスからのサーバー全件上書き */
  setLists: (lists: ShoppingList[]) => void;
  /** 同期サービスからのサーバー差分反映 */
  applyServerChanges: (params: {
    upserts: ShoppingList[];
    deletes: string[];
  }) => void;
  reset: () => void;
  /** 未分類が存在しなければ作成。ID を返す */
  ensureUnclassified: () => string;
};

const buildList = (
  name: string,
  emoji: string | null,
  system = false,
): ShoppingList => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    emoji,
    system,
    createdAt: now,
    updatedAt: now,
  };
};

const sortLists = (lists: ShoppingList[]): ShoppingList[] => {
  // system を先頭に固定 + 残りは createdAt 昇順
  const system = lists.filter((l) => l.system);
  const user = lists
    .filter((l) => !l.system)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return [...system, ...user];
};

const initialState: ListsState = {
  lists: [],
};

export const useListsStore = create<ListsState & ListsActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      addList: (name, emoji) => {
        const trimmed = name.trim().slice(0, LIST_NAME_MAX_LENGTH);
        if (trimmed.length === 0) {
          throw new Error("リスト名を入力してください");
        }
        const userListsCount = get().lists.filter((l) => !l.system).length;
        if (userListsCount >= USER_LIST_MAX_COUNT) {
          throw new Error(
            `リストは最大 ${USER_LIST_MAX_COUNT} 件まで作成できます`,
          );
        }
        const list = buildList(trimmed, emoji, false);
        set((state) => ({ lists: sortLists([...state.lists, list]) }));
        return list.id;
      },

      updateList: (id, patch) => {
        const now = new Date().toISOString();
        set((state) => ({
          lists: state.lists.map((l) => {
            if (l.id !== id || l.system) return l;
            return {
              ...l,
              name:
                patch.name !== undefined
                  ? patch.name.trim().slice(0, LIST_NAME_MAX_LENGTH)
                  : l.name,
              emoji: patch.emoji !== undefined ? patch.emoji : l.emoji,
              updatedAt: now,
            };
          }),
        }));
      },

      deleteList: (id) => {
        const target = get().lists.find((l) => l.id === id);
        if (!target || target.system) return;
        set((state) => ({
          lists: state.lists.filter((l) => l.id !== id),
        }));
      },

      setLists: (lists) => set({ lists: sortLists(lists) }),

      applyServerChanges: ({ upserts, deletes }) => {
        set((state) => {
          const byId = new Map(state.lists.map((l) => [l.id, l]));
          for (const u of upserts) byId.set(u.id, u);
          for (const id of deletes) byId.delete(id);
          return { lists: sortLists(Array.from(byId.values())) };
        });
      },

      reset: () => set(initialState),

      ensureUnclassified: () => {
        const existing = get().lists.find((l) => l.system);
        if (existing) return existing.id;
        const list = buildList(SYSTEM_LIST_NAME, SYSTEM_LIST_EMOJI, true);
        set((state) => ({ lists: sortLists([...state.lists, list]) }));
        return list.id;
      },
    }),
    {
      name: LISTS_STORAGE_KEY,
      version: LISTS_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lists: state.lists }),
    },
  ),
);
