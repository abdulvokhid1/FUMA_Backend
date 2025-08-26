-- DropForeignKey
ALTER TABLE "PaymentSubmission" DROP CONSTRAINT "PaymentSubmission_reviewedById_fkey";

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
