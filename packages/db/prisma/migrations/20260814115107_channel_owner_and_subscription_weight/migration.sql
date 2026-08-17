/*
  Warnings:

  - You are about to drop the column `priorityOverride` on the `ChannelSubscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "ownerUserId" TEXT;

-- AlterTable
ALTER TABLE "ChannelSubscription" DROP COLUMN "priorityOverride",
ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 5;

-- CreateIndex
CREATE INDEX "Channel_ownerUserId_idx" ON "Channel"("ownerUserId");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
