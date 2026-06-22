-- Fix 1: Asset status machine enforcement
-- The assert_status_transition trigger covers all status-bearing models except Asset.
-- This migration adds the missing guard so illegal transitions (e.g. SOLD → AVAILABLE,
-- DISPOSED → RENTED) are rejected at the DB level, not just in application code.

CREATE OR REPLACE FUNCTION "assert_asset_status_transition"()
RETURNS TRIGGER AS $$
DECLARE
  old_status TEXT;
  new_status TEXT;
  allowed    BOOLEAN := false;
BEGIN
  old_status := OLD."status"::TEXT;
  new_status := NEW."status"::TEXT;

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
  --   SOLD / DISPOSED / LOST: terminal — no outgoing transitions.
  allowed :=
    (old_status = 'INCOMING'     AND new_status IN ('AVAILABLE', 'DISPOSED'))
    OR (old_status = 'AVAILABLE'   AND new_status IN ('RENTED', 'SOLD', 'REPAIR', 'DISPOSED', 'LOST', 'UNAVAILABLE'))
    OR (old_status = 'RENTED'      AND new_status IN ('AVAILABLE', 'REPAIR', 'DISPOSED', 'LOST'))
    OR (old_status = 'REPAIR'      AND new_status IN ('AVAILABLE', 'DISPOSED', 'LOST'))
    OR (old_status = 'UNAVAILABLE' AND new_status IN ('AVAILABLE', 'REPAIR', 'DISPOSED', 'LOST'));

  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid Asset status transition: % -> %', old_status, new_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Asset_status_transition_guard"
BEFORE UPDATE OF "status" ON "Asset"
FOR EACH ROW EXECUTE FUNCTION "assert_asset_status_transition"();

-- Fix 2: Order cancellation cascades to DRAFT RentalContract
-- Without this, canceling an Order leaves the linked RentalContract in DRAFT,
-- creating an orphaned contract that can still be activated.

CREATE OR REPLACE FUNCTION "sync_rental_contract_on_order_cancel"()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" <> 'CANCELED' AND NEW."status" = 'CANCELED' THEN
    UPDATE "RentalContract" rc
    SET    "status"    = 'CANCELED',
           "updatedAt" = CURRENT_TIMESTAMP
    FROM   "RentalOrder" ro
    WHERE  ro."orderId"        = NEW."id"
      AND  ro."organizationId" = NEW."organizationId"
      AND  rc."rentalOrderId"  = ro."id"
      AND  rc."organizationId" = NEW."organizationId"
      AND  rc."status"         = 'DRAFT';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_cancel_sync_rental_contract"
AFTER UPDATE OF "status" ON "Order"
FOR EACH ROW EXECUTE FUNCTION "sync_rental_contract_on_order_cancel"();
