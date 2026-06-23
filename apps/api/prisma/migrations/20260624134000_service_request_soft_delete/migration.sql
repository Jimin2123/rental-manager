-- ServiceRequest 소프트 삭제 지원
ALTER TABLE "ServiceRequest" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "ServiceRequest_organizationId_deletedAt_idx" ON "ServiceRequest"("organizationId", "deletedAt");
