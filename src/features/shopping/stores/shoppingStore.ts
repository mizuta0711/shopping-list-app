import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  type ItemScope,
  type ShoppingItem,
  type SortKey,
} from "../types";

type ShoppingState = {
  items: ShoppingItem[];
  sort: SortKey;
  hasOnboarded: boolean;
};

type ShoppingActions = {
  addItem: (name: string, scope?: ItemScope) => void;
  addItems: (names: string[], scope?: ItemScope) => void;
  togglePurchased: (id: string) => void;
  moveScope: (id: string, scope: ItemScope) => void;
  reorderItems: (scope: ItemScope, orderedIds: string[]) => void;
  deleteItem: (id: string) => void;
  setSort: (sort: SortKey) => void;
  setHasOnboarded: (value: boolean) => void;
  reset: () => void;
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
  scope: ItemScope,
  order: number,
  now: string,
): ShoppingItem => ({
  id: crypto.randomUUID(),
  name,
  scope,
  status: "PENDING",
  order,
  createdAt: now,
  updatedAt: now,
  purchasedAt: null,
});

type LegacyItem = Omit<ShoppingItem, "order"> & { order?: number };
type LegacyPersistedState = Partial<ShoppingState> & { items?: LegacyItem[] };

const migrateToV2 = (
  persistedState: unknown,
): Partial<ShoppingState> | undefined => {
  if (!persistedState || typeof persistedState !== "object") {
    return persistedState as Partial<ShoppingState> | undefined;
  }
  const state = persistedState as LegacyPersistedState;
  const legacyItems = state.items ?? [];

  const byScope: Record<ItemScope, LegacyItem[]> = { TODAY: [], LATER: [] };
  for (const item of legacyItems) {
    byScope[item.scope].push(item);
  }

  const migratedItems: ShoppingItem[] = [];
  (Object.keys(byScope) as ItemScope[]).forEach((scope) => {
    byScope[scope]
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((item, idx) => {
        migratedItems.push({ ...item, order: idx } as ShoppingItem);
      });
  });

  return { ...state, items: migratedItems };
};

export const useShoppingStore = create<ShoppingState & ShoppingActions>()(
  persist(
    (set) => ({
      ...initialState,

      addItem: (name, scope = "TODAY") => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const now = new Date().toISOString();
        set((state) => {
          const isDuplicate = state.items.some(
            (item) =>
              item.name === trimmed &&
              item.scope === scope &&
              item.status === "PENDING",
          );
          if (isDuplicate) return state;
          return {
            items: [
              ...state.items,
              buildItem(trimmed, scope, nextOrder(state.items, scope), now),
            ],
          };
        });
      },

      addItems: (names, scope = "TODAY") => {
        const now = new Date().toISOString();
        set((state) => {
          const existingPendingNames = new Set(
            state.items
              .filter((i) => i.scope === scope && i.status === "PENDING")
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
            buildItem(n, scope, startOrder + i, now),
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

      setSort: (sort) => set({ sort }),

      setHasOnboarded: (value) => set({ hasOnboarded: value }),

      reset: () => set(initialState),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persistedState, version) => {
        if (version < 2) {
          return migrateToV2(persistedState) as ShoppingState & ShoppingActions;
        }
        return persistedState as ShoppingState & ShoppingActions;
      },
      partialize: (state) => ({
        items: state.items,
        sort: state.sort,
        hasOnboarded: state.hasOnboarded,
      }),
    },
  ),
);
