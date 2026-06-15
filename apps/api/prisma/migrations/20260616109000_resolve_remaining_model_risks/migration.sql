-- TaxInvoice semantic constraints.
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_type_original_check" CHECK (
  (
    type = 'TAX_INVOICE'
    AND "originalTaxInvoiceId" IS NULL
  )
  OR (
    type = 'CREDIT_NOTE'
    AND "originalTaxInvoiceId" IS NOT NULL
  )
);

ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_nts_confirmed_requires_confirm_num_check" CHECK (
  status <> 'NTS_CONFIRMED'
  OR "ntsConfirmNum" IS NOT NULL
);

CREATE OR REPLACE FUNCTION "assert_tax_invoice_invoice_consistency"()
RETURNS TRIGGER AS $$
DECLARE
  invoice_customer_id TEXT;
  original_customer_id TEXT;
  original_type "TaxInvoiceType";
BEGIN
  IF NEW."invoiceId" IS NOT NULL THEN
    SELECT "Invoice"."customerId"
    INTO invoice_customer_id
    FROM "Invoice"
    WHERE "Invoice"."id" = NEW."invoiceId"
      AND "Invoice"."organizationId" = NEW."organizationId";

    IF invoice_customer_id IS DISTINCT FROM NEW."customerId" THEN
      RAISE EXCEPTION 'TaxInvoice customer % does not match invoice % customer %', NEW."customerId", NEW."invoiceId", invoice_customer_id;
    END IF;
  END IF;

  IF NEW."originalTaxInvoiceId" IS NOT NULL THEN
    SELECT "TaxInvoice"."customerId", "TaxInvoice"."type"
    INTO original_customer_id, original_type
    FROM "TaxInvoice"
    WHERE "TaxInvoice"."id" = NEW."originalTaxInvoiceId"
      AND "TaxInvoice"."organizationId" = NEW."organizationId";

    IF original_customer_id IS DISTINCT FROM NEW."customerId" THEN
      RAISE EXCEPTION 'Credit note customer % does not match original tax invoice % customer %', NEW."customerId", NEW."originalTaxInvoiceId", original_customer_id;
    END IF;

    IF original_type <> 'TAX_INVOICE' THEN
      RAISE EXCEPTION 'Credit note originalTaxInvoiceId % must reference a TAX_INVOICE', NEW."originalTaxInvoiceId";
    END IF;
  END IF;

  IF NEW."invoiceId" IS NULL AND EXISTS (
    SELECT 1
    FROM "InvoiceItem"
    WHERE "InvoiceItem"."taxInvoiceId" = NEW."id"
      AND "InvoiceItem"."organizationId" = NEW."organizationId"
  ) THEN
    RAISE EXCEPTION 'TaxInvoice % must have invoiceId before InvoiceItems can reference it', NEW."id";
  END IF;

  IF NEW."invoiceId" IS NOT NULL AND EXISTS (
    SELECT 1
    FROM "InvoiceItem"
    WHERE "InvoiceItem"."taxInvoiceId" = NEW."id"
      AND "InvoiceItem"."organizationId" = NEW."organizationId"
      AND "InvoiceItem"."invoiceId" <> NEW."invoiceId"
  ) THEN
    RAISE EXCEPTION 'TaxInvoice % has InvoiceItems from a different invoice', NEW."id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assert_invoice_item_tax_invoice_consistency"()
RETURNS TRIGGER AS $$
DECLARE
  tax_invoice_invoice_id TEXT;
  tax_invoice_customer_id TEXT;
  invoice_customer_id TEXT;
