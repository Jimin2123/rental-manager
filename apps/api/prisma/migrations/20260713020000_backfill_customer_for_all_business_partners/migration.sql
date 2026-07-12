-- 모든 거래처에 Customer(BUSINESS) 레코드가 존재하도록 백필.
-- 담당직원 배정은 Customer를 앵커로 사용하므로 역할(SALES/PURCHASE)에 무관하게 필요.
INSERT INTO "Customer" (
  "id",
  "organizationId",
  "type",
  "businessPartnerId",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  bp."organizationId",
  'BUSINESS'::"CustomerType",
  bp."id",
  true,
  NOW(),
  NOW()
FROM "BusinessPartner" bp
WHERE bp."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Customer" c
    WHERE c."businessPartnerId" = bp."id"
      AND c."deletedAt" IS NULL
  );
