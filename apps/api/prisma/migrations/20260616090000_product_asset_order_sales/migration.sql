-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('INCOMING', 'AVAILABLE', 'RENTED', 'SOLD', 'DISPOSED', 'LOST', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('SALE', 'RENTAL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('REGISTERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VatType" AS ENUM ('NONE', 'INCLUDED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "modelName" TEXT,
    "category" TEXT,
    "memo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialNumber" TEXT,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" INTEGER,
    "memo" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'REGISTERED',
    "customerId" TEXT NOT NULL,
    "managerId" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deliveryStaffId" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleOrderItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "assetId" TEXT,
    "serialNumber" TEXT,
    "isUsedAssetShipment" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "supplyAmount" INTEGER NOT NULL,
    "vatType" "VatType" NOT NULL DEFAULT 'INCLUDED',
    "vatAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "marginAmount" INTEGER,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleOrderItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SaleOrderItem_quantity_positive_check" CHECK ("quantity" > 0),
    CONSTRAINT "SaleOrderItem_amount_non_negative_check" CHECK (
        "unitPrice" >= 0
        AND "supplyAmount" >= 0
        AND "vatAmount" >= 0
        AND "totalAmount" >= 0
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_id_organizationId_key" ON "Customer"("id", "organizationId");

CREATE UNIQUE INDEX "Product_id_organizationId_key" ON "Product"("id", "organizationId");
CREATE INDEX "Product_organizationId_idx" ON "Product"("organizationId");
CREATE INDEX "Product_organizationId_isActive_idx" ON "Product"("organizationId", "isActive");
CREATE INDEX "Product_organizationId_category_idx" ON "Product"("organizationId", "category");
CREATE INDEX "Product_name_idx" ON "Product"("name");

CREATE UNIQUE INDEX "Asset_id_organizationId_key" ON "Asset"("id", "organizationId");
CREATE UNIQUE INDEX "Asset_id_organizationId_productId_key" ON "Asset"("id", "organizationId", "productId");
CREATE UNIQUE INDEX "Asset_organizationId_serialNumber_key" ON "Asset"("organizationId", "serialNumber");
CREATE INDEX "Asset_organizationId_idx" ON "Asset"("organizationId");
CREATE INDEX "Asset_organizationId_status_idx" ON "Asset"("organizationId", "status");
CREATE INDEX "Asset_organizationId_productId_idx" ON "Asset"("organizationId", "productId");
CREATE INDEX "Asset_productId_idx" ON "Asset"("productId");

CREATE UNIQUE INDEX "Order_id_organizationId_key" ON "Order"("id", "organizationId");
CREATE UNIQUE INDEX "Order_organizationId_orderNo_key" ON "Order"("organizationId", "orderNo");
CREATE INDEX "Order_organizationId_idx" ON "Order"("organizationId");
CREATE INDEX "Order_organizationId_customerId_idx" ON "Order"("organizationId", "customerId");
CREATE INDEX "Order_organizationId_managerId_idx" ON "Order"("organizationId", "managerId");
CREATE INDEX "Order_organizationId_type_idx" ON "Order"("organizationId", "type");
CREATE INDEX "Order_organizationId_status_idx" ON "Order"("organizationId", "status");
CREATE INDEX "Order_organizationId_orderDate_idx" ON "Order"("organizationId", "orderDate");

CREATE UNIQUE INDEX "SaleOrder_id_organizationId_key" ON "SaleOrder"("id", "organizationId");
CREATE UNIQUE INDEX "SaleOrder_orderId_organizationId_key" ON "SaleOrder"("orderId", "organizationId");
CREATE INDEX "SaleOrder_organizationId_idx" ON "SaleOrder"("organizationId");
CREATE INDEX "SaleOrder_organizationId_deliveryStaffId_idx" ON "SaleOrder"("organizationId", "deliveryStaffId");
CREATE INDEX "SaleOrder_organizationId_saleDate_idx" ON "SaleOrder"("organizationId", "saleDate");

CREATE INDEX "SaleOrderItem_organizationId_idx" ON "SaleOrderItem"("organizationId");
CREATE INDEX "SaleOrderItem_organizationId_saleOrderId_idx" ON "SaleOrderItem"("organizationId", "saleOrderId");
CREATE INDEX "SaleOrderItem_organizationId_productId_idx" ON "SaleOrderItem"("organizationId", "productId");
CREATE INDEX "SaleOrderItem_assetId_idx" ON "SaleOrderItem"("assetId");

-- AddForeignKey
ALTER TABLE "Product"
    ADD CONSTRAINT "Product_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Asset"
    ADD CONSTRAINT "Asset_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Asset"
    ADD CONSTRAINT "Asset_productId_organizationId_fkey"
    FOREIGN KEY ("productId", "organizationId")
    REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_customerId_organizationId_fkey"
    FOREIGN KEY ("customerId", "organizationId")
    REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_managerId_organizationId_fkey"
    FOREIGN KEY ("managerId", "organizationId")
    REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleOrder"
    ADD CONSTRAINT "SaleOrder_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleOrder"
    ADD CONSTRAINT "SaleOrder_orderId_organizationId_fkey"
    FOREIGN KEY ("orderId", "organizationId")
    REFERENCES "Order"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleOrder"
    ADD CONSTRAINT "SaleOrder_deliveryStaffId_organizationId_fkey"
    FOREIGN KEY ("deliveryStaffId", "organizationId")
    REFERENCES "OrganizationMember"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleOrderItem"
    ADD CONSTRAINT "SaleOrderItem_saleOrderId_organizationId_fkey"
    FOREIGN KEY ("saleOrderId", "organizationId")
    REFERENCES "SaleOrder"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleOrderItem"
    ADD CONSTRAINT "SaleOrderItem_productId_organizationId_fkey"
    FOREIGN KEY ("productId", "organizationId")
    REFERENCES "Product"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleOrderItem"
    ADD CONSTRAINT "SaleOrderItem_assetId_organizationId_productId_fkey"
    FOREIGN KEY ("assetId", "organizationId", "productId")
    REFERENCES "Asset"("id", "organizationId", "productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cross-table integrity guards.
CREATE OR REPLACE FUNCTION "assert_sale_order_type"()
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
        RAISE EXCEPTION 'SaleOrder must reference an order in the same organization';
    END IF;

    IF order_type <> 'SALE' THEN
        RAISE EXCEPTION 'SaleOrder must reference an Order with SALE type';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SaleOrder_type_guard"
BEFORE INSERT OR UPDATE OF "orderId", "organizationId" ON "SaleOrder"
FOR EACH ROW EXECUTE FUNCTION "assert_sale_order_type"();

CREATE OR REPLACE FUNCTION "assert_order_type_with_sale_order"()
RETURNS trigger AS $$
DECLARE
    sale_order_count INTEGER;
BEGIN
    IF NEW."type" = 'SALE' THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*)
    INTO sale_order_count
    FROM "SaleOrder"
    WHERE "orderId" = NEW."id"
      AND "organizationId" = NEW."organizationId";

    IF sale_order_count > 0 THEN
        RAISE EXCEPTION 'Order with SaleOrder detail must keep SALE type';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Order_sale_order_type_guard"
BEFORE UPDATE OF "type" ON "Order"
FOR EACH ROW EXECUTE FUNCTION "assert_order_type_with_sale_order"();
