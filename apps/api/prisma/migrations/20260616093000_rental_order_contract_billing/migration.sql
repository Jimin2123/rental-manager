-- CreateEnum
CREATE TYPE "RentalContractStatus" AS ENUM ('ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RentalBillingStatus" AS ENUM ('SCHEDULED', 'ISSUED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RentalBillingItemType" AS ENUM ('MONTHLY_RENT', 'DEPOSIT', 'INSTALLATION', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "RentalOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "managementNo" TEXT,
    "isRenewal" BOOLEAN NOT NULL DEFAULT false,
    "contractDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalOrderItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rentalOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT,
    "serialNumber" TEXT,
    "isUsedAssetShipment" BOOLEAN NOT NULL DEFAULT false,
    "purchaseAmount" INTEGER,
    "warrantyExpiresAt" TIMESTAMP(3),
    "monthlyRentalPrice" INTEGER NOT NULL,
    "depositAmount" INTEGER,
    "installationLocation" TEXT,
    "specialTerms" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalOrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RentalOrderItem_amount_non_negative_check" CHECK (
        "monthlyRentalPrice" >= 0
        AND ("depositAmount" IS NULL OR "depositAmount" >= 0)
        AND ("purchaseAmount" IS NULL OR "purchaseAmount" >= 0)
    )
);

-- CreateTable
CREATE TABLE "RentalContract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rentalOrderId" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "status" "RentalContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "contractMonths" INTEGER NOT NULL,
    "billingDay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalContract_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RentalContract_billing_day_range_check" CHECK (
        "billingDay" IS NULL OR ("billingDay" >= 1 AND "billingDay" <= 31)
    ),
    CONSTRAINT "RentalContract_date_range_check" CHECK ("endDate" >= "startDate"),
    CONSTRAINT "RentalContract_contract_months_positive_check" CHECK ("contractMonths" > 0)
);

-- CreateTable
CREATE TABLE "RentalBilling" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rentalContractId" TEXT NOT NULL,
    "billingNo" TEXT NOT NULL,
    "status" "RentalBillingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "billingDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "supplyAmount" INTEGER NOT NULL,
    "vatAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalBilling_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RentalBilling_period_range_check" CHECK ("periodEnd" >= "periodStart"),
    CONSTRAINT "RentalBilling_amount_non_negative_check" CHECK (
        "supplyAmount" >= 0
        AND "vatAmount" >= 0
        AND "totalAmount" >= 0
    ),
    CONSTRAINT "RentalBilling_total_amount_check" CHECK (
        "totalAmount" = "supplyAmount" + "vatAmount"
    )
);

