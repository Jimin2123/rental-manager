-- ============================================================
-- 1. Account: emailVerifiedAt 추가
--    isActive는 관리자 정지 전용, 이메일 인증 여부는 이 필드로 구분
-- ============================================================
ALTER TABLE "Account" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- ============================================================
-- 2. Refund: invoiceId nullable화
--    청구서 없는 직접 환불(초과 입금 즉시 반환 등) 허용
-- ============================================================
ALTER TABLE "Refund" ALTER COLUMN "invoiceId" DROP NOT NULL;

-- ============================================================
-- 3. MeterReading: billingMonth 추가 (YYYY-MM)
--    청구 전에도 어느 달 분인지 명시
-- ============================================================
ALTER TABLE "MeterReading" ADD COLUMN "billingMonth" TEXT;

CREATE INDEX "MeterReading_organizationId_billingMonth_idx"
  ON "MeterReading"("organizationId", "billingMonth");

-- ============================================================
-- 4. PaymentAllocation 합계 검증 트리거
--    (a) 한 Payment의 총 배분액 <= Payment.amount
--    (b) 한 Invoice의 총 배분액 <= Invoice.finalAmount
-- ============================================================
CREATE OR REPLACE FUNCTION assert_payment_allocation_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_amount      INT;
  v_total_allocated     INT;
  v_invoice_final       INT;
  v_invoice_allocated   INT;
BEGIN
  -- (a) Payment 총 배분액 검증
  SELECT amount INTO v_payment_amount
    FROM "Payment"
   WHERE id = NEW."paymentId";

  SELECT COALESCE(SUM(amount), 0) INTO v_total_allocated
    FROM "PaymentAllocation"
   WHERE "paymentId" = NEW."paymentId"
     AND id IS DISTINCT FROM NEW.id; -- UPDATE 시 자기 자신 제외

  IF v_total_allocated + NEW.amount > v_payment_amount THEN
    RAISE EXCEPTION
      'PaymentAllocation 합계(%)가 Payment.amount(%)를 초과합니다.',
      v_total_allocated + NEW.amount, v_payment_amount;
  END IF;

  -- (b) Invoice 총 배분액 검증
  SELECT "finalAmount" INTO v_invoice_final
    FROM "Invoice"
   WHERE id = NEW."invoiceId";

  SELECT COALESCE(SUM(amount), 0) INTO v_invoice_allocated
    FROM "PaymentAllocation"
   WHERE "invoiceId" = NEW."invoiceId"
     AND id IS DISTINCT FROM NEW.id;

  IF v_invoice_allocated + NEW.amount > v_invoice_final THEN
    RAISE EXCEPTION
      'PaymentAllocation 합계(%)가 Invoice.finalAmount(%)를 초과합니다.',
      v_invoice_allocated + NEW.amount, v_invoice_final;
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "PaymentAllocation_limits_guard"
  AFTER INSERT OR UPDATE ON "PaymentAllocation"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION assert_payment_allocation_limits();
