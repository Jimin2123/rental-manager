-- 환불 무결성 트리거 버그 수정.
-- 기존 assert_refund_integrity()는 invoiceId가 NULL인 환불(= 수납만 연결한 환불)에도
-- invoice 고객 일치 검사를 실행해 'Refund customer % does not match invoice <NULL> customer <NULL>'로 실패했다.
-- payment 검사처럼 invoiceId가 있을 때만 invoice 검사를 수행하도록 NULL 가드를 추가한다.
CREATE OR REPLACE FUNCTION "assert_refund_integrity"()
RETURNS TRIGGER AS $$
DECLARE
  invoice_customer_id TEXT;
  payment_customer_id TEXT;
BEGIN
  IF NEW."invoiceId" IS NOT NULL THEN
    SELECT "Invoice"."customerId"
    INTO invoice_customer_id
    FROM "Invoice"
    WHERE "Invoice"."id" = NEW."invoiceId"
      AND "Invoice"."organizationId" = NEW."organizationId";

    IF invoice_customer_id IS DISTINCT FROM NEW."customerId" THEN
      RAISE EXCEPTION 'Refund customer % does not match invoice % customer %', NEW."customerId", NEW."invoiceId", invoice_customer_id;
    END IF;
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
