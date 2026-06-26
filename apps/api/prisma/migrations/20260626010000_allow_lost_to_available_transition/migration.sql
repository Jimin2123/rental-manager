-- LOST → AVAILABLE(발견) 전환 허용
-- 기존 트리거는 LOST를 terminal 상태로 정의했으나,
-- 스펙상 분실 자산을 발견했을 때 AVAILABLE로 복귀시킬 수 있어야 한다.

CREATE OR REPLACE FUNCTION "assert_asset_status_transition"()
RETURNS TRIGGER AS $$
DECLARE
  old_status TEXT := OLD.status::TEXT;
  new_status TEXT := NEW.status::TEXT;
  allowed    BOOLEAN := false;
BEGIN
  IF old_status = new_status THEN
    RETURN NEW;
  END IF;

  -- Honour the same operational override used by assert_status_transition.
  IF lower(COALESCE(current_setting('rental_manager.status_transition_override', true), 'off')) IN ('on', 'true', '1') THEN
    RETURN NEW;
  END IF;

  -- Allowed transitions:
  --   INCOMING    → AVAILABLE (입고 완료), DISPOSED (불량 폐기)
  --   AVAILABLE   → RENTED (계약 활성화), SOLD (판매), REPAIR (수리),
  --                 DISPOSED (폐기), LOST (분실), UNAVAILABLE (사용 불가)
  --   RENTED      → AVAILABLE (반납/계약 종료), REPAIR (현장 수리), DISPOSED, LOST
  --   REPAIR      → AVAILABLE (수리 완료), DISPOSED, LOST
  --   UNAVAILABLE → AVAILABLE (재사용 가능), REPAIR, DISPOSED, LOST
  --   LOST        → AVAILABLE (발견)
  --   SOLD / DISPOSED: terminal — no outgoing transitions.
  allowed :=
    (old_status = 'INCOMING'     AND new_status IN ('AVAILABLE', 'DISPOSED'))
    OR (old_status = 'AVAILABLE'   AND new_status IN ('RENTED', 'SOLD', 'REPAIR', 'DISPOSED', 'LOST', 'UNAVAILABLE'))
    OR (old_status = 'RENTED'      AND new_status IN ('AVAILABLE', 'REPAIR', 'DISPOSED', 'LOST'))
    OR (old_status = 'REPAIR'      AND new_status IN ('AVAILABLE', 'DISPOSED', 'LOST'))
    OR (old_status = 'UNAVAILABLE' AND new_status IN ('AVAILABLE', 'REPAIR', 'DISPOSED', 'LOST'))
    OR (old_status = 'LOST'        AND new_status IN ('AVAILABLE'));

  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid Asset status transition: % -> %', old_status, new_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
