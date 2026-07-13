-- customerContactId / individualProfileId 둘 다 NULL 허용으로 완화.
-- 사업자 고객은 거래처 전체에 배정하는 경우 둘 다 NULL이 될 수 있음.
-- 둘 다 동시에 NOT NULL인 경우만 차단 (상호배타 보장은 트리거에서 처리).
ALTER TABLE "CustomerAssignment"
  DROP CONSTRAINT "CustomerAssignment_contact_target_check",
  ADD CONSTRAINT "CustomerAssignment_contact_target_check" CHECK (
    "customerContactId" IS NULL OR "individualProfileId" IS NULL
  );
