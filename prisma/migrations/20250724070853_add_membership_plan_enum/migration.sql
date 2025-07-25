/*
  Warnings:

  - You are about to drop the column `level` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `paymentProof` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MembershipPlan" AS ENUM ('LEVEL1', 'LEVEL2', 'LEVEL3', 'LEVEL4', 'VIP');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "level",
DROP COLUMN "paymentProof",
ADD COLUMN     "paymentProofUrl" TEXT,
ADD COLUMN     "plan" "MembershipPlan",
ADD COLUMN     "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- DropEnum
DROP TYPE "UserRole";
