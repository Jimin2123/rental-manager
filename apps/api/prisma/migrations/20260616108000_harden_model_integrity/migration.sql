-- DropForeignKey: replace id-only optional links with organization-scoped links.
ALTER TABLE "RentalContractItem" DROP CONSTRAINT IF EXISTS "RentalContractItem_replacedByItemId_fkey";
ALTER TABLE "TaxInvoice" DROP CONSTRAINT IF EXISTS "TaxInvoice_originalTaxInvoiceId_fkey";
ALTER TABLE "InvoiceItem" DROP CONSTRAINT IF EXISTS "InvoiceItem_taxInvoiceId_fkey";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RentalContractItem_replacedByItemId_organizationId_idx" ON "RentalContractItem"("replacedByItemId", "organizationId");
CREATE INDEX IF NOT EXISTS "TaxInvoice_originalTaxInvoiceId_organizationId_idx" ON "TaxInvoice"("originalTaxInvoiceId", "organizationId");
CREATE INDEX IF NOT EXISTS "InvoiceItem_taxInvoiceId_organizationId_idx" ON "InvoiceItem"("taxInvoiceId", "organizationId");

-- AddForeignKey: organization boundary is part of the reference.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'RentalContractItem_replacedByItemId_organizationId_fkey'
  ) THEN
    ALTER TABLE "RentalContractItem" ADD CONSTRAINT "RentalContractItem_replacedByItemId_organizationId_fkey" FOREIGN KEY ("replacedByItemId", "organizationId") REFERENCES "RentalContractItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TaxInvoice_originalTaxInvoiceId_organizationId_fkey'
  ) THEN
    ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_originalTaxInvoiceId_organizationId_fkey" FOREIGN KEY ("originalTaxInvoiceId", "organizationId") REFERENCES "TaxInvoice"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InvoiceItem_taxInvoiceId_organizationId_fkey'
  ) THEN
    ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_taxInvoiceId_organizationId_fkey" FOREIGN KEY ("taxInvoiceId", "organizationId") REFERENCES "TaxInvoice"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$$;

-- CHECK constraints: item amounts, source compatibility, dates, counters, and service costs.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_type_source_check" CHECK (
  status = 'DRAFT'
  OR (
    type = 'SALE'
    AND "saleOrderId" IS NOT NULL
    AND "rentalContractId" IS NULL
    AND "serviceRequestId" IS NULL
    AND "billingMonth" IS NULL
    AND "periodStart" IS NULL
    AND "periodEnd" IS NULL
  )
  OR (
    type = 'RENTAL_MONTHLY'
    AND "saleOrderId" IS NULL
    AND "rentalContractId" IS NOT NULL
    AND "serviceRequestId" IS NULL
    AND "billingMonth" IS NOT NULL
    AND "periodStart" IS NOT NULL
    AND "periodEnd" IS NOT NULL
  )
  OR (
    type = 'SERVICE_FEE'
    AND "saleOrderId" IS NULL
    AND "rentalContractId" IS NULL
    AND "serviceRequestId" IS NOT NULL
    AND "billingMonth" IS NULL
    AND "periodStart" IS NULL
    AND "periodEnd" IS NULL
  )
  OR (
    type = 'MANUAL'
    AND "saleOrderId" IS NULL
    AND "rentalContractId" IS NULL
    AND "serviceRequestId" IS NULL
  )
);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_period_range_check" CHECK ("periodStart" IS NULL OR "periodEnd" IS NULL OR "periodEnd" >= "periodStart");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_final_amount_non_negative_check" CHECK ("finalAmount" >= 0);

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_quantity_positive_check" CHECK (quantity > 0);
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_amount_non_negative_check" CHECK ("unitPrice" >= 0 AND "supplyAmount" >= 0 AND "vatAmount" >= 0 AND "totalAmount" >= 0);
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_amount_calculation_check" CHECK ("supplyAmount" = quantity * "unitPrice" AND "totalAmount" = "supplyAmount" + "vatAmount");
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_source_type_check" CHECK (
  NOT ("saleOrderItemId" IS NOT NULL AND "rentalOrderItemId" IS NOT NULL)
  AND (type <> 'SALE_PRICE' OR "saleOrderItemId" IS NOT NULL)
  AND (type <> 'RENTAL_FEE' OR "rentalOrderItemId" IS NOT NULL)
  AND (type = 'SALE_PRICE' OR "saleOrderItemId" IS NULL)
  AND (type = 'RENTAL_FEE' OR "rentalOrderItemId" IS NULL)
);

ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quantity_positive_check" CHECK (quantity > 0);
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_amount_non_negative_check" CHECK (
  "unitPrice" >= 0
  AND ("monthlyRentalPrice" IS NULL OR "monthlyRentalPrice" >= 0)
  AND ("contractMonths" IS NULL OR "contractMonths" > 0)
  AND ("depositAmount" IS NULL OR "depositAmount" >= 0)
  AND "supplyAmount" >= 0
  AND "vatAmount" >= 0
  AND "totalAmount" >= 0
);
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_amount_calculation_check" CHECK ("supplyAmount" = quantity * "unitPrice" AND "totalAmount" = "supplyAmount" + "vatAmount");

ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_amount_non_negative_check" CHECK ("supplyAmount" >= 0 AND "vatAmount" >= 0 AND "totalAmount" >= 0);
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_amount_calculation_check" CHECK ("totalAmount" = "supplyAmount" + "vatAmount");
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_no_self_amendment_check" CHECK ("originalTaxInvoiceId" IS NULL OR "originalTaxInvoiceId" <> id);

ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_cost_non_negative_check" CHECK (
  ("laborCost" IS NULL OR "laborCost" >= 0)
  AND ("partsCost" IS NULL OR "partsCost" >= 0)
  AND ("travelCost" IS NULL OR "travelCost" >= 0)
);

ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_count_usage_non_negative_check" CHECK (
  "blackCount" >= 0
  AND ("colorCount" IS NULL OR "colorCount" >= 0)
  AND "blackUsage" >= 0
  AND ("colorUsage" IS NULL OR "colorUsage" >= 0)
);

