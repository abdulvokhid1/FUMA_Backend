/*
  Warnings:

  - You are about to drop the column `resetTokenHash` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `resetTokenIp` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `resetTokenUsedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `resetTokenUserAgent` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "resetTokenHash",
DROP COLUMN "resetTokenIp",
DROP COLUMN "resetTokenUsedAt",
DROP COLUMN "resetTokenUserAgent";
