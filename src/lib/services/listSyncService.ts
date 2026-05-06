import type { Prisma, ShoppingList as PrismaShoppingList } from "@prisma/client";
import {
  SYSTEM_LIST_EMOJI,
  SYSTEM_LIST_NAME,
} from "@/features/shopping/types";

/**
 * 各ユーザーごとに「未分類」リストを必ず 1 件だけ返す。
 *
 * partial unique index `WHERE "system" = TRUE` と `INSERT ... ON CONFLICT DO NOTHING`
 * により、同時呼び出しでも常に 1 件保証 + 例外なし。
 *
 * 必ず Prisma transaction client (`tx`) 内で呼ぶこと。
 */
export async function ensureUnclassifiedList(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<PrismaShoppingList> {
  const id = crypto.randomUUID();
  const now = new Date();
  await tx.$executeRaw`
    INSERT INTO "ShoppingList" ("id", "userId", "name", "emoji", "system", "createdAt", "updatedAt")
    VALUES (${id}, ${userId}, ${SYSTEM_LIST_NAME}, ${SYSTEM_LIST_EMOJI}, TRUE, ${now}, ${now})
    ON CONFLICT ("userId") WHERE "system" = TRUE DO NOTHING
  `;
  return tx.shoppingList.findFirstOrThrow({
    where: { userId, system: true },
  });
}