BEGIN
  IF NEW."taxInvoiceId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "TaxInvoice"."invoiceId", "TaxInvoice"."customerId"
  INTO tax_invoice_invoice_id, tax_invoice_customer_id
  FROM "TaxInvoice"
  WHERE "TaxInvoice"."id" = NEW."taxInvoiceId"
    AND "TaxInvoice"."organizationId" = NEW."organizationId";

  IF tax_invoice_invoice_id IS NULL THEN
    RAISE EXCEPTION 'InvoiceItem % cannot reference TaxInvoice % without invoiceId', NEW."id", NEW."taxInvoiceId";
  END IF;

  IF tax_invoice_invoice_id <> NEW."invoiceId" THEN
    RAISE EXCEPTION 'InvoiceItem % invoice % does not match TaxInvoice % invoice %', NEW."id", NEW."invoiceId", NEW."taxInvoiceId", tax_invoice_invoice_id;
  END IF;

  SELECT "Invoice"."customerId"
  INTO invoice_customer_id
  FROM "Invoice"
  WHERE "Invoice"."id" = NEW."invoiceId"
    AND "Invoice"."organizationId" = NEW."organizationId";

  IF tax_invoice_customer_id IS DISTINCT FROM invoice_customer_id THEN
    RAISE EXCEPTION 'InvoiceItem % tax invoice customer % does not match invoice customer %', NEW."id", tax_invoice_customer_id, invoice_customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "TaxInvoice_invoice_consistency_guard"
AFTER INSERT OR UPDATE OF "organizationId", "invoiceId", "customerId", "type", "originalTaxInvoiceId" ON "TaxInvoice"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_tax_invoice_invoice_consistency"();

CREATE CONSTRAINT TRIGGER "InvoiceItem_tax_invoice_consistency_guard"
AFTER INSERT OR UPDATE OF "organizationId", "invoiceId", "taxInvoiceId" ON "InvoiceItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_invoice_item_tax_invoice_consistency"();

-- Status transition guards for stateful workflow models.
CREATE OR REPLACE FUNCTION "assert_status_transition"()
RETURNS TRIGGER AS $$
DECLARE
  old_status TEXT;
  new_status TEXT;
  allowed BOOLEAN := false;