ALTER TABLE "RentalContract" ADD CONSTRAINT "RentalContract_payment_due_day_range_check" CHECK ("paymentDueDay" IS NULL OR ("paymentDueDay" BETWEEN 1 AND 31));

ALTER TABLE "RentalContractItem" ADD CONSTRAINT "RentalContractItem_no_self_replacement_check" CHECK ("replacedByItemId" IS NULL OR "replacedByItemId" <> id);
ALTER TABLE "RentalContractItem" ADD CONSTRAINT "RentalContractItem_replacement_status_check" CHECK (
  status <> 'REPLACED'
  OR ("replacedByItemId" IS NOT NULL AND "replacedAt" IS NOT NULL)
);
ALTER TABLE "RentalContractItem" ADD CONSTRAINT "RentalContractItem_meter_values_check" CHECK (
  "monthlyRentalPrice" >= 0
  AND ("freeBlackCount" IS NULL OR "freeBlackCount" >= 0)
  AND ("blackUnitPrice" IS NULL OR "blackUnitPrice" >= 0)
  AND ("freeColorCount" IS NULL OR "freeColorCount" >= 0)
  AND ("colorUnitPrice" IS NULL OR "colorUnitPrice" >= 0)
  AND (
    "billingType" <> 'METER'
    OR ("freeBlackCount" IS NOT NULL AND "blackUnitPrice" IS NOT NULL)
  )
  AND (
    ("freeColorCount" IS NULL AND "colorUnitPrice" IS NULL)
    OR ("freeColorCount" IS NOT NULL AND "colorUnitPrice" IS NOT NULL)
  )
);

