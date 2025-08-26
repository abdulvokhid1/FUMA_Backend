/*
  Warnings:

  - You are about to drop the column `targetId` on the `AdminLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AdminLog" DROP COLUMN "targetId",
ADD COLUMN     "submissionId" INTEGER,
ADD COLUMN     "targetUserId" INTEGER;
