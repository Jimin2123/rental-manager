-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_rentalOrderItemId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_saleOrderItemId_fkey";

-- DropForeignKey
ALTER TABLE "Quotation" DROP CONSTRAINT "Quotation_convertedOrderId_fkey";

-- DropForeignKey
ALTER TABLE "QuotationItem" DROP CONSTRAINT "QuotationItem_assetId_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "TaxInvoice" DROP CONSTRAINT "TaxInvoice_invoiceId_fkey";

-- DropIndex
DROP INDEX "Quotation_convertedOrderId_key";

-- DropIndex
DROP INDEX "TaxInvoice_invoiceId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_convertedOrderId_organizationId_key" ON "Quotation"("convertedOrderId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleOrderItem_id_organizationId_key" ON "SaleOrderItem"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxInvoice_invoiceId_organizationId_key" ON "TaxInvoice"("invoiceId", "organizationId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_organizationId_fkey" FOREIGN KEY ("uploadedById", "organizationId") REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_saleOrderItemId_organizationId_fkey" FOREIGN KEY ("saleOrderItemId", "organizationId") REFERENCES "SaleOrderItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_rentalOrderItemId_organizationId_fkey" FOREIGN KEY ("rentalOrderItemId", "organizationId") REFERENCES "RentalOrderItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_invoiceId_organizationId_fkey" FOREIGN KEY ("invoiceId", "organizationId") REFERENCES "Invoice"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_assetId_organizationId_productId_fkey" FOREIGN KEY ("assetId", "organizationId", "productId") REFERENCES "Asset"("id", "organizationId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_convertedOrderId_organizationId_fkey" FOREIGN KEY ("convertedOrderId", "organizationId") REFERENCES "Order"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints: 금액 양수 보장 (Prisma 미지원 → raw SQL)
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK (amount > 0);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_positive" CHECK (amount > 0);
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_positive" CHECK (amount > 0);
ALTER TABLE "InvoiceAdjustment" ADD CONSTRAINT "InvoiceAdjustment_amount_nonzero" CHECK (amount <> 0);

