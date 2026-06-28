/**
 * Social Auth E2E Tests
 *
 * 실제 DB와 NestJS 앱을 사용하되, 외부 OAuth 제공자(Google/Kakao/Naver)는 모킹합니다.
 * 테스트 계정은 "@social-e2e.test" 도메인을 사용하며 afterAll에서 정리합니다.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { TokenService } from '../src/auth/session/token.service';
import { GoogleProvider } from '../src/auth/social/providers/google.provider';
import { KakaoProvider } from '../src/auth/social/providers/kakao.provider';
import { NaverProvider } from '../src/auth/social/providers/naver.provider';
import { PrismaService } from '../src/prisma/prisma.service';

// ── 테스트 헬퍼 ────────────────────────────────────────────────────────────────

const TEST_DOMAIN = '@social-e2e.test';

const mockExchangeCode = jest.fn();
const mockProviderValue = { getAuthorizationUrl: jest.fn(), exchangeCode: mockExchangeCode, verify: jest.fn() };

async function createTestUser(prisma: PrismaService, emailPrefix: string) {
  const email = `${emailPrefix}${TEST_DOMAIN}`;
  const user = await prisma.user.create({ data: {} });
  const account = await prisma.account.create({
    data: { userId: user.id, email, emailVerifiedAt: new Date() },
  });
  return { user, account };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('Social Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenService: TokenService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleProvider)
      .useValue(mockProviderValue)
      .overrideProvider(KakaoProvider)
      .useValue(mockProviderValue)
      .overrideProvider(NaverProvider)
      .useValue(mockProviderValue)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.use(cookieParser());
    await app.init();

    prisma = module.get(PrismaService);
    tokenService = module.get(TokenService);
  });

  afterAll(async () => {
    // 테스트 계정 정리 (FK 순서: identity → refreshToken → account → user)
    const accounts = await prisma.account.findMany({ where: { email: { endsWith: TEST_DOMAIN } } });
    const accountIds = accounts.map((a) => a.id);
    const userIds = accounts.map((a) => a.userId);

    await prisma.accountIdentity.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.refreshToken.deleteMany({ where: { accountId: { in: accountIds } } });
    await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── GET /auth/social/identities ────────────────────────────────────────────

  describe('GET /auth/social/identities', () => {
    it('returns 401 without auth cookie', async () => {
      await request(app.getHttpServer()).get('/auth/social/identities').expect(401);
    });

    it('returns empty array for a new account with no linked providers', async () => {
      const { account } = await createTestUser(prisma, 'identities-empty');
      const jwt = tokenService.generateAccessToken({ sub: account.id, userId: account.userId, email: account.email });

      const res = await request(app.getHttpServer())
        .get('/auth/social/identities')
        .set('Cookie', [`access_token=${jwt}`])
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns linked identities for an account', async () => {
      const { account } = await createTestUser(prisma, 'identities-linked');
      await prisma.accountIdentity.create({
        data: {
          accountId: account.id,
          provider: 'GOOGLE',
          providerId: 'gid-linked',
          providerEmail: `linked${TEST_DOMAIN}`,
        },
      });
      const jwt = tokenService.generateAccessToken({ sub: account.id, userId: account.userId, email: account.email });

      const res = await request(app.getHttpServer())
        .get('/auth/social/identities')
        .set('Cookie', [`access_token=${jwt}`])
        .expect(200);

      expect(res.body).toEqual([expect.objectContaining({ provider: 'GOOGLE' })]);
    });
  });

  // ── POST /auth/social/merge ────────────────────────────────────────────────

  describe('POST /auth/social/merge', () => {
    it('returns 401 without auth cookie', async () => {
      await request(app.getHttpServer()).post('/auth/social/merge').send({ token: 'x' }).expect(401);
    });

    it('returns 400 when token field is missing', async () => {
      const { account } = await createTestUser(prisma, 'merge-no-token');
      const jwt = tokenService.generateAccessToken({ sub: account.id, userId: account.userId, email: account.email });

      await request(app.getHttpServer())
        .post('/auth/social/merge')
        .set('Cookie', [`access_token=${jwt}`])
        .send({})
        .expect(400);
    });

    it('returns 401 when merge token is invalid/expired', async () => {
      const { account } = await createTestUser(prisma, 'merge-bad-token');
      const jwt = tokenService.generateAccessToken({ sub: account.id, userId: account.userId, email: account.email });

      await request(app.getHttpServer())
        .post('/auth/social/merge')
        .set('Cookie', [`access_token=${jwt}`])
        .send({ token: 'invalid.token.here' })
        .expect(401);
    });

    it('returns 401 when merge token targets a different account', async () => {
      const { account: target } = await createTestUser(prisma, 'merge-wrong-target');
      const { account: other } = await createTestUser(prisma, 'merge-wrong-other');
      const jwt = tokenService.generateAccessToken({ sub: target.id, userId: target.userId, email: target.email });

      // merge token targets 'other', but current user is 'target'
      const mergeToken = tokenService.generateMergeToken({
        type: 'account_merge',
        sourceAccountId: 'src-x',
        targetAccountId: other.id,
        provider: 'google',
      });

      await request(app.getHttpServer())
        .post('/auth/social/merge')
        .set('Cookie', [`access_token=${jwt}`])
        .send({ token: mergeToken })
        .expect(401);
    });

    it('merges source account into target: transfers identity, soft-deletes source', async () => {
      const { account: source, user: sourceUser } = await createTestUser(prisma, 'merge-src');
      const { account: target } = await createTestUser(prisma, 'merge-tgt');

      await prisma.accountIdentity.create({
        data: {
          accountId: source.id,
          provider: 'GOOGLE',
          providerId: 'gid-to-merge',
          providerEmail: `src${TEST_DOMAIN}`,
        },
      });

      const jwt = tokenService.generateAccessToken({ sub: target.id, userId: target.userId, email: target.email });
      const mergeToken = tokenService.generateMergeToken({
        type: 'account_merge',
        sourceAccountId: source.id,
        targetAccountId: target.id,
        provider: 'google',
      });

      await request(app.getHttpServer())
        .post('/auth/social/merge')
        .set('Cookie', [`access_token=${jwt}`])
        .send({ token: mergeToken })
        .expect(200)
        .expect((res) => expect((res.body as { message?: unknown }).message).toBeDefined());

      // identity가 target으로 이동됐는지 확인
      const identity = await prisma.accountIdentity.findFirst({ where: { providerId: 'gid-to-merge' } });
      expect(identity?.accountId).toBe(target.id);

      // source 계정이 비활성화됐는지 확인
      const srcAccount = await prisma.account.findUnique({ where: { id: source.id } });
      expect(srcAccount?.isActive).toBe(false);
      expect(srcAccount?.deletedAt).not.toBeNull();

      // source 유저가 soft-delete됐는지 확인
      const srcUser = await prisma.user.findUnique({ where: { id: sourceUser.id } });
      expect(srcUser?.deletedAt).not.toBeNull();
    });
  });

  // ── GET /auth/social/:provider/callback (link flow) ───────────────────────

  describe('GET /auth/social/:provider/callback (link flow)', () => {
    it('redirects to ?merge_token= when social identity belongs to another account', async () => {
      const { account: source } = await createTestUser(prisma, 'cb-conflict-src');
      const { account: target } = await createTestUser(prisma, 'cb-conflict-tgt');

      // source 계정에 Google identity 등록
      await prisma.accountIdentity.create({
        data: {
          accountId: source.id,
          provider: 'GOOGLE',
          providerId: 'gid-conflict',
          providerEmail: `conflict-src${TEST_DOMAIN}`,
        },
      });

      // Google OAuth가 같은 providerId를 반환하도록 모킹
      mockExchangeCode.mockResolvedValue({
        providerId: 'gid-conflict',
        providerEmail: `conflict-src${TEST_DOMAIN}`,
        providerData: {},
      });

      const state = 'test-csrf-state';
      const res = await request(app.getHttpServer())
        .get('/auth/social/google/callback')
        .query({ code: 'auth-code', state })
        .set('Cookie', [`oauth_state=${state}`, `oauth_link_account=${target.id}`])
        .expect(302);

      expect(res.headers.location).toMatch(/\/settings\/account\?merge_token=/);
    });

    it('redirects to ?success=linked when social identity is new', async () => {
      const { account: target } = await createTestUser(prisma, 'cb-success-tgt');

      mockExchangeCode.mockResolvedValue({
        providerId: 'gid-new-link',
        providerEmail: `new-link${TEST_DOMAIN}`,
        providerData: {},
      });

      const state = 'test-csrf-success';
      const res = await request(app.getHttpServer())
        .get('/auth/social/google/callback')
        .query({ code: 'auth-code', state })
        .set('Cookie', [`oauth_state=${state}`, `oauth_link_account=${target.id}`])
        .expect(302);

      expect(res.headers.location).toMatch(/\/settings\/account\?success=linked/);

      // identity가 실제로 생성됐는지 확인
      const identity = await prisma.accountIdentity.findFirst({ where: { providerId: 'gid-new-link' } });
      expect(identity?.accountId).toBe(target.id);
    });

    it('redirects to login?error=social when state mismatch (CSRF protection)', async () => {
      const { account: target } = await createTestUser(prisma, 'cb-csrf-tgt');

      const res = await request(app.getHttpServer())
        .get('/auth/social/google/callback')
        .query({ code: 'auth-code', state: 'wrong-state' })
        .set('Cookie', [`oauth_state=correct-state`, `oauth_link_account=${target.id}`])
        .expect(302);

      expect(res.headers.location).toMatch(/\/login\?error=social/);
    });
  });

  // ── GET /auth/social/:provider/callback (login flow) ─────────────────────

  describe('GET /auth/social/:provider/callback (login flow)', () => {
    it('redirects to / when logging in with a known social identity', async () => {
      const { account } = await createTestUser(prisma, 'cb-login-known');
      await prisma.accountIdentity.create({
        data: {
          accountId: account.id,
          provider: 'GOOGLE',
          providerId: 'gid-login-known',
          providerEmail: `cb-login-known${TEST_DOMAIN}`,
        },
      });

      mockExchangeCode.mockResolvedValue({
        providerId: 'gid-login-known',
        providerEmail: `cb-login-known${TEST_DOMAIN}`,
        providerData: {},
      });

      const state = 'test-login-known-state';
      const res = await request(app.getHttpServer())
        .get('/auth/social/google/callback')
        .query({ code: 'auth-code', state })
        .set('Cookie', [`oauth_state=${state}`])
        .expect(302);

      // 조직이 없으면 /setup으로 리다이렉트
      expect(res.headers.location).toMatch(/\/(setup)?$/);
    });

    it('creates a separate account when providerEmail is already taken (no auto-linking)', async () => {
      // Account A: email cb-autolink-existing@social-e2e.test (이미 이 이메일로 계정 있음)
      const { account: existingAccount } = await createTestUser(prisma, 'cb-autolink-existing');

      // 같은 이메일로 Kakao 로그인 시도 — 자동 연동 대신 새 계정 생성
      mockExchangeCode.mockResolvedValue({
        providerId: 'kakao-separate-uid',
        providerEmail: `cb-autolink-existing${TEST_DOMAIN}`,
        providerData: {},
      });

      const state = 'test-autolink-separate-state';
      const res = await request(app.getHttpServer())
        .get('/auth/social/kakao/callback')
        .query({ code: 'auth-code', state })
        .set('Cookie', [`oauth_state=${state}`])
        .expect(302);

      // 로그인 성공 (setup 또는 / 으로 리다이렉트)
      expect(res.headers.location).toMatch(/\/(setup)?$/);

      // KAKAO identity가 기존 계정(existingAccount)에 연동되지 않았는지 확인
      const identityOnExisting = await prisma.accountIdentity.findFirst({
        where: { accountId: existingAccount.id, provider: 'KAKAO' },
      });
      expect(identityOnExisting).toBeNull();

      // KAKAO identity가 새 별도 계정에 생성됐는지 확인
      const kakaoIdentity = await prisma.accountIdentity.findFirst({ where: { providerId: 'kakao-separate-uid' } });
      expect(kakaoIdentity).not.toBeNull();
      expect(kakaoIdentity?.accountId).not.toBe(existingAccount.id);

      // 새 계정은 email이 null (이메일 충돌로 별도 계정 생성)
      const newAccount = await prisma.account.findUnique({ where: { id: kakaoIdentity!.accountId } });
      expect(newAccount?.email).toBeNull();
    });
  });

  // ── DELETE /auth/social/link/:provider ────────────────────────────────────

  describe('DELETE /auth/social/link/:provider', () => {
    it('returns 401 without auth cookie', async () => {
      await request(app.getHttpServer()).delete('/auth/social/link/google').expect(401);
    });

    it('returns 404 when provider is not linked', async () => {
      const { account } = await createTestUser(prisma, 'unlink-not-linked');
      const jwt = tokenService.generateAccessToken({ sub: account.id, userId: account.userId, email: account.email });

      await request(app.getHttpServer())
        .delete('/auth/social/link/google')
        .set('Cookie', [`access_token=${jwt}`])
        .expect(404);
    });

    it('returns 409 when it is the only auth method (no password, one identity)', async () => {
      const { account } = await createTestUser(prisma, 'unlink-only-method');
      await prisma.accountIdentity.create({
        data: {
          accountId: account.id,
          provider: 'GOOGLE',
          providerId: 'gid-only',
          providerEmail: `unlink-only-method${TEST_DOMAIN}`,
        },
      });
      // account has no passwordHash (createTestUser sets it null)
      const jwt = tokenService.generateAccessToken({ sub: account.id, userId: account.userId, email: account.email });

      await request(app.getHttpServer())
        .delete('/auth/social/link/google')
        .set('Cookie', [`access_token=${jwt}`])
        .expect(409);
    });

    it('returns 200 and removes identity when account has multiple identities', async () => {
      const { account } = await createTestUser(prisma, 'unlink-multi');
      await prisma.accountIdentity.create({
        data: {
          accountId: account.id,
          provider: 'GOOGLE',
          providerId: 'gid-multi-g',
          providerEmail: `unlink-multi${TEST_DOMAIN}`,
        },
      });
      await prisma.accountIdentity.create({
        data: {
          accountId: account.id,
          provider: 'KAKAO',
          providerId: 'kid-multi-k',
          providerEmail: `unlink-multi-k${TEST_DOMAIN}`,
        },
      });
      const jwt = tokenService.generateAccessToken({ sub: account.id, userId: account.userId, email: account.email });

      await request(app.getHttpServer())
        .delete('/auth/social/link/google')
        .set('Cookie', [`access_token=${jwt}`])
        .expect(204);

      const remaining = await prisma.accountIdentity.findFirst({ where: { providerId: 'gid-multi-g' } });
      expect(remaining).toBeNull();
    });
  });
});
