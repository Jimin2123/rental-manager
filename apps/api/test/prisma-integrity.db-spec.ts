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

  it('rejects invoice items that reference a tax invoice for another invoice', async () => {
    if (!client) {
      throw new Error('DB integration client was not initialized.');
    }

    const { organizationId, customerId } = await seedOrganizationAndCustomer(client);
    const invoiceId = randomUUID();
    const otherInvoiceId = randomUUID();
    const invoiceItemId = randomUUID();
    const taxInvoiceId = randomUUID();
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
          "finalAmount",
          "updatedAt"
        )
        VALUES
          ($1, $2, $3, 'MANUAL', 'DRAFT', $4, 0, $5),
          ($6, $2, $7, 'MANUAL', 'DRAFT', $4, 0, $5)
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
        INSERT INTO "TaxInvoice" (
          "id",
          "organizationId",
          "taxInvoiceNo",
          "type",
          "status",
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
        VALUES ($1, $2, $3, 'TAX_INVOICE', 'DRAFT', $4, $5, '123-45-67890', 'DB Integration Buyer', 1000, 0, 1000, $6, $6)
      `,
      [taxInvoiceId, organizationId, `TAX-${randomUUID()}`, otherInvoiceId, customerId, now],
    );

    await expect(
      client.query(
        `
          UPDATE "InvoiceItem"
          SET "taxInvoiceId" = $1,
              "updatedAt" = $2
          WHERE "id" = $3
        `,
        [taxInvoiceId, new Date(), invoiceItemId],
      ),
    ).rejects.toThrow(/does not match TaxInvoice/);
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
});
