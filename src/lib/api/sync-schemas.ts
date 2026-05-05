import { z } from "zod";

// userId は意図的にスキーマから除外する。
// strict() により余分なフィールド（userId 等）を含む payload は 400 で拒否される。
// サーバー側 upsert 時は { ...input, userId: session.user.id } で必ず上書きする。
export const ShoppingItemSchema = z
  .object({
    id: z.string().uuid(),
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
