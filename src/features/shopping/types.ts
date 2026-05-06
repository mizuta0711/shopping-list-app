export type ItemScope = "TODAY" | "LATER";
export type ItemStatus = "PENDING" | "PURCHASED";
export type SortKey = "NAME" | "CREATED_AT" | "MANUAL";

export type ShoppingItem = {
  id: string;
  /** 所属リスト ID（Phase 10.2 で追加。NOT NULL） */
  listId: string;
  name: string;
  scope: ItemScope;
  status: ItemStatus;
  order: number;
  createdAt: string;
  updatedAt: string;
  purchasedAt: string | null;
};

export const STORAGE_KEY = "shopping-list-app:state";
export const STORAGE_VERSION = 3;

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

// =============================================================
// Phase 10.2: 買い物リスト（複数リスト機能）
// =============================================================

/** 買い物リスト（store-specific list） */
export type ShoppingList = {
  id: string;
  name: string;
  emoji: string | null;
  /** true = 「未分類」(削除・改名・絵文字変更 不可) */
  system: boolean;
  createdAt: string;
  updatedAt: string;
};

export const LISTS_STORAGE_KEY = "shopping-list-app:lists:state";
export const LISTS_STORAGE_VERSION = 1;
export const ACTIVE_LIST_STORAGE_KEY = "shopping-list-app:active-list";
export const STATE_BACKUP_V2_KEY = "shopping-list-app:state-backup-v2";
export const STATE_MIGRATION_IN_PROGRESS_KEY =
  "shopping-list-app:state-backup-v2:in-progress";
export const COACHMARK_DISMISSED_KEY =
  "shopping-list-app:coachmark:phase10.2:dismissed";

export const LIST_NAME_MAX_LENGTH = 20;
export const USER_LIST_MAX_COUNT = 20;
export const SYSTEM_LIST_NAME = "未分類";
export const SYSTEM_LIST_EMOJI = "🗂️";

/** リスト編集画面で選択可能な絵文字プリセット 12 個 */
export const LIST_EMOJI_PRESETS = [
  "🛒",
  "🛍️",
  "💊",
  "🪙",
  "🏪",
  "🥕",
  "👔",
  "🏠",
  "📚",
  "🧴",
  "🍶",
  "🎁",
] as const;
