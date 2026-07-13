-- 사업자 고객 배정 시 거래처 담당자(customerContactId) 필수 → 선택으로 완화.
-- 거래처 전체에 담당 직원을 배정하는 것이 실제 업무 맥락에 맞음.
CREATE OR REPLACE FUNCTION "assert_customer_assignment_scope"()
RETURNS trigger AS $$
DECLARE
    customer_type "CustomerType";
    customer_individual_profile_id TEXT;
    customer_business_partner_id TEXT;
    contact_count INTEGER;
BEGIN
    SELECT "type", "individualProfileId", "businessPartnerId"
    INTO customer_type, customer_individual_profile_id, customer_business_partner_id
    FROM "Customer"
    WHERE "id" = NEW."customerId"
      AND "organizationId" = NEW."organizationId"
      AND "deletedAt" IS NULL;

    IF customer_type IS NULL THEN
        RAISE EXCEPTION 'CustomerAssignment customer must be an active customer in the same organization';
    END IF;

    IF customer_type = 'INDIVIDUAL' THEN
        IF NEW."individualProfileId" IS DISTINCT FROM customer_individual_profile_id OR NEW."customerContactId" IS NOT NULL THEN
            RAISE EXCEPTION 'Individual customer assignment must target the customer individual profile';
        END IF;
    ELSE
        -- 사업자 고객: individualProfileId는 항상 NULL, customerContactId는 선택
        IF NEW."individualProfileId" IS NOT NULL THEN
            RAISE EXCEPTION 'Business customer assignment must not target an individual profile';
        END IF;

        -- 거래처 담당자가 지정된 경우 해당 거래처 소속인지 검증
        IF NEW."customerContactId" IS NOT NULL THEN
            SELECT COUNT(*)
            INTO contact_count
            FROM "BusinessPartnerContact"
            WHERE "id" = NEW."customerContactId"
              AND "organizationId" = NEW."organizationId"
              AND "businessPartnerId" = customer_business_partner_id;

            IF contact_count = 0 THEN
                RAISE EXCEPTION 'CustomerAssignment contact must belong to the customer business partner';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
