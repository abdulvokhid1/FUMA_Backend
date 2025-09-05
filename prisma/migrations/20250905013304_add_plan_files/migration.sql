-- AlterTable
ALTER TABLE "MembershipPlanMeta" ADD COLUMN     "fileAName" TEXT,
ADD COLUMN     "fileAPath" TEXT,
ADD COLUMN     "fileAUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "fileBName" TEXT,
ADD COLUMN     "fileBPath" TEXT,
ADD COLUMN     "fileBUpdatedAt" TIMESTAMP(3);
