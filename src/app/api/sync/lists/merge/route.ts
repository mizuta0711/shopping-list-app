import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  requireSession,
} from "@/lib/api/sync-helpers";
import { ListsSyncMergeSchema } from "@/lib/api/sync-schemas";
import { listToDTO } from "@/lib/api/dto";
import type { ApiSuccess, ListsSyncMergeResponse } from "@/types/sync";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.error) return session.error;
    const { userId } = session;

    const json = await req.json().catch(() => null);
    if (json === null) return badRequest("JSON のパースに失敗しました");

    const parsed = ListsSyncMergeSchema.safeParse(json);
    if (!parsed.success) return badRequest("不正なリクエスト");
    const { localLists, localUnclassifiedId } = parsed.data;

    const preTxExisting = await prisma.shoppingList.findMany({
      where: { userId },
      select: { id: true },
    });
    const preTxExistingIds = new Set(preTxExisting.map((e) => e.id));

    const txResult = await prisma.$transaction(async (tx) => {
      // 1. サーバー側の正本となる「未分類」を取得 / なければ作成
      let unclassified = await tx.shoppingList.findFirst({
        where: { userId, system: true },
        orderBy: { createdAt: "asc" },
      });
      const remappedUnclassifiedIds: string[] = [];

      if (!unclassified) {
        // クライアント側の未分類を採用するか、新規作成する
        const localUL = localLists.find(
          (l) => l.system && l.id === localUnclassifiedId,
        );
        if (localUL) {
          unclassified = await tx.shoppingList.create({
            data: {
              id: localUL.id,
              userId,
              name: localUL.name,
              emoji: localUL.emoji,
              system: true,
              createdAt: new Date(localUL.createdAt),
              updatedAt: new Date(localUL.updatedAt),
            },
          });
        } else {
          const now = new Date();
          unclassified = await tx.shoppingList.create({
            data: {
              id: crypto.randomUUID(),
              userId,
              name: "未分類",
              emoji: "🗂️",
              system: true,
              createdAt: now,
              updatedAt: now,
            },
          });
        }
      }

      // 2. ローカル側の未分類 ID とサーバーの未分類 ID が異なる → remap
      if (
        localUnclassifiedId &&
        localUnclassifiedId !== unclassified.id
      ) {
        remappedUnclassifiedIds.push(localUnclassifiedId);
      }
      // ローカルの全 system: true な list (重複) もすべて remap 対象
      for (const l of localLists) {
        if (
          l.system &&
          l.id !== unclassified.id &&
          !remappedUnclassifiedIds.includes(l.id)
        ) {
          remappedUnclassifiedIds.push(l.id);
        }
      }

      // 3. 非 system の local lists を LWW upsert
      for (const input of localLists) {
        if (input.system) continue;
        const existing = await tx.shoppingList.findUnique({
          where: { id: input.id },
        });
        if (existing && existing.userId !== userId) continue;
        if (existing && existing.system) continue;

        const inputUpdatedAtMs = new Date(input.updatedAt).getTime();
        if (
          existing &&
          existing.updatedAt.getTime() >= inputUpdatedAtMs
        ) {
          continue;
        }
        await tx.shoppingList.upsert({
          where: { id: input.id },
          create: {
            id: input.id,
            userId,
            name: input.name,
            emoji: input.emoji,
            system: false,
            createdAt: new Date(input.createdAt),
            updatedAt: new Date(input.updatedAt),
          },
          update: {
            name: input.name,
            emoji: input.emoji,
            updatedAt: new Date(input.updatedAt),
          },
        });
      }

      const finalLists = await tx.shoppingList.findMany({ where: { userId } });
      return { finalLists, unclassified, remappedUnclassifiedIds };
    });

    const { finalLists, unclassified, remappedUnclassifiedIds } = txResult;

    const localIds = new Set(localLists.map((l) => l.id));
    const uploadedCount = localLists.filter(
      (l) => !preTxExistingIds.has(l.id) && !l.system,
    ).length;
    const downloadedCount = finalLists.filter(
      (f) => !localIds.has(f.id),
    ).length;

    const lastUpdatedAtMs =
      finalLists.length > 0
        ? Math.max(...finalLists.map((f) => f.updatedAt.getTime()))
        : null;

    const body: ApiSuccess<ListsSyncMergeResponse> = {
      success: true,
      data: {
        finalLists: finalLists.map(listToDTO),
        unclassifiedId: unclassified.id,
        remappedUnclassifiedIds,
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
    console.error("[POST /api/sync/lists/merge]", e);
    return internalError();
  }
}
