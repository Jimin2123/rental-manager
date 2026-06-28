import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Client } from 'pg';

import { TokenService } from '../src/auth/session/token.service';
import type { IMailService } from '../src/mail/mail.interface';
import { InvitationService } from '../src/organization/invitation/invitation.service';
import { PrismaService } from '../src/prisma/prisma.service';

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
      [
        'Failed to apply Prisma migrations for invitation-consent DB test.',
        execError.message,
        execError.stdout,
        execError.stderr,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
};

describe('InvitationService DB integration', () => {
  let client: Client;
  let databaseUrl: string;
  let prisma: PrismaService;
  let tokenService: TokenService;
  let invitationService: InvitationService;

  // 공유 픽스처
  let organizationId: string;
  let adminMemberId: string;

  beforeAll(async () => {
    const dbName = `invitation_consent_test_${randomUUID().replace(/-/g, '')}`;

    const adminClient = new Client({ connectionString: DEFAULT_DATABASE_URL });
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
    await adminClient.end();

    databaseUrl = databaseUrlFor(DEFAULT_DATABASE_URL, dbName);
    runMigrations(databaseUrl);

    client = new Client({ connectionString: databaseUrl });
    await client.connect();

    // 서비스 수동 조립
    const configStub = {
      getOrThrow: (key: string) => {
        if (key === 'DATABASE_URL') return databaseUrl;
        if (key === 'JWT_SECRET') return 'test-secret';
        throw new Error(`Unknown config key in test stub: ${key}`);
      },
      get: (key: string, defaultValue?: unknown) => {
        if (key === 'CLIENT_URL' || key === 'APP_URL') return 'http://localhost:5173';
        if (key === 'JWT_EXPIRES_IN') return '1h';
        return defaultValue;
      },
    } as unknown as ConfigService;

    prisma = new PrismaService(configStub);
    await prisma.$connect();

    const jwtService = new JwtService({ secret: 'test-secret' });
    tokenService = new TokenService(jwtService, configStub);

    const mailStub: IMailService = {
      sendEmailVerification: async () => {},
      sendPasswordReset: async () => {},
      sendOrganizationInvite: async () => {},
    };

    invitationService = new InvitationService(prisma, tokenService, configStub, mailStub);

    // 공유 픽스처: Address → BusinessProfile → Organization → User → OrganizationMember(admin)
    const addressId = randomUUID();
    const businessProfileId = randomUUID();
    organizationId = randomUUID();
    const adminUserId = randomUUID();
    adminMemberId = randomUUID();
    const now = new Date();

    await client.query(
      `INSERT INTO "Address" ("id", "zonecode", "address", "updatedAt") VALUES ($1, '00000', 'Test Address', $2)`,
      [addressId, now],
    );
    await client.query(
      `INSERT INTO "BusinessProfile" ("id", "name", "businessRegistrationNo", "representativeName", "addressId", "updatedAt")
       VALUES ($1, 'Test Org', $2, 'Admin', $3, $4)`,
      [businessProfileId, `biz-${randomUUID()}`, addressId, now],
    );
    await client.query(`INSERT INTO "Organization" ("id", "businessProfileId", "updatedAt") VALUES ($1, $2, $3)`, [
      organizationId,
      businessProfileId,
      now,
    ]);
    await client.query(`INSERT INTO "User" ("id", "updatedAt") VALUES ($1, $2)`, [adminUserId, now]);
    await client.query(
      `INSERT INTO "OrganizationMember" ("id", "userId", "organizationId", "role", "name", "isActive", "updatedAt")
       VALUES ($1, $2, $3, 'OWNER', 'Admin', true, $4)`,
      [adminMemberId, adminUserId, organizationId, now],
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await client.end();

    const adminClient = new Client({ connectionString: DEFAULT_DATABASE_URL });
    await adminClient.connect();
    const dbName = new URL(databaseUrl).pathname.slice(1);
    await adminClient.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await adminClient.end();
  });

  // 테스트별 초대 시드 헬퍼
  const seedInvitation = async (
    options: {
      email?: string;
      rawToken?: string;
      expiresAt?: Date;
      declinedAt?: Date;
      acceptedAt?: Date;
      orgId?: string;
      memberId?: string;
    } = {},
  ): Promise<{ invId: string; rawToken: string; email: string }> => {
    const rawToken = options.rawToken ?? randomUUID();
    const token = tokenService.hashToken(rawToken);
    const email = options.email ?? `invite-${randomUUID()}@example.com`;
    const expiresAt = options.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invId = randomUUID();
    const orgId = options.orgId ?? organizationId;
    const memberId = options.memberId ?? adminMemberId;

    await client.query(
      `INSERT INTO "OrganizationInvitation" ("id", "token", "email", "role", "organizationId", "invitedById", "expiresAt")
       VALUES ($1, $2, $3, 'STAFF', $4, $5, $6)`,
      [invId, token, email, orgId, memberId, expiresAt],
    );

    if (options.declinedAt) {
      await client.query(`UPDATE "OrganizationInvitation" SET "declinedAt" = $1 WHERE "id" = $2`, [
        options.declinedAt,
        invId,
      ]);
    }
    if (options.acceptedAt) {
      await client.query(`UPDATE "OrganizationInvitation" SET "acceptedAt" = $1 WHERE "id" = $2`, [
        options.acceptedAt,
        invId,
      ]);
    }

    return { invId, rawToken, email };
  };

  // ①  signupAccept: 계정+멤버 생성, 조직 새로 안 만든다
  describe('signupAccept', () => {
    it('계정·멤버를 생성하고 기존 조직을 재사용한다 (새 조직 없음)', async () => {
      const { rawToken } = await seedInvitation({ email: 'signup@example.com' });

      const orgCountBefore = await prisma.organization.count();

      const result = await invitationService.signupAccept(rawToken, {
        email: 'signup@example.com',
        password: 'Password123!',
        memberName: '신규멤버',
      });

      expect(result.organizationId).toBe(organizationId);

      // User 존재 확인
      const user = await prisma.user.findUnique({ where: { id: result.userId } });
      expect(user).toBeTruthy();

      // Account 존재 + 이메일 확인
      const account = await prisma.account.findUnique({ where: { id: result.accountId } });
      expect(account).toBeTruthy();
      expect(account!.email).toBe('signup@example.com');

      // OrganizationMember 생성 확인
      const member = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: result.userId, organizationId } },
      });
      expect(member).toBeTruthy();
      expect(member!.isActive).toBe(true);

      // 조직은 새로 생성되지 않아야 한다
      const orgCountAfter = await prisma.organization.count();
      expect(orgCountAfter).toBe(orgCountBefore);
    });
  });

  // ②  accept by token: 초대 이메일과 다른 계정으로도 멤버 생성
  describe('accept (token path)', () => {
    it('초대 이메일과 다른 계정으로도 OrganizationMember가 생성된다', async () => {
      const { rawToken } = await seedInvitation({ email: 'invited@example.com' });

      // 초대 이메일과 다른 이메일을 가진 기존 사용자
      const acceptingUserId = randomUUID();
      const now = new Date();
      await client.query(`INSERT INTO "User" ("id", "updatedAt") VALUES ($1, $2)`, [acceptingUserId, now]);

      await invitationService.accept(rawToken, acceptingUserId);

      const member = await prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: acceptingUserId, organizationId } },
      });
      expect(member).toBeTruthy();
      expect(member!.isActive).toBe(true);
    });
  });

  // ③  declineByToken: declinedAt 설정
  describe('declineByToken', () => {
    it('초대에 declinedAt을 설정한다', async () => {
      const { rawToken, invId } = await seedInvitation({ email: 'decline@example.com' });

      await invitationService.declineByToken(rawToken);

      const { rows } = await client.query<{ declinedAt: Date | null }>(
        `SELECT "declinedAt" FROM "OrganizationInvitation" WHERE "id" = $1`,
        [invId],
      );
      expect(rows[0].declinedAt).toBeTruthy();
    });
  });

  // ④  listForAdmin: PENDING / DECLINED / EXPIRED 파생, 수락된 건 제외
  describe('listForAdmin', () => {
    it('PENDING·DECLINED·EXPIRED status를 파생하고 수락된 초대는 결과에서 제외한다', async () => {
      // 이 테스트 전용 조직(다른 테스트와 격리)
      const addrId = randomUUID();
      const bpId = randomUUID();
      const orgId = randomUUID();
      const adminUid = randomUUID();
      const adminMid = randomUUID();
      const now = new Date();

      await client.query(
        `INSERT INTO "Address" ("id", "zonecode", "address", "updatedAt") VALUES ($1, '00000', 'Addr2', $2)`,
        [addrId, now],
      );
      await client.query(
        `INSERT INTO "BusinessProfile" ("id", "name", "businessRegistrationNo", "representativeName", "addressId", "updatedAt")
         VALUES ($1, 'ListOrg', $2, 'Rep2', $3, $4)`,
        [bpId, `biz-${randomUUID()}`, addrId, now],
      );
      await client.query(`INSERT INTO "Organization" ("id", "businessProfileId", "updatedAt") VALUES ($1, $2, $3)`, [
        orgId,
        bpId,
        now,
      ]);
      await client.query(`INSERT INTO "User" ("id", "updatedAt") VALUES ($1, $2)`, [adminUid, now]);
      await client.query(
        `INSERT INTO "OrganizationMember" ("id", "userId", "organizationId", "role", "name", "isActive", "updatedAt")
         VALUES ($1, $2, $3, 'OWNER', 'Admin2', true, $4)`,
        [adminMid, adminUid, orgId, now],
      );

      // PENDING 초대 (expiresAt 미래, declinedAt 없음)
      await seedInvitation({
        email: 'pending@x.com',
        expiresAt: new Date(Date.now() + 86_400_000),
        orgId,
        memberId: adminMid,
      });

      // DECLINED 초대 (declinedAt 설정)
      await seedInvitation({
        email: 'declined@x.com',
        expiresAt: new Date(Date.now() + 86_400_000),
        declinedAt: new Date(),
        orgId,
        memberId: adminMid,
      });

      // EXPIRED 초대 (expiresAt 과거)
      await seedInvitation({
        email: 'expired@x.com',
        expiresAt: new Date(Date.now() - 86_400_000),
        orgId,
        memberId: adminMid,
      });

      // ACCEPTED 초대 (acceptedAt 설정 → listForAdmin 결과에서 제외)
      await seedInvitation({
        email: 'accepted@x.com',
        expiresAt: new Date(Date.now() + 86_400_000),
        acceptedAt: new Date(),
        orgId,
        memberId: adminMid,
      });

      const result = await invitationService.listForAdmin(orgId);

      // 수락된 건은 목록에 없어야 한다
      expect(result.find((r) => r.email === 'accepted@x.com')).toBeUndefined();

      // 나머지 3건 상태 파생 확인
      const byEmail = Object.fromEntries(result.map((r) => [r.email, r.status]));
      expect(byEmail['pending@x.com']).toBe('PENDING');
      expect(byEmail['declined@x.com']).toBe('DECLINED');
      expect(byEmail['expired@x.com']).toBe('EXPIRED');
    });
  });
});