-- CreateTable
CREATE TABLE "RentalBillingItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rentalBillingId" TEXT NOT NULL,
    "rentalOrderItemId" TEXT,
    "type" "RentalBillingItemType" NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "supplyAmount" INTEGER NOT NULL,
    "vatAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalBillingItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RentalBillingItem_quantity_positive_check" CHECK ("quantity" > 0),
    CONSTRAINT "RentalBillingItem_amount_non_negative_check" CHECK (
        "unitPrice" >= 0
        AND "supplyAmount" >= 0
        AND "vatAmount" >= 0
        AND "totalAmount" >= 0
    ),
    CONSTRAINT "RentalBillingItem_amount_calculation_check" CHECK (
        "supplyAmount" = "quantity" * "unitPrice"
        AND "totalAmount" = "supplyAmount" + "vatAmount"
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "RentalOrder_id_organizationId_key" ON "RentalOrder"("id", "organizationId");
CREATE UNIQUE INDEX "RentalOrder_orderId_organizationId_key" ON "RentalOrder"("orderId", "organizationId");
CREATE UNIQUE INDEX "RentalOrder_organizationId_managementNo_key" ON "RentalOrder"("organizationId", "managementNo");
CREATE INDEX "RentalOrder_organizationId_idx" ON "RentalOrder"("organizationId");
CREATE INDEX "RentalOrder_organizationId_contractDate_idx" ON "RentalOrder"("organizationId", "contractDate");
CREATE INDEX "RentalOrder_organizationId_isRenewal_idx" ON "RentalOrder"("organizationId", "isRenewal");

CREATE UNIQUE INDEX "RentalOrderItem_id_organizationId_key" ON "RentalOrderItem"("id", "organizationId");
CREATE INDEX "RentalOrderItem_organizationId_idx" ON "RentalOrderItem"("organizationId");
CREATE INDEX "RentalOrderItem_organizationId_rentalOrderId_idx" ON "RentalOrderItem"("organizationId", "rentalOrderId");
CREATE INDEX "RentalOrderItem_organizationId_productId_idx" ON "RentalOrderItem"("organizationId", "productId");
CREATE INDEX "RentalOrderItem_assetId_idx" ON "RentalOrderItem"("assetId");

CREATE UNIQUE INDEX "RentalContract_id_organizationId_key" ON "RentalContract"("id", "organizationId");
CREATE UNIQUE INDEX "RentalContract_rentalOrderId_organizationId_key" ON "RentalContract"("rentalOrderId", "organizationId");
CREATE UNIQUE INDEX "RentalContract_organizationId_contractNo_key" ON "RentalContract"("organizationId", "contractNo");
CREATE INDEX "RentalContract_organizationId_idx" ON "RentalContract"("organizationId");
CREATE INDEX "RentalContract_organizationId_status_idx" ON "RentalContract"("organizationId", "status");
CREATE INDEX "RentalContract_organizationId_startDate_idx" ON "RentalContract"("organizationId", "startDate");
CREATE INDEX "RentalContract_organizationId_endDate_idx" ON "RentalContract"("organizationId", "endDate");

CREATE UNIQUE INDEX "RentalBilling_id_organizationId_key" ON "RentalBilling"("id", "organizationId");
CREATE UNIQUE INDEX "RentalBilling_organizationId_billingNo_key" ON "RentalBilling"("organizationId", "billingNo");
CREATE INDEX "RentalBilling_organizationId_idx" ON "RentalBilling"("organizationId");
CREATE INDEX "RentalBilling_organizationId_rentalContractId_idx" ON "RentalBilling"("organizationId", "rentalContractId");
CREATE INDEX "RentalBilling_organizationId_status_idx" ON "RentalBilling"("organizationId", "status");
CREATE INDEX "RentalBilling_organizationId_billingDate_idx" ON "RentalBilling"("organizationId", "billingDate");
CREATE INDEX "RentalBilling_organizationId_periodStart_periodEnd_idx"
    ON "RentalBilling"("organizationId", "periodStart", "periodEnd");

CREATE INDEX "RentalBillingItem_organizationId_idx" ON "RentalBillingItem"("organizationId");
CREATE INDEX "RentalBillingItem_organizationId_rentalBillingId_idx"
    ON "RentalBillingItem"("organizationId", "rentalBillingId");
CREATE INDEX "RentalBillingItem_organizationId_rentalOrderItemId_idx"
    ON "RentalBillingItem"("organizationId", "rentalOrderItemId");
CREATE INDEX "RentalBillingItem_organizationId_type_idx" ON "RentalBillingItem"("organizationId", "type");

-- AddForeignKey
ALTER TABLE "RentalOrder"
    ADD CONSTRAINT "RentalOrder_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalOrder"
    ADD CONSTRAINT "RentalOrder_orderId_organizationId_fkey"
    FOREIGN KEY ("orderId", "organizationId")
    REFERENCES "Order"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalOrderItem"
    ADD CONSTRAINT "RentalOrderItem_rentalOrderId_organizationId_fkey"
    FOREIGN KEY ("rentalOrderId", "organizationId")
    REFERENCES "RentalOrder"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalOrderItem"
    ADD CONSTRAINT "RentalOrderItem_productId_organizationId_fkey"
    FOREIGN KEY ("productId", "organizationId")
    REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalOrderItem"
    ADD CONSTRAINT "RentalOrderItem_assetId_organizationId_productId_fkey"
    FOREIGN KEY ("assetId", "organizationId", "productId")
    REFERENCES "Asset"("id", "organizationId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalContract"
    ADD CONSTRAINT "RentalContract_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalContract"
    ADD CONSTRAINT "RentalContract_rentalOrderId_organizationId_fkey"
    FOREIGN KEY ("rentalOrderId", "organizationId")
    REFERENCES "RentalOrder"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalBilling"
    ADD CONSTRAINT "RentalBilling_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalBilling"
    ADD CONSTRAINT "RentalBilling_rentalContractId_organizationId_fkey"
    FOREIGN KEY ("rentalContractId", "organizationId")
    REFERENCES "RentalContract"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalBillingItem"
    ADD CONSTRAINT "RentalBillingItem_rentalBillingId_organizationId_fkey"
    FOREIGN KEY ("rentalBillingId", "organizationId")
    REFERENCES "RentalBilling"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalBillingItem"
    ADD CONSTRAINT "RentalBillingItem_rentalOrderItemId_organizationId_fkey"
    FOREIGN KEY ("rentalOrderItemId", "organizationId")
    REFERENCES "RentalOrderItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cross-table integrity guards.
CREATE OR REPLACE FUNCTION "assert_rental_order_type"()
RETURNS trigger AS $$
DECLARE
    order_type "OrderType";
BEGIN
    SELECT "type"
    INTO order_type
    FROM "Order"
    WHERE "id" = NEW."orderId"
      AND "organizationId" = NEW."organizationId";

    IF order_type IS NULL THEN
        RAISE EXCEPTION 'RentalOrder must reference an order in the same organization';
    END IF;

    IF order_type <> 'RENTAL' THEN
        RAISE EXCEPTION 'RentalOrder must reference an Order with RENTAL type';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RentalOrder_type_guard"
BEFORE INSERT OR UPDATE OF "orderId", "organizationId" ON "RentalOrder"
FOR EACH ROW EXECUTE FUNCTION "assert_rental_order_type"();

CREATE OR REPLACE FUNCTION "assert_order_type_with_rental_order"()
RETURNS trigger AS $$
DECLARE
    rental_order_count INTEGER;
BEGIN
    IF NEW."type" = 'RENTAL' THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*)
    INTO rental_order_count
    FROM "RentalOrder"
    WHERE "orderId" = NEW."id"
      AND "organizationId" = NEW."organizationId";

    IF rental_order_count > 0 THEN
        RAISE EXCEPTION 'Order with RentalOrder detail must keep RENTAL type';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_rental_order_type_guard"
BEFORE UPDATE OF "type" ON "Order"
FOR EACH ROW EXECUTE FUNCTION "assert_order_type_with_rental_order"();

CREATE OR REPLACE FUNCTION "assert_rental_billing_item_scope"()
RETURNS trigger AS $$
DECLARE
    contract_rental_order_id TEXT;
    matched_item_count INTEGER;
BEGIN
    IF NEW."rentalOrderItemId" IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT contract."rentalOrderId"
    INTO contract_rental_order_id
    FROM "RentalBilling" AS billing
    INNER JOIN "RentalContract" AS contract
        ON contract."id" = billing."rentalContractId"
       AND contract."organizationId" = billing."organizationId"
    WHERE billing."id" = NEW."rentalBillingId"
      AND billing."organizationId" = NEW."organizationId";

    IF contract_rental_order_id IS NULL THEN
        RAISE EXCEPTION 'RentalBillingItem must reference a billing in the same organization';
    END IF;

    SELECT COUNT(*)
    INTO matched_item_count
    FROM "RentalOrderItem"
    WHERE "id" = NEW."rentalOrderItemId"
      AND "organizationId" = NEW."organizationId"
      AND "rentalOrderId" = contract_rental_order_id;

    IF matched_item_count = 0 THEN
        RAISE EXCEPTION 'RentalBillingItem item must belong to the billing contract rental order';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RentalBillingItem_scope_guard"
BEFORE INSERT OR UPDATE OF "organizationId", "rentalBillingId", "rentalOrderItemId" ON "RentalBillingItem"
FOR EACH ROW EXECUTE FUNCTION "assert_rental_billing_item_scope"();

CREATE OR REPLACE FUNCTION "assert_rental_billing_contract_update_scope"()
RETURNS trigger AS $$
DECLARE
    contract_rental_order_id TEXT;
    invalid_item_count INTEGER;
BEGIN
    SELECT "rentalOrderId"
    INTO contract_rental_order_id
    FROM "RentalContract"
    WHERE "id" = NEW."rentalContractId"
      AND "organizationId" = NEW."organizationId";

    IF contract_rental_order_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*)
    INTO invalid_item_count
    FROM "RentalBillingItem" AS item
    INNER JOIN "RentalOrderItem" AS order_item
        ON order_item."id" = item."rentalOrderItemId"
       AND order_item."organizationId" = item."organizationId"
    WHERE item."rentalBillingId" = NEW."id"
      AND item."organizationId" = NEW."organizationId"
      AND item."rentalOrderItemId" IS NOT NULL
      AND order_item."rentalOrderId" <> contract_rental_order_id;

    IF invalid_item_count > 0 THEN
        RAISE EXCEPTION 'RentalBilling contract cannot change while billing items belong to another rental order';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RentalBilling_contract_scope_guard"
