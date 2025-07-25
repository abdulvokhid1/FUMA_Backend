/*
  Warnings:

  - You are about to drop the column `accessExpiresAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isApproved` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `paymentProofUrl` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "accessExpiresAt",
DROP COLUMN "isApproved",
DROP COLUMN "paymentProofUrl",
ALTER COLUMN "role" SET DEFAULT 'TIER1';
