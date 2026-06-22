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

describe('SocialAuthService', () => {
  let service: SocialAuthService;
  let prisma: {
    accountIdentity: { findUnique: jest.Mock; create: jest.Mock };
    account: { findUnique: jest.Mock; create: jest.Mock };
    user: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let tokenService: { generateAccessToken: jest.Mock; generateRawRefreshToken: jest.Mock };
  let sessionService: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      accountIdentity: { findUnique: jest.fn(), create: jest.fn() },
      account: { findUnique: jest.fn(), create: jest.fn() },
      user: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    };
    tokenService = {
      generateAccessToken: jest.fn().mockReturnValue('access-jwt'),
      generateRawRefreshToken: jest.fn().mockReturnValue('raw-rt'),
    };
    sessionService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokenService },
        { provide: SessionService, useValue: sessionService },
        { provide: GoogleProvider, useValue: { verify: jest.fn().mockResolvedValue(makeSocialInfo()) } },
        { provide: KakaoProvider, useValue: { verify: jest.fn() } },
        { provide: NaverProvider, useValue: { verify: jest.fn() } },
      ],
    }).compile();
    service = module.get(SocialAuthService);
  });

  describe('loginOrRegister', () => {
    it('throws UnauthorizedException when provider returns no email and no existing identity', async () => {
      const noEmailInfo = { ...makeSocialInfo(), providerEmail: null };
      const module2 = await Test.createTestingModule({
        providers: [
          SocialAuthService,
          { provide: PrismaService, useValue: prisma },
          { provide: TokenService, useValue: tokenService },
          { provide: SessionService, useValue: sessionService },
          { provide: GoogleProvider, useValue: { verify: jest.fn().mockResolvedValue(noEmailInfo) } },
          { provide: KakaoProvider, useValue: { verify: jest.fn() } },
          { provide: NaverProvider, useValue: { verify: jest.fn() } },
        ],
      }).compile();
      const svc2 = module2.get(SocialAuthService);
      prisma.accountIdentity.findUnique.mockResolvedValue(null);
      await expect(svc2.loginOrRegister('google', 'token', {})).rejects.toThrow(UnauthorizedException);
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
      prisma.account.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-1' });
      prisma.account.create.mockResolvedValue({ id: 'acc-1', userId: 'user-1', email: 'a@gmail.com' });
      prisma.accountIdentity.create.mockResolvedValue({});

      const result = await service.loginOrRegister('google', 'token', {});
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.accessToken).toBe('access-jwt');
    });
  });

  describe('linkAccount', () => {
    it('throws ConflictException when identity already linked to another account', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue({ accountId: 'other-acc', providerId: 'google-uid-1' });
      await expect(service.linkAccount('my-acc', 'google', 'token')).rejects.toThrow(ConflictException);
    });

    it('returns without error when identity already linked to same account', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue({ accountId: 'my-acc', providerId: 'google-uid-1' });
      await expect(service.linkAccount('my-acc', 'google', 'token')).resolves.toBeUndefined();
      expect(prisma.accountIdentity.create).not.toHaveBeenCalled();
    });

    it('creates new identity when not yet linked', async () => {
      prisma.accountIdentity.findUnique.mockResolvedValue(null);
      prisma.accountIdentity.create.mockResolvedValue({});
      await expect(service.linkAccount('my-acc', 'google', 'token')).resolves.toBeUndefined();
      expect(prisma.accountIdentity.create).toHaveBeenCalled();
    });
  });
});
