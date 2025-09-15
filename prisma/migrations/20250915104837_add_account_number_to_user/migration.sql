-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NONE';
