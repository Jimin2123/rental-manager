import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../../auth/session/token.service';
import { MAIL_SERVICE } from '../../mail/mail.interface';
import { InvitationService } from './invitation.service';

describe('InvitationService', () => {
  let service: InvitationService;
  let prisma: {
    account: { findUnique: jest.Mock };
    organizationMember: { findUnique: jest.Mock; create: jest.Mock };
    organizationInvitation: { deleteMany: jest.Mock; create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    organization: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tokenService: { hashToken: jest.Mock; generateRawRefreshToken: jest.Mock };
  let mailService: { sendOrganizationInvite: jest.Mock };

  beforeEach(async () => {
    prisma = {
      account: { findUnique: jest.fn().mockResolvedValue(null) },
      organizationMember: { findUnique: jest.fn(), create: jest.fn() },
      organizationInvitation: { deleteMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      organization: { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    };
    tokenService = {
      hashToken: jest.fn().mockReturnValue('hashed-token'),
      generateRawRefreshToken: jest.fn().mockReturnValue('raw-token'),
    };
    mailService = { sendOrganizationInvite: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        InvitationService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokenService },
        { provide: MAIL_SERVICE, useValue: mailService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('http://localhost:3000') } },
      ],
    }).compile();
    service = module.get(InvitationService);
  });

  describe('send', () => {
    it('throws ConflictException when email is already an active member', async () => {
      prisma.account.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', isActive: true });
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', businessProfile: { name: '테스트' } });
      await expect(service.send('org-1', 'm-0', { email: 'a@b.com', role: 'STAFF' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('deletes existing pending invitations and creates new one', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', businessProfile: { name: '테스트' } });
      prisma.organizationInvitation.deleteMany.mockResolvedValue({});
      prisma.organizationInvitation.create.mockResolvedValue({});

      await service.send('org-1', 'm-0', { email: 'a@b.com', role: 'STAFF' });

      expect(prisma.organizationInvitation.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ email: 'a@b.com', organizationId: 'org-1', acceptedAt: null }),
        }),
      );
      expect(tokenService.hashToken).toHaveBeenCalledWith('raw-token');
      expect(prisma.organizationInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ token: 'hashed-token' }) }),
      );
      expect(mailService.sendOrganizationInvite).toHaveBeenCalledWith(
        'a@b.com',
        expect.stringContaining('raw-token'),
        '테스트',
      );
    });
  });

  describe('getByToken', () => {
    it('throws BadRequestException when token not found or already accepted', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue(null);
      await expect(service.getByToken('raw-token')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when invitation is expired', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        expiresAt: new Date(Date.now() - 1000),
        acceptedAt: null,
        organization: { businessProfile: { name: '테스트' } },
      });
      await expect(service.getByToken('raw-token')).rejects.toThrow(BadRequestException);
    });

    it('returns invitation when valid', async () => {
      const inv = {
        id: 'inv-1',
        email: 'a@b.com',
        role: 'STAFF',
        expiresAt: new Date(Date.now() + 100000),
        acceptedAt: null,
        organization: { businessProfile: { name: '테스트' } },
      };
      prisma.organizationInvitation.findUnique.mockResolvedValue(inv);
      const result = await service.getByToken('raw-token');
      expect(result).toMatchObject({ email: 'a@b.com' });
    });
  });

  describe('accept', () => {
    it('throws ConflictException when already a member', async () => {
      const inv = {
        id: 'inv-1',
        organizationId: 'org-1',
        role: 'STAFF',
        expiresAt: new Date(Date.now() + 100000),
        acceptedAt: null,
        organization: { businessProfile: { name: '테스트' } },
      };
      prisma.organizationInvitation.findUnique.mockResolvedValue(inv);
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1' });
      await expect(service.accept('raw-token', 'user-1')).rejects.toThrow(ConflictException);
    });

    it('creates OrganizationMember and sets acceptedAt', async () => {
      const inv = {
        id: 'inv-1',
        organizationId: 'org-1',
        role: 'STAFF',
        email: 'a@b.com',
        expiresAt: new Date(Date.now() + 100000),
        acceptedAt: null,
        organization: { businessProfile: { name: '테스트' } },
      };
      prisma.organizationInvitation.findUnique.mockResolvedValue(inv);
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      prisma.organizationMember.create.mockResolvedValue({});
      prisma.organizationInvitation.update.mockResolvedValue({});

      await service.accept('raw-token', 'user-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.organizationMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', organizationId: 'org-1' }) }),
      );
      expect(prisma.organizationInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { acceptedAt: expect.any(Date) } }),
      );
    });
  });
});