BEGIN
  old_status := OLD."status"::TEXT;
  new_status := NEW."status"::TEXT;

  IF old_status = new_status THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'Order' THEN
    allowed :=
      (old_status = 'REGISTERED' AND new_status IN ('CONFIRMED', 'CANCELED'))
      OR (old_status = 'CONFIRMED' AND new_status IN ('IN_DELIVERY', 'CANCELED'))
      OR (old_status = 'IN_DELIVERY' AND new_status IN ('DELIVERED', 'CANCELED'));
  ELSIF TG_TABLE_NAME = 'RentalContract' THEN
    allowed :=
      (old_status = 'DRAFT' AND new_status IN ('ACTIVE', 'CANCELED'))
      OR (old_status = 'ACTIVE' AND new_status IN ('ENDED', 'CANCELED'));
  ELSIF TG_TABLE_NAME = 'RentalContractItem' THEN
    allowed :=
      (old_status = 'PENDING' AND new_status IN ('ACTIVE', 'CANCELED'))
      OR (old_status = 'ACTIVE' AND new_status IN ('RETURNED', 'REPLACED', 'CANCELED'));
  ELSIF TG_TABLE_NAME = 'ServiceRequest' THEN
    allowed :=
      (old_status = 'RECEIVED' AND new_status IN ('SCHEDULED', 'IN_PROGRESS', 'CANCELED'))
      OR (old_status = 'SCHEDULED' AND new_status IN ('IN_PROGRESS', 'WAITING_FOR_PARTS', 'CANCELED'))
      OR (old_status = 'IN_PROGRESS' AND new_status IN ('WAITING_FOR_PARTS', 'COMPLETED', 'CANCELED'))
      OR (old_status = 'WAITING_FOR_PARTS' AND new_status IN ('SCHEDULED', 'IN_PROGRESS', 'CANCELED'));
  ELSIF TG_TABLE_NAME = 'ServiceVisit' THEN
    allowed :=
      (old_status = 'SCHEDULED' AND new_status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELED'))
      OR (old_status = 'IN_PROGRESS' AND new_status IN ('COMPLETED', 'CANCELED'));
  ELSIF TG_TABLE_NAME = 'Invoice' THEN
    allowed :=
      (old_status = 'DRAFT' AND new_status IN ('ISSUED', 'CANCELED'))
      OR (old_status = 'ISSUED' AND new_status = 'CANCELED');
  ELSIF TG_TABLE_NAME = 'Payment' THEN
    allowed :=
      (old_status = 'PENDING' AND new_status IN ('COMPLETED', 'FAILED', 'CANCELED'))
      OR (old_status = 'FAILED' AND new_status IN ('PENDING', 'CANCELED'))
      OR (old_status = 'COMPLETED' AND new_status = 'CANCELED');
  ELSIF TG_TABLE_NAME = 'Refund' THEN
    allowed :=
      (old_status = 'PENDING' AND new_status IN ('COMPLETED', 'FAILED', 'CANCELED'))
      OR (old_status = 'FAILED' AND new_status IN ('PENDING', 'CANCELED'));
  ELSIF TG_TABLE_NAME = 'TaxInvoice' THEN
    allowed :=
      (old_status = 'DRAFT' AND new_status IN ('ISSUED', 'CANCELED'))
      OR (old_status = 'ISSUED' AND new_status IN ('NTS_CONFIRMED', 'CANCELED'));
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid % status transition: % -> %', TG_TABLE_NAME, old_status, new_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_status_transition_guard"
BEFORE UPDATE OF "status" ON "Order"
FOR EACH ROW EXECUTE FUNCTION "assert_status_transition"();

CREATE TRIGGER "RentalContract_status_transition_guard"
BEFORE UPDATE OF "status" ON "RentalContract"
FOR EACH ROW EXECUTE FUNCTION "assert_status_transition"();

CREATE TRIGGER "RentalContractItem_status_transition_guard"
BEFORE UPDATE OF "status" ON "RentalContractItem"
FOR EACH ROW EXECUTE FUNCTION "assert_status_transition"();

CREATE TRIGGER "ServiceRequest_status_transition_guard"
BEFORE UPDATE OF "status" ON "ServiceRequest"
FOR EACH ROW EXECUTE FUNCTION "assert_status_transition"();

CREATE TRIGGER "ServiceVisit_status_transition_guard"
BEFORE UPDATE OF "status" ON "ServiceVisit"
FOR EACH ROW EXECUTE FUNCTION "assert_status_transition"();

CREATE TRIGGER "Invoice_status_transition_guard"
BEFORE UPDATE OF "status" ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION "assert_status_transition"();

CREATE TRIGGER "Payment_status_transition_guard"
BEFORE UPDATE OF "status" ON "Payment"
FOR EACH ROW EXECUTE FUNCTION "assert_status_transition"();

CREATE TRIGGER "Refund_status_transition_guard"
BEFORE UPDATE OF "status" ON "Refund"
FOR EACH ROW EXECUTE FUNCTION "assert_status_transition"();

CREATE TRIGGER "TaxInvoice_status_transition_guard"
BEFORE UPDATE OF "status" ON "TaxInvoice"
FOR EACH ROW EXECUTE FUNCTION "assert_status_transition"();

-- Replace polymorphic AssetEvent guard with source asset consistency checks.
CREATE OR REPLACE FUNCTION "assert_asset_event_source_integrity"()
RETURNS TRIGGER AS $$
DECLARE
  source_asset_id TEXT;
  source_exists BOOLEAN;
BEGIN
  IF NEW."sourceType" = 'MANUAL' THEN
    RETURN NEW;
  END IF;

  IF NEW."sourceId" IS NULL THEN
    RAISE EXCEPTION 'AssetEvent sourceId is required for sourceType %', NEW."sourceType";
  END IF;

  IF NEW."sourceType" = 'RENTAL_CONTRACT' THEN
    SELECT EXISTS (
      SELECT 1 FROM "RentalContract"
      WHERE "RentalContract"."id" = NEW."sourceId"
        AND "RentalContract"."organizationId" = NEW."organizationId"
    )
    INTO source_exists;

    IF NOT source_exists THEN
      RAISE EXCEPTION 'AssetEvent source RentalContract % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM "RentalContractItem"
      WHERE "RentalContractItem"."rentalContractId" = NEW."sourceId"
        AND "RentalContractItem"."organizationId" = NEW."organizationId"
        AND "RentalContractItem"."assetId" = NEW."assetId"
    ) THEN
      RAISE EXCEPTION 'AssetEvent source asset mismatch for RentalContract % and asset %', NEW."sourceId", NEW."assetId";
    END IF;
  ELSIF NEW."sourceType" = 'RENTAL_CONTRACT_ITEM' THEN
    SELECT "RentalContractItem"."assetId"
    INTO source_asset_id
    FROM "RentalContractItem"
    WHERE "RentalContractItem"."id" = NEW."sourceId"
      AND "RentalContractItem"."organizationId" = NEW."organizationId";

    IF source_asset_id IS NULL THEN
      RAISE EXCEPTION 'AssetEvent source RentalContractItem % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;

    IF source_asset_id <> NEW."assetId" THEN
      RAISE EXCEPTION 'AssetEvent source asset mismatch for RentalContractItem % and asset %', NEW."sourceId", NEW."assetId";
    END IF;
  ELSIF NEW."sourceType" = 'SALE_ORDER' THEN
    SELECT EXISTS (
      SELECT 1 FROM "SaleOrder"
      WHERE "SaleOrder"."id" = NEW."sourceId"
        AND "SaleOrder"."organizationId" = NEW."organizationId"
    )
    INTO source_exists;

    IF NOT source_exists THEN
      RAISE EXCEPTION 'AssetEvent source SaleOrder % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM "SaleOrderItem"
      WHERE "SaleOrderItem"."saleOrderId" = NEW."sourceId"
        AND "SaleOrderItem"."organizationId" = NEW."organizationId"
        AND "SaleOrderItem"."assetId" = NEW."assetId"
    ) THEN
      RAISE EXCEPTION 'AssetEvent source asset mismatch for SaleOrder % and asset %', NEW."sourceId", NEW."assetId";
    END IF;
  ELSIF NEW."sourceType" = 'SERVICE_REQUEST' THEN
    SELECT "ServiceRequest"."assetId"
    INTO source_asset_id
    FROM "ServiceRequest"
    WHERE "ServiceRequest"."id" = NEW."sourceId"
      AND "ServiceRequest"."organizationId" = NEW."organizationId";

    IF source_asset_id IS NULL THEN
      RAISE EXCEPTION 'AssetEvent source ServiceRequest % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;

    IF source_asset_id <> NEW."assetId" THEN
      RAISE EXCEPTION 'AssetEvent source asset mismatch for ServiceRequest % and asset %', NEW."sourceId", NEW."assetId";
    END IF;
  ELSIF NEW."sourceType" = 'SERVICE_VISIT' THEN
    SELECT "ServiceRequest"."assetId"
    INTO source_asset_id
    FROM "ServiceVisit"
    JOIN "ServiceRequest"
      ON "ServiceRequest"."id" = "ServiceVisit"."serviceRequestId"
     AND "ServiceRequest"."organizationId" = "ServiceVisit"."organizationId"
    WHERE "ServiceVisit"."id" = NEW."sourceId"
      AND "ServiceVisit"."organizationId" = NEW."organizationId";

    IF source_asset_id IS NULL THEN
      RAISE EXCEPTION 'AssetEvent source ServiceVisit % does not exist in organization %', NEW."sourceId", NEW."organizationId";
    END IF;

    IF source_asset_id <> NEW."assetId" THEN
      RAISE EXCEPTION 'AssetEvent source asset mismatch for ServiceVisit % and asset %', NEW."sourceId", NEW."assetId";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- MeterReading sequence and duplicate guards.
