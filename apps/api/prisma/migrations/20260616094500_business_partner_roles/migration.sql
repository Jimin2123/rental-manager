-- CreateEnum
CREATE TYPE "BusinessPartnerRoleType" AS ENUM ('SALES', 'PURCHASE');

-- CreateTable
CREATE TABLE "BusinessPartnerRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessPartnerId" TEXT NOT NULL,
    "type" "BusinessPartnerRoleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPartnerRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPartnerRole_businessPartnerId_organizationId_type_key"
    ON "BusinessPartnerRole"("businessPartnerId", "organizationId", "type");
CREATE INDEX "BusinessPartnerRole_organizationId_idx" ON "BusinessPartnerRole"("organizationId");
CREATE INDEX "BusinessPartnerRole_organizationId_businessPartnerId_idx"
    ON "BusinessPartnerRole"("organizationId", "businessPartnerId");
CREATE INDEX "BusinessPartnerRole_organizationId_type_idx" ON "BusinessPartnerRole"("organizationId", "type");

-- AddForeignKey
ALTER TABLE "BusinessPartnerRole"
    ADD CONSTRAINT "BusinessPartnerRole_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessPartnerRole"
    ADD CONSTRAINT "BusinessPartnerRole_businessPartnerId_organizationId_fkey"
    FOREIGN KEY ("businessPartnerId", "organizationId")
    REFERENCES "BusinessPartner"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
