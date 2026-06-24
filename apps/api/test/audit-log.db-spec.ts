import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { Client } from 'pg';

const DEFAULT_DATABASE_URL = 'postgresql://rental_manager:rental_manager_password@127.0.0.1:5432/rental_manager';
const apiRoot = join(__dirname, '..');

const databaseUrlFor = (baseDatabaseUrl: string, databaseName: string): string => {
  const url = new URL(baseDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
};

const runMigrations = (databaseUrl: string): void => {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiRoot,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
};

describe('AuditLog DB integration', () => {
  let client: Client;
  let databaseUrl: string;
  let organizationId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const dbName = `audit_log_test_${randomUUID().replace(/-/g, '')}`;

    const admin = new Client({ connectionString: DEFAULT_DATABASE_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    databaseUrl = databaseUrlFor(DEFAULT_DATABASE_URL, dbName);
    runMigrations(databaseUrl);

    client = new Client({ connectionString: databaseUrl });
    await client.connect();

    // 최소 픽스처: Organization + Customer + Invoice
    const addressId = randomUUID();
    const businessProfileId = randomUUID();
    organizationId = randomUUID();
    const individualProfileId = randomUUID();
    const customerId = randomUUID();
    invoiceId = randomUUID();
    const now = new Date();

    await client.query(
      `INSERT INTO "Address" ("id","zonecode","address","updatedAt") VALUES ($1,'00000','test addr',$2)`,
      [addressId, now],
    );
    await client.query(
      `INSERT INTO "BusinessProfile" ("id","name","businessRegistrationNo","representativeName","addressId","updatedAt")
       VALUES ($1,'AuditTestOrg',$2,'Tester',$3,$4)`,
      [businessProfileId, `biz-${randomUUID()}`, addressId, now],
    );
    await client.query(`INSERT INTO "Organization" ("id","businessProfileId","updatedAt") VALUES ($1,$2,$3)`, [
      organizationId,
      businessProfileId,
      now,
    ]);
    await client.query(
      `INSERT INTO "IndividualProfile" ("id","name","updatedAt") VALUES ($1,'Test Customer',$2)`,
      [individualProfileId, now],
    );
    await client.query(
      `INSERT INTO "Customer" ("id","organizationId","type","individualProfileId","updatedAt") VALUES ($1,$2,'INDIVIDUAL',$3,$4)`,
      [customerId, organizationId, individualProfileId, now],
    );
    await client.query(
      `INSERT INTO "Invoice" ("id","organizationId","invoiceNo","type","status","customerId","updatedAt")
       VALUES ($1,$2,'INV-001','MANUAL','ISSUED',$3,$4)`,
      [invoiceId, organizationId, customerId, now],
    );
  });

  afterAll(async () => {
    await client.end();

    const admin = new Client({ connectionString: DEFAULT_DATABASE_URL });
    await admin.connect();
    const dbName = new URL(databaseUrl).pathname.slice(1);
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.end();
  });

  const insertAuditLog = (overrides: Record<string, unknown> = {}) => {
    const defaults = {
      id: randomUUID(),
      organizationId,
      actorId: null, // 시스템 행위자 (nullable)
      action: 'STATUS_CHANGE',
      targetType: 'Invoice',
      targetId: invoiceId,
      before: null,
      after: null,
      reason: null,
      createdAt: new Date(),
    };
    const row = { ...defaults, ...overrides };
    return client.query(
      `INSERT INTO "AuditLog" ("id","organizationId","actorId","action","targetType","targetId","before","after","reason","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        row.id, row.organizationId, row.actorId, row.action,
        row.targetType, row.targetId, row.before, row.after, row.reason, row.createdAt,
      ],
    );
  };

  describe('정상 삽입', () => {
    it('유효한 targetType/targetId로 감사 로그를 기록한다', async () => {
      const id = randomUUID();
      await insertAuditLog({ id });
      const { rows } = await client.query(`SELECT "id" FROM "AuditLog" WHERE "id" = $1`, [id]);
      expect(rows).toHaveLength(1);
    });

    it('actorId가 null이면 시스템 행위자로 삽입에 성공한다', async () => {
      const id = randomUUID();
      await insertAuditLog({ id, actorId: null });
      const { rows } = await client.query(`SELECT "actorId" FROM "AuditLog" WHERE "id" = $1`, [id]);
      expect(rows[0].actorId).toBeNull();
    });

    it('존재하지 않는 actorId는 FK 위반으로 실패한다', async () => {
      await expect(insertAuditLog({ actorId: randomUUID() })).rejects.toThrow();
    });

    it('before/after JSON 스냅샷을 저장하고 조회한다', async () => {
      const id = randomUUID();
      const before = { status: 'DRAFT', amount: 10000 };
      const after = { status: 'ISSUED', amount: 10000 };
      await insertAuditLog({ id, before: JSON.stringify(before), after: JSON.stringify(after) });
      const { rows } = await client.query(`SELECT "before","after" FROM "AuditLog" WHERE "id" = $1`, [id]);
      expect(rows[0].before).toMatchObject(before);
      expect(rows[0].after).toMatchObject(after);
    });
  });

  describe('트리거 — targetType 무결성', () => {
    it('허용되지 않은 targetType이면 예외를 던진다', async () => {
      await expect(insertAuditLog({ targetType: 'UnknownEntity' })).rejects.toThrow(
        /Unsupported AuditLog targetType UnknownEntity/,
      );
    });

    it('존재하지 않는 targetId이면 예외를 던진다', async () => {
      await expect(insertAuditLog({ targetId: randomUUID() })).rejects.toThrow(
        /AuditLog target Invoice\..* does not exist/,
      );
    });
  });

  describe('트랜잭션 원자성', () => {
    it('트랜잭션 롤백 시 감사 로그도 롤백된다', async () => {
      const id = randomUUID();
      await client.query('BEGIN');
      await insertAuditLog({ id });
      await client.query('ROLLBACK');

      const { rows } = await client.query(`SELECT "id" FROM "AuditLog" WHERE "id" = $1`, [id]);
      expect(rows).toHaveLength(0);
    });

    it('트랜잭션 커밋 시 감사 로그가 영속된다', async () => {
      const id = randomUUID();
      await client.query('BEGIN');
      await insertAuditLog({ id });
      await client.query('COMMIT');

      const { rows } = await client.query(`SELECT "id" FROM "AuditLog" WHERE "id" = $1`, [id]);
      expect(rows).toHaveLength(1);
    });
  });

  describe('조직 격리', () => {
    it('존재하지 않는 organizationId로는 삽입 불가 (FK 위반)', async () => {
      await expect(insertAuditLog({ organizationId: randomUUID() })).rejects.toThrow();
    });
  });
});
