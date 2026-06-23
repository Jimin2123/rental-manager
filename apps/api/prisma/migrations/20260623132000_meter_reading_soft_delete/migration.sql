-- MeterReading 소프트 삭제 지원
ALTER TABLE "MeterReading" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "MeterReading_organizationId_deletedAt_idx" ON "MeterReading"("organizationId", "deletedAt");
