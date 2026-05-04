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
