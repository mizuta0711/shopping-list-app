-- Phase 10.2: 店舗別リスト機能のスキーマ追加 (Stage 2 §4-2-2)
-- 設計書: docs/features/20260505_phase10.2-stores.md

-- 1. ShoppingList テーブル作成
CREATE TABLE "ShoppingList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingList_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShoppingList_userId_updatedAt_idx" ON "ShoppingList"("userId", "updatedAt");
CREATE INDEX "ShoppingList_userId_system_idx" ON "ShoppingList"("userId", "system");

-- 各ユーザーごとに system: true は 1 件のみ（partial unique index）
CREATE UNIQUE INDEX "ShoppingList_userId_system_unique" ON "ShoppingList"("userId") WHERE "system" = TRUE;

ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. 既存ユーザー全員に「未分類」リストを作成（マイグレーション時の初期化）
INSERT INTO "ShoppingList" ("id", "userId", "name", "emoji", "system", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", '未分類', '🗂️', TRUE, NOW(), NOW() FROM "User";

-- 3. ShoppingItem に listId を NULLABLE で追加
ALTER TABLE "ShoppingItem" ADD COLUMN "listId" TEXT;

-- 4. 既存アイテムを各ユーザーの未分類リストへ紐付け
UPDATE "ShoppingItem" i
SET "listId" = (
  SELECT l."id" FROM "ShoppingList" l WHERE l."userId" = i."userId" AND l."system" = TRUE LIMIT 1
);

-- 5. NOT NULL 制約 + 外部キー
ALTER TABLE "ShoppingItem" ALTER COLUMN "listId" SET NOT NULL;
CREATE INDEX "ShoppingItem_userId_listId_scope_status_idx" ON "ShoppingItem"("userId", "listId", "scope", "status");
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ShoppingList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. ShoppingListDeletionTombstone テーブル
CREATE TABLE "ShoppingListDeletionTombstone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoppingListDeletionTombstone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShoppingListDeletionTombstone_userId_deletedAt_idx" ON "ShoppingListDeletionTombstone"("userId", "deletedAt");
CREATE UNIQUE INDEX "ShoppingListDeletionTombstone_userId_listId_key" ON "ShoppingListDeletionTombstone"("userId", "listId");

ALTER TABLE "ShoppingListDeletionTombstone" ADD CONSTRAINT "ShoppingListDeletionTombstone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
