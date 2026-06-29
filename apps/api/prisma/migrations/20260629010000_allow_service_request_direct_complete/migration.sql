-- ServiceRequest 전이맵 보완: 예약된 방문을 바로 처리·완료하는 정상 흐름 허용.
-- 기존 assert_status_transition는 IN_PROGRESS->COMPLETED만 허용해, 방문 완료 시
-- 자동전이(SCHEDULED/WAITING_FOR_PARTS -> COMPLETED)가 막혀 500이 발생했다.
-- SCHEDULED->COMPLETED, WAITING_FOR_PARTS->COMPLETED를 허용 전이에 추가한다.
-- (다른 테이블 전이 규칙·override 메커니즘은 20260616110000과 동일하게 유지)
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

  IF lower(COALESCE(current_setting('rental_manager.status_transition_override', true), 'off')) IN ('on', 'true', '1') THEN
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
      OR (old_status = 'SCHEDULED' AND new_status IN ('IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'CANCELED'))
      OR (old_status = 'IN_PROGRESS' AND new_status IN ('WAITING_FOR_PARTS', 'COMPLETED', 'CANCELED'))
      OR (old_status = 'WAITING_FOR_PARTS' AND new_status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'));
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
