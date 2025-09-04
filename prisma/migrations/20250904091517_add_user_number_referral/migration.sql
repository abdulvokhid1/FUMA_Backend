/*
  Warnings:

  - You are about to drop the column `planCreatedAt` on the `PaymentSubmission` table. All the data in the column will be lost.
  - You are about to drop the column `planCreatedAt` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userNumber` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PaymentSubmission" DROP COLUMN "planCreatedAt";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "planCreatedAt",
ADD COLUMN     "referredBy" INTEGER,
ADD COLUMN     "userNumber" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_userNumber_key" ON "User"("userNumber");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredBy_fkey" FOREIGN KEY ("referredBy") REFERENCES "User"("userNumber") ON DELETE SET NULL ON UPDATE CASCADE;
