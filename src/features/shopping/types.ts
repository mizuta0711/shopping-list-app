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

/// 買い物セット定義（カレーセット・調味料セット 等）
export type ShoppingSet = {
  id: string;
  name: string;
  items: string[];
  createdAt: string;
  updatedAt: string;
};

export const SETS_STORAGE_KEY = "shopping-list-app:sets:state";
export const SETS_STORAGE_VERSION = 1;

export const SET_NAME_MAX_LENGTH = 50;
export const SET_ITEM_NAME_MAX_LENGTH = 50;
export const SET_ITEMS_MAX_COUNT = 100;
