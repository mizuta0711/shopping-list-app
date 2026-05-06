import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  requireSession,
} from "@/lib/api/sync-helpers";
import {
  SetsSyncPullQuerySchema,
  SetsSyncPushSchema,
} from "@/lib/api/sync-schemas";
import { setToDTO } from "@/lib/api/dto";
import type {
  ApiSuccess,
  SetsSyncPullResponse,
  SetsSyncPushResponse,
  ShoppingSetDTO,
} from "@/types/sync";

async function getLastUpdatedAt(userId: string): Promise<string | null> {
  const [lastSet, lastTombstone] = await Promise.all([
    prisma.shoppingSet.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.setDeletionTombstone.findFirst({
      where: { userId },
      orderBy: { deletedAt: "desc" },
      select: { deletedAt: true },
    }),
  ]);

  const candidates: number[] = [];
  if (lastSet) candidates.push(lastSet.updatedAt.getTime());
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
    const parsed = SetsSyncPullQuerySchema.safeParse({ since: sinceParam });
    if (!parsed.success) {
      return badRequest("不正なクエリパラメータ");
    }
    const { since } = parsed.data;
    const sinceDate = since ? new Date(since) : undefined;

    const [sets, deletes] = await Promise.all([
      prisma.shoppingSet.findMany({
        where: {
          userId,
          ...(sinceDate ? { updatedAt: { gt: sinceDate } } : {}),
        },
      }),
      sinceDate
        ? prisma.setDeletionTombstone.findMany({
            where: { userId, deletedAt: { gt: sinceDate } },
            select: { setId: true },
          })
        : Promise.resolve([] as { setId: string }[]),
    ]);

    const lastUpdatedAt = await getLastUpdatedAt(userId);

    const body: ApiSuccess<SetsSyncPullResponse> = {
      success: true,
      data: {
        sets: sets.map(setToDTO),
        serverDeletes: deletes.map((d) => d.setId),
        serverTime: new Date().toISOString(),
        lastUpdatedAt,
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[GET /api/sync/sets]", e);
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

    const parsed = SetsSyncPushSchema.safeParse(json);
    if (!parsed.success) {
      return badRequest("不正なリクエスト");
    }
    const { upserts, deletedIds, since } = parsed.data;
    const sinceDate = since ? new Date(since) : null;

    // 未分類リスト ID を取得（listId 未指定/不正セットの補完用）
    const unclassifiedList = await prisma.shoppingList.findFirst({
      where: { userId, system: true },
      select: { id: true },
    });
    if (!unclassifiedList) {
      return badRequest(
        "未分類リストが見つかりません。先に POST /api/sync/lists/merge を実行してください",
      );
    }
    const unclassifiedId = unclassifiedList.id;

    const result = await prisma.$transaction(async (tx) => {
      const applied: ShoppingSetDTO[] = [];
      const rejected: SetsSyncPushResponse["rejected"] = [];

      // ユーザーが所有するリスト ID のホワイトリストを構築（不正 listId の防御）
      const userListIds = new Set(
        (
          await tx.shoppingList.findMany({
            where: { userId },
            select: { id: true },
          })
        ).map((l) => l.id),
      );

      for (const input of upserts) {
        const existing = await tx.shoppingSet.findUnique({
          where: { id: input.id },
        });
        if (existing && existing.userId !== userId) continue;

        const inputUpdatedAt = new Date(input.updatedAt).getTime();
        if (existing && existing.updatedAt.getTime() >= inputUpdatedAt) {
          rejected.push({
            id: input.id,
            reason: "SERVER_NEWER",
            serverSet: setToDTO(existing),
          });
          continue;
        }

        const resolvedListId =
          input.listId && userListIds.has(input.listId)
            ? input.listId
            : (existing?.listId ?? unclassifiedId);
        const data = {
          name: input.name,
          items: input.items,
          listId: resolvedListId,
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.updatedAt),
          userId,
        };
        const upserted = await tx.shoppingSet.upsert({
          where: { id: input.id },
          create: { id: input.id, ...data },
          update: data,
        });
        applied.push(setToDTO(upserted));
      }

      if (deletedIds.length > 0) {
        await tx.shoppingSet.deleteMany({
          where: { userId, id: { in: deletedIds } },
        });
        const now = new Date();
        for (const id of deletedIds) {
          await tx.setDeletionTombstone.upsert({
            where: { userId_setId: { userId, setId: id } },
            create: { userId, setId: id, deletedAt: now },
            update: { deletedAt: now },
          });
        }
      }

      const excludedIds = [...upserts.map((u) => u.id), ...deletedIds];

      const serverChanges = sinceDate
        ? await tx.shoppingSet.findMany({
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
        ? await tx.setDeletionTombstone.findMany({
            where: {
              userId,
              deletedAt: { gt: sinceDate },
              ...(deletedIds.length > 0
                ? { NOT: { setId: { in: deletedIds } } }
                : {}),
            },
            select: { setId: true },
          })
        : [];

      return {
        applied,
        rejected,
        serverChanges: serverChanges.map(setToDTO),
        serverDeletes: serverDeletes.map((d) => d.setId),
      };
    });

    const lastUpdatedAt = await getLastUpdatedAt(userId);

    const body: ApiSuccess<SetsSyncPushResponse> = {
      success: true,
      data: {
        ...result,
        serverTime: new Date().toISOString(),
        lastUpdatedAt,
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[PUT /api/sync/sets]", e);
    return internalError();
  }
}
