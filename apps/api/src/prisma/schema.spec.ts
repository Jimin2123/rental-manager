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

    expect(customerSchema).toMatch(/assignments\s+CustomerAssignment\[\]/);
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
    expect(enumSchema).toContain('CANCELED');
    expect(enumSchema).not.toContain('CANCELLED');
    expect(enumSchema).toContain('enum VatType');

    expect(organizationSchema).toContain('orders                  Order[]');
    expect(organizationSchema).toContain('saleOrders              SaleOrder[]');
    expect(organizationMemberSchema).toContain('managedOrders       Order[]              @relation("OrderManager")');
    expect(organizationMemberSchema).toContain(
      'deliveredSaleOrders SaleOrder[]          @relation("SaleDeliveryStaff")',
    );
    expect(customerSchema).toMatch(/orders\s+Order\[\]/);
    expect(customerSchema).toContain('@@unique([id, organizationId])');
    expect(productSchema).toContain('saleOrderItems   SaleOrderItem[]');
    expect(assetSchema).toMatch(/saleOrderItems\s+SaleOrderItem\[\]/);
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
    expect(saleOrderSchema).toContain('items    SaleOrderItem[]');
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

  it('models rental order, contract, and unified invoice billing without printer-specific options', () => {
    const enumSchema = readFileSync(join(__dirname, '../../prisma/enums.prisma'), 'utf8');
    const organizationSchema = readFileSync(join(prismaModelsPath, 'business/organization.prisma'), 'utf8');
    const productSchema = readFileSync(join(prismaModelsPath, 'product/product.prisma'), 'utf8');
    const assetSchema = readFileSync(join(prismaModelsPath, 'product/asset.prisma'), 'utf8');
    const orderSchema = readFileSync(join(prismaModelsPath, 'orders/order.prisma'), 'utf8');
    const rentalOrderSchema = readFileSync(join(prismaModelsPath, 'orders/rental-order.prisma'), 'utf8');
    const rentalOrderItemSchema = readFileSync(join(prismaModelsPath, 'orders/rental-order-item.prisma'), 'utf8');
    const rentalContractSchema = readFileSync(join(prismaModelsPath, 'orders/rental-contract.prisma'), 'utf8');
    const invoiceSchema = readFileSync(join(prismaModelsPath, 'finance/invoice.prisma'), 'utf8');
    const invoiceItemSchema = readFileSync(join(prismaModelsPath, 'finance/invoice-item.prisma'), 'utf8');

    // RentalBilling이 Invoice로 통합됨 — 관련 enum/모델 없음
    expect(enumSchema).not.toContain('RentalBillingStatus');
    expect(enumSchema).not.toContain('RentalBillingItemType');
    expect(enumSchema).toContain('enum RentalContractStatus');
    expect(enumSchema).toContain('DRAFT');
    expect(enumSchema).toContain('ACTIVE');
    expect(enumSchema).toContain('ENDED');
    expect(enumSchema).toContain('enum InvoiceType');
    expect(enumSchema).toContain('RENTAL_MONTHLY');
    expect(enumSchema).toContain('enum InvoiceStatus');
    expect(enumSchema).toContain('ISSUED');

    expect(organizationSchema).toContain('rentalOrders            RentalOrder[]');
    expect(organizationSchema).toContain('rentalContracts         RentalContract[]');
    expect(organizationSchema).toMatch(/invoices\s+Invoice\[\]/);
    expect(organizationSchema).not.toContain('rentalBillings');
    expect(productSchema).toContain('rentalOrderItems RentalOrderItem[]');
    expect(assetSchema).toMatch(/rentalOrderItems\s+RentalOrderItem\[\]/);
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
    // DRAFT가 기본값 — ACTIVE 직접 활성화 전까지 장비 미점유
    expect(rentalContractSchema).toContain('status    RentalContractStatus @default(DRAFT)');
    expect(rentalContractSchema).toContain('isRenewal Boolean');
    expect(rentalContractSchema).toContain('startDate DateTime');
    expect(rentalContractSchema).toContain('endDate   DateTime');
    expect(rentalContractSchema).toContain('contractMonths Int');
    expect(rentalContractSchema).toContain('billingDay');
    expect(rentalContractSchema).toContain('paymentDueDay');
    expect(rentalContractSchema).toContain('billingTiming');
    expect(rentalContractSchema).toContain('invoices Invoice[]');
    expect(rentalContractSchema).not.toContain('billings RentalBilling');
    expect(rentalContractSchema).toContain('@@unique([rentalOrderId, organizationId])');
    expect(rentalContractSchema).toContain('@@unique([id, organizationId])');

    // Invoice가 RentalBilling 역할 통합
    expect(invoiceSchema).toContain('model Invoice');
    expect(invoiceSchema).toContain('type   InvoiceType');
    expect(invoiceSchema).toContain('rentalContractId String?');
    expect(invoiceSchema).toContain('billingMonth');
    expect(invoiceSchema).toContain('periodStart');
    expect(invoiceSchema).toContain('periodEnd');
    expect(invoiceSchema).toContain('finalAmount       Int @default(0)');
    expect(invoiceSchema).toContain('@@unique([organizationId, invoiceNo])');

    expect(invoiceItemSchema).toContain('model InvoiceItem');
    expect(invoiceItemSchema).toContain('type InvoiceItemType');
    expect(invoiceItemSchema).toContain('supplyAmount Int');
    expect(invoiceItemSchema).toContain('vatAmount    Int');
    expect(invoiceItemSchema).toContain('totalAmount  Int');
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

  it('keeps replacement and tax-document relations scoped to the organization', () => {
    const rentalContractItemSchema = readFileSync(join(prismaModelsPath, 'orders/rental-contract-item.prisma'), 'utf8');
    const taxInvoiceSchema = readFileSync(join(prismaModelsPath, 'finance/tax-invoice.prisma'), 'utf8');
    const migration = readFileSync(
      join(prismaMigrationsPath, '20260616108000_harden_model_integrity/migration.sql'),
      'utf8',
    );

    expect(rentalContractItemSchema).toContain(
      'replacedByItem   RentalContractItem?  @relation("ItemReplacement", fields: [replacedByItemId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(taxInvoiceSchema).toContain(
      'originalTaxInvoice   TaxInvoice?  @relation("TaxInvoiceAmendment", fields: [originalTaxInvoiceId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );

    expect(migration).toContain('"RentalContractItem_replacedByItemId_organizationId_fkey"');
    expect(migration).toContain('"TaxInvoice_originalTaxInvoiceId_organizationId_fkey"');
    expect(migration).toContain('"RentalContractItem_no_self_replacement_check"');
    expect(migration).toContain('"TaxInvoice_no_self_amendment_check"');
  });

  it('tracks rental invoice items down to rental contract items', () => {
    const invoiceItemSchema = readFileSync(join(prismaModelsPath, 'finance/invoice-item.prisma'), 'utf8');
    const rentalContractItemSchema = readFileSync(
      join(prismaModelsPath, 'orders/rental-contract-item.prisma'),
      'utf8',
    );
    const migration = readFileSync(
      join(prismaMigrationsPath, '20260616111000_invoice_item_contract_item_trace/migration.sql'),
      'utf8',
    );

    expect(invoiceItemSchema).toContain('rentalContractItemId String?');
    expect(invoiceItemSchema).toContain(
      'rentalContractItem   RentalContractItem? @relation(fields: [rentalContractItemId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(invoiceItemSchema).toContain('@@index([rentalContractItemId])');
    expect(rentalContractItemSchema).toContain('invoiceItems InvoiceItem[]');
    expect(migration).toContain('DROP CONSTRAINT "InvoiceItem_source_type_check"');
    expect(migration).toContain('ADD CONSTRAINT "InvoiceItem_source_type_check" CHECK');
    expect(migration).toContain('assert_invoice_item_rental_contract_item_scope');
    expect(migration).toContain('CREATE CONSTRAINT TRIGGER "Invoice_rental_contract_item_scope_guard"');
    expect(migration).toContain('CREATE CONSTRAINT TRIGGER "RentalContractItem_invoice_item_scope_guard"');
  });

  it('stores invoice settlement summary separately from document status', () => {
    const enumSchema = readFileSync(join(__dirname, '../../prisma/enums.prisma'), 'utf8');
    const invoiceSchema = readFileSync(join(prismaModelsPath, 'finance/invoice.prisma'), 'utf8');
    const migration = readFileSync(
      join(prismaMigrationsPath, '20260616112000_invoice_settlement_summary/migration.sql'),
      'utf8',
    );

    expect(enumSchema).toContain('enum InvoiceSettlementStatus');
    expect(enumSchema).toContain('UNPAID');
    expect(enumSchema).toContain('PARTIALLY_PAID');
    expect(enumSchema).toContain('PAID');
    expect(enumSchema).toContain('OVERPAID');
    expect(invoiceSchema).toContain('paidAmount        Int @default(0)');
    expect(invoiceSchema).toContain('refundedAmount    Int @default(0)');
    expect(invoiceSchema).toContain('outstandingAmount Int @default(0)');
    expect(invoiceSchema).toContain('settlementStatus  InvoiceSettlementStatus @default(UNPAID)');
    expect(invoiceSchema).toContain('@@index([organizationId, settlementStatus])');
    expect(invoiceSchema).toContain('@@index([organizationId, customerId, settlementStatus, dueDate])');
    expect(migration).toContain('CREATE TYPE "InvoiceSettlementStatus"');
    expect(migration).toContain('"Invoice_settlement_amount_non_negative_check"');
    expect(migration).toContain('recalculate_invoice_financials');
    expect(migration).toContain('assert_invoice_settlement_summary_managed');
    expect(migration).toContain('sync_invoice_final_amount');
    expect(migration).toContain('PaymentAllocation_sync_invoice_financials');
    expect(migration).toContain('Payment_sync_invoice_financials');
    expect(migration).toContain('Refund_sync_invoice_financials');
  });

  it('models meter usage invoice items for counter billing', () => {
    const enumSchema = readFileSync(join(__dirname, '../../prisma/enums.prisma'), 'utf8');
    const migrationPath = join(prismaMigrationsPath, '20260616113000_meter_usage_invoice_items/migration.sql');

    expect(enumSchema).toContain('METER_USAGE');
    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('assert_meter_reading_invoice_item_scope');
    expect(migration).toContain('"InvoiceItem_meter_reading_scope_guard"');
    expect(migration).toContain("type <> 'METER_USAGE'");
  });

  it('models tax invoices at invoice level only', () => {
    const invoiceItemSchema = readFileSync(join(prismaModelsPath, 'finance/invoice-item.prisma'), 'utf8');
    const taxInvoiceSchema = readFileSync(join(prismaModelsPath, 'finance/tax-invoice.prisma'), 'utf8');

    expect(invoiceItemSchema).not.toContain('taxInvoiceId');
    expect(invoiceItemSchema).not.toContain('taxInvoice   TaxInvoice?');
    expect(taxInvoiceSchema).not.toContain('items InvoiceItem[]');
    expect(taxInvoiceSchema).toContain('@@unique([invoiceId, organizationId])');

    const migration = readFileSync(
      join(prismaMigrationsPath, '20260616114000_invoice_level_tax_invoice/migration.sql'),
      'utf8',
    );

    expect(migration).toContain('DROP COLUMN "taxInvoiceId"');
    expect(migration).toContain('assert_issued_invoice_is_immutable');
  });

  it('adds database guards for financial totals, source compatibility, and metered billing values', () => {
    const auditLogSchema = readFileSync(join(prismaModelsPath, 'common/audit-log.prisma'), 'utf8');
    const attachmentSchema = readFileSync(join(prismaModelsPath, 'common/attachment.prisma'), 'utf8');
    const assetEventSchema = readFileSync(join(prismaModelsPath, 'product/asset-event.prisma'), 'utf8');
    const invoiceSchema = readFileSync(join(prismaModelsPath, 'finance/invoice.prisma'), 'utf8');
    const migration = readFileSync(
      join(prismaMigrationsPath, '20260616108000_harden_model_integrity/migration.sql'),
      'utf8',
    );

    expect(auditLogSchema).toContain('DB trigger가 지원 targetType/targetId 존재 여부를 검증');
    expect(attachmentSchema).toContain('DB trigger가 지원 sourceType/sourceId 존재 여부를 검증');
    expect(assetEventSchema).toContain('DB trigger가 sourceType별 sourceId 존재 여부와 source asset 일치까지 검증');
    expect(invoiceSchema).toContain('DB trigger가 InvoiceItem/InvoiceAdjustment 변경 시 자동 재계산');

    expect(migration).toContain('assert_audit_log_target_integrity');
    expect(migration).toContain('"AuditLog_target_integrity_guard"');
    expect(migration).toContain('assert_attachment_source_integrity');
    expect(migration).toContain('"Attachment_source_integrity_guard"');
    expect(migration).toContain('assert_asset_event_source_integrity');
    expect(migration).toContain('"AssetEvent_source_integrity_guard"');
    expect(migration).toContain('"Invoice_type_source_check"');
    expect(migration).toContain('"Invoice_period_range_check"');
    expect(migration).toContain('"InvoiceItem_quantity_positive_check"');
    expect(migration).toContain('"InvoiceItem_source_type_check"');
    expect(migration).toContain('"QuotationItem_amount_calculation_check"');
    expect(migration).toContain('"TaxInvoice_amount_calculation_check"');
    expect(migration).toContain('"ServiceVisit_cost_non_negative_check"');
    expect(migration).toContain('"MeterReading_count_usage_non_negative_check"');
    expect(migration).toContain('"RentalContract_payment_due_day_range_check"');
    expect(migration).toContain('"RentalContractItem_meter_values_check"');
    expect(migration).toContain('recalculate_invoice_final_amount');
    expect(migration).toContain('sync_invoice_final_amount');
    expect(migration).toContain('assert_payment_allocation_integrity');
    expect(migration).toContain('assert_payment_integrity');
    expect(migration).toContain('assert_refund_integrity');
    expect(migration).toContain('assert_refund_cap_for_invoice');
    expect(migration).toContain('assert_refund_cap_after_payment_status_change');
  });

  it('adds database guards for remaining high-risk model invariants', () => {
    const taxInvoiceSchema = readFileSync(join(prismaModelsPath, 'finance/tax-invoice.prisma'), 'utf8');
    const meterReadingSchema = readFileSync(join(prismaModelsPath, 'product/meter-reading.prisma'), 'utf8');
    const assetEventSchema = readFileSync(join(prismaModelsPath, 'product/asset-event.prisma'), 'utf8');
    const migration = readFileSync(
      join(prismaMigrationsPath, '20260616109000_resolve_remaining_model_risks/migration.sql'),
      'utf8',
    );

    expect(taxInvoiceSchema).toContain('DB trigger가 invoice/customer/original 의미 제약을 검증');
    expect(meterReadingSchema).toContain('DB trigger가 중복 검침과 이전/다음 검침 대비 카운터 단조 증가를 검증');
    expect(assetEventSchema).toContain('source asset 일치까지 검증');

    expect(migration).toContain('"TaxInvoice_type_original_check"');
    expect(migration).toContain('"TaxInvoice_nts_confirmed_requires_confirm_num_check"');
    expect(migration).toContain('assert_tax_invoice_invoice_consistency');
    expect(migration).toContain('"TaxInvoice_invoice_consistency_guard"');

    expect(migration).toContain('assert_status_transition');
    expect(migration).toContain('"Order_status_transition_guard"');
    expect(migration).toContain('"RentalContract_status_transition_guard"');
    expect(migration).toContain('"RentalContractItem_status_transition_guard"');
    expect(migration).toContain('"ServiceRequest_status_transition_guard"');
    expect(migration).toContain('"ServiceVisit_status_transition_guard"');
    expect(migration).toContain('"Invoice_status_transition_guard"');
    expect(migration).toContain('"Payment_status_transition_guard"');
    expect(migration).toContain('"Refund_status_transition_guard"');

    expect(migration).toContain('CREATE OR REPLACE FUNCTION "assert_asset_event_source_integrity"');
    expect(migration).toContain('asset mismatch');
    expect(migration).toContain('"MeterReading_asset_reading_date_key"');
    expect(migration).toContain('"MeterReading_color_pair_check"');
    expect(migration).toContain('assert_meter_reading_sequence_integrity');
    expect(migration).toContain('"MeterReading_sequence_guard"');

    expect(migration).toContain('"SaleOrderItem_vat_type_check"');
    expect(migration).toContain('"InvoiceItem_vat_type_check"');
    expect(migration).toContain('"QuotationItem_vat_type_check"');
  });

  it('uses unique ordered migration timestamps for the final model integrity migrations', () => {
    expect(existsSync(join(prismaMigrationsPath, '20260616107000_add_audit_log/migration.sql'))).toBe(true);
    expect(existsSync(join(prismaMigrationsPath, '20260616108000_harden_model_integrity/migration.sql'))).toBe(true);
    expect(existsSync(join(prismaMigrationsPath, '20260616109000_resolve_remaining_model_risks/migration.sql'))).toBe(
      true,
    );
    expect(existsSync(join(prismaMigrationsPath, '20260616107000_harden_model_integrity/migration.sql'))).toBe(false);
  });

  it('keeps status guards strict by default while allowing transaction-scoped operational overrides', () => {
    const apiPackage = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const dbJestConfigPath = join(__dirname, '../../test/jest-db.json');
    const migrationPath = join(prismaMigrationsPath, '20260616110000_status_transition_override/migration.sql');

    expect(apiPackage.scripts?.['test:db']).toBe('jest --config ./test/jest-db.json --runInBand');
    expect(existsSync(dbJestConfigPath)).toBe(true);
    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain("current_setting('rental_manager.status_transition_override', true)");
    expect(migration).toContain('CREATE OR REPLACE FUNCTION "assert_status_transition"');
  });

  it('enforces Asset status machine and Order-to-RentalContract cancellation cascade at DB level', () => {
    const migrationPath = join(
      prismaMigrationsPath,
      '20260616116000_asset_status_machine_and_order_contract_sync/migration.sql',
    );

    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, 'utf8');

    // Asset status machine
    expect(migration).toContain('assert_asset_status_transition');
    expect(migration).toContain('"Asset_status_transition_guard"');
    expect(migration).toContain("current_setting('rental_manager.status_transition_override', true)");
    expect(migration).toContain("'INCOMING'");
    expect(migration).toContain("'AVAILABLE'");
    expect(migration).toContain("'RENTED'");
    expect(migration).toContain("'SOLD'");
    expect(migration).toContain("'DISPOSED'");
    expect(migration).toContain("'LOST'");

    // Order → RentalContract cancellation cascade
    expect(migration).toContain('sync_rental_contract_on_order_cancel');
    expect(migration).toContain('"Order_cancel_sync_rental_contract"');
    expect(migration).toContain("rc.\"status\"");
  });

  it('models document sequences for organization-scoped daily numbering', () => {
    const enumSchema = readFileSync(join(__dirname, '../../prisma/enums.prisma'), 'utf8');
    const organizationSchema = readFileSync(join(prismaModelsPath, 'business/organization.prisma'), 'utf8');
    const sequencePath = join(prismaModelsPath, 'common/document-sequence.prisma');
    const migrationPath = join(
      prismaMigrationsPath,
      '20260616115000_document_sequence_and_workflow_services/migration.sql',
    );

    expect(existsSync(sequencePath)).toBe(true);
    expect(existsSync(migrationPath)).toBe(true);

    const sequenceSchema = readFileSync(sequencePath, 'utf8');
    const migration = readFileSync(migrationPath, 'utf8');

    expect(enumSchema).toContain('enum DocumentSequenceType');
    expect(enumSchema).toContain('ORDER');
    expect(enumSchema).toContain('INVOICE');
    expect(organizationSchema).toContain('documentSequences       DocumentSequence[]');
    expect(sequenceSchema).toContain('@@unique([organizationId, type, dateKey])');
    expect(migration).toContain('CREATE TYPE "DocumentSequenceType"');
    expect(migration).toContain('CREATE TABLE "DocumentSequence"');
  });

  it('models maintenance schedule for rental contracts with interval-based inspection tracking', () => {
    const enumSchema = readFileSync(join(__dirname, '../../prisma/enums.prisma'), 'utf8');
    const maintenanceSchedulePath = join(prismaModelsPath, 'service/maintenance-schedule.prisma');
    const serviceRequestSchema = readFileSync(join(prismaModelsPath, 'service/service-request.prisma'), 'utf8');
    const rentalContractSchema = readFileSync(join(prismaModelsPath, 'orders/rental-contract.prisma'), 'utf8');
    const organizationMemberSchema = readFileSync(
      join(prismaModelsPath, 'business/organization-member.prisma'),
      'utf8',
    );
    const migrationPath = join(
      prismaMigrationsPath,
      '20260616117000_maintenance_schedule/migration.sql',
    );

    expect(enumSchema).toContain('enum MaintenanceIntervalUnit');
    expect(enumSchema).toContain('MONTH');
    expect(enumSchema).toContain('DAY');

    expect(existsSync(maintenanceSchedulePath)).toBe(true);
    const maintenanceScheduleSchema = readFileSync(maintenanceSchedulePath, 'utf8');

    expect(maintenanceScheduleSchema).toContain('model MaintenanceSchedule');
    expect(maintenanceScheduleSchema).toContain(
      'rentalContract   RentalContract @relation(fields: [rentalContractId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(maintenanceScheduleSchema).toContain('intervalUnit  MaintenanceIntervalUnit');
    expect(maintenanceScheduleSchema).toContain('intervalValue Int');
    expect(maintenanceScheduleSchema).toContain('nextScheduledAt DateTime');
    expect(maintenanceScheduleSchema).toContain('lastInspectedAt DateTime?');
    expect(maintenanceScheduleSchema).toContain(
      'assignedStaff   OrganizationMember? @relation(fields: [assignedStaffId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(maintenanceScheduleSchema).toContain('isActive Boolean @default(true)');
    expect(maintenanceScheduleSchema).toContain('@@unique([id, organizationId])');
    expect(maintenanceScheduleSchema).toContain('@@index([organizationId, nextScheduledAt])');

    expect(serviceRequestSchema).toContain('maintenanceScheduleId String?');
    expect(serviceRequestSchema).toContain(
      'maintenanceSchedule   MaintenanceSchedule? @relation(fields: [maintenanceScheduleId, organizationId], references: [id, organizationId], onDelete: Restrict)',
    );
    expect(serviceRequestSchema).toContain('@@index([organizationId, maintenanceScheduleId])');

    expect(rentalContractSchema).toContain('maintenanceSchedules MaintenanceSchedule[]');
    expect(organizationMemberSchema).toContain('maintenanceSchedules MaintenanceSchedule[]');

    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TYPE "MaintenanceIntervalUnit"');
    expect(migration).toContain('CREATE TABLE "MaintenanceSchedule"');
    expect(migration).toContain('"MaintenanceSchedule_rentalContractId_organizationId_fkey"');
    expect(migration).toContain('"MaintenanceSchedule_assignedStaffId_organizationId_fkey"');
    expect(migration).toContain('"MaintenanceSchedule_interval_value_positive_check"');
    expect(migration).toContain('"ServiceRequest_maintenanceScheduleId_organizationId_fkey"');
  });

  describe('User 인증 도메인 schema', () => {
    const userModelsPath = join(prismaModelsPath, 'user');
    const migrationPath = join(
      prismaMigrationsPath,
      '20260618118000_user_auth_domain',
      'migration.sql',
    );

    it('enums.prisma에 UserType, OAuthProvider, OrganizationMemberRole이 정의되어 있다', () => {
      const enumsPath = join(__dirname, '../../prisma/enums.prisma');
      const enums = readFileSync(enumsPath, 'utf8');

      expect(enums).toContain('enum UserType {');
      expect(enums).toContain('PERSONAL');
      expect(enums).toContain('BUSINESS');
      expect(enums).toContain('enum OAuthProvider {');
      expect(enums).toContain('GOOGLE');
      expect(enums).toContain('KAKAO');
      expect(enums).toContain('NAVER');
      expect(enums).toContain('enum OrganizationMemberRole {');
      expect(enums).toContain('OWNER');
      expect(enums).toContain('ADMIN');
      expect(enums).toContain('MANAGER');
      expect(enums).toContain('STAFF');
    });

    it('User 모델이 type, account, organizationMembers 관계를 가진다', () => {
      const userSchema = readFileSync(join(userModelsPath, 'user.prisma'), 'utf8');

      expect(userSchema).toContain('model User {');
      expect(userSchema).toContain('type UserType @default(PERSONAL)');
      expect(userSchema).toContain('deletedAt DateTime?');
      expect(userSchema).toContain('account             Account?');
      expect(userSchema).toContain('organizationMembers OrganizationMember[]');
    });

    it('Account 모델이 userId unique FK와 nullable passwordHash를 가진다', () => {
      const accountSchema = readFileSync(join(userModelsPath, 'account.prisma'), 'utf8');

      expect(accountSchema).toContain('model Account {');
      expect(accountSchema).toContain('userId String @unique');
      expect(accountSchema).toContain(
        'user   User   @relation(fields: [userId], references: [id], onDelete: Restrict)',
      );
      expect(accountSchema).toContain('email        String  @unique');
      expect(accountSchema).toContain('passwordHash String?');
      expect(accountSchema).toContain('isActive    Boolean   @default(true)');
      expect(accountSchema).toContain('lastLoginAt DateTime?');
      expect(accountSchema).toContain('identities        AccountIdentity[]');
      expect(accountSchema).toContain('passwordHistories PasswordHistory[]');
      expect(accountSchema).toContain('refreshTokens     RefreshToken[]');
      expect(accountSchema).toContain('@@index([email])');
    });
  });
});
