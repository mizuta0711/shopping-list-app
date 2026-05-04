import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  badRequest,
  internalError,
  requireSession,
} from "@/lib/api/sync-helpers";
import {
  SyncPullQuerySchema,
  SyncPushSchema,
} from "@/lib/api/sync-schemas";
import { toDTO } from "@/lib/api/dto";
import type {
  ApiSuccess,
  ShoppingItemDTO,
  SyncPullResponse,
  SyncPushResponse,
} from "@/types/sync";

async function getLastUpdatedAt(userId: string): Promise<string | null> {
  const [lastItem, lastTombstone] = await Promise.all([
    prisma.shoppingItem.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.deletionTombstone.findFirst({
      where: { userId },
      orderBy: { deletedAt: "desc" },
      select: { deletedAt: true },
    }),
  ]);

  const candidates: number[] = [];
  if (lastItem) candidates.push(lastItem.updatedAt.getTime());
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
    const parsed = SyncPullQuerySchema.safeParse({ since: sinceParam });
    if (!parsed.success) {
      return badRequest("不正なクエリパラメータ");
    }
    const { since } = parsed.data;
    const sinceDate = since ? new Date(since) : undefined;

    const [items, deletes] = await Promise.all([
      prisma.shoppingItem.findMany({
        where: {
          userId,
          ...(sinceDate ? { updatedAt: { gt: sinceDate } } : {}),
        },
      }),
      sinceDate
        ? prisma.deletionTombstone.findMany({
            where: { userId, deletedAt: { gt: sinceDate } },
            select: { itemId: true },
          })
        : Promise.resolve([] as { itemId: string }[]),
    ]);

    const lastUpdatedAt = await getLastUpdatedAt(userId);

    const body: ApiSuccess<SyncPullResponse> = {
      success: true,
      data: {
        items: items.map(toDTO),
        serverDeletes: deletes.map((d) => d.itemId),
        serverTime: new Date().toISOString(),
        lastUpdatedAt,
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[GET /api/sync/items]", e);
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

    const parsed = SyncPushSchema.safeParse(json);
    if (!parsed.success) {
      return badRequest("不正なリクエスト");
    }
    const { upserts, deletedIds, since } = parsed.data;
    const sinceDate = since ? new Date(since) : null;

    const result = await prisma.$transaction(async (tx) => {
      const applied: ShoppingItemDTO[] = [];
      const rejected: SyncPushResponse["rejected"] = [];

      for (const input of upserts) {
        const existing = await tx.shoppingItem.findUnique({
          where: { id: input.id },
        });
        // 別ユーザー所有の id は黙って無視（攻撃 or バグの防御）
        if (existing && existing.userId !== userId) continue;

        const inputUpdatedAt = new Date(input.updatedAt).getTime();
        if (existing && existing.updatedAt.getTime() >= inputUpdatedAt) {
          // LWW: サーバー側が新しいか同値ならスキップ（同値時もサーバー優先で冪等性確保）
          rejected.push({
            id: input.id,
            reason: "SERVER_NEWER",
            serverItem: toDTO(existing),
          });
          continue;
        }

        const data = {
          name: input.name,
          scope: input.scope,
          status: input.status,
          order: input.order,
          createdAt: new Date(input.createdAt),
          updatedAt: new Date(input.updatedAt),
          purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : null,
          userId,
        };
        const upserted = await tx.shoppingItem.upsert({
          where: { id: input.id },
          create: { id: input.id, ...data },
          update: data,
        });
        applied.push(toDTO(upserted));
      }

      if (deletedIds.length > 0) {
        await tx.shoppingItem.deleteMany({
          where: { userId, id: { in: deletedIds } },
        });
        const now = new Date();
        for (const id of deletedIds) {
          await tx.deletionTombstone.upsert({
            where: { userId_itemId: { userId, itemId: id } },
            create: { userId, itemId: id, deletedAt: now },
            update: { deletedAt: now },
          });
        }
      }

      const excludedIds = [...upserts.map((u) => u.id), ...deletedIds];

      const serverChanges = sinceDate
        ? await tx.shoppingItem.findMany({
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
        ? await tx.deletionTombstone.findMany({
            where: {
              userId,
              deletedAt: { gt: sinceDate },
              ...(deletedIds.length > 0
                ? { NOT: { itemId: { in: deletedIds } } }
                : {}),
            },
            select: { itemId: true },
          })
        : [];

      return {
        applied,
        rejected,
        serverChanges: serverChanges.map(toDTO),
        serverDeletes: serverDeletes.map((d) => d.itemId),
      };
    });

    const lastUpdatedAt = await getLastUpdatedAt(userId);

    const body: ApiSuccess<SyncPushResponse> = {
      success: true,
      data: {
        ...result,
        serverTime: new Date().toISOString(),
        lastUpdatedAt,
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[PUT /api/sync/items]", e);
    return internalError();
  }
}