BEFORE UPDATE OF "organizationId", "rentalContractId" ON "RentalBilling"
FOR EACH ROW EXECUTE FUNCTION "assert_rental_billing_contract_update_scope"();

CREATE OR REPLACE FUNCTION "assert_rental_billing_totals_match_items"()
RETURNS trigger AS $$
DECLARE
    target_billing_id TEXT;
    target_organization_id TEXT;
    header_supply_amount INTEGER;
    header_vat_amount INTEGER;
    header_total_amount INTEGER;
    item_supply_amount INTEGER;
    item_vat_amount INTEGER;
    item_total_amount INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'RentalBilling' THEN
        target_billing_id := NEW."id";
        target_organization_id := NEW."organizationId";
    ELSE
        target_billing_id := COALESCE(NEW."rentalBillingId", OLD."rentalBillingId");
        target_organization_id := COALESCE(NEW."organizationId", OLD."organizationId");
    END IF;

    SELECT "supplyAmount", "vatAmount", "totalAmount"
    INTO header_supply_amount, header_vat_amount, header_total_amount
    FROM "RentalBilling"
    WHERE "id" = target_billing_id
      AND "organizationId" = target_organization_id;

    IF header_supply_amount IS NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;

        RETURN NEW;
    END IF;

    SELECT
        COALESCE(SUM("supplyAmount"), 0),
        COALESCE(SUM("vatAmount"), 0),
        COALESCE(SUM("totalAmount"), 0)
    INTO item_supply_amount, item_vat_amount, item_total_amount
    FROM "RentalBillingItem"
    WHERE "rentalBillingId" = target_billing_id
      AND "organizationId" = target_organization_id;

    IF header_supply_amount <> item_supply_amount
       OR header_vat_amount <> item_vat_amount
       OR header_total_amount <> item_total_amount THEN
        RAISE EXCEPTION 'RentalBilling totals must match RentalBillingItem totals';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "RentalBillingItem_totals_match_billing"
AFTER INSERT OR UPDATE OR DELETE ON "RentalBillingItem"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_rental_billing_totals_match_items"();

CREATE CONSTRAINT TRIGGER "RentalBilling_totals_match_items"
AFTER INSERT OR UPDATE OF "supplyAmount", "vatAmount", "totalAmount" ON "RentalBilling"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "assert_rental_billing_totals_match_items"();
