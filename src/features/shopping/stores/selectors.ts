import type { ItemScope, ShoppingItem, SortKey } from "../types";

export const filterPendingByScope = (
  items: ShoppingItem[],
  scope: ItemScope,
): ShoppingItem[] =>
  items.filter((item) => item.status === "PENDING" && item.scope === scope);

export const filterPurchased = (items: ShoppingItem[]): ShoppingItem[] =>
  items.filter((item) => item.status === "PURCHASED");

export const sortItems = (
  items: ShoppingItem[],
  sort: SortKey,
): ShoppingItem[] => {
  const arr = [...items];
  if (sort === "NAME") {
    return arr.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  }
  if (sort === "MANUAL") {
    return arr.sort((a, b) => a.order - b.order);
  }
  return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};
