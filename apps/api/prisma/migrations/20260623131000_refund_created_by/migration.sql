-- AlterTable: Refund에 createdById 감사 추적 필드 추가
ALTER TABLE "Refund" ADD COLUMN "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_createdById_organizationId_fkey"
  FOREIGN KEY ("createdById", "organizationId")
  REFERENCES "OrganizationMember"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Refund_organizationId_createdById_idx" ON "Refund"("organizationId", "createdById");
