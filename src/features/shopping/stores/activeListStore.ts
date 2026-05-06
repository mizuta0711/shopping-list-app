import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ACTIVE_LIST_STORAGE_KEY } from "../types";

type MoveModeState = {
  enabled: boolean;
  /** 選択中アイテム ID。永続化しない（メモリのみ） */
  selectedItemIds: string[];
};

type ActiveListState = {
  /** アクティブな buying list の ID（永続化対象） */
  activeListId: string | null;
  /** 移動モード state（永続化対象外、リロードで OFF） */
  moveMode: MoveModeState;
};

type ActiveListActions = {
  setActiveListId: (id: string | null) => void;
  enterMoveMode: () => void;
  exitMoveMode: () => void;
  toggleMoveSelection: (itemId: string) => void;
  clearMoveSelection: () => void;
  reset: () => void;
};

const initialState: ActiveListState = {
  activeListId: null,
  moveMode: { enabled: false, selectedItemIds: [] },
};

export const useActiveListStore = create<
  ActiveListState & ActiveListActions
>()(
  persist(
    (set) => ({
      ...initialState,

      setActiveListId: (id) => {
        // リスト切替時は移動モードもリセット
        set({
          activeListId: id,
          moveMode: { enabled: false, selectedItemIds: [] },
        });
      },

      enterMoveMode: () => {
        set({ moveMode: { enabled: true, selectedItemIds: [] } });
      },

      exitMoveMode: () => {
        set({ moveMode: { enabled: false, selectedItemIds: [] } });
      },

      toggleMoveSelection: (itemId) => {
        set((state) => {
          const next = state.moveMode.selectedItemIds.includes(itemId)
            ? state.moveMode.selectedItemIds.filter((id) => id !== itemId)
            : [...state.moveMode.selectedItemIds, itemId];
          return {
            moveMode: { ...state.moveMode, selectedItemIds: next },
          };
        });
      },

      clearMoveSelection: () => {
        set((state) => ({
          moveMode: { ...state.moveMode, selectedItemIds: [] },
        }));
      },

      reset: () => set(initialState),
    }),
    {
      name: ACTIVE_LIST_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // activeListId のみ永続化。moveMode はメモリのみ
      partialize: (state) => ({ activeListId: state.activeListId }),
    },
  ),
);
