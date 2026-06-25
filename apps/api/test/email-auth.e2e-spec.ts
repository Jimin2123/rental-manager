/**
 * Email Auth E2E Tests
 *
 * 실제 DB와 NestJS 앱을 사용합니다.
 * 테스트 계정은 "@email-e2e.test" 도메인을 사용하며 afterAll에서 정리합니다.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_DOMAIN = '@email-e2e.test';
const TEST_PASSWORD = 'Password1!';

async function createEmailAccount(prisma: PrismaService, emailPrefix: string, options: { social?: boolean } = {}) {
  const email = `${emailPrefix}${TEST_DOMAIN}`;
  const passwordHash = options.social ? null : await bcrypt.hash(TEST_PASSWORD, 4);
  const user = await prisma.user.create({ data: {} });
  const account = await prisma.account.create({
    data: { userId: user.id, email, passwordHash, emailVerifiedAt: new Date() },
  });
  return { user, account, email };
}

describe('Email Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.use(cookieParser());
    await app.init();

    prisma = module.get(PrismaService);
  });

  afterAll(async () => {
    const accounts = await prisma.account.findMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    const accountIds = accounts.map((a) => a.id);
    const userIds = accounts.map((a) => a.userId);

    await prisma.accountIdentity.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.refreshToken.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    await app.close();
  });

  // ── POST /auth/login — 유효성 검사 ────────────────────────────────────────

  describe('POST /auth/login — validation', () => {
    it('returns 400 when password is empty string', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'any@test.com', password: '' })
        .expect(400);
    });

    it('returns 400 when password field is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'any@test.com' })
        .expect(400);
    });

    it('returns 400 when email is invalid format', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: TEST_PASSWORD })
        .expect(400);
    });

    it('returns 400 when email field is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ password: TEST_PASSWORD })
        .expect(400);
    });
  });

  // ── POST /auth/login — 인증 실패 ──────────────────────────────────────────

  describe('POST /auth/login — auth failure', () => {
    it('returns 401 when account does not exist', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `nonexistent${TEST_DOMAIN}`, password: TEST_PASSWORD })
        .expect(401);
    });

    it('returns 401 when password is wrong', async () => {
      await createEmailAccount(prisma, 'wrong-pw');

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `wrong-pw${TEST_DOMAIN}`, password: 'WrongPassword1!' })
        .expect(401);
    });

    it('returns 401 when account is social-only (no passwordHash)', async () => {
      await createEmailAccount(prisma, 'social-only', { social: true });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `social-only${TEST_DOMAIN}`, password: TEST_PASSWORD })
        .expect(401);
    });
  });

  // ── POST /auth/login — 로그인 성공 ────────────────────────────────────────

  describe('POST /auth/login — success', () => {
    it('returns 200 and sets auth cookies on valid credentials', async () => {
      await createEmailAccount(prisma, 'login-success');

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `login-success${TEST_DOMAIN}`, password: TEST_PASSWORD })
        .expect(200);

      const cookies = res.headers['set-cookie'] as string[] | string;
      const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
      expect(cookieStr).toMatch(/access_token=/);
      expect(cookieStr).toMatch(/refresh_token=/);
    });

    it('returns organization list (empty array when no org)', async () => {
      await createEmailAccount(prisma, 'login-orgs');

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: `login-orgs${TEST_DOMAIN}`, password: TEST_PASSWORD })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
