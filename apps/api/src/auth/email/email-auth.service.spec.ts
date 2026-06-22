import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { TokenService } from '../session/token.service';
import { EmailAuthService } from './email-auth.service';

jest.mock('bcrypt');
const bcryptHash = bcrypt.hash as jest.Mock;
const bcryptCompare = bcrypt.compare as jest.Mock;

const makeAccount = (overrides = {}) => ({
  id: 'acc-1',
  userId: 'user-1',
  email: 'a@b.com',
  passwordHash: '$2b$12$hashed',
  isActive: true,
  emailVerifiedAt: null,
  lastLoginAt: null,
  ...overrides,
});

describe('EmailAuthService', () => {
  let service: EmailAuthService;
  let prisma: {
    account: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; findFirst: jest.Mock };
    user: { create: jest.Mock };
    passwordHistory: { create: jest.Mock };
    refreshToken: { findUnique: jest.Mock };
    organizationMember: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tokenService: { generateAccessToken: jest.Mock; generateRawRefreshToken: jest.Mock; hashToken: jest.Mock };
  let sessionService: { create: jest.Mock; findByHash: jest.Mock; rotate: jest.Mock; revokeAll: jest.Mock };

  beforeEach(async () => {
    prisma = {
      account: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      user: { create: jest.fn() },
      passwordHistory: { create: jest.fn() },
      refreshToken: { findUnique: jest.fn() },
      organizationMember: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    };
    tokenService = {
      generateAccessToken: jest.fn().mockReturnValue('access-jwt'),
      generateRawRefreshToken: jest.fn().mockReturnValue('new-raw-token'),
      hashToken: jest.fn((raw: string) => `hash:${raw}`),
    };
    sessionService = {
      create: jest.fn(),
      findByHash: jest.fn(),
      rotate: jest.fn(),
      revokeAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokenService },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();
    service = module.get(EmailAuthService);
  });

  describe('register', () => {
    it('throws ConflictException when email is already taken', async () => {
      prisma.account.findUnique.mockResolvedValue(makeAccount());
      await expect(service.register('a@b.com', 'password123')).rejects.toThrow(ConflictException);
    });

    it('creates user, account, and password history in a transaction', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      bcryptHash.mockResolvedValue('$hashed');
      prisma.user.create.mockResolvedValue({ id: 'user-1' });
      prisma.account.create.mockResolvedValue({ id: 'acc-1' });
      prisma.passwordHistory.create.mockResolvedValue({});

      await service.register('new@b.com', 'password123');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalledWith({ data: { type: 'PERSONAL' } });
      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'new@b.com', userId: 'user-1' }) }),
      );
      expect(prisma.passwordHistory.create).toHaveBeenCalled();
    });
  });

  describe('validateCredentials', () => {
    it('throws UnauthorizedException when account not found', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      await expect(service.validateCredentials('x@b.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when account has no passwordHash (social-only)', async () => {
      prisma.account.findUnique.mockResolvedValue(makeAccount({ passwordHash: null }));
      await expect(service.validateCredentials('a@b.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when account is inactive', async () => {
      prisma.account.findUnique.mockResolvedValue(makeAccount({ isActive: false }));
      await expect(service.validateCredentials('a@b.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      prisma.account.findUnique.mockResolvedValue(makeAccount());
      bcryptCompare.mockResolvedValue(false);
      await expect(service.validateCredentials('a@b.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('returns account and updates lastLoginAt on success', async () => {
      const account = makeAccount();
      prisma.account.findUnique.mockResolvedValue(account);
      bcryptCompare.mockResolvedValue(true);
      prisma.account.update.mockResolvedValue(account);

      const result = await service.validateCredentials('a@b.com', 'correct');
      expect(result.id).toBe('acc-1');
      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  describe('issueTokens', () => {
    it('returns access and refresh tokens and creates a session', async () => {
      const result = await service.issueTokens('acc-1', 'user-1', 'a@b.com', false, {});
      expect(result.accessToken).toBe('access-jwt');
      expect(result.refreshToken).toBe('new-raw-token');
      expect(sessionService.create).toHaveBeenCalledWith('acc-1', 'new-raw-token', expect.any(Date), {});
    });

    it('sets 90-day expiry when rememberMe is true', async () => {
      await service.issueTokens('acc-1', 'user-1', 'a@b.com', true, {});
      const expiresAt = (sessionService.create.mock.calls[0] as [string, string, Date, object])[2];
      const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(daysUntilExpiry).toBeGreaterThan(85);
    });
  });

  describe('refreshSession', () => {
    it('throws UnauthorizedException when token is not found', async () => {
      sessionService.findByHash.mockResolvedValue(null);
      await expect(service.refreshSession('raw-token', {})).rejects.toThrow(UnauthorizedException);
    });

    it('revokes all tokens and throws when a revoked token is reused (reuse detection)', async () => {
      sessionService.findByHash.mockResolvedValue({
        id: 'rt-1',
        accountId: 'acc-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 10_000),
      });

      await expect(service.refreshSession('raw-token', {})).rejects.toThrow(UnauthorizedException);
      expect(sessionService.revokeAll).toHaveBeenCalledWith('acc-1');
    });

    it('throws UnauthorizedException when token is expired', async () => {
      sessionService.findByHash.mockResolvedValue({
        id: 'rt-1',
        accountId: 'acc-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refreshSession('raw-token', {})).rejects.toThrow(UnauthorizedException);
    });

    it('rotates the token and returns new access + refresh tokens', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      sessionService.findByHash.mockResolvedValue({
        id: 'rt-1',
        accountId: 'acc-1',
        revokedAt: null,
        expiresAt,
      });
      prisma.account.findFirst.mockResolvedValue(makeAccount());

      const result = await service.refreshSession('raw-token', { userAgent: 'Chrome' });

      expect(sessionService.rotate).toHaveBeenCalledWith(
        'rt-1',
        'new-raw-token',
        'acc-1',
        expiresAt,
        expect.any(Object),
      );
      expect(result.accessToken).toBe('access-jwt');
      expect(result.refreshToken).toBe('new-raw-token');
    });
  });

  describe('switchOrg', () => {
    it('throws ForbiddenException when not a member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      await expect(service.switchOrg('acc-1', 'user-1', 'a@b.com', 'org-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when member is inactive', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ role: 'STAFF', isActive: false });
      await expect(service.switchOrg('acc-1', 'user-1', 'a@b.com', 'org-1')).rejects.toThrow(ForbiddenException);
    });

    it('returns access token with organizationId and role when valid', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ role: 'OWNER', isActive: true });
      const result = await service.switchOrg('acc-1', 'user-1', 'a@b.com', 'org-1');
      expect(result).toHaveProperty('accessToken');
      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', role: 'OWNER' }),
      );
    });
  });
});