-- Polymorphic source guards for models that cannot use a single static FK.
CREATE OR REPLACE FUNCTION "assert_attachment_source_integrity"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."sourceType" = 'RentalContract' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "RentalContract"
      WHERE "RentalContract"."id" = NEW."sourceId"
        AND "RentalContract"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'Attachment source RentalContract % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  ELSIF NEW."sourceType" = 'SaleOrder' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "SaleOrder"
      WHERE "SaleOrder"."id" = NEW."sourceId"
        AND "SaleOrder"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'Attachment source SaleOrder % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  ELSIF NEW."sourceType" = 'ServiceRequest' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "ServiceRequest"
      WHERE "ServiceRequest"."id" = NEW."sourceId"
        AND "ServiceRequest"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'Attachment source ServiceRequest % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  ELSIF NEW."sourceType" = 'ServiceVisit' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "ServiceVisit"
      WHERE "ServiceVisit"."id" = NEW."sourceId"
        AND "ServiceVisit"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'Attachment source ServiceVisit % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  ELSIF NEW."sourceType" = 'Invoice' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Invoice"
      WHERE "Invoice"."id" = NEW."sourceId"
        AND "Invoice"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'Attachment source Invoice % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  ELSIF NEW."sourceType" = 'Customer' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Customer"
      WHERE "Customer"."id" = NEW."sourceId"
        AND "Customer"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'Attachment source Customer % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  ELSIF NEW."sourceType" = 'Quotation' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Quotation"
      WHERE "Quotation"."id" = NEW."sourceId"
        AND "Quotation"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'Attachment source Quotation % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported Attachment sourceType %', NEW."sourceType";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assert_asset_event_source_integrity"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."sourceType" = 'MANUAL' THEN
    RETURN NEW;
  END IF;

  IF NEW."sourceId" IS NULL THEN
    RAISE EXCEPTION 'AssetEvent sourceId is required for sourceType %', NEW."sourceType";
  END IF;

  IF NEW."sourceType" = 'RENTAL_CONTRACT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "RentalContract"
      WHERE "RentalContract"."id" = NEW."sourceId"
        AND "RentalContract"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'AssetEvent source RentalContract % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  ELSIF NEW."sourceType" = 'RENTAL_CONTRACT_ITEM' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "RentalContractItem"
      WHERE "RentalContractItem"."id" = NEW."sourceId"
        AND "RentalContractItem"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'AssetEvent source RentalContractItem % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  ELSIF NEW."sourceType" = 'SALE_ORDER' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "SaleOrder"
      WHERE "SaleOrder"."id" = NEW."sourceId"
        AND "SaleOrder"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'AssetEvent source SaleOrder % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  ELSIF NEW."sourceType" = 'SERVICE_REQUEST' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "ServiceRequest"
      WHERE "ServiceRequest"."id" = NEW."sourceId"
        AND "ServiceRequest"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'AssetEvent source ServiceRequest % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  ELSIF NEW."sourceType" = 'SERVICE_VISIT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "ServiceVisit"
      WHERE "ServiceVisit"."id" = NEW."sourceId"
        AND "ServiceVisit"."organizationId" = NEW."organizationId"
    ) THEN
      RAISE EXCEPTION 'AssetEvent source ServiceVisit % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Attachment_source_integrity_guard"
AFTER INSERT OR UPDATE OF "organizationId", "sourceType", "sourceId" ON "Attachment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_attachment_source_integrity"();

CREATE CONSTRAINT TRIGGER "AssetEvent_source_integrity_guard"
AFTER INSERT OR UPDATE OF "organizationId", "sourceType", "sourceId" ON "AssetEvent"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_asset_event_source_integrity"();

CREATE OR REPLACE FUNCTION "assert_audit_log_target_integrity"()
RETURNS TRIGGER AS $$
DECLARE
  target_table TEXT;
  target_exists BOOLEAN;
BEGIN
  target_table := CASE NEW."targetType"
    WHEN 'RentalContract' THEN 'RentalContract'
    WHEN 'RentalContractItem' THEN 'RentalContractItem'
    WHEN 'Invoice' THEN 'Invoice'
    WHEN 'Payment' THEN 'Payment'
    WHEN 'Refund' THEN 'Refund'
    WHEN 'Asset' THEN 'Asset'
    WHEN 'SaleOrder' THEN 'SaleOrder'
    WHEN 'Order' THEN 'Order'
    WHEN 'ServiceRequest' THEN 'ServiceRequest'
    WHEN 'ServiceVisit' THEN 'ServiceVisit'
    WHEN 'Customer' THEN 'Customer'
    WHEN 'Quotation' THEN 'Quotation'
    WHEN 'TaxInvoice' THEN 'TaxInvoice'
    ELSE NULL
  END;

  IF target_table IS NULL THEN
    RAISE EXCEPTION 'Unsupported AuditLog targetType %', NEW."targetType";
  END IF;

  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM %I WHERE "id" = $1 AND "organizationId" = $2)',
    target_table
  )
  INTO target_exists
  USING NEW."targetId", NEW."organizationId";

  IF NOT target_exists THEN
    RAISE EXCEPTION 'AuditLog target %.% does not exist in organization %', NEW."targetType", NEW."targetId", NEW."organizationId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "AuditLog_target_integrity_guard"
AFTER INSERT OR UPDATE OF "organizationId", "targetType", "targetId" ON "AuditLog"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_audit_log_target_integrity"();

