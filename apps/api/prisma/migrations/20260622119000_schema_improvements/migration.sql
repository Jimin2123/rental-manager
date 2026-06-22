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
--    한 Payment의 총 배분액 <= Payment.amount
--    (Invoice 초과 배분은 OVERPAID 정상 케이스이므로 검증하지 않음)
-- ============================================================
CREATE OR REPLACE FUNCTION assert_payment_allocation_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_payment_amount  INT;
  v_total_allocated INT;
BEGIN
  -- Payment 총 배분액 검증: 받은 금액보다 많이 배분할 수 없음
  -- Invoice 초과 배분(OVERPAID)은 정상 비즈니스 케이스이므로 검증하지 않음
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

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "PaymentAllocation_limits_guard"
  AFTER INSERT OR UPDATE ON "PaymentAllocation"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION assert_payment_allocation_limits();
