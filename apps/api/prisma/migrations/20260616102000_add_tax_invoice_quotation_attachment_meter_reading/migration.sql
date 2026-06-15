-- CreateEnum
CREATE TYPE "TaxInvoiceType" AS ENUM ('TAX_INVOICE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "TaxInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELED', 'NTS_CONFIRMED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuotationType" AS ENUM ('SALE', 'RENTAL');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('FIXED', 'METER');

-- CreateEnum
CREATE TYPE "MeterReadingMethod" AS ENUM ('MANUAL', 'PHOTO', 'REMOTE');

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "taxInvoiceId" TEXT;

-- AlterTable
ALTER TABLE "RentalContractItem" ADD COLUMN     "billingType" "BillingType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "blackUnitPrice" INTEGER,
ADD COLUMN     "colorUnitPrice" INTEGER,
ADD COLUMN     "freeBlackCount" INTEGER,
ADD COLUMN     "freeColorCount" INTEGER,
ADD COLUMN     "installationAddress" TEXT,
ADD COLUMN     "installationAddressDetail" TEXT,
ADD COLUMN     "installationZonecode" TEXT;

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "category" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxInvoiceNo" TEXT NOT NULL,
    "type" "TaxInvoiceType" NOT NULL DEFAULT 'TAX_INVOICE',
    "status" "TaxInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "originalTaxInvoiceId" TEXT,
    "invoiceId" TEXT,
    "customerId" TEXT NOT NULL,
    "buyerBusinessNo" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerCeoName" TEXT,
    "buyerEmail" TEXT,
    "supplyAmount" INTEGER NOT NULL,
    "vatAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "ntsConfirmNum" TEXT,
    "externalRef" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "monthlyRentalPrice" INTEGER,
    "contractMonths" INTEGER,
    "depositAmount" INTEGER,
    "supplyAmount" INTEGER NOT NULL,
    "vatType" "VatType" NOT NULL DEFAULT 'INCLUDED',
    "vatAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quotationNo" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "QuotationType" NOT NULL,
    "customerId" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3),
    "convertedOrderId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "rentalContractItemId" TEXT,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "blackCount" INTEGER NOT NULL,
    "colorCount" INTEGER,
    "blackUsage" INTEGER NOT NULL,
    "colorUsage" INTEGER,
    "readingMethod" "MeterReadingMethod" NOT NULL DEFAULT 'MANUAL',
    "invoiceItemId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_organizationId_idx" ON "Attachment"("organizationId");

-- CreateIndex
CREATE INDEX "Attachment_organizationId_sourceType_sourceId_idx" ON "Attachment"("organizationId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "Attachment_organizationId_sourceType_idx" ON "Attachment"("organizationId", "sourceType");

-- CreateIndex
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "TaxInvoice_invoiceId_key" ON "TaxInvoice"("invoiceId");

-- CreateIndex
CREATE INDEX "TaxInvoice_organizationId_idx" ON "TaxInvoice"("organizationId");

-- CreateIndex
CREATE INDEX "TaxInvoice_organizationId_status_idx" ON "TaxInvoice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "TaxInvoice_organizationId_customerId_idx" ON "TaxInvoice"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "TaxInvoice_organizationId_issueDate_idx" ON "TaxInvoice"("organizationId", "issueDate");

-- CreateIndex
CREATE INDEX "TaxInvoice_organizationId_type_idx" ON "TaxInvoice"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "TaxInvoice_id_organizationId_key" ON "TaxInvoice"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxInvoice_organizationId_taxInvoiceNo_key" ON "TaxInvoice"("organizationId", "taxInvoiceNo");

-- CreateIndex
CREATE INDEX "QuotationItem_organizationId_idx" ON "QuotationItem"("organizationId");

-- CreateIndex
CREATE INDEX "QuotationItem_organizationId_quotationId_idx" ON "QuotationItem"("organizationId", "quotationId");

-- CreateIndex
CREATE INDEX "QuotationItem_organizationId_productId_idx" ON "QuotationItem"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "QuotationItem_assetId_idx" ON "QuotationItem"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_convertedOrderId_key" ON "Quotation"("convertedOrderId");

-- CreateIndex
CREATE INDEX "Quotation_organizationId_idx" ON "Quotation"("organizationId");

-- CreateIndex
CREATE INDEX "Quotation_organizationId_status_idx" ON "Quotation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Quotation_organizationId_type_idx" ON "Quotation"("organizationId", "type");

-- CreateIndex
CREATE INDEX "Quotation_organizationId_customerId_idx" ON "Quotation"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "Quotation_organizationId_validUntil_idx" ON "Quotation"("organizationId", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_id_organizationId_key" ON "Quotation"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_organizationId_quotationNo_key" ON "Quotation"("organizationId", "quotationNo");

-- CreateIndex
CREATE INDEX "MeterReading_organizationId_idx" ON "MeterReading"("organizationId");

-- CreateIndex
CREATE INDEX "MeterReading_organizationId_assetId_idx" ON "MeterReading"("organizationId", "assetId");

-- CreateIndex
CREATE INDEX "MeterReading_organizationId_assetId_readingDate_idx" ON "MeterReading"("organizationId", "assetId", "readingDate");

-- CreateIndex
CREATE INDEX "MeterReading_organizationId_rentalContractItemId_idx" ON "MeterReading"("organizationId", "rentalContractItemId");

-- CreateIndex
CREATE INDEX "MeterReading_invoiceItemId_idx" ON "MeterReading"("invoiceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_id_organizationId_key" ON "MeterReading"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceItem_id_organizationId_key" ON "InvoiceItem"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "OrganizationMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_taxInvoiceId_fkey" FOREIGN KEY ("taxInvoiceId") REFERENCES "TaxInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_originalTaxInvoiceId_fkey" FOREIGN KEY ("originalTaxInvoiceId") REFERENCES "TaxInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_organizationId_fkey" FOREIGN KEY ("quotationId", "organizationId") REFERENCES "Quotation"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_productId_organizationId_fkey" FOREIGN KEY ("productId", "organizationId") REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_assetId_organizationId_fkey" FOREIGN KEY ("assetId", "organizationId") REFERENCES "Asset"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_convertedOrderId_fkey" FOREIGN KEY ("convertedOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_assetId_organizationId_fkey" FOREIGN KEY ("assetId", "organizationId") REFERENCES "Asset"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_rentalContractItemId_organizationId_fkey" FOREIGN KEY ("rentalContractItemId", "organizationId") REFERENCES "RentalContractItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_invoiceItemId_organizationId_fkey" FOREIGN KEY ("invoiceItemId", "organizationId") REFERENCES "InvoiceItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