-- Invoice.finalAmount is denormalized for query performance and maintained by DB triggers.
CREATE OR REPLACE FUNCTION "recalculate_invoice_final_amount"(invoice_id TEXT, org_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE "Invoice"
  SET
    "finalAmount" =
      COALESCE((
        SELECT SUM("InvoiceItem"."totalAmount")
        FROM "InvoiceItem"
        WHERE "InvoiceItem"."invoiceId" = invoice_id
          AND "InvoiceItem"."organizationId" = org_id
      ), 0)
      +
      COALESCE((
        SELECT SUM("InvoiceAdjustment"."amount")
        FROM "InvoiceAdjustment"
        WHERE "InvoiceAdjustment"."invoiceId" = invoice_id
          AND "InvoiceAdjustment"."organizationId" = org_id
      ), 0),
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "Invoice"."id" = invoice_id
    AND "Invoice"."organizationId" = org_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "sync_invoice_final_amount"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM "recalculate_invoice_final_amount"(NEW."invoiceId", NEW."organizationId");
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM "recalculate_invoice_final_amount"(OLD."invoiceId", OLD."organizationId");
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "InvoiceItem_sync_final_amount"
AFTER INSERT OR UPDATE OR DELETE ON "InvoiceItem"
FOR EACH ROW EXECUTE FUNCTION "sync_invoice_final_amount"();

CREATE TRIGGER "InvoiceAdjustment_sync_final_amount"
AFTER INSERT OR UPDATE OR DELETE ON "InvoiceAdjustment"
FOR EACH ROW EXECUTE FUNCTION "sync_invoice_final_amount"();

SELECT "recalculate_invoice_final_amount"("Invoice"."id", "Invoice"."organizationId")
FROM "Invoice";

-- Payment allocations must belong to the same customer and cannot exceed the payment amount.
CREATE OR REPLACE FUNCTION "assert_payment_allocation_integrity"()
RETURNS TRIGGER AS $$
DECLARE
  payment_customer_id TEXT;
  invoice_customer_id TEXT;
  payment_amount INTEGER;
  allocated_amount INTEGER;
BEGIN
  SELECT "Payment"."customerId", "Payment"."amount"
  INTO payment_customer_id, payment_amount
  FROM "Payment"
  WHERE "Payment"."id" = NEW."paymentId"
    AND "Payment"."organizationId" = NEW."organizationId";

  SELECT "Invoice"."customerId"
  INTO invoice_customer_id
  FROM "Invoice"
  WHERE "Invoice"."id" = NEW."invoiceId"
    AND "Invoice"."organizationId" = NEW."organizationId";

  IF payment_customer_id IS DISTINCT FROM invoice_customer_id THEN
    RAISE EXCEPTION 'PaymentAllocation customer mismatch for payment % and invoice %', NEW."paymentId", NEW."invoiceId";
  END IF;

  SELECT COALESCE(SUM("PaymentAllocation"."amount"), 0)
  INTO allocated_amount
  FROM "PaymentAllocation"
  WHERE "PaymentAllocation"."paymentId" = NEW."paymentId"
    AND "PaymentAllocation"."organizationId" = NEW."organizationId";

  IF allocated_amount > payment_amount THEN
    RAISE EXCEPTION 'PaymentAllocation total % exceeds payment amount % for payment %', allocated_amount, payment_amount, NEW."paymentId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assert_payment_integrity"()
RETURNS TRIGGER AS $$
DECLARE
  allocated_amount INTEGER;
BEGIN
  SELECT COALESCE(SUM("PaymentAllocation"."amount"), 0)
  INTO allocated_amount
  FROM "PaymentAllocation"
  WHERE "PaymentAllocation"."paymentId" = NEW."id"
    AND "PaymentAllocation"."organizationId" = NEW."organizationId";

  IF allocated_amount > NEW."amount" THEN
    RAISE EXCEPTION 'PaymentAllocation total % exceeds payment amount % for payment %', allocated_amount, NEW."amount", NEW."id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "PaymentAllocation"
    JOIN "Invoice"
      ON "Invoice"."id" = "PaymentAllocation"."invoiceId"
     AND "Invoice"."organizationId" = "PaymentAllocation"."organizationId"
    WHERE "PaymentAllocation"."paymentId" = NEW."id"
      AND "PaymentAllocation"."organizationId" = NEW."organizationId"
      AND "Invoice"."customerId" <> NEW."customerId"
  ) THEN
    RAISE EXCEPTION 'Payment customer mismatch for existing allocations on payment %', NEW."id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "PaymentAllocation_integrity_guard"
