-- AlterTable: Asset에 매입처(BusinessPartner) 연결 필드 추가
ALTER TABLE "Asset" ADD COLUMN "supplierId" TEXT;

ALTER TABLE "Asset"
ADD CONSTRAINT "Asset_supplierId_organizationId_fkey"
FOREIGN KEY ("supplierId", "organizationId")
REFERENCES "BusinessPartner"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Asset_supplierId_idx" ON "Asset"("supplierId");
