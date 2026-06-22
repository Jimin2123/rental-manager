import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../session/token.service';
import { MAIL_SERVICE } from '../../mail/mail.interface';
import { VERIFICATION_TOKEN_STORE } from '../verification/token-store/verification-token-store.interface';
import { PasswordService } from './password.service';

jest.mock('bcrypt');
const bcryptHash = bcrypt.hash as jest.Mock;
const bcryptCompare = bcrypt.compare as jest.Mock;

describe('PasswordService', () => {
  let service: PasswordService;
  let prisma: {
    account: { findUnique: jest.Mock; update: jest.Mock };
    passwordHistory: { findMany: jest.Mock; create: jest.Mock };
    refreshToken: { updateMany: jest.Mock };
  };
  let tokenStore: { save: jest.Mock; findValid: jest.Mock; markUsed: jest.Mock };
  let mailService: { sendPasswordReset: jest.Mock };

  beforeEach(async () => {
    prisma = {
      account: { findUnique: jest.fn(), update: jest.fn() },
      passwordHistory: { findMany: jest.fn(), create: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
    };
    tokenStore = { save: jest.fn(), findValid: jest.fn(), markUsed: jest.fn() };
    mailService = { sendPasswordReset: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: TokenService,
          useValue: {
            hashToken: (raw: string) => `hash:${raw}`,
            generateRawRefreshToken: jest.fn().mockReturnValue('raw-reset-token'),
          },
        },
        { provide: MAIL_SERVICE, useValue: mailService },
        { provide: VERIFICATION_TOKEN_STORE, useValue: tokenStore },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://localhost:3000') } },
      ],
    }).compile();
    service = module.get(PasswordService);
  });

  describe('sendResetEmail', () => {
    it('does not reveal whether the email exists (no error thrown)', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      await expect(service.sendResetEmail('unknown@b.com')).resolves.toBeUndefined();
      expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('saves token and sends email when account exists', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: 'acc-1', email: 'a@b.com' });
      tokenStore.save.mockResolvedValue(undefined);
      mailService.sendPasswordReset.mockResolvedValue(undefined);

      await service.sendResetEmail('a@b.com');

      expect(tokenStore.save).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'hash:raw-reset-token', type: 'PASSWORD_RESET', accountId: 'acc-1' }),
      );
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith('a@b.com', expect.stringContaining('raw-reset-token'));
    });
  });

  describe('resetPassword', () => {
    it('throws BadRequestException when token is invalid', async () => {
      tokenStore.findValid.mockResolvedValue(null);
      await expect(service.resetPassword('bad-token', 'new-pass')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when new password matches a recent history entry', async () => {
      tokenStore.findValid.mockResolvedValue({ id: 'vt-1', accountId: 'acc-1' });
      prisma.passwordHistory.findMany.mockResolvedValue([{ passwordHash: '$old' }]);
      bcryptCompare.mockResolvedValue(true); // new password matches old

      await expect(service.resetPassword('token', 'same-old-pass')).rejects.toThrow(BadRequestException);
    });

    it('updates passwordHash and marks token used when valid', async () => {
      tokenStore.findValid.mockResolvedValue({ id: 'vt-1', accountId: 'acc-1' });
      prisma.passwordHistory.findMany.mockResolvedValue([]);
      bcryptHash.mockResolvedValue('$new-hash');
      prisma.account.update.mockResolvedValue({});
      prisma.passwordHistory.create.mockResolvedValue({});
      tokenStore.markUsed.mockResolvedValue(undefined);

      await service.resetPassword('raw-token', 'new-pass-123');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { passwordHash: '$new-hash' },
      });
      expect(tokenStore.markUsed).toHaveBeenCalledWith('vt-1');
    });
  });

  describe('changePassword', () => {
    it('throws NotFoundException when account not found', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      await expect(service.changePassword('acc-1', 'cur', 'new')).rejects.toThrow(NotFoundException);
    });

    it('throws UnauthorizedException when current password is wrong', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: 'acc-1', passwordHash: '$hash' });
      bcryptCompare.mockResolvedValue(false);
      await expect(service.changePassword('acc-1', 'wrong', 'new')).rejects.toThrow(UnauthorizedException);
    });
  });
});
