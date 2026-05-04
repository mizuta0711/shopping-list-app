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

const buildItem = (name: string, scope: ItemScope, now: string): ShoppingItem => ({
  id: crypto.randomUUID(),
  name,
  scope,
  status: "PENDING",
  createdAt: now,
  updatedAt: now,
  purchasedAt: null,
});

export const useShoppingStore = create<ShoppingState & ShoppingActions>()(
  persist(
    (set) => ({
      ...initialState,

      addItem: (name, scope = "TODAY") => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const now = new Date().toISOString();
        set((state) => ({
          items: [...state.items, buildItem(trimmed, scope, now)],
        }));
      },

      addItems: (names, scope = "TODAY") => {
        const now = new Date().toISOString();
        const newItems = names
          .map((n) => n.trim())
          .filter((n) => n.length > 0)
          .map((n) => buildItem(n, scope, now));
        if (newItems.length === 0) return;
        set((state) => ({ items: [...state.items, ...newItems] }));
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
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, scope, updatedAt: now } : item,
          ),
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
      partialize: (state) => ({
        items: state.items,
        sort: state.sort,
        hasOnboarded: state.hasOnboarded,
      }),
    },
  ),
);
