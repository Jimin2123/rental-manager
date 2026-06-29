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
  try {
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: apiRoot,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
  } catch (error) {
    const execError = error as { message?: string; stdout?: string; stderr?: string };
    throw new Error(
      ['Failed to apply Prisma migrations for DB integration test.', execError.message, execError.stdout, execError.stderr]
        .filter(Boolean)
        .join('\n'),
    );
  }
};

describe('DepositAccount DB integration', () => {
  let client: Client;
  let databaseUrl: string;
  let organizationId: string;

  beforeAll(async () => {
    const dbName = `deposit_account_test_${randomUUID().replace(/-/g, '')}`;

    const admin = new Client({ connectionString: DEFAULT_DATABASE_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    databaseUrl = databaseUrlFor(DEFAULT_DATABASE_URL, dbName);
    runMigrations(databaseUrl);

    client = new Client({ connectionString: databaseUrl });
    await client.connect();

    // 최소 픽스처: Organization (audit-log.db-spec 패턴 그대로)
    const addressId = randomUUID();
    const businessProfileId = randomUUID();
    organizationId = randomUUID();
    const now = new Date();

    await client.query(
      `INSERT INTO "Address" ("id","zonecode","address","updatedAt") VALUES ($1,'00000','test addr',$2)`,
      [addressId, now],
    );
    await client.query(
      `INSERT INTO "BusinessProfile" ("id","name","businessRegistrationNo","representativeName","addressId","updatedAt")
       VALUES ($1,'DepositTestOrg',$2,'Tester',$3,$4)`,
      [businessProfileId, `biz-${randomUUID()}`, addressId, now],
    );
    await client.query(`INSERT INTO "Organization" ("id","businessProfileId","updatedAt") VALUES ($1,$2,$3)`, [
      organizationId,
      businessProfileId,
      now,
    ]);
  });

  afterAll(async () => {
    await client.end();

    const admin = new Client({ connectionString: DEFAULT_DATABASE_URL });
    await admin.connect();
    const dbName = new URL(databaseUrl).pathname.slice(1);
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.end();
  });

  const insertDepositAccount = (overrides: Record<string, unknown> = {}) => {
    const defaults = {
      id: randomUUID(),
      organizationId,
      bankName: '국민',
      accountNumber: `acct-${randomUUID()}`,
      accountHolder: '테스터',
      isDefault: false,
      updatedAt: new Date(),
    };
    const row = { ...defaults, ...overrides };
    return client.query(
      `INSERT INTO "DepositAccount" ("id","organizationId","bankName","accountNumber","accountHolder","isDefault","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id, row.organizationId, row.bankName, row.accountNumber, row.accountHolder, row.isDefault, row.updatedAt],
    );
  };

  beforeEach(async () => {
    await client.query('DELETE FROM "DepositAccount" WHERE "organizationId" = $1', [organizationId]);
  });

  describe('부분 유니크 — 기본계좌', () => {
    it('기본계좌는 조직당 1개만 허용한다 (두 번째 isDefault=true 삽입을 거부한다)', async () => {
      await insertDepositAccount({ isDefault: true });

      await expect(
        insertDepositAccount({ isDefault: true }),
      ).rejects.toThrow();
    });

    it('소프트 삭제된 기본계좌가 있으면 새 기본계좌 등록을 허용한다', async () => {
      const id = randomUUID();
      const now = new Date();

      await client.query(
        `INSERT INTO "DepositAccount" ("id","organizationId","bankName","accountNumber","accountHolder","isDefault","deletedAt","updatedAt")
         VALUES ($1,$2,'부산','del-default-${randomUUID()}','삭제자',true,$3,$3)`,
        [id, organizationId, now],
      );

      // deletedAt이 있으므로 부분 유니크 인덱스 조건에서 제외 → 새 기본계좌 허용
      await expect(
        insertDepositAccount({ isDefault: true }),
      ).resolves.toBeDefined();
    });
  });

  describe('부분 유니크 — (organizationId, bankName, accountNumber)', () => {
    it('동일 (은행명, 계좌번호) 중복을 막는다', async () => {
      const bankName = '우리';
      const accountNumber = `dup-${randomUUID()}`;

      await insertDepositAccount({ bankName, accountNumber });

      await expect(
        insertDepositAccount({ bankName, accountNumber, accountHolder: '다른사람' }),
      ).rejects.toThrow();
    });

    it('소프트 삭제 후 동일 계좌번호 재등록을 허용한다', async () => {
      const bankName = '하나';
      const accountNumber = `reuse-${randomUUID()}`;
      const id = randomUUID();
      const now = new Date();

      // 1차 삽입
      await client.query(
        `INSERT INTO "DepositAccount" ("id","organizationId","bankName","accountNumber","accountHolder","updatedAt")
         VALUES ($1,$2,$3,$4,'김',$5)`,
        [id, organizationId, bankName, accountNumber, now],
      );

      // 소프트 삭제
      await client.query(
        `UPDATE "DepositAccount" SET "deletedAt"=$1, "updatedAt"=$1 WHERE "id"=$2`,
        [new Date(), id],
      );

      // deletedAt이 있으므로 부분 유니크 인덱스 조건에서 제외 → 동일 (bankName, accountNumber) 재삽입 허용
      await expect(
        insertDepositAccount({ bankName, accountNumber }),
      ).resolves.toBeDefined();
    });
  });
});
