/*
  Warnings:

  - You are about to drop the column `referredBy` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_referredBy_fkey";

-- DropForeignKey
ALTER TABLE "UserPlanGrant" DROP CONSTRAINT "UserPlanGrant_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "referredBy",
ALTER COLUMN "userNumber" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "UserPlanGrant" ADD CONSTRAINT "UserPlanGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