CREATE UNIQUE INDEX "MeterReading_asset_reading_date_key" ON "MeterReading"("organizationId", "assetId", "readingDate");

ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_color_pair_check" CHECK (
  (
    "colorCount" IS NULL
    AND "colorUsage" IS NULL
  )
  OR (
    "colorCount" IS NOT NULL
    AND "colorUsage" IS NOT NULL
  )
);

CREATE OR REPLACE FUNCTION "assert_meter_reading_sequence_integrity"()
RETURNS TRIGGER AS $$
DECLARE
  previous_reading RECORD;
  next_reading RECORD;
BEGIN
  SELECT "MeterReading"."blackCount", "MeterReading"."colorCount"
  INTO previous_reading
  FROM "MeterReading"
  WHERE "MeterReading"."organizationId" = NEW."organizationId"
    AND "MeterReading"."assetId" = NEW."assetId"
    AND "MeterReading"."readingDate" < NEW."readingDate"
  ORDER BY "MeterReading"."readingDate" DESC, "MeterReading"."createdAt" DESC
  LIMIT 1;

  IF FOUND THEN
    IF NEW."blackCount" < previous_reading."blackCount" THEN
      RAISE EXCEPTION 'MeterReading blackCount must be monotonic for asset %', NEW."assetId";
    END IF;

    IF NEW."blackUsage" <> NEW."blackCount" - previous_reading."blackCount" THEN
      RAISE EXCEPTION 'MeterReading blackUsage must equal blackCount delta for asset %', NEW."assetId";
    END IF;

    IF NEW."colorCount" IS NOT NULL AND previous_reading."colorCount" IS NOT NULL THEN
      IF NEW."colorCount" < previous_reading."colorCount" THEN
        RAISE EXCEPTION 'MeterReading colorCount must be monotonic for asset %', NEW."assetId";
      END IF;

      IF NEW."colorUsage" <> NEW."colorCount" - previous_reading."colorCount" THEN
        RAISE EXCEPTION 'MeterReading colorUsage must equal colorCount delta for asset %', NEW."assetId";
      END IF;
    END IF;
  END IF;

  SELECT "MeterReading"."blackCount", "MeterReading"."blackUsage", "MeterReading"."colorCount", "MeterReading"."colorUsage"
  INTO next_reading
  FROM "MeterReading"
  WHERE "MeterReading"."organizationId" = NEW."organizationId"
    AND "MeterReading"."assetId" = NEW."assetId"
    AND "MeterReading"."readingDate" > NEW."readingDate"
  ORDER BY "MeterReading"."readingDate" ASC, "MeterReading"."createdAt" ASC
  LIMIT 1;

  IF FOUND THEN
    IF next_reading."blackCount" < NEW."blackCount" THEN
      RAISE EXCEPTION 'MeterReading blackCount cannot exceed next reading for asset %', NEW."assetId";
    END IF;

    IF next_reading."blackUsage" <> next_reading."blackCount" - NEW."blackCount" THEN
      RAISE EXCEPTION 'Next MeterReading blackUsage must equal blackCount delta for asset %', NEW."assetId";
    END IF;

    IF next_reading."colorCount" IS NOT NULL AND NEW."colorCount" IS NOT NULL THEN
      IF next_reading."colorCount" < NEW."colorCount" THEN
        RAISE EXCEPTION 'MeterReading colorCount cannot exceed next reading for asset %', NEW."assetId";
      END IF;

      IF next_reading."colorUsage" <> next_reading."colorCount" - NEW."colorCount" THEN
        RAISE EXCEPTION 'Next MeterReading colorUsage must equal colorCount delta for asset %', NEW."assetId";
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "MeterReading_sequence_guard"
AFTER INSERT OR UPDATE OF "organizationId", "assetId", "readingDate", "blackCount", "colorCount", "blackUsage", "colorUsage" ON "MeterReading"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_meter_reading_sequence_integrity"();

-- VAT semantic guards.
ALTER TABLE "SaleOrderItem" ADD CONSTRAINT "SaleOrderItem_vat_type_check" CHECK (
  "vatType" <> 'NONE'
  OR (
    "vatAmount" = 0
    AND "totalAmount" = "supplyAmount"
  )
);

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_vat_type_check" CHECK (
  "vatType" <> 'NONE'
  OR (
    "vatAmount" = 0
    AND "totalAmount" = "supplyAmount"
  )
);

ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_vat_type_check" CHECK (
  "vatType" <> 'NONE'
  OR (
    "vatAmount" = 0
    AND "totalAmount" = "supplyAmount"
  )
);
