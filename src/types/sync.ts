import type {
  ShoppingItem,
  ShoppingList,
  ShoppingSet,
} from "@/features/shopping/types";

/**
 * クライアント送受信に使う ShoppingItem DTO。
 *
 * Prisma の ShoppingItem モデルから userId を除外した形で API 上やり取りする。
 * FE の `ShoppingItem` には元々 `userId` がないため、`Omit` 自体は実質 no-op だが、
 * 将来 `ShoppingItem` に `userId` が追加された場合でも DTO に漏れないことを型で保証する。
 *
 * サーバー側で受信した `upserts` には必ず `{ ...input, userId: session.user.id }` で
 * `userId` を上書きしてから Prisma に渡す（クライアントが偽装した userId を弾く防御層）。
 */
export type ShoppingItemDTO = Omit<ShoppingItem, "userId">;

export type ApiSuccess<T> = { success: true; data: T };

export type ApiError = {
  success: false;
  error: { code: string; message: string; fields?: Record<string, string> };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** GET /api/sync/items のレスポンス data */
export type SyncPullResponse = {
  items: ShoppingItemDTO[];
  serverDeletes: string[];
  serverTime: string;
  lastUpdatedAt: string | null;
};

/** PUT /api/sync/items のリクエスト */
export type SyncPushRequest = {
  upserts: ShoppingItemDTO[];
  deletedIds: string[];
  since: string | null;
};

/** PUT /api/sync/items のレスポンス data */
export type SyncPushResponse = {
  applied: ShoppingItemDTO[];
  rejected: Array<{
    id: string;
    reason: "SERVER_NEWER";
    serverItem: ShoppingItemDTO;
  }>;
  serverChanges: ShoppingItemDTO[];
  serverDeletes: string[];
  serverTime: string;
  lastUpdatedAt: string | null;
};

/** POST /api/sync/merge のリクエスト */
export type SyncMergeRequest = {
  localItems: ShoppingItemDTO[];
};

/** POST /api/sync/merge のレスポンス data */
export type SyncMergeResponse = {
  finalItems: ShoppingItemDTO[];
  uploadedCount: number;
  downloadedCount: number;
  serverTime: string;
  lastUpdatedAt: string | null;
};

// =============================================================
// Phase 10.1b: ShoppingSet 同期用の型
// =============================================================

/**
 * クライアント送受信に使う ShoppingSet DTO。
 * ShoppingSet には元々 userId が含まれないが、API DTO であることを明示する。
 * サーバー側 upsert 時は `userId: session.user.id` で必ず上書きする。
 *
 * Phase 10.4: listId を追加。
 * - API レスポンスでは必ず string として含む（setToDTO が常に補完する）
 * - API リクエスト（push）では旧クライアント後方互換のため Zod スキーマ側で optional を許可し、
 *   サーバー側で未分類 ID に補完してから DB に保存する
 */
export type ShoppingSetDTO = ShoppingSet;

/** GET /api/sync/sets のレスポンス data */
export type SetsSyncPullResponse = {
  sets: ShoppingSetDTO[];
  serverDeletes: string[];
  serverTime: string;
  lastUpdatedAt: string | null;
};

/** PUT /api/sync/sets のリクエスト */
export type SetsSyncPushRequest = {
  upserts: ShoppingSetDTO[];
  deletedIds: string[];
  since: string | null;
};

/** PUT /api/sync/sets のレスポンス data */
export type SetsSyncPushResponse = {
  applied: ShoppingSetDTO[];
  rejected: Array<{
    id: string;
    reason: "SERVER_NEWER";
    serverSet: ShoppingSetDTO;
  }>;
  serverChanges: ShoppingSetDTO[];
  serverDeletes: string[];
  serverTime: string;
  lastUpdatedAt: string | null;
};

/** POST /api/sync/sets/merge のリクエスト */
export type SetsSyncMergeRequest = {
  localSets: ShoppingSetDTO[];
};

/** POST /api/sync/sets/merge のレスポンス data */
export type SetsSyncMergeResponse = {
  finalSets: ShoppingSetDTO[];
  uploadedCount: number;
  downloadedCount: number;
  serverTime: string;
  lastUpdatedAt: string | null;
};

// =============================================================
// Phase 10.2: ShoppingList 同期用の型
// =============================================================

/** ShoppingList の API DTO（クライアント型と同一形状） */
export type ShoppingListDTO = ShoppingList;

/** GET /api/sync/lists のレスポンス data */
export type ListsSyncPullResponse = {
  lists: ShoppingListDTO[];
  serverDeletes: string[];
  serverTime: string;
  lastUpdatedAt: string | null;
};

/** PUT /api/sync/lists のリクエスト */
export type ListsSyncPushRequest = {
  upserts: ShoppingListDTO[];
  deletedIds: string[];
  since: string | null;
};

/** PUT /api/sync/lists のレスポンス data */
export type ListsSyncPushResponse = {
  applied: ShoppingListDTO[];
  rejected: Array<{
    id: string;
    reason: "SERVER_NEWER" | "SYSTEM_PROTECTED";
    serverList?: ShoppingListDTO;
  }>;
  serverChanges: ShoppingListDTO[];
  serverDeletes: string[];
  serverTime: string;
  lastUpdatedAt: string | null;
};

/** POST /api/sync/lists/merge のリクエスト */
export type ListsSyncMergeRequest = {
  localLists: ShoppingListDTO[];
  /** 「未分類」(`system: true`) リストのローカル ID */
  localUnclassifiedId: string | null;
};

/** POST /api/sync/lists/merge のレスポンス data */
export type ListsSyncMergeResponse = {
  finalLists: ShoppingListDTO[];
  /** サーバー側で正本となる未分類 ID（古い方を採用） */
  unclassifiedId: string;
  /** クライアント側で別 ID として作られていた未分類 ID（クライアントは items の listId をリマップする） */
  remappedUnclassifiedIds: string[];
  uploadedCount: number;
  downloadedCount: number;
  serverTime: string;
  lastUpdatedAt: string | null;
};
