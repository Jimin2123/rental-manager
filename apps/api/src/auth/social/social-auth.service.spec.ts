import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { TokenService } from '../session/token.service';
import { GoogleProvider } from './providers/google.provider';
import { KakaoProvider } from './providers/kakao.provider';
import { NaverProvider } from './providers/naver.provider';
import { SocialAuthService } from './social-auth.service';

const makeSocialInfo = () => ({
  providerId: 'google-uid-1',
  providerEmail: 'a@gmail.com',
  providerData: { name: 'Alice' },
});

type MockPrisma = {
  accountIdentity: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  account: {
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  user: { create: jest.Mock; update: jest.Mock };
  organizationMember: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  refreshToken: { updateMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('SocialAuthService', () => {
  let service: SocialAuthService;
  let prisma: MockPrisma;
  let tokenService: {
    generateAccessToken: jest.Mock;
    generateRawRefreshToken: jest.Mock;
    generateMergeToken: jest.Mock;
    verifyMergeToken: jest.Mock;
  };
  let sessionService: { create: jest.Mock };

  const buildPrisma = (): MockPrisma => ({
    accountIdentity: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: { create: jest.fn(), update: jest.fn() },
    organizationMember: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    $transaction: jest.fn().mockImplementation((fn: (tx: MockPrisma) => Promise<unknown>) => fn(prisma)),
  });

  const buildTokenService = () => ({
    generateAccessToken: jest.fn().mockReturnValue('access-jwt'),
    generateRawRefreshToken: jest.fn().mockReturnValue('raw-rt'),
    generateMergeToken: jest.fn().mockReturnValue('merge-token'),
    verifyMergeToken: jest.fn(),
  });

  const buildProviders = (overrides: Record<string, Partial<{ verify: jest.Mock; exchangeCode: jest.Mock }>> = {}) => ({
    google: {
      verify: jest.fn().mockResolvedValue(makeSocialInfo()),
      exchangeCode: jest.fn().mockResolvedValue(makeSocialInfo()),
      ...(overrides['google'] ?? {}),
    },
    kakao: { verify: jest.fn(), exchangeCode: jest.fn(), ...(overrides['kakao'] ?? {}) },
    naver: { verify: jest.fn(), exchangeCode: jest.fn(), ...(overrides['naver'] ?? {}) },
  });

  async function buildModule(providerOverrides?: Parameters<typeof buildProviders>[0]) {
    const providers = buildProviders(providerOverrides);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokenService },
        { provide: SessionService, useValue: sessionService },
        { provide: GoogleProvider, useValue: providers.google },
        { provide: KakaoProvider, useValue: providers.kakao },
        { provide: NaverProvider, useValue: providers.naver },
      ],
    }).compile();
    return module.get(SocialAuthService);
  }

  beforeEach(async () => {
    prisma = buildPrisma();
    tokenService = buildTokenService();
    sessionService = { create: jest.fn() };
    service = await buildModule();
  });

  // ── getLinkedProviders ──────────────────────────────────────────────────────

  describe('getLinkedProviders', () => {
    it('returns identities for the given account', async () => {
      prisma.accountIdentity.findMany.mockResolvedValue([{ provider: 'GOOGLE', providerEmail: 'a@gmail.com' }]);
      const result = await service.getLinkedProviders('acc-1');
      expect(result).toEqual([{ provider: 'GOOGLE', providerEmail: 'a@gmail.com' }]);
    });

    it('returns empty array when account has no linked identities', async () => {
      prisma.accountIdentity.findMany.mockResolvedValue([]);
      const result = await service.getLinkedProviders('acc-1');
      expect(result).toEqual([]);
    });
  });

  // ── linkAccountWithCode ────────────────────────────────────────────────────

  describe('linkAccountWithCode', () => {
    it('returns { status: linked } when no existing identity', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue(null);
      prisma.accountIdentity.create.mockResolvedValue({});
      const result = await service.linkAccountWithCode('acc-1', 'google', 'code', 'http://redirect');
      expect(result).toEqual({ status: 'linked' });
      expect(prisma.accountIdentity.create).toHaveBeenCalled();
    });

    it('returns { status: already_linked } when identity belongs to same account', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue({ accountId: 'acc-1', providerId: 'google-uid-1' });
      const result = await service.linkAccountWithCode('acc-1', 'google', 'code', 'http://redirect');
      expect(result).toEqual({ status: 'already_linked' });
      expect(prisma.accountIdentity.create).not.toHaveBeenCalled();
    });

    it('returns { status: conflict, sourceAccountId } when identity belongs to another account', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue({ accountId: 'acc-other', providerId: 'google-uid-1' });
      const result = await service.linkAccountWithCode('acc-1', 'google', 'code', 'http://redirect');
      expect(result).toEqual({ status: 'conflict', sourceAccountId: 'acc-other' });
    });
  });

  // ── generateMergeToken / verifyMergeToken ──────────────────────────────────

  describe('generateMergeToken', () => {
    it('delegates to tokenService and returns the token', () => {
      const token = service.generateMergeToken('src', 'tgt', 'google');
      expect(tokenService.generateMergeToken).toHaveBeenCalledWith({
        type: 'account_merge',
        sourceAccountId: 'src',
        targetAccountId: 'tgt',
        provider: 'google',
      });
      expect(token).toBe('merge-token');
    });
  });

  describe('verifyMergeToken', () => {
    it('delegates to tokenService and returns payload', () => {
      const payload = { type: 'account_merge', sourceAccountId: 'src', targetAccountId: 'tgt', provider: 'google' };
      tokenService.verifyMergeToken.mockReturnValue(payload);
      expect(service.verifyMergeToken('some-token')).toEqual(payload);
    });
  });

  // ── mergeAccounts ──────────────────────────────────────────────────────────

  describe('mergeAccounts', () => {
    const SOURCE = { id: 'src-acc', userId: 'src-user', email: 'src@test.com' };
    const TARGET = { id: 'tgt-acc', userId: 'tgt-user', email: 'tgt@test.com' };

    beforeEach(() => {
      prisma.account.findUniqueOrThrow.mockResolvedValueOnce(SOURCE).mockResolvedValueOnce(TARGET);
    });

    it('transfers non-conflicting identity to target account', async () => {
      prisma.accountIdentity.findMany
        .mockResolvedValueOnce([{ id: 'id-1', provider: 'GOOGLE', accountId: SOURCE.id }]) // source identities
        .mockResolvedValueOnce([]); // target providers (empty → no conflict)
      prisma.organizationMember.findMany.mockResolvedValue([]);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.account.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      await service.mergeAccounts(SOURCE.id, TARGET.id);

      expect(prisma.accountIdentity.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { accountId: TARGET.id } }),
      );
    });

    it('skips identity transfer when target already has same provider', async () => {
      prisma.accountIdentity.findMany
        .mockResolvedValueOnce([{ id: 'id-1', provider: 'GOOGLE', accountId: SOURCE.id }]) // source
        .mockResolvedValueOnce([{ provider: 'GOOGLE' }]); // target already has GOOGLE
      prisma.organizationMember.findMany.mockResolvedValue([]);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.account.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      await service.mergeAccounts(SOURCE.id, TARGET.id);

      expect(prisma.accountIdentity.update).not.toHaveBeenCalled();
    });

    it('transfers org membership when target user is not in that org', async () => {
      prisma.accountIdentity.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.organizationMember.findMany.mockResolvedValue([{ id: 'mem-1', organizationId: 'org-1', userId: SOURCE.userId }]);
      prisma.organizationMember.findUnique.mockResolvedValue(null); // no conflict
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.account.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      await service.mergeAccounts(SOURCE.id, TARGET.id);

      expect(prisma.organizationMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { userId: TARGET.userId } }),
      );
    });

    it('skips org membership when target user is already in that org', async () => {
      prisma.accountIdentity.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.organizationMember.findMany.mockResolvedValue([{ id: 'mem-1', organizationId: 'org-1', userId: SOURCE.userId }]);
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'existing-mem' }); // conflict
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.account.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      await service.mergeAccounts(SOURCE.id, TARGET.id);

      expect(prisma.organizationMember.update).not.toHaveBeenCalled();
    });

    it('revokes source refresh tokens and soft-deletes source account and user', async () => {
      prisma.accountIdentity.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.organizationMember.findMany.mockResolvedValue([]);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.account.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      await service.mergeAccounts(SOURCE.id, TARGET.id);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { accountId: SOURCE.id }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
      );
      expect(prisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SOURCE.id },
          data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SOURCE.userId } }),
      );
    });
  });

  // ── loginOrRegister ────────────────────────────────────────────────────────

  describe('loginOrRegister', () => {
    it('throws UnauthorizedException when provider returns no email and no existing identity', async () => {
      const noEmailInfo = { ...makeSocialInfo(), providerEmail: null };
      const svc = await buildModule({ google: { verify: jest.fn().mockResolvedValue(noEmailInfo) } });
      prisma.accountIdentity.findUnique.mockResolvedValue(null);
      await expect(svc.loginOrRegister('google', 'token', {})).rejects.toThrow(UnauthorizedException);
    });

    it('issues tokens when an existing identity is found', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue({
        accountId: 'acc-1',
        account: { id: 'acc-1', userId: 'user-1', email: 'a@gmail.com', isActive: true },
      });
      const result = await service.loginOrRegister('google', 'token', {});
      expect(result.accessToken).toBe('access-jwt');
      expect(sessionService.create).toHaveBeenCalled();
    });

    it('creates user, account, identity and issues tokens on first social login', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue(null);
      prisma.account.findUnique.mockResolvedValue(null); // 이메일 미사용
      prisma.user.create.mockResolvedValue({ id: 'user-1' });
      prisma.account.create.mockResolvedValue({ id: 'acc-1', userId: 'user-1', email: 'a@gmail.com' });
      prisma.accountIdentity.create.mockResolvedValue({});
      const result = await service.loginOrRegister('google', 'token', {});
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-jwt');
      // 이메일이 없을 때 null로 계정 생성
      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'a@gmail.com' }) }),
      );
    });

    it('creates a separate account with null email when providerEmail is already taken', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue(null);
      // 같은 이메일이 이미 다른 계정에 있음
      prisma.account.findUnique.mockResolvedValue({ id: 'other-acc', userId: 'other-user', email: 'a@gmail.com' });
      prisma.user.create.mockResolvedValue({ id: 'user-2' });
      prisma.account.create.mockResolvedValue({ id: 'acc-2', userId: 'user-2', email: null });
      prisma.accountIdentity.create.mockResolvedValue({});
      const result = await service.loginOrRegister('google', 'token', {});
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-jwt');
      // email null로 새 계정 생성
      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: null }) }),
      );
    });

    it('includes userId in return value', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue({
        accountId: 'acc-1',
        account: { id: 'acc-1', userId: 'user-1', email: 'a@gmail.com', isActive: true },
      });
      const result = await service.loginOrRegister('google', 'token', {});
      expect(result.userId).toBe('user-1');
    });
  });

  // ── linkAccount (access-token based) ──────────────────────────────────────

  describe('linkAccount', () => {
    it('throws ConflictException when identity already linked to another account', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue({ accountId: 'other-acc', providerId: 'google-uid-1' });
      await expect(service.linkAccount('my-acc', 'google', 'token')).rejects.toThrow(ConflictException);
    });

    it('creates new identity when not yet linked', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue(null);
      prisma.accountIdentity.create.mockResolvedValue({});
      await expect(service.linkAccount('my-acc', 'google', 'token')).resolves.toBeUndefined();
      expect(prisma.accountIdentity.create).toHaveBeenCalled();
    });
  });

  // ── loginOrRegisterWithCode ────────────────────────────────────────────────

  describe('loginOrRegisterWithCode', () => {
    it('exchanges code and returns tokens with userId for new user', async () => {
      const exchangeMock = jest.fn().mockResolvedValue(makeSocialInfo());
      const svc = await buildModule({ google: { verify: jest.fn(), exchangeCode: exchangeMock } });

      prisma.accountIdentity.findUnique.mockResolvedValue(null);
      prisma.account.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1' });
      prisma.account.create.mockResolvedValue({ id: 'acc-1', userId: 'user-1', email: 'a@gmail.com' });
      prisma.accountIdentity.create.mockResolvedValue({});

      const result = await svc.loginOrRegisterWithCode(
        'google',
        'code-abc',
        'http://localhost:5173/auth/social/google/callback',
        {},
        'test-state',
      );
      expect(exchangeMock).toHaveBeenCalledWith(
        'code-abc',
        'http://localhost:5173/auth/social/google/callback',
        'test-state',
      );
      expect(result.accessToken).toBe('access-jwt');
      expect(result.userId).toBe('user-1');
    });

    it('creates separate account with null email when providerEmail is already taken', async () => {
      const exchangeMock = jest.fn().mockResolvedValue(makeSocialInfo());
      const svc = await buildModule({ google: { verify: jest.fn(), exchangeCode: exchangeMock } });

      prisma.accountIdentity.findUnique.mockResolvedValue(null);
      prisma.account.findUnique.mockResolvedValue({ id: 'other-acc', userId: 'other-user', email: 'a@gmail.com' });
      prisma.user.create.mockResolvedValue({ id: 'user-2' });
      prisma.account.create.mockResolvedValue({ id: 'acc-2', userId: 'user-2', email: null });
      prisma.accountIdentity.create.mockResolvedValue({});

      const result = await svc.loginOrRegisterWithCode(
        'google',
        'code-abc',
        'http://localhost:5173/auth/social/google/callback',
        {},
        'test-state',
      );
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-jwt');
      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: null }) }),
      );
    });
  });

  // ── getOrganizations ───────────────────────────────────────────────────────

  describe('getOrganizations', () => {
    it('returns mapped organization list for user', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([
        {
          role: 'OWNER',
          organization: {
            id: 'org-1',
            businessProfile: { name: '테스트회사', businessRegistrationNo: '1234567890' },
          },
        },
      ]);
      const result = await service.getOrganizations('user-1');
      expect(result).toEqual([{ id: 'org-1', name: '테스트회사', businessRegistrationNo: '1234567890', role: 'OWNER' }]);
    });
  });
});
