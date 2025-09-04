-- CreateTable
CREATE TABLE "UserPlanGrant" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "plan" "MembershipPlan" NOT NULL,
    "label" TEXT NOT NULL,
    "featuresSnapshot" JSONB NOT NULL,
    "priceSnapshot" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedById" INTEGER,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,

    CONSTRAINT "UserPlanGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPlanGrant_userId_expiresAt_idx" ON "UserPlanGrant"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "UserPlanGrant_expiresAt_idx" ON "UserPlanGrant"("expiresAt");

-- AddForeignKey
ALTER TABLE "UserPlanGrant" ADD CONSTRAINT "UserPlanGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
