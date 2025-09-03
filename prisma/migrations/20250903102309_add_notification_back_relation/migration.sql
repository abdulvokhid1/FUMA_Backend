-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetTokenHash" VARCHAR(64),
ADD COLUMN     "resetTokenIp" VARCHAR(45),
ADD COLUMN     "resetTokenUsedAt" TIMESTAMP(3),
ADD COLUMN     "resetTokenUserAgent" TEXT;
