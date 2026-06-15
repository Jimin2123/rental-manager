-- CreateEnum
CREATE TYPE "RentalContractItemStatus" AS ENUM ('PENDING', 'ACTIVE', 'RETURNED', 'REPLACED', 'CANCELED');

-- CreateEnum
CREATE TYPE "BillingTiming" AS ENUM ('PREPAID', 'POSTPAID');

-- CreateEnum
CREATE TYPE "AssetEventSourceType" AS ENUM ('RENTAL_CONTRACT', 'RENTAL_CONTRACT_ITEM', 'SALE_ORDER', 'SERVICE_REQUEST', 'SERVICE_VISIT', 'MANUAL');

-- AlterEnum
ALTER TYPE "RentalContractStatus" ADD VALUE 'DRAFT';


-- AlterTable
ALTER TABLE "RentalContract"
ADD COLUMN "billingTiming" "BillingTiming" NOT NULL DEFAULT 'PREPAID',
ADD COLUMN "paymentDueDay" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "RentalContractItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rentalContractId" TEXT NOT NULL,
    "rentalOrderItemId" TEXT,
    "assetId" TEXT NOT NULL,
    "status" "RentalContractItemStatus" NOT NULL DEFAULT 'PENDING',
    "monthlyRentalPrice" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "replacedByItemId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalContractItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "fromStatus" "AssetStatus",
    "toStatus" "AssetStatus" NOT NULL,
    "sourceType" "AssetEventSourceType" NOT NULL,
    "sourceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RentalContractItem_organizationId_idx" ON "RentalContractItem"("organizationId");
CREATE INDEX "RentalContractItem_organizationId_rentalContractId_idx" ON "RentalContractItem"("organizationId", "rentalContractId");
CREATE INDEX "RentalContractItem_organizationId_assetId_idx" ON "RentalContractItem"("organizationId", "assetId");
CREATE INDEX "RentalContractItem_organizationId_status_idx" ON "RentalContractItem"("organizationId", "status");
CREATE INDEX "RentalContractItem_organizationId_assetId_status_idx" ON "RentalContractItem"("organizationId", "assetId", "status");
CREATE UNIQUE INDEX "RentalContractItem_id_organizationId_key" ON "RentalContractItem"("id", "organizationId");

-- Partial unique index: 동일 장비의 ACTIVE 계약 항목은 1개만 허용
CREATE UNIQUE INDEX "RentalContractItem_assetId_active_unique" ON "RentalContractItem"("assetId") WHERE status = 'ACTIVE';

-- CreateIndex
CREATE INDEX "AssetEvent_organizationId_idx" ON "AssetEvent"("organizationId");
CREATE INDEX "AssetEvent_organizationId_assetId_idx" ON "AssetEvent"("organizationId", "assetId");
CREATE INDEX "AssetEvent_organizationId_assetId_createdAt_idx" ON "AssetEvent"("organizationId", "assetId", "createdAt");
CREATE INDEX "AssetEvent_organizationId_sourceType_sourceId_idx" ON "AssetEvent"("organizationId", "sourceType", "sourceId");

-- CreateIndex

-- AddForeignKey
ALTER TABLE "RentalContractItem" ADD CONSTRAINT "RentalContractItem_rentalContractId_organizationId_fkey" FOREIGN KEY ("rentalContractId", "organizationId") REFERENCES "RentalContract"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalContractItem" ADD CONSTRAINT "RentalContractItem_rentalOrderItemId_organizationId_fkey" FOREIGN KEY ("rentalOrderItemId", "organizationId") REFERENCES "RentalOrderItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalContractItem" ADD CONSTRAINT "RentalContractItem_assetId_organizationId_fkey" FOREIGN KEY ("assetId", "organizationId") REFERENCES "Asset"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalContractItem" ADD CONSTRAINT "RentalContractItem_replacedByItemId_fkey" FOREIGN KEY ("replacedByItemId") REFERENCES "RentalContractItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_assetId_organizationId_fkey" FOREIGN KEY ("assetId", "organizationId") REFERENCES "Asset"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
