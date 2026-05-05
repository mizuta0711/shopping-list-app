-- CreateTable
CREATE TABLE "ShoppingSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetDeletionTombstone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetDeletionTombstone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShoppingSet_userId_updatedAt_idx" ON "ShoppingSet"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "SetDeletionTombstone_userId_deletedAt_idx" ON "SetDeletionTombstone"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SetDeletionTombstone_userId_setId_key" ON "SetDeletionTombstone"("userId", "setId");

-- AddForeignKey
ALTER TABLE "ShoppingSet" ADD CONSTRAINT "ShoppingSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetDeletionTombstone" ADD CONSTRAINT "SetDeletionTombstone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
