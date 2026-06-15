-- DropForeignKey
ALTER TABLE "CustomerAssignment" DROP CONSTRAINT "CustomerAssignment_customerContactId_fkey";

-- AlterTable
ALTER TABLE "RentalContractItem" ADD COLUMN     "replacedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "visitLocationAddress" TEXT,
ADD COLUMN     "visitLocationAddressDetail" TEXT,
ADD COLUMN     "visitLocationZonecode" TEXT;

-- AlterTable
ALTER TABLE "ServiceVisit" ADD COLUMN     "laborCost" INTEGER,
ADD COLUMN     "partsCost" INTEGER,
ADD COLUMN     "travelCost" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPartnerContact_id_organizationId_key" ON "BusinessPartnerContact"("id", "organizationId");

-- CreateIndex
CREATE INDEX "RentalContractItem_organizationId_replacedAt_idx" ON "RentalContractItem"("organizationId", "replacedAt");

-- AddForeignKey
ALTER TABLE "CustomerAssignment" ADD CONSTRAINT "CustomerAssignment_customerContactId_organizationId_fkey" FOREIGN KEY ("customerContactId", "organizationId") REFERENCES "BusinessPartnerContact"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

