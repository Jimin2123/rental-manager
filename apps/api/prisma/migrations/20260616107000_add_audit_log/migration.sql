-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'STATUS_CHANGE', 'CANCEL');

-- DropForeignKey
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_taxInvoiceId_fkey";

-- DropForeignKey
ALTER TABLE "RentalContractItem" DROP CONSTRAINT "RentalContractItem_replacedByItemId_fkey";

-- DropForeignKey
ALTER TABLE "TaxInvoice" DROP CONSTRAINT "TaxInvoice_originalTaxInvoiceId_fkey";

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_targetType_targetId_idx" ON "AuditLog"("organizationId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_actorId_idx" ON "AuditLog"("organizationId", "actorId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_action_idx" ON "AuditLog"("organizationId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_organizationId_fkey" FOREIGN KEY ("actorId", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_taxInvoiceId_organizationId_fkey" FOREIGN KEY ("taxInvoiceId", "organizationId") REFERENCES "TaxInvoice"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_originalTaxInvoiceId_organizationId_fkey" FOREIGN KEY ("originalTaxInvoiceId", "organizationId") REFERENCES "TaxInvoice"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContractItem" ADD CONSTRAINT "RentalContractItem_replacedByItemId_organizationId_fkey" FOREIGN KEY ("replacedByItemId", "organizationId") REFERENCES "RentalContractItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

