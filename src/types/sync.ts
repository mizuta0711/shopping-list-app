import type { ShoppingItem } from "@/features/shopping/types";

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
