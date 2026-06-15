ALTER TABLE "InvoiceItem" ADD COLUMN "rentalContractItemId" TEXT;

CREATE INDEX "InvoiceItem_rentalContractItemId_idx" ON "InvoiceItem"("rentalContractItemId");

ALTER TABLE "InvoiceItem" DROP CONSTRAINT "InvoiceItem_source_type_check";
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_source_type_check" CHECK (
  NOT ("saleOrderItemId" IS NOT NULL AND ("rentalOrderItemId" IS NOT NULL OR "rentalContractItemId" IS NOT NULL))
  AND (type <> 'SALE_PRICE' OR ("saleOrderItemId" IS NOT NULL AND "rentalOrderItemId" IS NULL AND "rentalContractItemId" IS NULL))
  AND (type <> 'RENTAL_FEE' OR "rentalOrderItemId" IS NOT NULL)
  AND (type = 'SALE_PRICE' OR "saleOrderItemId" IS NULL)
  AND (type = 'RENTAL_FEE' OR ("rentalOrderItemId" IS NULL AND "rentalContractItemId" IS NULL))
);

ALTER TABLE "InvoiceItem"
  ADD CONSTRAINT "InvoiceItem_rentalContractItemId_organizationId_fkey"
  FOREIGN KEY ("rentalContractItemId", "organizationId")
  REFERENCES "RentalContractItem"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "assert_invoice_item_rental_contract_item_scope"()
RETURNS TRIGGER AS $$
DECLARE
  invoice_type "InvoiceType";
  invoice_contract_id TEXT;
  contract_item_contract_id TEXT;
  contract_item_order_item_id TEXT;
BEGIN
  IF NEW."rentalContractItemId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "type", "rentalContractId"
  INTO invoice_type, invoice_contract_id
  FROM "Invoice"
  WHERE "id" = NEW."invoiceId"
    AND "organizationId" = NEW."organizationId";

  IF invoice_type <> 'RENTAL_MONTHLY' OR invoice_contract_id IS NULL THEN
    RAISE EXCEPTION 'InvoiceItem rentalContractItemId is only allowed for RENTAL_MONTHLY invoices';
  END IF;

  SELECT "rentalContractId", "rentalOrderItemId"
  INTO contract_item_contract_id, contract_item_order_item_id
  FROM "RentalContractItem"
  WHERE "id" = NEW."rentalContractItemId"
    AND "organizationId" = NEW."organizationId";

  IF contract_item_contract_id IS DISTINCT FROM invoice_contract_id THEN
    RAISE EXCEPTION 'InvoiceItem rental contract item must belong to invoice rental contract';
  END IF;

  IF NEW."rentalOrderItemId" IS NOT NULL
     AND contract_item_order_item_id IS DISTINCT FROM NEW."rentalOrderItemId" THEN
    RAISE EXCEPTION 'InvoiceItem rental order item must match rental contract item source order item';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "InvoiceItem_rental_contract_item_scope_guard"
AFTER INSERT OR UPDATE OF "organizationId", "invoiceId", "rentalOrderItemId", "rentalContractItemId" ON "InvoiceItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_invoice_item_rental_contract_item_scope"();

CREATE OR REPLACE FUNCTION "assert_invoice_rental_contract_item_scope"()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "InvoiceItem"
    WHERE "invoiceId" = NEW."id"
      AND "organizationId" = NEW."organizationId"
      AND "rentalContractItemId" IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW."type" <> 'RENTAL_MONTHLY' OR NEW."rentalContractId" IS NULL THEN
    RAISE EXCEPTION 'Invoice update would leave existing InvoiceItems with rentalContractItemId outside a RENTAL_MONTHLY invoice';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "InvoiceItem" AS invoice_item
    LEFT JOIN "RentalContractItem" AS contract_item
      ON contract_item."id" = invoice_item."rentalContractItemId"
     AND contract_item."organizationId" = invoice_item."organizationId"
    WHERE invoice_item."invoiceId" = NEW."id"
      AND invoice_item."organizationId" = NEW."organizationId"
      AND invoice_item."rentalContractItemId" IS NOT NULL
      AND (
        contract_item."id" IS NULL
        OR contract_item."rentalContractId" IS DISTINCT FROM NEW."rentalContractId"
        OR (
          invoice_item."rentalOrderItemId" IS NOT NULL
          AND contract_item."rentalOrderItemId" IS DISTINCT FROM invoice_item."rentalOrderItemId"
        )
      )
  ) THEN
    RAISE EXCEPTION 'Invoice update would leave existing InvoiceItems with rentalContractItemId outside invoice rental contract';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "Invoice_rental_contract_item_scope_guard"
AFTER UPDATE OF "organizationId", "type", "rentalContractId" ON "Invoice"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_invoice_rental_contract_item_scope"();

CREATE OR REPLACE FUNCTION "assert_rental_contract_item_invoice_scope"()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "InvoiceItem" AS invoice_item
    LEFT JOIN "Invoice" AS invoice
      ON invoice."id" = invoice_item."invoiceId"
     AND invoice."organizationId" = invoice_item."organizationId"
    WHERE invoice_item."rentalContractItemId" = NEW."id"
      AND invoice_item."organizationId" = NEW."organizationId"
      AND (
        invoice."id" IS NULL
        OR invoice."type" <> 'RENTAL_MONTHLY'
        OR invoice."rentalContractId" IS NULL
        OR NEW."rentalContractId" IS DISTINCT FROM invoice."rentalContractId"
        OR (
          invoice_item."rentalOrderItemId" IS NOT NULL
          AND NEW."rentalOrderItemId" IS DISTINCT FROM invoice_item."rentalOrderItemId"
        )
      )
  ) THEN
    RAISE EXCEPTION 'RentalContractItem update would leave existing InvoiceItems with rentalContractItemId outside invoice rental contract';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "RentalContractItem_invoice_item_scope_guard"
AFTER UPDATE OF "organizationId", "rentalContractId", "rentalOrderItemId" ON "RentalContractItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_rental_contract_item_invoice_scope"();
