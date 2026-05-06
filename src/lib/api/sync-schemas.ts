import { z } from "zod";

// userId は意図的にスキーマから除外する。
// strict() により余分なフィールド（userId 等）を含む payload は 400 で拒否される。
// サーバー側 upsert 時は { ...input, userId: session.user.id } で必ず上書きする。
export const ShoppingItemSchema = z
  .object({
    id: z.string().uuid(),
    /**
     * Phase 10.2 で追加。後方互換のため optional とし、未指定時はサーバー側で
     * 該当ユーザーの「未分類」リスト ID を補完する（dto.toDTO は常に listId を含む）。
     */
    listId: z.string().uuid().optional(),
    name: z.string().min(1).max(100),
    scope: z.enum(["TODAY", "LATER"]),
    status: z.enum(["PENDING", "PURCHASED"]),
    order: z.number().int().min(0),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    purchasedAt: z.string().datetime().nullable(),
  })
  .strict();

export const SyncPullQuerySchema = z.object({
  since: z.string().datetime().optional(),
});

export const SyncPushSchema = z
  .object({
    upserts: z.array(ShoppingItemSchema).max(500),
    deletedIds: z.array(z.string().uuid()).max(500),
    since: z.string().datetime().nullable(),
  })
  .strict();

export const SyncMergeSchema = z
  .object({
    localItems: z.array(ShoppingItemSchema).max(500),
  })
  .strict();

// =============================================================
// Phase 10.1b: ShoppingSet 同期用スキーマ
// =============================================================

export const ShoppingSetSchema = z
  .object({
    id: z.string().uuid(),
    /**
     * Phase 10.4 で追加。後方互換のため optional とし、未指定時はサーバー側で
     * 該当ユーザーの「未分類」リスト ID を補完する（dto.setToDTO は常に listId を含む）。
     */
    listId: z.string().uuid().optional(),
    name: z.string().min(1).max(50),
    items: z.array(z.string().min(1).max(50)).max(100),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const SetsSyncPullQuerySchema = z.object({
  since: z.string().datetime().optional(),
});

export const SetsSyncPushSchema = z
  .object({
    upserts: z.array(ShoppingSetSchema).max(200),
    deletedIds: z.array(z.string().uuid()).max(200),
    since: z.string().datetime().nullable(),
  })
  .strict();

export const SetsSyncMergeSchema = z
  .object({
    localSets: z.array(ShoppingSetSchema).max(200),
  })
  .strict();

// =============================================================
// Phase 10.2: ShoppingList 同期用スキーマ
// =============================================================

export const ShoppingListSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(20),
    emoji: z.string().nullable(),
    system: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const ListsSyncPullQuerySchema = z.object({
  since: z.string().datetime().optional(),
});

export const ListsSyncPushSchema = z
  .object({
    upserts: z.array(ShoppingListSchema).max(50),
    deletedIds: z.array(z.string().uuid()).max(50),
    since: z.string().datetime().nullable(),
  })
  .strict();

export const ListsSyncMergeSchema = z
  .object({
    localLists: z.array(ShoppingListSchema).max(50),
    localUnclassifiedId: z.string().uuid().nullable(),
  })
  .strict();
