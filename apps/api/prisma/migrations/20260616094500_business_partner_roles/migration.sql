-- CreateEnum
CREATE TYPE "BusinessPartnerRoleType" AS ENUM ('SALES', 'PURCHASE');

-- CreateTable
CREATE TABLE "BusinessPartnerRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessPartnerId" TEXT NOT NULL,
    "type" "BusinessPartnerRoleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPartnerRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPartnerRole_businessPartnerId_organizationId_type_key"
    ON "BusinessPartnerRole"("businessPartnerId", "organizationId", "type");
CREATE INDEX "BusinessPartnerRole_organizationId_idx" ON "BusinessPartnerRole"("organizationId");
CREATE INDEX "BusinessPartnerRole_organizationId_businessPartnerId_idx"
    ON "BusinessPartnerRole"("organizationId", "businessPartnerId");
CREATE INDEX "BusinessPartnerRole_organizationId_type_idx" ON "BusinessPartnerRole"("organizationId", "type");

-- AddForeignKey
ALTER TABLE "BusinessPartnerRole"
    ADD CONSTRAINT "BusinessPartnerRole_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BusinessPartnerRole"
    ADD CONSTRAINT "BusinessPartnerRole_businessPartnerId_organizationId_fkey"
    FOREIGN KEY ("businessPartnerId", "organizationId")
    REFERENCES "BusinessPartner"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cross-table integrity guards.
CREATE OR REPLACE FUNCTION "assert_customer_business_partner_sales_role"()
RETURNS trigger AS $$
DECLARE
    sales_role_count INTEGER;
BEGIN
    IF NEW."type" <> 'BUSINESS' OR NEW."deletedAt" IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*)
    INTO sales_role_count
    FROM "BusinessPartnerRole"
    WHERE "businessPartnerId" = NEW."businessPartnerId"
      AND "organizationId" = NEW."organizationId"
      AND "type" = 'SALES';

    IF sales_role_count = 0 THEN
        RAISE EXCEPTION 'Business customer must reference a business partner with SALES role';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Customer_business_partner_sales_role_guard"
BEFORE INSERT OR UPDATE OF "organizationId", "type", "businessPartnerId", "deletedAt" ON "Customer"
FOR EACH ROW EXECUTE FUNCTION "assert_customer_business_partner_sales_role"();

CREATE OR REPLACE FUNCTION "assert_order_customer_sales_role"()
RETURNS trigger AS $$
DECLARE
    customer_type "CustomerType";
    customer_business_partner_id TEXT;
    sales_role_count INTEGER;
BEGIN
    SELECT "type", "businessPartnerId"
    INTO customer_type, customer_business_partner_id
    FROM "Customer"
    WHERE "id" = NEW."customerId"
      AND "organizationId" = NEW."organizationId"
      AND "deletedAt" IS NULL;

    IF customer_type IS NULL THEN
        RAISE EXCEPTION 'Order customer must be an active customer in the same organization';
    END IF;

    IF customer_type <> 'BUSINESS' THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*)
    INTO sales_role_count
    FROM "BusinessPartnerRole"
    WHERE "businessPartnerId" = customer_business_partner_id
      AND "organizationId" = NEW."organizationId"
      AND "type" = 'SALES';

    IF sales_role_count = 0 THEN
        RAISE EXCEPTION 'Order business customer must have SALES business partner role';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_customer_sales_role_guard"
BEFORE INSERT OR UPDATE OF "organizationId", "customerId" ON "Order"
FOR EACH ROW EXECUTE FUNCTION "assert_order_customer_sales_role"();

CREATE OR REPLACE FUNCTION "assert_business_partner_sales_role_removal"()
RETURNS trigger AS $$
DECLARE
    active_customer_count INTEGER;
BEGIN
    IF OLD."type" <> 'SALES' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW."type" = 'SALES'
           AND NEW."businessPartnerId" = OLD."businessPartnerId"
           AND NEW."organizationId" = OLD."organizationId" THEN
            RETURN NEW;
        END IF;
    END IF;

    SELECT COUNT(*)
    INTO active_customer_count
    FROM "Customer"
    WHERE "businessPartnerId" = OLD."businessPartnerId"
      AND "organizationId" = OLD."organizationId"
      AND "type" = 'BUSINESS'
      AND "deletedAt" IS NULL;

    IF active_customer_count > 0 THEN
        RAISE EXCEPTION 'Cannot remove SALES role while active business customers reference this business partner';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BusinessPartnerRole_sales_role_update_guard"
BEFORE UPDATE OF "organizationId", "businessPartnerId", "type" ON "BusinessPartnerRole"
FOR EACH ROW EXECUTE FUNCTION "assert_business_partner_sales_role_removal"();

CREATE TRIGGER "BusinessPartnerRole_sales_role_delete_guard"
BEFORE DELETE ON "BusinessPartnerRole"
FOR EACH ROW EXECUTE FUNCTION "assert_business_partner_sales_role_removal"();
