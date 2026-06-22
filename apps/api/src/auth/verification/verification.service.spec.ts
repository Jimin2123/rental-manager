import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../session/token.service';
import { MAIL_SERVICE } from '../../mail/mail.interface';
import { VERIFICATION_TOKEN_STORE } from './token-store/verification-token-store.interface';
import { VerificationService } from './verification.service';

describe('VerificationService', () => {
  let service: VerificationService;
  let prismaAccount: { findUnique: jest.Mock; update: jest.Mock };
  let tokenStore: { save: jest.Mock; findValid: jest.Mock; markUsed: jest.Mock };
  let mailService: { sendEmailVerification: jest.Mock };
  let hashToken: jest.Mock;

  beforeEach(async () => {
    prismaAccount = { findUnique: jest.fn(), update: jest.fn() };
    tokenStore    = { save: jest.fn(), findValid: jest.fn(), markUsed: jest.fn() };
    mailService   = { sendEmailVerification: jest.fn() };
    hashToken     = jest.fn((raw: string) => `hash:${raw}`);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: PrismaService, useValue: { account: prismaAccount } },
        { provide: TokenService, useValue: { hashToken, generateRawRefreshToken: jest.fn().mockReturnValue('raw-vt') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://localhost:3000') } },
        { provide: MAIL_SERVICE, useValue: mailService },
        { provide: VERIFICATION_TOKEN_STORE, useValue: tokenStore },
      ],
    }).compile();
    service = module.get(VerificationService);
  });

  describe('sendVerificationEmail', () => {
    it('silently returns when account does not exist (prevents email enumeration)', async () => {
      prismaAccount.findUnique.mockResolvedValue(null);
      await expect(service.sendVerificationEmail('x@b.com')).resolves.toBeUndefined();
      expect(tokenStore.save).not.toHaveBeenCalled();
      expect(mailService.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('saves hashed token and sends email', async () => {
      prismaAccount.findUnique.mockResolvedValue({ id: 'acc-1', email: 'a@b.com', emailVerifiedAt: null });
      tokenStore.save.mockResolvedValue(undefined);
      mailService.sendEmailVerification.mockResolvedValue(undefined);

      await service.sendVerificationEmail('a@b.com');

      expect(tokenStore.save).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'hash:raw-vt', type: 'EMAIL_VERIFY', accountId: 'acc-1' }),
      );
      expect(mailService.sendEmailVerification).toHaveBeenCalledWith('a@b.com', expect.stringContaining('raw-vt'));
    });
  });

  describe('verifyEmail', () => {
    it('throws BadRequestException when token is invalid or expired', async () => {
      tokenStore.findValid.mockResolvedValue(null);
      await expect(service.verifyEmail('bad-token')).rejects.toThrow(BadRequestException);
    });

    it('sets emailVerifiedAt and marks token as used', async () => {
      tokenStore.findValid.mockResolvedValue({ id: 'vt-1', accountId: 'acc-1' });
      prismaAccount.update.mockResolvedValue({});
      tokenStore.markUsed.mockResolvedValue(undefined);

      await service.verifyEmail('raw-vt');

      expect(hashToken).toHaveBeenCalledWith('raw-vt');
      expect(prismaAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { emailVerifiedAt: expect.any(Date) },
      });
      expect(tokenStore.markUsed).toHaveBeenCalledWith('vt-1');
    });
  });
});
