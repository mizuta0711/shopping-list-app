import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  requireSession,
} from "@/lib/api/sync-helpers";
import { SyncMergeSchema } from "@/lib/api/sync-schemas";
import { toDTO } from "@/lib/api/dto";
import type { ApiSuccess, SyncMergeResponse } from "@/types/sync";
import { ensureUnclassifiedList } from "@/lib/services/listSyncService";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.error) return session.error;
    const { userId } = session;

    const json = await req.json().catch(() => null);
    if (json === null) return badRequest("JSON のパースに失敗しました");

    const parsed = SyncMergeSchema.safeParse(json);
    if (!parsed.success) return badRequest("不正なリクエスト");
    const { localItems } = parsed.data;

    // tx 開始前のスナップショット（uploadedCount 計算専用、stale を許容）
    const preTxExisting = await prisma.shoppingItem.findMany({
      where: { userId },
      select: { id: true },
    });
    const preTxExistingIds = new Set(preTxExisting.map((e) => e.id));

    const finalItems = await prisma.$transaction(async (tx) => {
      // listId 補完: 未指定または不正な listId は未分類で受け入れる
      const unclassified = await ensureUnclassifiedList(tx, userId);
      const userListIds = new Set(
        (
          await tx.shoppingList.findMany({
            where: { userId },
            select: { id: true },
          })
        ).map((l) => l.id),
      );

      // tx 内で改めて取得して LWW 判定の正確性を確保
      const inputIds = localItems.map((l) => l.id);
      const txExisting =
        inputIds.length > 0
          ? await tx.shoppingItem.findMany({
              where: { userId, id: { in: inputIds } },
              select: { id: true, updatedAt: true },
            })
          : [];
      const txExistingMap = new Map(
        txExisting.map((e) => [e.id, e.updatedAt.getTime()] as const),
      );

      for (const input of localItems) {
        const existingUpdatedAtMs = txExistingMap.get(input.id);
        const inputUpdatedAtMs = new Date(input.updatedAt).getTime();
        if (
          existingUpdatedAtMs !== undefined &&
          existingUpdatedAtMs >= inputUpdatedAtMs
        ) {
          continue;
        }
        const listId =
          input.listId && userListIds.has(input.listId)
            ? input.listId
            : unclassified.id;
        const data = {
          listId,
          name: input.name,
          scope: input.scope,
          status: input.status,
          order: input.order,
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.updatedAt),
          purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : null,
          userId,
        };
        await tx.shoppingItem.upsert({
          where: { id: input.id },
          create: { id: input.id, ...data },
          update: data,
        });
      }

      return tx.shoppingItem.findMany({ where: { userId } });
    });

    const localIds = new Set(localItems.map((l) => l.id));
    const uploadedCount = localItems.filter(
      (l) => !preTxExistingIds.has(l.id),
    ).length;
    const downloadedCount = finalItems.filter(
      (f) => !localIds.has(f.id),
    ).length;

    const lastUpdatedAtMs =
      finalItems.length > 0
        ? Math.max(...finalItems.map((f) => f.updatedAt.getTime()))
        : null;

    const body: ApiSuccess<SyncMergeResponse> = {
      success: true,
      data: {
        finalItems: finalItems.map(toDTO),
        uploadedCount,
        downloadedCount,
        serverTime: new Date().toISOString(),
        lastUpdatedAt:
          lastUpdatedAtMs !== null
            ? new Date(lastUpdatedAtMs).toISOString()
            : null,
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[POST /api/sync/merge]", e);
    return internalError();
  }
}
