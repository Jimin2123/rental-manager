import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Prisma customer schema', () => {
  const prismaModelsPath = join(__dirname, '../../prisma/models');
  const prismaMigrationsPath = join(__dirname, '../../prisma/migrations');
  const prismaConfigPath = join(__dirname, '../../prisma.config.ts');

  it('loads the schema folder so split model files share one Prisma context', () => {
    const prismaConfig = readFileSync(prismaConfigPath, 'utf8');

    expect(prismaConfig).toContain("schema: 'prisma'");
  });

  it('models individual and business customers through distinct profile relations', () => {
    const individualProfilePath = join(prismaModelsPath, 'customers/individual-profile.prisma');

    const customerSchema = readFileSync(join(prismaModelsPath, 'customers/customer.prisma'), 'utf8');
    const businessPartnerSchema = readFileSync(join(prismaModelsPath, 'customers/business-partner.prisma'), 'utf8');
    const businessPartnerContactSchema = readFileSync(
      join(prismaModelsPath, 'business/business-partner-contact.prisma'),
      'utf8',
    );
    const addressSchema = readFileSync(join(prismaModelsPath, 'common/address.prisma'), 'utf8');

    expect(existsSync(individualProfilePath)).toBe(true);

    const individualProfileSchema = readFileSync(individualProfilePath, 'utf8');

    expect(customerSchema).toContain('individualProfileId String?');
    expect(customerSchema).toContain(
      'individualProfile   IndividualProfile? @relation(fields: [individualProfileId], references: [id], onDelete: Restrict)',
    );
    expect(customerSchema).toContain('businessPartnerId String?');
    expect(customerSchema).toContain(
      'businessPartner   BusinessPartner? @relation(fields: [businessPartnerId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(customerSchema).toContain('@@index([individualProfileId])');
    expect(customerSchema).toContain('@@index([businessPartnerId])');

    expect(individualProfileSchema).toContain('model IndividualProfile');
    expect(individualProfileSchema).toContain('addressId String?  @unique');
    expect(individualProfileSchema).toContain('customers           Customer[]');
    expect(businessPartnerSchema).toContain('customers Customer[]');
    expect(businessPartnerSchema).toContain('@@unique([id, organizationId])');
    expect(businessPartnerContactSchema).toContain(
      'businessPartner   BusinessPartner @relation(fields: [businessPartnerId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(addressSchema).toContain('individualProfile IndividualProfile?');
  });

  it('models sales and purchase roles as assignable business partner roles', () => {
    const enumSchema = readFileSync(join(__dirname, '../../prisma/enums.prisma'), 'utf8');
    const organizationSchema = readFileSync(join(prismaModelsPath, 'business/organization.prisma'), 'utf8');
    const businessPartnerSchema = readFileSync(join(prismaModelsPath, 'customers/business-partner.prisma'), 'utf8');
    const businessPartnerRoleSchema = readFileSync(
      join(prismaModelsPath, 'customers/business-partner-role.prisma'),
      'utf8',
    );
    const migration = readFileSync(
      join(prismaMigrationsPath, '20260616094500_business_partner_roles/migration.sql'),
      'utf8',
    );

    expect(enumSchema).toContain('enum BusinessPartnerRoleType');
    expect(enumSchema).toContain('SALES');
    expect(enumSchema).toContain('PURCHASE');

    expect(organizationSchema).toContain('businessPartnerRoles');
    expect(businessPartnerSchema).toContain('roles     BusinessPartnerRole[]');

    expect(businessPartnerRoleSchema).toContain('model BusinessPartnerRole');
    expect(businessPartnerRoleSchema).toContain('type BusinessPartnerRoleType');
    expect(businessPartnerRoleSchema).toContain(
      'businessPartner   BusinessPartner @relation(fields: [businessPartnerId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(businessPartnerRoleSchema).toContain('@@unique([businessPartnerId, organizationId, type])');
    expect(businessPartnerRoleSchema).toContain('@@index([organizationId, type])');

    expect(migration).toContain('CREATE TYPE "BusinessPartnerRoleType"');
    expect(migration).toContain('CREATE TABLE "BusinessPartnerRole"');
    expect(migration).toContain('"BusinessPartnerRole_businessPartnerId_organizationId_fkey"');
    expect(migration).toContain('"BusinessPartnerRole_businessPartnerId_organizationId_type_key"');
    expect(migration).toContain('assert_customer_business_partner_sales_role');
    expect(migration).toContain('assert_order_customer_sales_role');
    expect(migration).toContain('assert_business_partner_sales_role_removal');
  });

  it('models internal staff assignment to customer contacts', () => {
    const organizationMemberPath = join(prismaModelsPath, 'business/organization-member.prisma');
    const customerAssignmentPath = join(prismaModelsPath, 'customers/customer-assignment.prisma');

    expect(existsSync(organizationMemberPath)).toBe(true);
    expect(existsSync(customerAssignmentPath)).toBe(true);

    const organizationSchema = readFileSync(join(prismaModelsPath, 'business/organization.prisma'), 'utf8');
    const organizationMemberSchema = readFileSync(organizationMemberPath, 'utf8');
    const customerSchema = readFileSync(join(prismaModelsPath, 'customers/customer.prisma'), 'utf8');
    const customerAssignmentSchema = readFileSync(customerAssignmentPath, 'utf8');
    const businessPartnerContactSchema = readFileSync(
      join(prismaModelsPath, 'business/business-partner-contact.prisma'),
      'utf8',
    );
    const individualProfileSchema = readFileSync(join(prismaModelsPath, 'customers/individual-profile.prisma'), 'utf8');

    expect(organizationSchema).toContain('members                 OrganizationMember[]');
    expect(organizationSchema).toContain('customerAssignments     CustomerAssignment[]');

    expect(organizationMemberSchema).toContain('model OrganizationMember');
    expect(organizationMemberSchema).toContain('customerAssignments CustomerAssignment[]');
    expect(organizationMemberSchema).toContain('@@unique([id, organizationId])');

    expect(customerSchema).toContain('assignments CustomerAssignment[]');
    expect(businessPartnerContactSchema).toContain('customerAssignments CustomerAssignment[]');
    expect(individualProfileSchema).toContain('customerAssignments CustomerAssignment[]');

    expect(customerAssignmentSchema).toContain('model CustomerAssignment');
    expect(customerAssignmentSchema).toContain(
      'customer   Customer @relation(fields: [customerId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(customerAssignmentSchema).toContain(
      'organizationMember   OrganizationMember @relation(fields: [organizationMemberId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(customerAssignmentSchema).toContain('customerContactId String?');
    expect(customerAssignmentSchema).toContain('individualProfileId String?');
    expect(customerAssignmentSchema).toContain('endedAt   DateTime?');
  });

  it('models order registration and sale-specific order lines separately', () => {
    const enumSchema = readFileSync(join(__dirname, '../../prisma/enums.prisma'), 'utf8');
    const organizationSchema = readFileSync(join(prismaModelsPath, 'business/organization.prisma'), 'utf8');
    const organizationMemberSchema = readFileSync(
      join(prismaModelsPath, 'business/organization-member.prisma'),
      'utf8',
    );
    const customerSchema = readFileSync(join(prismaModelsPath, 'customers/customer.prisma'), 'utf8');
    const productSchema = readFileSync(join(prismaModelsPath, 'product/product.prisma'), 'utf8');
    const assetSchema = readFileSync(join(prismaModelsPath, 'product/asset.prisma'), 'utf8');
    const orderSchema = readFileSync(join(prismaModelsPath, 'orders/order.prisma'), 'utf8');
    const saleOrderSchema = readFileSync(join(prismaModelsPath, 'orders/sale-order.prisma'), 'utf8');
    const saleOrderItemSchema = readFileSync(join(prismaModelsPath, 'orders/sale-order-item.prisma'), 'utf8');

    expect(enumSchema).toContain('enum OrderType');
    expect(enumSchema).toContain('SALE');
    expect(enumSchema).toContain('RENTAL');
    expect(enumSchema).toContain('enum OrderStatus');
    expect(enumSchema).toContain('REGISTERED');
    expect(enumSchema).toContain('CANCELLED');
    expect(enumSchema).toContain('enum VatType');

    expect(organizationSchema).toContain('orders                  Order[]');
    expect(organizationSchema).toContain('saleOrders              SaleOrder[]');
    expect(organizationMemberSchema).toContain('managedOrders       Order[]              @relation("OrderManager")');
    expect(organizationMemberSchema).toContain(
      'deliveredSaleOrders SaleOrder[]          @relation("SaleDeliveryStaff")',
    );
    expect(customerSchema).toContain('orders      Order[]');
    expect(customerSchema).toContain('@@unique([id, organizationId])');
    expect(productSchema).toContain('saleOrderItems   SaleOrderItem[]');
    expect(assetSchema).toContain('saleOrderItems   SaleOrderItem[]');
    expect(assetSchema).toContain('@@unique([id, organizationId, productId])');

    expect(orderSchema).toContain('model Order');
    expect(orderSchema).toContain('orderNo String');
    expect(orderSchema).toContain('type   OrderType');
    expect(orderSchema).toContain('status OrderStatus @default(REGISTERED)');
    expect(orderSchema).toContain(
      'customer   Customer @relation(fields: [customerId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(orderSchema).toContain(
      'manager   OrganizationMember? @relation("OrderManager", fields: [managerId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(orderSchema).toContain('saleOrder   SaleOrder?');
    expect(orderSchema).toContain('@@unique([organizationId, orderNo])');
    expect(orderSchema).toContain('@@unique([id, organizationId])');

    expect(saleOrderSchema).toContain('model SaleOrder');
    expect(saleOrderSchema).toContain(
      'order   Order  @relation(fields: [orderId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(saleOrderSchema).toContain(
      'deliveryStaff   OrganizationMember? @relation("SaleDeliveryStaff", fields: [deliveryStaffId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(saleOrderSchema).not.toContain('memo String?');
    expect(saleOrderSchema).toContain('items SaleOrderItem[]');
    expect(saleOrderSchema).toContain('@@unique([orderId, organizationId])');
    expect(saleOrderSchema).toContain('@@unique([id, organizationId])');

    expect(saleOrderItemSchema).toContain('model SaleOrderItem');
    expect(saleOrderItemSchema).toContain(
      'saleOrder   SaleOrder @relation(fields: [saleOrderId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(saleOrderItemSchema).toContain(
      'product   Product @relation(fields: [productId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(saleOrderItemSchema).toContain(
      'asset   Asset?  @relation(fields: [assetId, organizationId, productId], references: [id, organizationId, productId], onDelete: Restrict)',
    );
    expect(saleOrderItemSchema).toContain('isUsedAssetShipment Boolean @default(false)');
    expect(saleOrderItemSchema).toContain('quantity  Int');
    expect(saleOrderItemSchema).toContain('unitPrice Int');
    expect(saleOrderItemSchema).toContain('supplyAmount Int');
    expect(saleOrderItemSchema).toContain('vatType VatType @default(INCLUDED)');
    expect(saleOrderItemSchema).toContain('vatAmount Int');
    expect(saleOrderItemSchema).toContain('totalAmount Int');
    expect(saleOrderItemSchema).toContain('marginAmount Int?');
  });

  it('models rental order, contract, and billing foundations without printer-specific options', () => {
    const enumSchema = readFileSync(join(__dirname, '../../prisma/enums.prisma'), 'utf8');
    const organizationSchema = readFileSync(join(prismaModelsPath, 'business/organization.prisma'), 'utf8');
    const productSchema = readFileSync(join(prismaModelsPath, 'product/product.prisma'), 'utf8');
    const assetSchema = readFileSync(join(prismaModelsPath, 'product/asset.prisma'), 'utf8');
    const orderSchema = readFileSync(join(prismaModelsPath, 'orders/order.prisma'), 'utf8');
    const rentalOrderSchema = readFileSync(join(prismaModelsPath, 'orders/rental-order.prisma'), 'utf8');
    const rentalOrderItemSchema = readFileSync(join(prismaModelsPath, 'orders/rental-order-item.prisma'), 'utf8');
    const rentalContractSchema = readFileSync(join(prismaModelsPath, 'orders/rental-contract.prisma'), 'utf8');
    const rentalBillingSchema = readFileSync(join(prismaModelsPath, 'orders/rental-billing.prisma'), 'utf8');
    const rentalBillingItemSchema = readFileSync(join(prismaModelsPath, 'orders/rental-billing-item.prisma'), 'utf8');

    expect(enumSchema).toContain('enum RentalContractStatus');
    expect(enumSchema).toContain('ACTIVE');
    expect(enumSchema).toContain('ENDED');
    expect(enumSchema).toContain('enum RentalBillingStatus');
    expect(enumSchema).toContain('ISSUED');
    expect(enumSchema).toContain('PAID');
    expect(enumSchema).toContain('enum RentalBillingItemType');
    expect(enumSchema).toContain('MONTHLY_RENT');

    expect(organizationSchema).toContain('rentalOrders            RentalOrder[]');
    expect(organizationSchema).toContain('rentalContracts         RentalContract[]');
    expect(organizationSchema).toContain('rentalBillings          RentalBilling[]');
    expect(productSchema).toContain('rentalOrderItems RentalOrderItem[]');
    expect(assetSchema).toContain('rentalOrderItems RentalOrderItem[]');
    expect(orderSchema).toContain('rentalOrder RentalOrder?');

    expect(rentalOrderSchema).toContain('model RentalOrder');
    expect(rentalOrderSchema).toContain(
      'order   Order  @relation(fields: [orderId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(rentalOrderSchema).toContain('isRenewal Boolean @default(false)');
    expect(rentalOrderSchema).toContain('items    RentalOrderItem[]');
    expect(rentalOrderSchema).toContain('contract RentalContract?');
    expect(rentalOrderSchema).toContain('@@unique([orderId, organizationId])');
    expect(rentalOrderSchema).not.toContain('Printer');

    expect(rentalOrderItemSchema).toContain('model RentalOrderItem');
    expect(rentalOrderItemSchema).toContain(
      'rentalOrder   RentalOrder @relation(fields: [rentalOrderId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(rentalOrderItemSchema).toContain(
      'product   Product @relation(fields: [productId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(rentalOrderItemSchema).toContain(
      'asset   Asset?  @relation(fields: [assetId, organizationId, productId], references: [id, organizationId, productId], onDelete: Restrict)',
    );
    expect(rentalOrderItemSchema).toContain('monthlyRentalPrice Int');
    expect(rentalOrderItemSchema).toContain('depositAmount Int?');
    expect(rentalOrderItemSchema).not.toContain('contractMonths Int');
    expect(rentalOrderItemSchema).toContain('installationLocation String?');
    expect(rentalOrderItemSchema).toContain('specialTerms String?');
    expect(rentalOrderItemSchema).toContain('@@unique([id, organizationId])');
    expect(rentalOrderItemSchema).not.toContain('includedQuantity');
    expect(rentalOrderItemSchema).not.toContain('overageUnitPrice');

    expect(rentalContractSchema).toContain('model RentalContract');
    expect(rentalContractSchema).toContain(
      'rentalOrder   RentalOrder @relation(fields: [rentalOrderId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(rentalContractSchema).toContain('status RentalContractStatus @default(ACTIVE)');
    expect(rentalContractSchema).toContain('startDate DateTime');
    expect(rentalContractSchema).toContain('endDate   DateTime');
    expect(rentalContractSchema).toContain('contractMonths Int');
    expect(rentalContractSchema).toContain('billingDay Int?');
    expect(rentalContractSchema).toContain('billings RentalBilling[]');
    expect(rentalContractSchema).toContain('@@unique([rentalOrderId, organizationId])');
    expect(rentalContractSchema).toContain('@@unique([id, organizationId])');

    expect(rentalBillingSchema).toContain('model RentalBilling');
    expect(rentalBillingSchema).toContain(
      'rentalContract   RentalContract @relation(fields: [rentalContractId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(rentalBillingSchema).toContain('billingNo String');
    expect(rentalBillingSchema).toContain('status RentalBillingStatus @default(SCHEDULED)');
    expect(rentalBillingSchema).toContain('periodStart DateTime');
    expect(rentalBillingSchema).toContain('periodEnd   DateTime');
    expect(rentalBillingSchema).toContain('items RentalBillingItem[]');
    expect(rentalBillingSchema).toContain('@@unique([organizationId, billingNo])');
    expect(rentalBillingSchema).toContain('@@unique([id, organizationId])');

    expect(rentalBillingItemSchema).toContain('model RentalBillingItem');
    expect(rentalBillingItemSchema).toContain(
      'rentalBilling   RentalBilling @relation(fields: [rentalBillingId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(rentalBillingItemSchema).toContain(
      'rentalOrderItem   RentalOrderItem? @relation(fields: [rentalOrderItemId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(rentalBillingItemSchema).toContain('type RentalBillingItemType');
    expect(rentalBillingItemSchema).toContain('supplyAmount Int');
    expect(rentalBillingItemSchema).toContain('vatAmount    Int');
    expect(rentalBillingItemSchema).toContain('totalAmount  Int');
  });

  it('adds a product and sale order migration in dependency order', () => {
    const migration = readFileSync(
      join(prismaMigrationsPath, '20260616090000_product_asset_order_sales/migration.sql'),
      'utf8',
    );

    expect(migration).toContain('CREATE TYPE "AssetStatus"');
    expect(migration).toContain('CREATE TYPE "OrderType"');
    expect(migration).toContain('CREATE TYPE "OrderStatus"');
    expect(migration).toContain('CREATE TYPE "VatType"');
    expect(migration).toContain('CREATE TABLE "Product"');
    expect(migration).toContain('CREATE TABLE "Asset"');
    expect(migration).toContain('CREATE TABLE "Order"');
    expect(migration).toContain('CREATE TABLE "SaleOrder"');
    expect(migration).toContain('CREATE TABLE "SaleOrderItem"');
    expect(migration).toContain('"Order_customerId_organizationId_fkey"');
    expect(migration).toContain('"SaleOrder_deliveryStaffId_organizationId_fkey"');
    expect(migration).toContain('"SaleOrderItem_assetId_organizationId_productId_fkey"');
    expect(migration).toContain('"SaleOrderItem_quantity_positive_check"');
    expect(migration).toContain('"SaleOrderItem_amount_non_negative_check"');
    expect(migration).toContain('"SaleOrderItem_amount_calculation_check"');
    expect(migration).toContain('assert_sale_order_type');
  });

  it('adds a rental order, contract, and billing migration after order registration', () => {
    const migration = readFileSync(
      join(prismaMigrationsPath, '20260616093000_rental_order_contract_billing/migration.sql'),
      'utf8',
    );

    expect(migration).toContain('CREATE TYPE "RentalContractStatus"');
    expect(migration).toContain('CREATE TYPE "RentalBillingStatus"');
    expect(migration).toContain('CREATE TYPE "RentalBillingItemType"');
    expect(migration).toContain('CREATE TABLE "RentalOrder"');
    expect(migration).toContain('CREATE TABLE "RentalOrderItem"');
    expect(migration).toContain('CREATE TABLE "RentalContract"');
    expect(migration).toContain('CREATE TABLE "RentalBilling"');
    expect(migration).toContain('CREATE TABLE "RentalBillingItem"');
    expect(migration).toContain('"RentalOrder_orderId_organizationId_fkey"');
    expect(migration).toContain('"RentalOrderItem_assetId_organizationId_productId_fkey"');
    expect(migration).toContain('"RentalBillingItem_rentalOrderItemId_organizationId_fkey"');
    expect(migration).toContain('"RentalContract_contract_months_positive_check"');
    expect(migration).not.toContain('"RentalOrderItem_contract_months_positive_check"');
    expect(migration).toContain('"RentalBillingItem_amount_non_negative_check"');
    expect(migration).toContain('"RentalBillingItem_amount_calculation_check"');
    expect(migration).toContain('"RentalBilling_total_amount_check"');
    expect(migration).toContain('assert_rental_order_type');
    expect(migration).toContain('assert_rental_billing_item_scope');
    expect(migration).toContain('assert_rental_billing_totals_match_items');
  });

  it('adds database integrity guards for cross-model rules Prisma cannot express', () => {
    const migration = readFileSync(
      join(prismaMigrationsPath, '20260615190000_initial_schema_integrity/migration.sql'),
      'utf8',
    );

    expect(migration).toContain('Customer_type_profile_check');
    expect(migration).toContain('Customer_active_individual_profile_unique');
    expect(migration).toContain('Customer_active_business_partner_unique');
    expect(migration).toContain('BusinessPartnerContact_one_primary_per_partner');
    expect(migration).toContain('assert_business_profile_single_owner');
    expect(migration).toContain('assert_address_single_owner');
    expect(migration).toContain('assert_business_partner_registration_unique');
    expect(migration).toContain('CustomerAssignment_contact_target_check');
    expect(migration).toContain('CustomerAssignment_one_primary_active_assignee');
    expect(migration).toContain('assert_customer_assignment_scope');
    expect(migration).toContain('Customer_id_organizationId_key');
    expect(migration).toContain('"CustomerAssignment_customerId_organizationId_fkey"');
  });
});
