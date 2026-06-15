ALTER TYPE "InvoiceItemType" ADD VALUE 'METER_USAGE' AFTER 'RENTAL_FEE';

ALTER TABLE "InvoiceItem" DROP CONSTRAINT IF EXISTS "InvoiceItem_source_type_check";

ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_source_type_check" CHECK (
  NOT ("saleOrderItemId" IS NOT NULL AND ("rentalOrderItemId" IS NOT NULL OR "rentalContractItemId" IS NOT NULL))
  AND (type <> 'SALE_PRICE' OR ("saleOrderItemId" IS NOT NULL AND "rentalOrderItemId" IS NULL AND "rentalContractItemId" IS NULL))
  AND (type <> 'RENTAL_FEE' OR ("saleOrderItemId" IS NULL AND "rentalOrderItemId" IS NOT NULL))
  AND (type <> 'METER_USAGE' OR ("saleOrderItemId" IS NULL AND "rentalContractItemId" IS NOT NULL))
  AND (type = 'SALE_PRICE' OR "saleOrderItemId" IS NULL)
  AND (type IN ('RENTAL_FEE', 'METER_USAGE') OR ("rentalOrderItemId" IS NULL AND "rentalContractItemId" IS NULL))
  AND (type = 'RENTAL_FEE' OR "rentalOrderItemId" IS NULL)
);

CREATE OR REPLACE FUNCTION "assert_meter_reading_invoice_item_scope"()
RETURNS TRIGGER AS $$
DECLARE
  invoice_item_type "InvoiceItemType";
  invoice_item_contract_item_id TEXT;
BEGIN
  IF NEW."invoiceItemId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."rentalContractItemId" IS NULL THEN
    RAISE EXCEPTION 'MeterReading must reference rentalContractItemId before linking to an InvoiceItem';
  END IF;

  SELECT "type", "rentalContractItemId"
  INTO invoice_item_type, invoice_item_contract_item_id
  FROM "InvoiceItem"
  WHERE "id" = NEW."invoiceItemId"
    AND "organizationId" = NEW."organizationId";

  IF invoice_item_type <> 'METER_USAGE' THEN
    RAISE EXCEPTION 'MeterReading can only link to METER_USAGE InvoiceItem';
  END IF;

  IF invoice_item_contract_item_id IS DISTINCT FROM NEW."rentalContractItemId" THEN
    RAISE EXCEPTION 'MeterReading rental contract item must match InvoiceItem rental contract item';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "MeterReading_invoice_item_scope_guard"
AFTER INSERT OR UPDATE OF "organizationId", "rentalContractItemId", "invoiceItemId" ON "MeterReading"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_meter_reading_invoice_item_scope"();

CREATE OR REPLACE FUNCTION "assert_invoice_item_meter_reading_scope"()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "MeterReading"
    WHERE "invoiceItemId" = NEW."id"
      AND "organizationId" = NEW."organizationId"
      AND (
        NEW."type" <> 'METER_USAGE'
        OR NEW."rentalContractItemId" IS NULL
        OR "MeterReading"."rentalContractItemId" IS DISTINCT FROM NEW."rentalContractItemId"
      )
  ) THEN
    RAISE EXCEPTION 'InvoiceItem update would leave existing MeterReadings outside a METER_USAGE invoice item';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "InvoiceItem_meter_reading_scope_guard"
AFTER UPDATE OF "organizationId", "type", "rentalContractItemId" ON "InvoiceItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_invoice_item_meter_reading_scope"();
