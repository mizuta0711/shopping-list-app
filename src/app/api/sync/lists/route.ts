import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  requireSession,
} from "@/lib/api/sync-helpers";
import {
  ListsSyncPullQuerySchema,
  ListsSyncPushSchema,
} from "@/lib/api/sync-schemas";
import { listToDTO } from "@/lib/api/dto";
import type {
  ApiSuccess,
  ListsSyncPullResponse,
  ListsSyncPushResponse,
  ShoppingListDTO,
} from "@/types/sync";
import { ensureUnclassifiedList } from "@/lib/services/listSyncService";

async function getLastUpdatedAt(userId: string): Promise<string | null> {
  const [lastList, lastTombstone] = await Promise.all([
    prisma.shoppingList.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.shoppingListDeletionTombstone.findFirst({
      where: { userId },
      orderBy: { deletedAt: "desc" },
      select: { deletedAt: true },
    }),
  ]);

  const candidates: number[] = [];
  if (lastList) candidates.push(lastList.updatedAt.getTime());
  if (lastTombstone) candidates.push(lastTombstone.deletedAt.getTime());
  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates)).toISOString();
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.error) return session.error;
    const { userId } = session;

    const sinceParam = req.nextUrl.searchParams.get("since") ?? undefined;
    const parsed = ListsSyncPullQuerySchema.safeParse({ since: sinceParam });
    if (!parsed.success) return badRequest("不正なクエリパラメータ");
    const { since } = parsed.data;
    const sinceDate = since ? new Date(since) : undefined;

    // GET ではサイドエフェクトなし（未分類保証は migration.sql + merge route が担当）
    const [lists, deletes] = await Promise.all([
      prisma.shoppingList.findMany({
        where: {
          userId,
          ...(sinceDate ? { updatedAt: { gt: sinceDate } } : {}),
        },
      }),
      sinceDate
        ? prisma.shoppingListDeletionTombstone.findMany({
            where: { userId, deletedAt: { gt: sinceDate } },
            select: { listId: true },
          })
        : Promise.resolve([] as { listId: string }[]),
    ]);

    const lastUpdatedAt = await getLastUpdatedAt(userId);

    const body: ApiSuccess<ListsSyncPullResponse> = {
      success: true,
      data: {
        lists: lists.map(listToDTO),
        serverDeletes: deletes.map((d) => d.listId),
        serverTime: new Date().toISOString(),
        lastUpdatedAt,
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[GET /api/sync/lists]", e);
    return internalError();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.error) return session.error;
    const { userId } = session;

    const json = await req.json().catch(() => null);
    if (json === null) return badRequest("JSON のパースに失敗しました");

    const parsed = ListsSyncPushSchema.safeParse(json);
    if (!parsed.success) return badRequest("不正なリクエスト");
    const { upserts, deletedIds, since } = parsed.data;
    const sinceDate = since ? new Date(since) : null;

    const result = await prisma.$transaction(async (tx) => {
      const applied: ShoppingListDTO[] = [];
      const rejected: ListsSyncPushResponse["rejected"] = [];

      // 削除処理: 所属アイテムを未分類へ移動 → リスト本体削除 → tombstone
      if (deletedIds.length > 0) {
        const unclassified = await ensureUnclassifiedList(tx, userId);
        for (const id of deletedIds) {
          const list = await tx.shoppingList.findUnique({ where: { id } });
          if (!list || list.userId !== userId) continue;
          if (list.system) {
            rejected.push({
              id,
              reason: "SYSTEM_PROTECTED",
              serverList: listToDTO(list),
            });
            continue;
          }
          // 1. 当該リスト所属アイテムを未分類へ
          await tx.shoppingItem.updateMany({
            where: { userId, listId: id },
            data: { listId: unclassified.id, updatedAt: new Date() },
          });
          // 2. リスト本体削除
          await tx.shoppingList.delete({ where: { id } });
          // 3. tombstone 発行
          const now = new Date();
          await tx.shoppingListDeletionTombstone.upsert({
            where: { userId_listId: { userId, listId: id } },
            create: { userId, listId: id, deletedAt: now },
            update: { deletedAt: now },
          });
        }
      }

      // upsert 処理: system: true は無視 / userId 所有権チェック / LWW
      for (const input of upserts) {
        if (input.system) continue; // クライアントから system list 作成は不可
        const existing = await tx.shoppingList.findUnique({
          where: { id: input.id },
        });
        if (existing && existing.userId !== userId) continue;
        if (existing && existing.system) {
          rejected.push({
            id: input.id,
            reason: "SYSTEM_PROTECTED",
            serverList: listToDTO(existing),
          });
          continue;
        }
        const inputUpdatedAt = new Date(input.updatedAt).getTime();
        if (existing && existing.updatedAt.getTime() >= inputUpdatedAt) {
          rejected.push({
            id: input.id,
            reason: "SERVER_NEWER",
            serverList: listToDTO(existing),
          });
          continue;
        }
        const upserted = await tx.shoppingList.upsert({
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
        applied.push(listToDTO(upserted));
      }

      const excludedIds = [...upserts.map((u) => u.id), ...deletedIds];

      const serverChanges = sinceDate
        ? await tx.shoppingList.findMany({
            where: {
              userId,
              updatedAt: { gt: sinceDate },
              ...(excludedIds.length > 0
                ? { NOT: { id: { in: excludedIds } } }
                : {}),
            },
          })
        : [];

      const serverDeletes = sinceDate
        ? await tx.shoppingListDeletionTombstone.findMany({
            where: {
              userId,
              deletedAt: { gt: sinceDate },
              ...(deletedIds.length > 0
                ? { NOT: { listId: { in: deletedIds } } }
                : {}),
            },
            select: { listId: true },
          })
        : [];

      return {
        applied,
        rejected,
        serverChanges: serverChanges.map(listToDTO),
        serverDeletes: serverDeletes.map((d) => d.listId),
      };
    });

    const lastUpdatedAt = await getLastUpdatedAt(userId);

    const body: ApiSuccess<ListsSyncPushResponse> = {
      success: true,
      data: {
        ...result,
        serverTime: new Date().toISOString(),
        lastUpdatedAt,
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[PUT /api/sync/lists]", e);
    return internalError();
  }
}
