export type ItemScope = "TODAY" | "LATER";
export type ItemStatus = "PENDING" | "PURCHASED";
export type SortKey = "NAME" | "CREATED_AT" | "MANUAL";

export type ShoppingItem = {
  id: string;
  name: string;
  scope: ItemScope;
  status: ItemStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
  purchasedAt: string | null;
};

export const STORAGE_KEY = "shopping-list-app:state";
export const STORAGE_VERSION = 2;
