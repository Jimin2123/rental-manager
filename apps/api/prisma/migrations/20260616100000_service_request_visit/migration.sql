-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('RECEIVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ServiceRequestType" AS ENUM ('REPAIR', 'MAINTENANCE', 'INSTALLATION', 'REMOVAL', 'INSPECTION', 'ETC');

-- CreateEnum
CREATE TYPE "ServiceVisitStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ServiceVisitResult" AS ENUM ('REPAIRED', 'PARTS_REPLACED', 'CANNOT_REPAIR', 'DEFERRED', 'ETC');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "serviceRequestId" TEXT;

-- AlterTable
ALTER TABLE "SaleOrderItem" ADD COLUMN     "warrantyEndDate" TIMESTAMP(3),
ADD COLUMN     "warrantyStartDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestNo" TEXT NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "type" "ServiceRequestType" NOT NULL,
    "customerId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "isWarranty" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "requestedVisitDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceVisit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "staffId" TEXT,
    "status" "ServiceVisitStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3),
    "visitedAt" TIMESTAMP(3),
    "workDescription" TEXT,
    "result" "ServiceVisitResult",
    "requiresFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceRequest_organizationId_idx" ON "ServiceRequest"("organizationId");

-- CreateIndex
CREATE INDEX "ServiceRequest_organizationId_status_idx" ON "ServiceRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ServiceRequest_organizationId_type_idx" ON "ServiceRequest"("organizationId", "type");

-- CreateIndex
CREATE INDEX "ServiceRequest_organizationId_customerId_idx" ON "ServiceRequest"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "ServiceRequest_organizationId_assetId_idx" ON "ServiceRequest"("organizationId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_id_organizationId_key" ON "ServiceRequest"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_organizationId_requestNo_key" ON "ServiceRequest"("organizationId", "requestNo");

-- CreateIndex
CREATE INDEX "ServiceVisit_organizationId_idx" ON "ServiceVisit"("organizationId");

-- CreateIndex
CREATE INDEX "ServiceVisit_organizationId_serviceRequestId_idx" ON "ServiceVisit"("organizationId", "serviceRequestId");

-- CreateIndex
CREATE INDEX "ServiceVisit_organizationId_staffId_idx" ON "ServiceVisit"("organizationId", "staffId");

-- CreateIndex
CREATE INDEX "ServiceVisit_organizationId_status_idx" ON "ServiceVisit"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ServiceVisit_organizationId_scheduledAt_idx" ON "ServiceVisit"("organizationId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_serviceRequestId_organizationId_fkey" FOREIGN KEY ("serviceRequestId", "organizationId") REFERENCES "ServiceRequest"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assetId_organizationId_fkey" FOREIGN KEY ("assetId", "organizationId") REFERENCES "Asset"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_serviceRequestId_organizationId_fkey" FOREIGN KEY ("serviceRequestId", "organizationId") REFERENCES "ServiceRequest"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_staffId_organizationId_fkey" FOREIGN KEY ("staffId", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
