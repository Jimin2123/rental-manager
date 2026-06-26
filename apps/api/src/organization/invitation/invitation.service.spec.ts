import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../../auth/session/token.service';
import { MAIL_SERVICE } from '../../mail/mail.interface';
import { InvitationService } from './invitation.service';

describe('InvitationService', () => {
  let service: InvitationService;
  let prisma: {
    account: { findUnique: jest.Mock; create: jest.Mock };
    organizationMember: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    organizationInvitation: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      delete: jest.Mock;
    };
    organization: { findUnique: jest.Mock };
    user: { create: jest.Mock };
    passwordHistory: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let tokenService: { hashToken: jest.Mock; generateRawRefreshToken: jest.Mock };
  let mailService: { sendOrganizationInvite: jest.Mock };

  beforeEach(async () => {
    prisma = {
      account: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      organizationMember: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      organizationInvitation: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      organization: { findUnique: jest.fn() },
      user: { create: jest.fn() },
      passwordHistory: { create: jest.fn() },
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
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', isActive: true });
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

  describe('listPending', () => {
    it('미수락·미만료 초대만 조회한다', async () => {
      prisma.organizationInvitation.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          email: 'a@x.com',
          role: 'STAFF',
          expiresAt: new Date(),
          createdAt: new Date(),
          invitedBy: { name: '홍길동' },
        },
      ]);
      const result = await service.listPending('org-1');
      expect(prisma.organizationInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            acceptedAt: null,
            expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('cancel', () => {
    it('조직이 일치하면 초대를 삭제한다', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        acceptedAt: null,
      });
      await service.cancel('org-1', 'inv-1');
      expect(prisma.organizationInvitation.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    });

    it('초대가 없거나 다른 조직이면 NotFound', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue(null);
      await expect(service.cancel('org-1', 'inv-x')).rejects.toThrow(NotFoundException);
      prisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'other',
        acceptedAt: null,
      });
      await expect(service.cancel('org-1', 'inv-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resend', () => {
    it('초대의 email/role로 send를 재호출한다', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        invitedById: 'mem-1',
        email: 'a@x.com',
        role: 'MANAGER',
        acceptedAt: null,
      });
      const sendSpy = jest.spyOn(service, 'send').mockResolvedValue(undefined);
      await service.resend('org-1', 'inv-1');
      expect(sendSpy).toHaveBeenCalledWith('org-1', 'mem-1', { email: 'a@x.com', role: 'MANAGER' });
    });

    it('이미 수락된 초대면 Conflict', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        invitedById: 'mem-1',
        email: 'a@x.com',
        role: 'STAFF',
        acceptedAt: new Date(),
      });
      await expect(service.resend('org-1', 'inv-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('listMine', () => {
    it('내 이메일의 대기 초대만 조회한다', async () => {
      prisma.organizationInvitation.findMany.mockResolvedValue([{ id: 'inv-1' }]);
      await service.listMine('a@x.com');
      expect(prisma.organizationInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: 'a@x.com',
            acceptedAt: null,
            declinedAt: null,
            expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
          }),
        }),
      );
    });
  });

  describe('declineById', () => {
    it('내 이메일 대기 초대를 거절 처리한다', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1', email: 'a@x.com', acceptedAt: null, declinedAt: null, expiresAt: new Date(Date.now() + 1000),
      });
      await service.declineById('inv-1', 'a@x.com');
      expect(prisma.organizationInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inv-1' }, data: { declinedAt: expect.any(Date) } }),
      );
    });

    it('다른 이메일 초대면 NotFound', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue({
        id: 'inv-1', email: 'other@x.com', acceptedAt: null, declinedAt: null, expiresAt: new Date(Date.now() + 1000),
      });
      await expect(service.declineById('inv-1', 'a@x.com')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listForAdmin', () => {
    it('수락 제외, 거절/만료 포함하며 status를 파생한다', async () => {
      const now = Date.now();
      prisma.organizationInvitation.findMany.mockResolvedValue([
        { id: 'p', email: 'p@x.com', role: 'STAFF', expiresAt: new Date(now + 1000), declinedAt: null, createdAt: new Date(), invitedBy: { name: '홍' } },
        { id: 'd', email: 'd@x.com', role: 'STAFF', expiresAt: new Date(now + 1000), declinedAt: new Date(), createdAt: new Date(), invitedBy: { name: '홍' } },
        { id: 'e', email: 'e@x.com', role: 'STAFF', expiresAt: new Date(now - 1000), declinedAt: null, createdAt: new Date(), invitedBy: { name: '홍' } },
      ]);
      const result = await service.listForAdmin('org-1');
      expect(result.map((r) => r.status)).toEqual(['PENDING', 'DECLINED', 'EXPIRED']);
    });
  });
});
