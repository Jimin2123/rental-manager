import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { MemberService } from './member.service';

describe('MemberService', () => {
  let service: MemberService;
  let prisma: {
    account: { findUnique: jest.Mock };
    organizationMember: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      account: { findUnique: jest.fn() },
      organizationMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [MemberService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(MemberService);
  });

  describe('list', () => {
    it('returns active members', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([{ id: 'm-1', name: '홍길동', role: 'STAFF', isActive: true }]);
      const result = await service.list('org-1');
      expect(prisma.organizationMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1', isActive: true } }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('addDirect', () => {
    it('throws NotFoundException when email account not found', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      await expect(service.addDirect('org-1', { email: 'a@b.com', role: 'STAFF', name: '홍길동' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when already a member', async () => {
      prisma.account.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', isActive: true });
      await expect(service.addDirect('org-1', { email: 'a@b.com', role: 'STAFF', name: '홍길동' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates OrganizationMember when account exists and not a member', async () => {
      prisma.account.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      prisma.organizationMember.create.mockResolvedValue({});
      await service.addDirect('org-1', { email: 'a@b.com', role: 'STAFF', name: '홍길동' });
      expect(prisma.organizationMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-1', role: 'STAFF' }) }),
      );
    });

    it('reactivates a deactivated member instead of throwing', async () => {
      prisma.account.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', isActive: false });
      prisma.organizationMember.update.mockResolvedValue({});
      await service.addDirect('org-1', { email: 'a@b.com', role: 'STAFF', name: '홍길동' });
      expect(prisma.organizationMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }),
      );
      expect(prisma.organizationMember.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws ForbiddenException when updating OWNER role', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', role: 'OWNER', isActive: true });
      await expect(service.update('org-1', 'm-1', { role: 'ADMIN' })).rejects.toThrow(ForbiddenException);
    });

    it('updates non-OWNER member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', role: 'STAFF', isActive: true });
      prisma.organizationMember.update.mockResolvedValue({});
      await service.update('org-1', 'm-1', { name: '새이름' });
      expect(prisma.organizationMember.update).toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('throws ForbiddenException when deactivating OWNER', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', role: 'OWNER', isActive: true });
      await expect(service.deactivate('org-1', 'm-1')).rejects.toThrow(ForbiddenException);
    });

    it('sets isActive to false for non-OWNER member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', role: 'STAFF', isActive: true });
      prisma.organizationMember.update.mockResolvedValue({});
      await service.deactivate('org-1', 'm-1');
      expect(prisma.organizationMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });
  });
});