AFTER INSERT OR UPDATE ON "PaymentAllocation"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_payment_allocation_integrity"();

CREATE CONSTRAINT TRIGGER "Payment_integrity_guard"
AFTER UPDATE OF "amount", "customerId", "organizationId" ON "Payment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_payment_integrity"();

-- Refunds must match invoice/payment customers and cannot exceed completed paid allocations.
CREATE OR REPLACE FUNCTION "assert_refund_cap_for_invoice"(invoice_id TEXT, org_id TEXT)
RETURNS VOID AS $$
DECLARE
  paid_amount INTEGER;
  refunded_amount INTEGER;
BEGIN
  SELECT COALESCE(SUM("PaymentAllocation"."amount"), 0)
  INTO paid_amount
  FROM "PaymentAllocation"
  JOIN "Payment"
    ON "Payment"."id" = "PaymentAllocation"."paymentId"
   AND "Payment"."organizationId" = "PaymentAllocation"."organizationId"
  WHERE "PaymentAllocation"."invoiceId" = invoice_id
    AND "PaymentAllocation"."organizationId" = org_id
    AND "Payment"."status" = 'COMPLETED';

  SELECT COALESCE(SUM("Refund"."amount"), 0)
  INTO refunded_amount
  FROM "Refund"
  WHERE "Refund"."invoiceId" = invoice_id
    AND "Refund"."organizationId" = org_id
    AND "Refund"."status" <> 'CANCELED';

  IF refunded_amount > paid_amount THEN
    RAISE EXCEPTION 'Refund total % exceeds completed paid amount % for invoice %', refunded_amount, paid_amount, invoice_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assert_refund_integrity"()
RETURNS TRIGGER AS $$
DECLARE
  invoice_customer_id TEXT;
  payment_customer_id TEXT;
BEGIN
  SELECT "Invoice"."customerId"
  INTO invoice_customer_id
  FROM "Invoice"
  WHERE "Invoice"."id" = NEW."invoiceId"
    AND "Invoice"."organizationId" = NEW."organizationId";

  IF invoice_customer_id IS DISTINCT FROM NEW."customerId" THEN
    RAISE EXCEPTION 'Refund customer % does not match invoice % customer %', NEW."customerId", NEW."invoiceId", invoice_customer_id;
  END IF;

  IF NEW."paymentId" IS NOT NULL THEN
    SELECT "Payment"."customerId"
    INTO payment_customer_id
    FROM "Payment"
    WHERE "Payment"."id" = NEW."paymentId"
      AND "Payment"."organizationId" = NEW."organizationId";

    IF payment_customer_id IS DISTINCT FROM NEW."customerId" THEN
      RAISE EXCEPTION 'Refund customer % does not match payment % customer %', NEW."customerId", NEW."paymentId", payment_customer_id;
    END IF;
  END IF;

  PERFORM "assert_refund_cap_for_invoice"(NEW."invoiceId", NEW."organizationId");

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assert_refund_cap_after_payment_change"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM "assert_refund_cap_for_invoice"(NEW."invoiceId", NEW."organizationId");
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM "assert_refund_cap_for_invoice"(OLD."invoiceId", OLD."organizationId");
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assert_refund_cap_after_payment_status_change"()
RETURNS TRIGGER AS $$
DECLARE
  allocated_invoice RECORD;
BEGIN
  FOR allocated_invoice IN
    SELECT DISTINCT "PaymentAllocation"."invoiceId", "PaymentAllocation"."organizationId"
    FROM "PaymentAllocation"
    WHERE "PaymentAllocation"."paymentId" = NEW."id"
      AND "PaymentAllocation"."organizationId" = NEW."organizationId"
  LOOP
    PERFORM "assert_refund_cap_for_invoice"(allocated_invoice."invoiceId", allocated_invoice."organizationId");
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Refund_integrity_guard"
AFTER INSERT OR UPDATE ON "Refund"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_refund_integrity"();

CREATE CONSTRAINT TRIGGER "PaymentAllocation_refund_cap_guard"
AFTER INSERT OR UPDATE OR DELETE ON "PaymentAllocation"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_refund_cap_after_payment_change"();

CREATE CONSTRAINT TRIGGER "Payment_refund_cap_guard"
AFTER UPDATE OF "status" ON "Payment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_refund_cap_after_payment_status_change"();
