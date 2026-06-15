/*
  Warnings:

  - You are about to drop the `RentalBilling` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RentalBillingItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('SALE', 'RENTAL_MONTHLY', 'SERVICE_FEE', 'MANUAL');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELED');

-- CreateEnum
CREATE TYPE "InvoiceItemType" AS ENUM ('SALE_PRICE', 'RENTAL_FEE', 'SERVICE_FEE', 'INSTALLATION_FEE', 'REMOVAL_FEE', 'DELIVERY_FEE', 'DEPOSIT', 'PENALTY', 'ETC');

-- CreateEnum
CREATE TYPE "InvoiceAdjustmentType" AS ENUM ('DISCOUNT', 'CANCELLATION', 'RETURN', 'RENTAL_PRORATION', 'BILLING_ERROR', 'EXTRA_CHARGE', 'ETC');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'VIRTUAL_ACCOUNT', 'CMS', 'ETC');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'TOSS_PAYMENTS', 'PORTONE', 'INICIS', 'KCP', 'BANK_API', 'OPEN_BANKING');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('SALE_CANCEL', 'SALE_RETURN', 'RENTAL_CANCEL', 'RENTAL_PRORATION', 'OVERPAYMENT', 'BILLING_ERROR', 'ETC');

-- AlterEnum
ALTER TYPE "AssetStatus" ADD VALUE 'REPAIR';

-- DropForeignKey
ALTER TABLE "RentalBilling" DROP CONSTRAINT "RentalBilling_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "RentalBilling" DROP CONSTRAINT "RentalBilling_rentalContractId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "RentalBillingItem" DROP CONSTRAINT "RentalBillingItem_rentalBillingId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "RentalBillingItem" DROP CONSTRAINT "RentalBillingItem_rentalOrderItemId_organizationId_fkey";

-- DropTable
DROP TABLE "RentalBilling";

-- DropTable
DROP TABLE "RentalBillingItem";

-- DropEnum
DROP TYPE "RentalBillingItemType";

-- DropEnum
DROP TYPE "RentalBillingStatus";

-- CreateTable
CREATE TABLE "InvoiceAdjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "InvoiceAdjustmentType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "saleOrderItemId" TEXT,
    "rentalOrderItemId" TEXT,
    "type" "InvoiceItemType" NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "supplyAmount" INTEGER NOT NULL,
    "vatType" "VatType" NOT NULL DEFAULT 'INCLUDED',
    "vatAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "customerId" TEXT NOT NULL,
    "saleOrderId" TEXT,
    "rentalContractId" TEXT,
    "billingMonth" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "finalAmount" INTEGER NOT NULL DEFAULT 0,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "method" "PaymentMethod" NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "externalRef" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "refundNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" "RefundReason" NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod",
    "refundedAt" TIMESTAMP(3),
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceAdjustment_organizationId_idx" ON "InvoiceAdjustment"("organizationId");

-- CreateIndex
CREATE INDEX "InvoiceAdjustment_organizationId_invoiceId_idx" ON "InvoiceAdjustment"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceAdjustment_organizationId_type_idx" ON "InvoiceAdjustment"("organizationId", "type");

-- CreateIndex
CREATE INDEX "InvoiceItem_organizationId_idx" ON "InvoiceItem"("organizationId");

-- CreateIndex
CREATE INDEX "InvoiceItem_organizationId_invoiceId_idx" ON "InvoiceItem"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_organizationId_type_idx" ON "InvoiceItem"("organizationId", "type");

-- CreateIndex
CREATE INDEX "InvoiceItem_saleOrderItemId_idx" ON "InvoiceItem"("saleOrderItemId");

-- CreateIndex
CREATE INDEX "InvoiceItem_rentalOrderItemId_idx" ON "InvoiceItem"("rentalOrderItemId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_type_idx" ON "Invoice"("organizationId", "type");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_customerId_idx" ON "Invoice"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_dueDate_idx" ON "Invoice"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_saleOrderId_idx" ON "Invoice"("organizationId", "saleOrderId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_rentalContractId_idx" ON "Invoice"("organizationId", "rentalContractId");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_billingMonth_idx" ON "Invoice"("organizationId", "billingMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_id_organizationId_key" ON "Invoice"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_invoiceNo_key" ON "Invoice"("organizationId", "invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_saleOrderId_key" ON "Invoice"("organizationId", "saleOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_rentalContractId_billingMonth_type_key" ON "Invoice"("organizationId", "rentalContractId", "billingMonth", "type");

-- CreateIndex
CREATE INDEX "PaymentAllocation_organizationId_idx" ON "PaymentAllocation"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_organizationId_paymentId_idx" ON "PaymentAllocation"("organizationId", "paymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_organizationId_invoiceId_idx" ON "PaymentAllocation"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_idx" ON "Payment"("organizationId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_customerId_idx" ON "Payment"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_status_idx" ON "Payment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Payment_organizationId_paidAt_idx" ON "Payment"("organizationId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_organizationId_method_idx" ON "Payment"("organizationId", "method");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_organizationId_key" ON "Payment"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organizationId_paymentNo_key" ON "Payment"("organizationId", "paymentNo");

-- CreateIndex
CREATE INDEX "Refund_organizationId_idx" ON "Refund"("organizationId");

-- CreateIndex
CREATE INDEX "Refund_organizationId_customerId_idx" ON "Refund"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "Refund_organizationId_invoiceId_idx" ON "Refund"("organizationId", "invoiceId");

-- CreateIndex
CREATE INDEX "Refund_organizationId_paymentId_idx" ON "Refund"("organizationId", "paymentId");

-- CreateIndex
CREATE INDEX "Refund_organizationId_status_idx" ON "Refund"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_id_organizationId_key" ON "Refund"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_organizationId_refundNo_key" ON "Refund"("organizationId", "refundNo");

-- AddForeignKey
ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_invoiceId_organizationId_fkey" FOREIGN KEY ("invoiceId", "organizationId") REFERENCES "Invoice"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_organizationId_fkey" FOREIGN KEY ("invoiceId", "organizationId") REFERENCES "Invoice"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_saleOrderItemId_fkey" FOREIGN KEY ("saleOrderItemId") REFERENCES "SaleOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_rentalOrderItemId_fkey" FOREIGN KEY ("rentalOrderItemId") REFERENCES "RentalOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_saleOrderId_organizationId_fkey" FOREIGN KEY ("saleOrderId", "organizationId") REFERENCES "SaleOrder"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_rentalContractId_organizationId_fkey" FOREIGN KEY ("rentalContractId", "organizationId") REFERENCES "RentalContract"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_organizationId_fkey" FOREIGN KEY ("paymentId", "organizationId") REFERENCES "Payment"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_organizationId_fkey" FOREIGN KEY ("invoiceId", "organizationId") REFERENCES "Invoice"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_invoiceId_organizationId_fkey" FOREIGN KEY ("invoiceId", "organizationId") REFERENCES "Invoice"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_organizationId_fkey" FOREIGN KEY ("paymentId", "organizationId") REFERENCES "Payment"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
