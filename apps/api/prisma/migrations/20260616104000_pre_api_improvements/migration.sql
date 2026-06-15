-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "OrderStatus" ADD VALUE 'IN_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';

-- AlterEnum
ALTER TYPE "ServiceRequestStatus" ADD VALUE 'WAITING_FOR_PARTS';

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "disposedAt" TIMESTAMP(3),
ADD COLUMN     "disposedReason" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "RentalContract" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isRenewal" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Customer_organizationId_isActive_idx" ON "Customer"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "IndividualProfile_email_idx" ON "IndividualProfile"("email");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_customerId_dueDate_status_idx" ON "Invoice"("organizationId", "customerId", "dueDate", "status");

-- CreateIndex
CREATE INDEX "Payment_organizationId_customerId_paidAt_idx" ON "Payment"("organizationId", "customerId", "paidAt");

-- CreateIndex
CREATE INDEX "RentalContractItem_organizationId_status_endedAt_idx" ON "RentalContractItem"("organizationId", "status", "endedAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_organizationId_fkey" FOREIGN KEY ("createdById", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdById_organizationId_fkey" FOREIGN KEY ("createdById", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdById_organizationId_fkey" FOREIGN KEY ("createdById", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_createdById_organizationId_fkey" FOREIGN KEY ("createdById", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

