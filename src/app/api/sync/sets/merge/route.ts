import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  requireSession,
} from "@/lib/api/sync-helpers";
import { SetsSyncMergeSchema } from "@/lib/api/sync-schemas";
import { setToDTO } from "@/lib/api/dto";
import type { ApiSuccess, SetsSyncMergeResponse } from "@/types/sync";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.error) return session.error;
    const { userId } = session;

    const json = await req.json().catch(() => null);
    if (json === null) return badRequest("JSON のパースに失敗しました");

    const parsed = SetsSyncMergeSchema.safeParse(json);
    if (!parsed.success) return badRequest("不正なリクエスト");
    const { localSets } = parsed.data;

    // tx 開始前のスナップショット（uploadedCount 計算専用）
    const preTxExisting = await prisma.shoppingSet.findMany({
      where: { userId },
      select: { id: true },
    });
    const preTxExistingIds = new Set(preTxExisting.map((e) => e.id));

    const finalSets = await prisma.$transaction(async (tx) => {
      const inputIds = localSets.map((l) => l.id);
      const txExisting =
        inputIds.length > 0
          ? await tx.shoppingSet.findMany({
              where: { userId, id: { in: inputIds } },
              select: { id: true, updatedAt: true },
            })
          : [];
      const txExistingMap = new Map(
        txExisting.map((e) => [e.id, e.updatedAt.getTime()] as const),
      );

      for (const input of localSets) {
        const existingUpdatedAtMs = txExistingMap.get(input.id);
        const inputUpdatedAtMs = new Date(input.updatedAt).getTime();
        if (
          existingUpdatedAtMs !== undefined &&
          existingUpdatedAtMs >= inputUpdatedAtMs
        ) {
          continue;
        }
        const data = {
          name: input.name,
          items: input.items,
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.updatedAt),
          userId,
        };
        await tx.shoppingSet.upsert({
          where: { id: input.id },
          create: { id: input.id, ...data },
          update: data,
        });
      }

      return tx.shoppingSet.findMany({ where: { userId } });
    });

    const localIds = new Set(localSets.map((l) => l.id));
    const uploadedCount = localSets.filter(
      (l) => !preTxExistingIds.has(l.id),
    ).length;
    const downloadedCount = finalSets.filter(
      (f) => !localIds.has(f.id),
    ).length;

    const lastUpdatedAtMs =
      finalSets.length > 0
        ? Math.max(...finalSets.map((f) => f.updatedAt.getTime()))
        : null;

    const body: ApiSuccess<SetsSyncMergeResponse> = {
      success: true,
      data: {
        finalSets: finalSets.map(setToDTO),
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
    console.error("[POST /api/sync/sets/merge]", e);
    return internalError();
  }
}
