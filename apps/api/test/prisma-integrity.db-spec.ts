import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { Client } from 'pg';

const DEFAULT_DATABASE_URL = 'postgresql://rental_manager:rental_manager_password@127.0.0.1:5432/rental_manager';
const apiRoot = join(__dirname, '..');

type SeededCustomer = {
  organizationId: string;
  customerId: string;
};

type RentalInvoiceTraceFixture = SeededCustomer & {
  productId: string;
  rentalOrderItemId: string;
  otherRentalOrderItemId: string;
  rentalContractId: string;
  otherRentalContractId: string;
  rentalContractItemId: string;
  otherRentalContractItemId: string;
  invoiceId: string;
  now: Date;
};

const quoteIdentifier = (identifier: string): string => `"${identifier.replaceAll('"', '""')}"`;

const databaseUrlFor = (baseDatabaseUrl: string, databaseName: string): string => {
  const url = new URL(baseDatabaseUrl);
  url.pathname = `/${databaseName}`;

  return url.toString();
};

const runMigrations = (databaseUrl: string): void => {
  try {
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: apiRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: 'pipe',
    });
  } catch (error) {
    const execError = error as { message?: string; stdout?: string; stderr?: string };

    throw new Error(
      [
        'Failed to apply Prisma migrations for DB integration test.',
        execError.message,
        execError.stdout,
        execError.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
};

const seedOrganizationAndCustomer = async (client: Client): Promise<SeededCustomer> => {
  const addressId = randomUUID();
  const businessProfileId = randomUUID();
  const organizationId = randomUUID();
  const individualProfileId = randomUUID();
  const customerId = randomUUID();
  const now = new Date();

  await client.query(
    `
      INSERT INTO "Address" ("id", "zonecode", "address", "updatedAt")
      VALUES ($1, '00000', 'DB integration test address', $2)
    `,
    [addressId, now],
  );
  await client.query(
    `
      INSERT INTO "BusinessProfile" (
        "id",
        "name",
        "businessRegistrationNo",
        "representativeName",
        "addressId",
        "updatedAt"
      )
      VALUES ($1, 'DB Integration Org', $2, 'Tester', $3, $4)
    `,
    [businessProfileId, `biz-${randomUUID()}`, addressId, now],
  );
  await client.query(
    `
      INSERT INTO "Organization" ("id", "businessProfileId", "updatedAt")
      VALUES ($1, $2, $3)
    `,
    [organizationId, businessProfileId, now],
  );
  await client.query(
    `
      INSERT INTO "IndividualProfile" ("id", "name", "updatedAt")
      VALUES ($1, 'DB Integration Customer', $2)
    `,
    [individualProfileId, now],
  );
  await client.query(
    `
      INSERT INTO "Customer" (
        "id",
        "organizationId",
        "type",
        "individualProfileId",
        "updatedAt"
      )
      VALUES ($1, $2, 'INDIVIDUAL', $3, $4)
    `,
    [customerId, organizationId, individualProfileId, now],
  );

  return { organizationId, customerId };
};

const seedAdditionalCustomer = async (client: Client, organizationId: string): Promise<string> => {
  const individualProfileId = randomUUID();
  const customerId = randomUUID();
  const now = new Date();

  await client.query(
    `
      INSERT INTO "IndividualProfile" ("id", "name", "updatedAt")
      VALUES ($1, 'DB Integration Additional Customer', $2)
    `,
    [individualProfileId, now],
  );
  await client.query(
    `
      INSERT INTO "Customer" (
        "id",
        "organizationId",
        "type",
        "individualProfileId",
        "updatedAt"
      )
      VALUES ($1, $2, 'INDIVIDUAL', $3, $4)
    `,
    [customerId, organizationId, individualProfileId, now],
  );

  return customerId;
};

const withTransaction = async (client: Client, callback: () => Promise<void>): Promise<void> => {
  await client.query('BEGIN');

  try {
    await callback();
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

const seedRentalInvoiceTraceFixture = async (client: Client): Promise<RentalInvoiceTraceFixture> => {
  const { organizationId, customerId } = await seedOrganizationAndCustomer(client);
  const productId = randomUUID();
  const assetId = randomUUID();
  const otherAssetId = randomUUID();
  const orderId = randomUUID();
  const otherOrderId = randomUUID();
  const rentalOrderId = randomUUID();
  const otherRentalOrderId = randomUUID();
  const rentalOrderItemId = randomUUID();
  const otherRentalOrderItemId = randomUUID();
  const rentalContractId = randomUUID();
  const otherRentalContractId = randomUUID();
  const rentalContractItemId = randomUUID();
  const otherRentalContractItemId = randomUUID();
  const invoiceId = randomUUID();
  const now = new Date();
  const startDate = new Date('2026-06-01T00:00:00.000Z');
  const endDate = new Date('2027-05-31T00:00:00.000Z');

  await client.query(
    `
      INSERT INTO "Product" (
        "id",
        "organizationId",
        "name",
        "updatedAt"
      )
      VALUES ($1, $2, 'DB Integration Rental Product', $3)
    `,
    [productId, organizationId, now],
  );
  await client.query(
    `
      INSERT INTO "Asset" (
        "id",
        "organizationId",
        "productId",
        "serialNumber",
        "updatedAt"
      )
      VALUES
        ($1, $2, $3, $4, $6),
        ($5, $2, $3, $7, $6)
    `,
    [assetId, organizationId, productId, `asset-${randomUUID()}`, otherAssetId, now, `asset-${randomUUID()}`],
  );
  await client.query(
    `
      INSERT INTO "Order" (
        "id",
        "organizationId",
        "orderNo",
        "type",
        "status",
        "customerId",
        "updatedAt"
      )
      VALUES
        ($1, $2, $3, 'RENTAL', 'REGISTERED', $4, $5),
        ($6, $2, $7, 'RENTAL', 'REGISTERED', $4, $5)
    `,
    [orderId, organizationId, `ORD-${randomUUID()}`, customerId, now, otherOrderId, `ORD-${randomUUID()}`],
  );
  await client.query(
    `
      INSERT INTO "RentalOrder" (
        "id",
        "organizationId",
        "orderId",
        "managementNo",
        "updatedAt"
      )
      VALUES
        ($1, $2, $3, $4, $5),
        ($6, $2, $7, $8, $5)
    `,
    [
      rentalOrderId,
      organizationId,
      orderId,
      `RNT-${randomUUID()}`,
      now,
      otherRentalOrderId,
      otherOrderId,
      `RNT-${randomUUID()}`,
    ],
  );
  await client.query(
    `
      INSERT INTO "RentalOrderItem" (
        "id",
        "organizationId",
        "rentalOrderId",
        "productId",
        "assetId",
        "monthlyRentalPrice",
        "updatedAt"
      )
      VALUES
        ($1, $2, $3, $4, $5, 1000, $9),
        ($6, $2, $7, $4, $8, 1000, $9)
    `,
    [
      rentalOrderItemId,
      organizationId,
      rentalOrderId,
      productId,
      assetId,
      otherRentalOrderItemId,
      otherRentalOrderId,
      otherAssetId,
      now,
    ],
  );
  await client.query(
    `
      INSERT INTO "RentalContract" (
        "id",
        "organizationId",
        "rentalOrderId",
        "contractNo",
        "status",
        "startDate",
        "endDate",
        "contractMonths",
        "billingDay",
        "paymentDueDay",
        "updatedAt"
      )
      VALUES
        ($1, $2, $3, $4, 'DRAFT', $5, $6, 12, 1, 10, $9),
        ($7, $2, $8, $10, 'DRAFT', $5, $6, 12, 1, 10, $9)
    `,
    [
      rentalContractId,
      organizationId,
      rentalOrderId,
      `CTR-${randomUUID()}`,
      startDate,
      endDate,
      otherRentalContractId,
      otherRentalOrderId,
      now,
      `CTR-${randomUUID()}`,
    ],
  );
  await client.query(
    `
      INSERT INTO "RentalContractItem" (
        "id",
        "organizationId",
        "rentalContractId",
        "rentalOrderItemId",
        "assetId",
        "monthlyRentalPrice",
        "updatedAt"
      )
      VALUES
        ($1, $2, $3, $4, $5, 1000, $9),
        ($6, $2, $7, $8, $10, 1000, $9)
    `,
    [
      rentalContractItemId,
      organizationId,
      rentalContractId,
      rentalOrderItemId,
      assetId,
      otherRentalContractItemId,
      otherRentalContractId,
      otherRentalOrderItemId,
      now,
      otherAssetId,
    ],
  );
  await client.query(
    `
      INSERT INTO "Invoice" (
        "id",
        "organizationId",
        "invoiceNo",
        "type",
        "status",
        "customerId",
        "rentalContractId",
        "billingMonth",
        "periodStart",
        "periodEnd",
        "finalAmount",
        "updatedAt"
      )
      VALUES ($1, $2, $3, 'RENTAL_MONTHLY', 'DRAFT', $4, $5, '2026-06', $6, $7, 0, $8)
    `,
    [invoiceId, organizationId, `INV-${randomUUID()}`, customerId, rentalContractId, startDate, endDate, now],
  );

  return {
    organizationId,
    customerId,
    productId,
    rentalOrderItemId,
    otherRentalOrderItemId,
    rentalContractId,
    otherRentalContractId,
    rentalContractItemId,
    otherRentalContractItemId,
    invoiceId,
    now,
  };
};

const seedSaleOrderItem = async (
  client: Client,
  fixture: Pick<RentalInvoiceTraceFixture, 'organizationId' | 'customerId' | 'productId' | 'now'>,
): Promise<string> => {
  const orderId = randomUUID();
  const saleOrderId = randomUUID();
  const saleOrderItemId = randomUUID();

  await client.query(
    `
      INSERT INTO "Order" (
        "id",
        "organizationId",
        "orderNo",
        "type",
        "status",
        "customerId",
        "updatedAt"
      )
      VALUES ($1, $2, $3, 'SALE', 'REGISTERED', $4, $5)
    `,
    [orderId, fixture.organizationId, `ORD-${randomUUID()}`, fixture.customerId, fixture.now],
  );
  await client.query(
    `
      INSERT INTO "SaleOrder" (
        "id",
        "organizationId",
        "orderId",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4)
    `,
    [saleOrderId, fixture.organizationId, orderId, fixture.now],
  );
  await client.query(
    `
      INSERT INTO "SaleOrderItem" (
        "id",
        "organizationId",
        "saleOrderId",
        "productId",
        "quantity",
        "unitPrice",
        "supplyAmount",
        "vatType",
        "vatAmount",
        "totalAmount",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, 1, 1000, 1000, 'NONE', 0, 1000, $5)
    `,
    [saleOrderItemId, fixture.organizationId, saleOrderId, fixture.productId, fixture.now],
  );

  return saleOrderItemId;
};

const insertContractBackedRentalInvoiceItem = async (
  client: Client,
  fixture: RentalInvoiceTraceFixture,
  invoiceItemId = randomUUID(),
): Promise<string> => {
  await client.query(
    `
      INSERT INTO "InvoiceItem" (
        "id",
        "organizationId",
        "invoiceId",
        "rentalOrderItemId",
        "rentalContractItemId",
        "type",
        "description",
        "quantity",
        "unitPrice",
        "supplyAmount",
        "vatType",
        "vatAmount",
        "totalAmount",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, 'RENTAL_FEE', 'Monthly rental fee', 1, 1000, 1000, 'NONE', 0, 1000, $6)
    `,
    [
      invoiceItemId,
      fixture.organizationId,
      fixture.invoiceId,
      fixture.rentalOrderItemId,
      fixture.rentalContractItemId,
      fixture.now,
    ],
  );

  return invoiceItemId;
};

const insertMeterUsageInvoiceItem = async (
  client: Client,
  fixture: RentalInvoiceTraceFixture,
  invoiceItemId = randomUUID(),
): Promise<string> => {
  await client.query(
    `
      INSERT INTO "InvoiceItem" (
        "id",
        "organizationId",
        "invoiceId",
        "rentalContractItemId",
        "type",
        "description",
        "quantity",
        "unitPrice",
        "supplyAmount",
        "vatType",
        "vatAmount",
        "totalAmount",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, 'METER_USAGE', 'Meter usage charge', 1, 500, 500, 'NONE', 0, 500, $5)
    `,
    [invoiceItemId, fixture.organizationId, fixture.invoiceId, fixture.rentalContractItemId, fixture.now],
  );

  return invoiceItemId;
};

const insertMeterReading = async (
  client: Client,
  fixture: RentalInvoiceTraceFixture,
  invoiceItemId: string,
  readingId = randomUUID(),
  rentalContractItemId = fixture.rentalContractItemId,
): Promise<string> => {
  await client.query(
    `
      INSERT INTO "MeterReading" (
        "id",
        "organizationId",
        "assetId",
        "rentalContractItemId",
        "readingDate",
        "blackCount",
        "blackUsage",
        "readingMethod",
        "invoiceItemId",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        (
          SELECT "assetId"
          FROM "RentalContractItem"
          WHERE "id" = $3
            AND "organizationId" = $2
        ),
        $3,
        $4,
        100,
        100,
        'MANUAL',
        $5,
        $4
      )
    `,
    [readingId, fixture.organizationId, rentalContractItemId, fixture.now, invoiceItemId],
  );

  return readingId;
};

const insertAdditionalMeterContractItem = async (
  client: Client,
  fixture: RentalInvoiceTraceFixture,
  contractItemId = randomUUID(),
): Promise<string> => {
  const assetId = randomUUID();

  await client.query(
    `
      INSERT INTO "Asset" (
        "id",
        "organizationId",
        "productId",
        "serialNumber",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [assetId, fixture.organizationId, fixture.productId, `asset-${randomUUID()}`, fixture.now],
  );
  await client.query(
    `
      INSERT INTO "RentalContractItem" (
        "id",
        "organizationId",
        "rentalContractId",
        "assetId",
        "monthlyRentalPrice",
        "billingType",
        "freeBlackCount",
        "blackUnitPrice",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, 1000, 'METER', 100, 10, $5)
    `,
    [contractItemId, fixture.organizationId, fixture.rentalContractId, assetId, fixture.now],
  );

  return contractItemId;
};

const insertManualInvoice = async (
  client: Client,
  seed: SeededCustomer,
  invoiceId = randomUUID(),
  now = new Date(),
): Promise<string> => {
  await client.query(
    `
      INSERT INTO "Invoice" (
        "id",
        "organizationId",
        "invoiceNo",
        "type",
        "status",
        "customerId",
        "updatedAt"
      )
      VALUES ($1, $2, $3, 'MANUAL', 'DRAFT', $4, $5)
    `,
    [invoiceId, seed.organizationId, `INV-${randomUUID()}`, seed.customerId, now],
  );

  return invoiceId;
};

const insertTaxInvoice = async (
  client: Client,
  input: {
    organizationId: string;
    customerId: string;
    invoiceId?: string | null;
    originalTaxInvoiceId?: string | null;
    type?: 'TAX_INVOICE' | 'CREDIT_NOTE';
    taxInvoiceId?: string;
    now?: Date;
  },
): Promise<string> => {
  const taxInvoiceId = input.taxInvoiceId ?? randomUUID();
  const now = input.now ?? new Date();

  await client.query(
    `
      INSERT INTO "TaxInvoice" (
        "id",
        "organizationId",
        "taxInvoiceNo",
        "type",
        "status",
        "originalTaxInvoiceId",
        "invoiceId",
        "customerId",
        "buyerBusinessNo",
        "buyerName",
        "supplyAmount",
        "vatAmount",
        "totalAmount",
        "issueDate",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, '123-45-67890', 'DB Integration Buyer', 1000, 0, 1000, $8, $8)
    `,
    [
      taxInvoiceId,
      input.organizationId,
      `TAX-${randomUUID()}`,
      input.type ?? 'TAX_INVOICE',
      input.originalTaxInvoiceId ?? null,
      input.invoiceId ?? null,
      input.customerId,
      now,
    ],
  );

  return taxInvoiceId;
};

describe('Prisma database integrity guards', () => {
  const baseDatabaseUrl = process.env.DB_INTEGRATION_DATABASE_URL ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const adminDatabaseName = process.env.DB_INTEGRATION_ADMIN_DATABASE ?? 'postgres';
  const testDatabaseName = `rental_manager_db_${process.pid}_${Date.now()}`;
  const adminDatabaseUrl = databaseUrlFor(baseDatabaseUrl, adminDatabaseName);
  const testDatabaseUrl = databaseUrlFor(baseDatabaseUrl, testDatabaseName);

  let adminClient: Client | undefined;
  let client: Client | undefined;

  beforeAll(async () => {
    const connectedAdminClient = new Client({ connectionString: adminDatabaseUrl });

    await connectedAdminClient.connect();
    adminClient = connectedAdminClient;
    await adminClient.query(`CREATE DATABASE ${quoteIdentifier(testDatabaseName)}`);

    runMigrations(testDatabaseUrl);

    client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();

    if (adminClient) {
      await adminClient.query(
        `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1
            AND pid <> pg_backend_pid()
        `,
        [testDatabaseName],
      );
      await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(testDatabaseName)}`);
      await adminClient.end();
    }
  });

  it('blocks invalid status jumps unless a transaction-local operational override is enabled', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const { organizationId, customerId } = await seedOrganizationAndCustomer(client);
    const orderId = randomUUID();
    const now = new Date();

    await client.query(
      `
        INSERT INTO "Order" (
          "id",
          "organizationId",
          "orderNo",
          "type",
          "status",
          "customerId",
          "updatedAt"
        )
        VALUES ($1, $2, $3, 'SALE', 'REGISTERED', $4, $5)
      `,
      [orderId, organizationId, `ORD-${randomUUID()}`, customerId, now],
    );

    await expect(
      client.query(
        `
          UPDATE "Order"
          SET "status" = 'DELIVERED',
              "updatedAt" = $1
          WHERE "id" = $2
        `,
        [new Date(), orderId],
      ),
    ).rejects.toThrow(/Invalid Order status transition: REGISTERED -> DELIVERED/);

    await withTransaction(client, async () => {
      await client.query("SET LOCAL rental_manager.status_transition_override = 'on'");
      await client.query(
        `
          UPDATE "Order"
          SET "status" = 'DELIVERED',
              "updatedAt" = $1
          WHERE "id" = $2
        `,
        [new Date(), orderId],
      );
    });

    const result = await client.query<{ status: string }>(
      'SELECT "status"::TEXT AS status FROM "Order" WHERE "id" = $1',
      [orderId],
    );

    expect(result.rows[0]?.status).toBe('DELIVERED');
  });

  it('prevents changing invoice items after invoice issue for invoice-level tax invoices', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const { organizationId, customerId } = await seedOrganizationAndCustomer(client);
    const invoiceId = randomUUID();
    const invoiceItemId = randomUUID();
    const now = new Date();

    await client.query(
      `
        INSERT INTO "Invoice" (
          "id",
          "organizationId",
          "invoiceNo",
          "type",
          "status",
          "customerId",
          "updatedAt"
        )
        VALUES ($1, $2, $3, 'MANUAL', 'DRAFT', $4, $5)
      `,
      [invoiceId, organizationId, `INV-${randomUUID()}`, customerId, now],
    );
    await client.query(
      `
        INSERT INTO "InvoiceItem" (
          "id",
          "organizationId",
          "invoiceId",
          "type",
          "description",
          "quantity",
          "unitPrice",
          "supplyAmount",
          "vatType",
          "vatAmount",
          "totalAmount",
          "updatedAt"
        )
        VALUES ($1, $2, $3, 'ETC', 'Manual charge', 1, 1000, 1000, 'NONE', 0, 1000, $4)
      `,
      [invoiceItemId, organizationId, invoiceId, now],
    );
    await client.query(
      `
        UPDATE "Invoice"
        SET "status" = 'ISSUED',
            "issuedAt" = $1,
            "updatedAt" = $1
        WHERE "id" = $2
          AND "organizationId" = $3
      `,
      [new Date(), invoiceId, organizationId],
    );

    await expect(
      client.query(
        `
          UPDATE "InvoiceItem"
          SET "unitPrice" = 2000,
              "supplyAmount" = 2000,
              "totalAmount" = 2000,
              "updatedAt" = $1
          WHERE "id" = $2
        `,
        [new Date(), invoiceItemId],
      ),
    ).rejects.toThrow(/cannot be changed/);
  });

  it('prevents moving invoice items away from issued invoices', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const { organizationId, customerId } = await seedOrganizationAndCustomer(client);
    const invoiceId = randomUUID();
    const otherInvoiceId = randomUUID();
    const invoiceItemId = randomUUID();
    const now = new Date();

    await client.query(
      `
        INSERT INTO "Invoice" (
          "id",
          "organizationId",
          "invoiceNo",
          "type",
          "status",
          "customerId",
          "updatedAt"
        )
        VALUES
          ($1, $2, $3, 'MANUAL', 'DRAFT', $4, $5),
          ($6, $2, $7, 'MANUAL', 'DRAFT', $4, $5)
      `,
      [invoiceId, organizationId, `INV-${randomUUID()}`, customerId, now, otherInvoiceId, `INV-${randomUUID()}`],
    );
    await client.query(
      `
        INSERT INTO "InvoiceItem" (
          "id",
          "organizationId",
          "invoiceId",
          "type",
          "description",
          "quantity",
          "unitPrice",
          "supplyAmount",
          "vatType",
          "vatAmount",
          "totalAmount",
          "updatedAt"
        )
        VALUES ($1, $2, $3, 'ETC', 'Manual charge', 1, 1000, 1000, 'NONE', 0, 1000, $4)
      `,
      [invoiceItemId, organizationId, invoiceId, now],
    );
    await client.query(
      `
        UPDATE "Invoice"
        SET "status" = 'ISSUED',
            "issuedAt" = $1,
            "updatedAt" = $1
        WHERE "id" = $2
          AND "organizationId" = $3
      `,
      [new Date(), invoiceId, organizationId],
    );

    await expect(
      client.query(
        `
          UPDATE "InvoiceItem"
          SET "invoiceId" = $1,
              "updatedAt" = $2
          WHERE "id" = $3
            AND "organizationId" = $4
        `,
        [otherInvoiceId, new Date(), invoiceItemId, organizationId],
      ),
    ).rejects.toThrow(/cannot be changed/);
  });

  it('prevents changing invoice adjustments after invoice issue', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const { organizationId, customerId } = await seedOrganizationAndCustomer(client);
    const invoiceId = randomUUID();
    const adjustmentId = randomUUID();
    const now = new Date();

    await client.query(
      `
        INSERT INTO "Invoice" (
          "id",
          "organizationId",
          "invoiceNo",
          "type",
          "status",
          "customerId",
          "updatedAt"
        )
        VALUES ($1, $2, $3, 'MANUAL', 'DRAFT', $4, $5)
      `,
      [invoiceId, organizationId, `INV-${randomUUID()}`, customerId, now],
    );
    await client.query(
      `
        INSERT INTO "InvoiceAdjustment" (
          "id",
          "organizationId",
          "invoiceId",
          "type",
          "amount",
          "updatedAt"
        )
        VALUES ($1, $2, $3, 'EXTRA_CHARGE', 1000, $4)
      `,
      [adjustmentId, organizationId, invoiceId, now],
    );
    await client.query(
      `
        UPDATE "Invoice"
        SET "status" = 'ISSUED',
            "issuedAt" = $1,
            "updatedAt" = $1
        WHERE "id" = $2
          AND "organizationId" = $3
      `,
      [new Date(), invoiceId, organizationId],
    );

    await expect(
      client.query(
        `
          UPDATE "InvoiceAdjustment"
          SET "amount" = 2000,
              "updatedAt" = $1
          WHERE "id" = $2
            AND "organizationId" = $3
        `,
        [new Date(), adjustmentId, organizationId],
      ),
    ).rejects.toThrow(/invoice adjustments cannot be changed/);
  });

  it('allows invoice-level tax invoices for the matching invoice customer', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const seed = await seedOrganizationAndCustomer(client);
    const invoiceId = await insertManualInvoice(client, seed);
    const taxInvoiceId = await insertTaxInvoice(client, {
      organizationId: seed.organizationId,
      customerId: seed.customerId,
      invoiceId,
    });

    const result = await client.query<{ invoiceId: string }>(
      `
        SELECT "invoiceId"
        FROM "TaxInvoice"
        WHERE "id" = $1
          AND "organizationId" = $2
      `,
      [taxInvoiceId, seed.organizationId],
    );

    expect(result.rows[0]?.invoiceId).toBe(invoiceId);
  });

  it('rejects tax invoices whose customer differs from the linked invoice customer', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const invoiceSeed = await seedOrganizationAndCustomer(client);
    const otherCustomerId = await seedAdditionalCustomer(client, invoiceSeed.organizationId);
    const invoiceId = await insertManualInvoice(client, invoiceSeed);

    await expect(
      insertTaxInvoice(client, {
        organizationId: invoiceSeed.organizationId,
        customerId: otherCustomerId,
        invoiceId,
      }),
    ).rejects.toThrow(/does not match invoice/);
  });

  it('rejects credit notes that reference another credit note as original', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const seed = await seedOrganizationAndCustomer(client);
    const invoiceId = await insertManualInvoice(client, seed);
    const originalTaxInvoiceId = await insertTaxInvoice(client, {
      organizationId: seed.organizationId,
      customerId: seed.customerId,
      invoiceId,
    });
    const creditNoteId = await insertTaxInvoice(client, {
      organizationId: seed.organizationId,
      customerId: seed.customerId,
      originalTaxInvoiceId,
      type: 'CREDIT_NOTE',
    });

    await expect(
      insertTaxInvoice(client, {
        organizationId: seed.organizationId,
        customerId: seed.customerId,
        originalTaxInvoiceId: creditNoteId,
        type: 'CREDIT_NOTE',
      }),
    ).rejects.toThrow(/must reference a TAX_INVOICE/);
  });

  it('rejects credit notes whose customer differs from the original tax invoice customer', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const originalSeed = await seedOrganizationAndCustomer(client);
    const otherCustomerId = await seedAdditionalCustomer(client, originalSeed.organizationId);
    const invoiceId = await insertManualInvoice(client, originalSeed);
    const originalTaxInvoiceId = await insertTaxInvoice(client, {
      organizationId: originalSeed.organizationId,
      customerId: originalSeed.customerId,
      invoiceId,
    });

    await expect(
      insertTaxInvoice(client, {
        organizationId: originalSeed.organizationId,
        customerId: otherCustomerId,
        originalTaxInvoiceId,
        type: 'CREDIT_NOTE',
      }),
    ).rejects.toThrow(/does not match original tax invoice/);
  });

  it('rejects rental invoice items whose rental contract item belongs to another contract', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const fixture = await seedRentalInvoiceTraceFixture(client);
    const invoiceItemId = randomUUID();

    await expect(
      client.query(
        `
          INSERT INTO "InvoiceItem" (
            "id",
            "organizationId",
            "invoiceId",
            "rentalOrderItemId",
            "rentalContractItemId",
            "type",
            "description",
            "quantity",
            "unitPrice",
            "supplyAmount",
            "vatType",
            "vatAmount",
            "totalAmount",
            "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, 'RENTAL_FEE', 'Monthly rental fee', 1, 1000, 1000, 'NONE', 0, 1000, $6)
        `,
        [
          invoiceItemId,
          fixture.organizationId,
          fixture.invoiceId,
          fixture.rentalOrderItemId,
          fixture.otherRentalContractItemId,
          fixture.now,
        ],
      ),
    ).rejects.toThrow(/rental contract item must belong to invoice rental contract/);
  });

  it('allows matching rental invoice items to reference their contract item', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const fixture = await seedRentalInvoiceTraceFixture(client);
    const invoiceItemId = await insertContractBackedRentalInvoiceItem(client, fixture);

    const result = await client.query<{ rentalContractItemId: string }>(
      `
        SELECT "rentalContractItemId"
        FROM "InvoiceItem"
        WHERE "id" = $1
          AND "organizationId" = $2
      `,
      [invoiceItemId, fixture.organizationId],
    );

    expect(result.rows[0]?.rentalContractItemId).toBe(fixture.rentalContractItemId);
  });

  it('rejects invoice parent updates that invalidate contract-item-backed invoice items', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const fixture = await seedRentalInvoiceTraceFixture(client);
    await insertContractBackedRentalInvoiceItem(client, fixture);

    await expect(
      client.query(
        `
          UPDATE "Invoice"
          SET "rentalContractId" = $1,
              "updatedAt" = $2
          WHERE "id" = $3
            AND "organizationId" = $4
        `,
        [fixture.otherRentalContractId, new Date(), fixture.invoiceId, fixture.organizationId],
      ),
    ).rejects.toThrow(/existing InvoiceItems with rentalContractItemId/);
  });

  it('rejects rental contract item parent updates that invalidate existing invoice items', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const fixture = await seedRentalInvoiceTraceFixture(client);
    await insertContractBackedRentalInvoiceItem(client, fixture);

    await expect(
      client.query(
        `
          UPDATE "RentalContractItem"
          SET "rentalContractId" = $1,
              "updatedAt" = $2
          WHERE "id" = $3
            AND "organizationId" = $4
        `,
        [fixture.otherRentalContractId, new Date(), fixture.rentalContractItemId, fixture.organizationId],
      ),
    ).rejects.toThrow(/existing InvoiceItems with rentalContractItemId/);
  });

  it('rejects invoice items that mix sale sources with rental contract item sources', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const fixture = await seedRentalInvoiceTraceFixture(client);
    const saleOrderItemId = await seedSaleOrderItem(client, fixture);

    await expect(
      client.query(
        `
          INSERT INTO "InvoiceItem" (
            "id",
            "organizationId",
            "invoiceId",
            "saleOrderItemId",
            "rentalContractItemId",
            "type",
            "description",
            "quantity",
            "unitPrice",
            "supplyAmount",
            "vatType",
            "vatAmount",
            "totalAmount",
            "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5, 'SALE_PRICE', 'Mixed source item', 1, 1000, 1000, 'NONE', 0, 1000, $6)
        `,
        [
          randomUUID(),
          fixture.organizationId,
          fixture.invoiceId,
          saleOrderItemId,
          fixture.rentalContractItemId,
          fixture.now,
        ],
      ),
    ).rejects.toThrow(/InvoiceItem_source_type_check/);
  });

  it('recalculates invoice settlement summary after payment allocation and refund completion', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const { organizationId, customerId } = await seedOrganizationAndCustomer(client);
    const now = new Date();
    const invoiceId = randomUUID();
    const paymentId = randomUUID();
    const refundId = randomUUID();

    await client.query(
      `
        INSERT INTO "Invoice" (
          "id",
          "organizationId",
          "invoiceNo",
          "type",
          "status",
          "customerId",
          "updatedAt"
        )
        VALUES ($1, $2, $3, 'MANUAL', 'DRAFT', $4, $5)
      `,
      [invoiceId, organizationId, `INV-${randomUUID()}`, customerId, now],
    );
    await client.query(
      `
        INSERT INTO "InvoiceItem" (
          "id",
          "organizationId",
          "invoiceId",
          "type",
          "quantity",
          "unitPrice",
          "supplyAmount",
          "vatType",
          "vatAmount",
          "totalAmount",
          "updatedAt"
        )
        VALUES ($1, $2, $3, 'ETC', 1, 10000, 10000, 'NONE', 0, 10000, $4)
      `,
      [randomUUID(), organizationId, invoiceId, now],
    );
    await client.query(
      `
        INSERT INTO "Payment" (
          "id",
          "organizationId",
          "paymentNo",
          "customerId",
          "status",
          "method",
          "amount",
          "paidAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 'COMPLETED', 'BANK_TRANSFER', 6000, $5, $5)
      `,
      [paymentId, organizationId, `PAY-${randomUUID()}`, customerId, now],
    );
    await client.query(
      `
        INSERT INTO "PaymentAllocation" (
          "id",
          "organizationId",
          "paymentId",
          "invoiceId",
          "amount",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 6000, $5)
      `,
      [randomUUID(), organizationId, paymentId, invoiceId, now],
    );

    const partial = await client.query<{
      finalAmount: number;
      paidAmount: number;
      refundedAmount: number;
      outstandingAmount: number;
      settlementStatus: string;
    }>(
      `
        SELECT
          "finalAmount",
          "paidAmount",
          "refundedAmount",
          "outstandingAmount",
          "settlementStatus"::TEXT
        FROM "Invoice"
        WHERE "id" = $1
      `,
      [invoiceId],
    );

    expect(partial.rows[0]).toEqual({
      finalAmount: 10000,
      paidAmount: 6000,
      refundedAmount: 0,
      outstandingAmount: 4000,
      settlementStatus: 'PARTIALLY_PAID',
    });

    await client.query(
      `
        INSERT INTO "Refund" (
          "id",
          "organizationId",
          "refundNo",
          "customerId",
          "invoiceId",
          "paymentId",
          "status",
          "reason",
          "amount",
          "method",
          "refundedAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'COMPLETED', 'OVERPAYMENT', 1000, 'BANK_TRANSFER', $7, $7)
      `,
      [refundId, organizationId, `REF-${randomUUID()}`, customerId, invoiceId, paymentId, now],
    );

    const refunded = await client.query<{
      paidAmount: number;
      refundedAmount: number;
      outstandingAmount: number;
      settlementStatus: string;
    }>(
      `
        SELECT
          "paidAmount",
          "refundedAmount",
          "outstandingAmount",
          "settlementStatus"::TEXT
        FROM "Invoice"
        WHERE "id" = $1
      `,
      [invoiceId],
    );

    expect(refunded.rows[0]).toEqual({
      paidAmount: 6000,
      refundedAmount: 1000,
      outstandingAmount: 5000,
      settlementStatus: 'PARTIALLY_PAID',
    });
  });

  it('keeps a newly inserted zero-amount invoice unpaid until a financial recalculation changes it', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const { organizationId, customerId } = await seedOrganizationAndCustomer(client);
    const invoiceId = randomUUID();
    const now = new Date();

    await client.query(
      `
        INSERT INTO "Invoice" (
          "id",
          "organizationId",
          "invoiceNo",
          "type",
          "status",
          "customerId",
          "updatedAt"
        )
        VALUES ($1, $2, $3, 'MANUAL', 'DRAFT', $4, $5)
      `,
      [invoiceId, organizationId, `INV-${randomUUID()}`, customerId, now],
    );

    const result = await client.query<{
      finalAmount: number;
      paidAmount: number;
      refundedAmount: number;
      outstandingAmount: number;
      settlementStatus: string;
    }>(
      `
        SELECT
          "finalAmount",
          "paidAmount",
          "refundedAmount",
          "outstandingAmount",
          "settlementStatus"::TEXT
        FROM "Invoice"
        WHERE "id" = $1
      `,
      [invoiceId],
    );

    expect(result.rows[0]).toEqual({
      finalAmount: 0,
      paidAmount: 0,
      refundedAmount: 0,
      outstandingAmount: 0,
      settlementStatus: 'UNPAID',
    });
  });

  it('marks zero-amount invoices with completed payment allocations as overpaid', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const { organizationId, customerId } = await seedOrganizationAndCustomer(client);
    const invoiceId = randomUUID();
    const paymentId = randomUUID();
    const now = new Date();

    await client.query(
      `
        INSERT INTO "Invoice" (
          "id",
          "organizationId",
          "invoiceNo",
          "type",
          "status",
          "customerId",
          "updatedAt"
        )
        VALUES ($1, $2, $3, 'MANUAL', 'DRAFT', $4, $5)
      `,
      [invoiceId, organizationId, `INV-${randomUUID()}`, customerId, now],
    );
    await client.query(
      `
        INSERT INTO "Payment" (
          "id",
          "organizationId",
          "paymentNo",
          "customerId",
          "status",
          "method",
          "amount",
          "paidAt",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 'COMPLETED', 'BANK_TRANSFER', 1000, $5, $5)
      `,
      [paymentId, organizationId, `PAY-${randomUUID()}`, customerId, now],
    );
    await client.query(
      `
        INSERT INTO "PaymentAllocation" (
          "id",
          "organizationId",
          "paymentId",
          "invoiceId",
          "amount",
          "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 1000, $5)
      `,
      [randomUUID(), organizationId, paymentId, invoiceId, now],
    );

    const result = await client.query<{
      finalAmount: number;
      paidAmount: number;
      refundedAmount: number;
      outstandingAmount: number;
      settlementStatus: string;
    }>(
      `
        SELECT
          "finalAmount",
          "paidAmount",
          "refundedAmount",
          "outstandingAmount",
          "settlementStatus"::TEXT
        FROM "Invoice"
        WHERE "id" = $1
      `,
      [invoiceId],
    );

    expect(result.rows[0]).toEqual({
      finalAmount: 0,
      paidAmount: 1000,
      refundedAmount: 0,
      outstandingAmount: 0,
      settlementStatus: 'OVERPAID',
    });
  });

  it('rejects direct invoice settlement summary mutations', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const { organizationId, customerId } = await seedOrganizationAndCustomer(client);
    const invoiceId = randomUUID();
    const now = new Date();

    await client.query(
      `
        INSERT INTO "Invoice" (
          "id",
          "organizationId",
          "invoiceNo",
          "type",
          "status",
          "customerId",
          "updatedAt"
        )
        VALUES ($1, $2, $3, 'MANUAL', 'DRAFT', $4, $5)
      `,
      [invoiceId, organizationId, `INV-${randomUUID()}`, customerId, now],
    );

    await expect(
      client.query(
        `
          UPDATE "Invoice"
          SET "paidAmount" = 999,
              "settlementStatus" = 'PAID',
              "updatedAt" = $1
          WHERE "id" = $2
            AND "organizationId" = $3
        `,
        [new Date(), invoiceId, organizationId],
      ),
    ).rejects.toThrow(/settlement summary fields are managed/);
  });

  it('rejects invoice inserts with caller-provided settlement summary values', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const { organizationId, customerId } = await seedOrganizationAndCustomer(client);
    const now = new Date();

    await expect(
      client.query(
        `
          INSERT INTO "Invoice" (
            "id",
            "organizationId",
            "invoiceNo",
            "type",
            "status",
            "customerId",
            "finalAmount",
            "paidAmount",
            "outstandingAmount",
            "settlementStatus",
            "updatedAt"
          )
          VALUES ($1, $2, $3, 'MANUAL', 'DRAFT', $4, 1000, 1000, 0, 'PAID', $5)
        `,
        [randomUUID(), organizationId, `INV-${randomUUID()}`, customerId, now],
      ),
    ).rejects.toThrow(/settlement summary fields are managed/);
  });

  it('allows meter readings to link to matching meter usage invoice items', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const fixture = await seedRentalInvoiceTraceFixture(client);
    const invoiceItemId = await insertMeterUsageInvoiceItem(client, fixture);
    const meterReadingId = await insertMeterReading(client, fixture, invoiceItemId);

    const result = await client.query<{ invoiceItemId: string }>(
      `
        SELECT "invoiceItemId"
        FROM "MeterReading"
        WHERE "id" = $1
          AND "organizationId" = $2
      `,
      [meterReadingId, fixture.organizationId],
    );

    expect(result.rows[0]?.invoiceItemId).toBe(invoiceItemId);
  });

  it('rejects meter usage invoice items without a rental contract item', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const fixture = await seedRentalInvoiceTraceFixture(client);

    await expect(
      client.query(
        `
          INSERT INTO "InvoiceItem" (
            "id",
            "organizationId",
            "invoiceId",
            "type",
            "description",
            "quantity",
            "unitPrice",
            "supplyAmount",
            "vatType",
            "vatAmount",
            "totalAmount",
            "updatedAt"
          )
          VALUES ($1, $2, $3, 'METER_USAGE', 'Meter usage charge', 1, 500, 500, 'NONE', 0, 500, $4)
        `,
        [randomUUID(), fixture.organizationId, fixture.invoiceId, fixture.now],
      ),
    ).rejects.toThrow(/InvoiceItem_source_type_check/);
  });

  it('rejects meter readings linked to non-meter invoice items', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const fixture = await seedRentalInvoiceTraceFixture(client);
    const invoiceItemId = await insertContractBackedRentalInvoiceItem(client, fixture);

    await expect(insertMeterReading(client, fixture, invoiceItemId)).rejects.toThrow(/METER_USAGE/);
  });

  it('rejects meter readings linked to meter usage invoice items for another contract item', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const fixture = await seedRentalInvoiceTraceFixture(client);
    const invoiceItemId = await insertMeterUsageInvoiceItem(client, fixture);
    const otherContractItemId = await insertAdditionalMeterContractItem(client, fixture);

    await expect(insertMeterReading(client, fixture, invoiceItemId, randomUUID(), otherContractItemId)).rejects.toThrow(
      /rental contract item must match InvoiceItem/,
    );
  });

  it('rejects invoice item parent updates that invalidate linked meter readings', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const fixture = await seedRentalInvoiceTraceFixture(client);
    const invoiceItemId = await insertMeterUsageInvoiceItem(client, fixture);
    await insertMeterReading(client, fixture, invoiceItemId);

    await expect(
      client.query(
        `
          UPDATE "InvoiceItem"
          SET "type" = 'RENTAL_FEE',
              "rentalOrderItemId" = $1,
              "updatedAt" = $2
          WHERE "id" = $3
            AND "organizationId" = $4
        `,
        [fixture.rentalOrderItemId, new Date(), invoiceItemId, fixture.organizationId],
      ),
    ).rejects.toThrow(/existing MeterReadings/);
  });

  it('rejects invoice item contract item updates that invalidate linked meter readings', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const fixture = await seedRentalInvoiceTraceFixture(client);
    const invoiceItemId = await insertMeterUsageInvoiceItem(client, fixture);
    const otherContractItemId = await insertAdditionalMeterContractItem(client, fixture);
    await insertMeterReading(client, fixture, invoiceItemId);

    await expect(
      client.query(
        `
          UPDATE "InvoiceItem"
          SET "rentalContractItemId" = $1,
              "updatedAt" = $2
          WHERE "id" = $3
            AND "organizationId" = $4
        `,
        [otherContractItemId, new Date(), invoiceItemId, fixture.organizationId],
      ),
    ).rejects.toThrow(/existing MeterReadings/);
  });
});
