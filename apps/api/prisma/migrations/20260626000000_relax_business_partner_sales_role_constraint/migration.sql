-- 거래처 SALES 역할 제거 제약 완화
-- 기존: 법인고객이 존재하면 무조건 차단
-- 변경: 진행 중인 주문(REGISTERED/CONFIRMED/IN_DELIVERY) 또는 활성 렌탈 계약(DRAFT/ACTIVE)이 있을 때만 차단

CREATE OR REPLACE FUNCTION "assert_business_partner_sales_role_removal"()
RETURNS trigger AS $$
DECLARE
    active_order_count    INTEGER;
    active_contract_count INTEGER;
BEGIN
    -- SALES 역할이 아닌 경우 무시
    IF OLD."type" <> 'SALES' THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    -- UPDATE인데 SALES 역할·거래처·조직 모두 그대로면 무시
    IF TG_OP = 'UPDATE' THEN
        IF NEW."type" = 'SALES'
           AND NEW."businessPartnerId" = OLD."businessPartnerId"
           AND NEW."organizationId"   = OLD."organizationId" THEN
            RETURN NEW;
        END IF;
    END IF;

    -- 진행 중인 주문 확인 (취소·납품완료 제외)
    SELECT COUNT(*)
    INTO active_order_count
    FROM "Order" o
    JOIN "Customer" c
      ON c."id"             = o."customerId"
     AND c."organizationId" = o."organizationId"
    WHERE c."businessPartnerId" = OLD."businessPartnerId"
      AND c."organizationId"   = OLD."organizationId"
      AND c."type"             = 'BUSINESS'
      AND c."deletedAt"        IS NULL
      AND o."status"           NOT IN ('CANCELED', 'DELIVERED');

    IF active_order_count > 0 THEN
        RAISE EXCEPTION '진행 중인 주문이 있어 매출 거래처 역할을 해제할 수 없습니다.';
    END IF;

    -- 활성 렌탈 계약 확인 (DRAFT·ACTIVE)
    SELECT COUNT(*)
    INTO active_contract_count
    FROM "RentalContract" rc
    JOIN "RentalOrder" ro
      ON ro."id"             = rc."rentalOrderId"
     AND ro."organizationId" = rc."organizationId"
    JOIN "Order" o
      ON o."id"             = ro."orderId"
     AND o."organizationId" = ro."organizationId"
    JOIN "Customer" c
      ON c."id"             = o."customerId"
     AND c."organizationId" = o."organizationId"
    WHERE c."businessPartnerId" = OLD."businessPartnerId"
      AND c."organizationId"   = OLD."organizationId"
      AND c."type"             = 'BUSINESS'
      AND c."deletedAt"        IS NULL
      AND rc."status"          IN ('DRAFT', 'ACTIVE');

    IF active_contract_count > 0 THEN
        RAISE EXCEPTION '활성 렌탈 계약이 있어 매출 거래처 역할을 해제할 수 없습니다.';
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
