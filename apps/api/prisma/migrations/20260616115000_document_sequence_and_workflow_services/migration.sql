CREATE TYPE "DocumentSequenceType" AS ENUM (
  'ORDER',
  'QUOTATION',
  'RENTAL_CONTRACT',
  'RENTAL_MANAGEMENT',
  'INVOICE',
  'PAYMENT',
  'REFUND',
  'TAX_INVOICE',
  'SERVICE_REQUEST'
);

CREATE TABLE "DocumentSequence" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "type" "DocumentSequenceType" NOT NULL,
  "dateKey" TEXT NOT NULL,
  "nextValue" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentSequence_next_value_positive_check" CHECK ("nextValue" > 0)
);

CREATE UNIQUE INDEX "DocumentSequence_organizationId_type_dateKey_key"
  ON "DocumentSequence"("organizationId", "type", "dateKey");
CREATE INDEX "DocumentSequence_organizationId_idx" ON "DocumentSequence"("organizationId");
CREATE INDEX "DocumentSequence_organizationId_type_idx" ON "DocumentSequence"("organizationId", "type");

ALTER TABLE "DocumentSequence"
  ADD CONSTRAINT "DocumentSequence_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
