-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PENDING', 'TIER1', 'TIER2', 'TIER3', 'VIP');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessExpiresAt" TIMESTAMP(3),
ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentProofUrl" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3);
