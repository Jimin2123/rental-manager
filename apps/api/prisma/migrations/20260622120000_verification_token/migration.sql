CREATE TYPE "VerificationTokenType" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

CREATE TABLE "VerificationToken" (
  "id"        TEXT         NOT NULL,
  "token"     TEXT         NOT NULL,
  "type"      "VerificationTokenType" NOT NULL,
  "accountId" TEXT         NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE INDEX "VerificationToken_accountId_idx" ON "VerificationToken"("accountId");

ALTER TABLE "VerificationToken"
  ADD CONSTRAINT "VerificationToken_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
