CREATE TYPE "InvoiceSettlementStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERPAID');

ALTER TABLE "Invoice"
  ADD COLUMN "paidAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "outstandingAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "settlementStatus" "InvoiceSettlementStatus" NOT NULL DEFAULT 'UNPAID';

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_settlement_amount_non_negative_check" CHECK (
  "paidAmount" >= 0
  AND "refundedAmount" >= 0
  AND "outstandingAmount" >= 0
);

CREATE INDEX "Invoice_organizationId_settlementStatus_idx" ON "Invoice"("organizationId", "settlementStatus");
CREATE INDEX "Invoice_organizationId_customerId_settlementStatus_dueDate_idx"
  ON "Invoice"("organizationId", "customerId", "settlementStatus", "dueDate");

CREATE OR REPLACE FUNCTION "recalculate_invoice_financials"(invoice_id TEXT, org_id TEXT)
RETURNS VOID AS $$
DECLARE
  invoice_status "InvoiceStatus";
  item_total INTEGER;
  adjustment_total INTEGER;
  final_amount INTEGER;
  paid_amount INTEGER;
  refunded_amount INTEGER;
  net_paid_amount INTEGER;
  outstanding_amount INTEGER;
  settlement_status "InvoiceSettlementStatus";
  previous_recalculate_setting TEXT;
BEGIN
  SELECT "status"
  INTO invoice_status
  FROM "Invoice"
  WHERE "id" = invoice_id
    AND "organizationId" = org_id;

  IF invoice_status IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM("totalAmount"), 0)
  INTO item_total
  FROM "InvoiceItem"
  WHERE "invoiceId" = invoice_id
    AND "organizationId" = org_id;

  SELECT COALESCE(SUM("amount"), 0)
  INTO adjustment_total
  FROM "InvoiceAdjustment"
  WHERE "invoiceId" = invoice_id
    AND "organizationId" = org_id;

  SELECT COALESCE(SUM("PaymentAllocation"."amount"), 0)
  INTO paid_amount
  FROM "PaymentAllocation"
  INNER JOIN "Payment"
    ON "Payment"."id" = "PaymentAllocation"."paymentId"
   AND "Payment"."organizationId" = "PaymentAllocation"."organizationId"
  WHERE "PaymentAllocation"."invoiceId" = invoice_id
    AND "PaymentAllocation"."organizationId" = org_id
    AND "Payment"."status" = 'COMPLETED';

  SELECT COALESCE(SUM("amount"), 0)
  INTO refunded_amount
  FROM "Refund"
  WHERE "invoiceId" = invoice_id
    AND "organizationId" = org_id
    AND "status" = 'COMPLETED';

  final_amount := item_total + adjustment_total;
  net_paid_amount := paid_amount - refunded_amount;
  outstanding_amount := GREATEST(final_amount - net_paid_amount, 0);

  IF net_paid_amount > final_amount THEN
    settlement_status := 'OVERPAID';
  ELSIF net_paid_amount <= 0 THEN
    settlement_status := 'UNPAID';
  ELSIF net_paid_amount < final_amount THEN
    settlement_status := 'PARTIALLY_PAID';
  ELSE
    settlement_status := 'PAID';
  END IF;

  previous_recalculate_setting := COALESCE(
    current_setting('rental_manager.invoice_financials_recalculate', true),
    'off'
  );
  PERFORM set_config('rental_manager.invoice_financials_recalculate', 'on', true);

  UPDATE "Invoice"
  SET "finalAmount" = final_amount,
      "paidAmount" = paid_amount,
      "refundedAmount" = refunded_amount,
      "outstandingAmount" = outstanding_amount,
      "settlementStatus" = settlement_status,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "id" = invoice_id
    AND "organizationId" = org_id;

  PERFORM set_config('rental_manager.invoice_financials_recalculate', previous_recalculate_setting, true);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assert_invoice_settlement_summary_managed"()
RETURNS TRIGGER AS $$
BEGIN
  IF lower(COALESCE(current_setting('rental_manager.invoice_financials_recalculate', true), 'off')) IN ('on', 'true', '1') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."finalAmount" <> 0
       OR NEW."paidAmount" <> 0
       OR NEW."refundedAmount" <> 0
       OR NEW."outstandingAmount" <> 0
       OR NEW."settlementStatus" <> 'UNPAID' THEN
      RAISE EXCEPTION 'Invoice settlement summary fields are managed by database recalculation';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD."finalAmount" IS DISTINCT FROM NEW."finalAmount"
     OR OLD."paidAmount" IS DISTINCT FROM NEW."paidAmount"
     OR OLD."refundedAmount" IS DISTINCT FROM NEW."refundedAmount"
     OR OLD."outstandingAmount" IS DISTINCT FROM NEW."outstandingAmount"
     OR OLD."settlementStatus" IS DISTINCT FROM NEW."settlementStatus" THEN
    RAISE EXCEPTION 'Invoice settlement summary fields are managed by database recalculation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Invoice_settlement_summary_managed_guard"
BEFORE INSERT OR UPDATE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION "assert_invoice_settlement_summary_managed"();

CREATE OR REPLACE FUNCTION "sync_invoice_final_amount"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM "recalculate_invoice_financials"(NEW."invoiceId", NEW."organizationId");
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM "recalculate_invoice_financials"(OLD."invoiceId", OLD."organizationId");
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "sync_invoice_financials_from_payment_allocation"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM "recalculate_invoice_financials"(NEW."invoiceId", NEW."organizationId");
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM "recalculate_invoice_financials"(OLD."invoiceId", OLD."organizationId");
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "sync_invoice_financials_from_payment"()
RETURNS TRIGGER AS $$
DECLARE
  allocated_invoice RECORD;
BEGIN
  FOR allocated_invoice IN
    SELECT DISTINCT "invoiceId", "organizationId"
    FROM "PaymentAllocation"
    WHERE "paymentId" = NEW."id"
      AND "organizationId" = NEW."organizationId"
  LOOP
    PERFORM "recalculate_invoice_financials"(allocated_invoice."invoiceId", allocated_invoice."organizationId");
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "sync_invoice_financials_from_refund"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM "recalculate_invoice_financials"(NEW."invoiceId", NEW."organizationId");
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM "recalculate_invoice_financials"(OLD."invoiceId", OLD."organizationId");
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PaymentAllocation_sync_invoice_financials"
AFTER INSERT OR UPDATE OR DELETE ON "PaymentAllocation"
FOR EACH ROW EXECUTE FUNCTION "sync_invoice_financials_from_payment_allocation"();

CREATE TRIGGER "Payment_sync_invoice_financials"
AFTER UPDATE OF "status", "amount" ON "Payment"
FOR EACH ROW EXECUTE FUNCTION "sync_invoice_financials_from_payment"();

CREATE TRIGGER "Refund_sync_invoice_financials"
AFTER INSERT OR UPDATE OR DELETE ON "Refund"
FOR EACH ROW EXECUTE FUNCTION "sync_invoice_financials_from_refund"();

SELECT "recalculate_invoice_financials"("Invoice"."id", "Invoice"."organizationId")
FROM "Invoice";
