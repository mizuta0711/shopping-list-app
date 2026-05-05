import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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
  addSet: (name: string, items: string[]) => void;
  updateSet: (id: string, name: string, items: string[]) => void;
  deleteSet: (id: string) => void;
  reset: () => void;
  /** Phase 10.1b: 同期サービスがサーバー全件で上書きする時に使う（マージ完了時など） */
  setSets: (sets: ShoppingSet[]) => void;
  /** Phase 10.1b: 同期サービスがサーバー差分を反映する時に使う（reconcile 結果の適用） */
  applyServerChanges: (params: {
    upserts: ShoppingSet[];
    deletes: string[];
  }) => void;
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
    (set) => ({
      ...initialState,

      addSet: (name, items) => {
        const trimmedName = sanitizeName(name);
        const cleanItems = sanitizeItems(items);
        if (!trimmedName || cleanItems.length === 0) return;
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        set((state) => ({
          sets: [
            ...state.sets,
            {
              id,
              name: trimmedName,
              items: cleanItems,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
      },

      updateSet: (id, name, items) => {
        const trimmedName = sanitizeName(name);
        const cleanItems = sanitizeItems(items);
        if (!trimmedName || cleanItems.length === 0) return;
        const now = new Date().toISOString();
        set((state) => ({
          sets: state.sets.map((s) =>
            s.id === id
              ? { ...s, name: trimmedName, items: cleanItems, updatedAt: now }
              : s,
          ),
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
    }),
    {
      name: SETS_STORAGE_KEY,
      version: SETS_STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sets: state.sets }),
    },
  ),
);
