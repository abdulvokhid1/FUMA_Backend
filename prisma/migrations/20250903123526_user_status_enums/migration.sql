/*
  Warnings:

  - You are about to drop the column `isApproved` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isPayed` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "isApproved",
DROP COLUMN "isPayed",
ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NONE';
