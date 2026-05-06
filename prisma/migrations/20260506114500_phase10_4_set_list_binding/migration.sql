-- Phase 10.4: ShoppingSet にリスト紐付け追加
-- 設計書: docs/features/20260506_phase10.4-set-list-binding.md §4-2

-- 1. ShoppingSet に listId を NULLABLE で追加
ALTER TABLE "ShoppingSet" ADD COLUMN "listId" TEXT;

-- 2. 既存セットを各ユーザーの未分類リストへ紐付け
UPDATE "ShoppingSet" s
SET "listId" = (
  SELECT l."id" FROM "ShoppingList" l WHERE l."userId" = s."userId" AND l."system" = TRUE LIMIT 1
);

-- 3. NOT NULL 制約 + 外部キー（ON DELETE Restrict: 先行 UPDATE → DELETE 失敗時の保護）
ALTER TABLE "ShoppingSet" ALTER COLUMN "listId" SET NOT NULL;
CREATE INDEX "ShoppingSet_userId_listId_idx" ON "ShoppingSet"("userId", "listId");
ALTER TABLE "ShoppingSet" ADD CONSTRAINT "ShoppingSet_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ShoppingList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
