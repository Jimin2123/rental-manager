-- 입금계좌(DepositAccount) 도입 + Payment/Refund 연결
-- CreateTable
CREATE TABLE "DepositAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "label" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "memo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DepositAccount_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "DepositAccount_id_organizationId_key" ON "DepositAccount"("id", "organizationId");
CREATE INDEX "DepositAccount_organizationId_idx" ON "DepositAccount"("organizationId");
CREATE INDEX "DepositAccount_organizationId_isActive_idx" ON "DepositAccount"("organizationId", "isActive");

-- 기본계좌는 조직당 1개 (삭제되지 않은 활성 후보 중)
CREATE UNIQUE INDEX "DepositAccount_one_default_per_org" ON "DepositAccount"("organizationId")
    WHERE "isDefault" AND "deletedAt" IS NULL;

-- 동일 조직 내 (은행명, 계좌번호) 중복 방지 (삭제되지 않은 것 한정)
CREATE UNIQUE INDEX "DepositAccount_active_bank_account_unique" ON "DepositAccount"("organizationId", "bankName", "accountNumber")
    WHERE "deletedAt" IS NULL;

-- FK to Organization
ALTER TABLE "DepositAccount" ADD CONSTRAINT "DepositAccount_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payment.depositAccountId
ALTER TABLE "Payment" ADD COLUMN "depositAccountId" TEXT;
CREATE INDEX "Payment_organizationId_depositAccountId_idx" ON "Payment"("organizationId", "depositAccountId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_depositAccountId_organizationId_fkey"
    FOREIGN KEY ("depositAccountId", "organizationId") REFERENCES "DepositAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Refund.depositAccountId
ALTER TABLE "Refund" ADD COLUMN "depositAccountId" TEXT;
CREATE INDEX "Refund_organizationId_depositAccountId_idx" ON "Refund"("organizationId", "depositAccountId");
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_depositAccountId_organizationId_fkey"
    FOREIGN KEY ("depositAccountId", "organizationId") REFERENCES "DepositAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
