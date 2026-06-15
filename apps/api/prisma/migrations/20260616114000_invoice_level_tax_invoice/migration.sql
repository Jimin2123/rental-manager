DO $$
DECLARE
  tax_invoice RECORD;
  linked_invoice_count INTEGER;
  linked_invoice_id TEXT;
BEGIN
  FOR tax_invoice IN
    SELECT "id", "organizationId", "invoiceId"
    FROM "TaxInvoice"
    WHERE EXISTS (
      SELECT 1
      FROM "InvoiceItem"
      WHERE "InvoiceItem"."taxInvoiceId" = "TaxInvoice"."id"
        AND "InvoiceItem"."organizationId" = "TaxInvoice"."organizationId"
    )
  LOOP
    SELECT COUNT(DISTINCT "invoiceId"), MIN("invoiceId")
    INTO linked_invoice_count, linked_invoice_id
    FROM "InvoiceItem"
    WHERE "taxInvoiceId" = tax_invoice."id"
      AND "organizationId" = tax_invoice."organizationId";

    IF linked_invoice_count <> 1 THEN
      RAISE EXCEPTION 'TaxInvoice % has item-level links across multiple invoices and cannot be migrated to invoice-level issuance', tax_invoice."id";
    END IF;

    IF tax_invoice."invoiceId" IS NOT NULL AND tax_invoice."invoiceId" <> linked_invoice_id THEN
      RAISE EXCEPTION 'TaxInvoice % invoiceId % conflicts with linked InvoiceItem invoice %', tax_invoice."id", tax_invoice."invoiceId", linked_invoice_id;
    END IF;

    IF tax_invoice."invoiceId" IS NULL THEN
      UPDATE "TaxInvoice"
      SET "invoiceId" = linked_invoice_id,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = tax_invoice."id"
        AND "organizationId" = tax_invoice."organizationId";
    END IF;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS "InvoiceItem_tax_invoice_consistency_guard" ON "InvoiceItem";
DROP FUNCTION IF EXISTS "assert_invoice_item_tax_invoice_consistency"();

ALTER TABLE "InvoiceItem" DROP CONSTRAINT IF EXISTS "InvoiceItem_taxInvoiceId_organizationId_fkey";
DROP INDEX IF EXISTS "InvoiceItem_taxInvoiceId_organizationId_idx";
ALTER TABLE "InvoiceItem" DROP COLUMN "taxInvoiceId";

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assert_issued_invoice_is_immutable"()
RETURNS TRIGGER AS $$
DECLARE
  invoice_status "InvoiceStatus";
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT "status"
    INTO invoice_status
    FROM "Invoice"
    WHERE "id" = OLD."invoiceId"
      AND "organizationId" = OLD."organizationId";

    IF invoice_status <> 'DRAFT' THEN
      IF TG_TABLE_NAME = 'InvoiceItem' THEN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Issued or canceled invoice items cannot be deleted';
        END IF;

        RAISE EXCEPTION 'Issued or canceled invoice items cannot be changed';
      END IF;

      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Issued or canceled invoice adjustments cannot be deleted';
      END IF;

      RAISE EXCEPTION 'Issued or canceled invoice adjustments cannot be changed';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT "status"
    INTO invoice_status
    FROM "Invoice"
    WHERE "id" = NEW."invoiceId"
      AND "organizationId" = NEW."organizationId";

    IF invoice_status <> 'DRAFT' THEN
      IF TG_TABLE_NAME = 'InvoiceItem' THEN
        RAISE EXCEPTION 'Issued or canceled invoice items cannot be changed';
      END IF;

      RAISE EXCEPTION 'Issued or canceled invoice adjustments cannot be changed';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "InvoiceItem_issued_invoice_immutable_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceItem"
FOR EACH ROW EXECUTE FUNCTION "assert_issued_invoice_is_immutable"();

CREATE TRIGGER "InvoiceAdjustment_issued_invoice_immutable_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceAdjustment"
FOR EACH ROW EXECUTE FUNCTION "assert_issued_invoice_is_immutable"();
