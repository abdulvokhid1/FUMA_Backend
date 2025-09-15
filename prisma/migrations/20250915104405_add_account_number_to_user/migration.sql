/*
  Warnings:

  - You are about to drop the column `isApproved` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `isPayed` on the `Notification` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[accountNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "isApproved",
DROP COLUMN "isPayed";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_accountNumber_key" ON "User"("accountNumber");
