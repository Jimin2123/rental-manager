import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationService } from './organization.service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: {
    $transaction: jest.Mock;
    address: { create: jest.Mock };
    businessProfile: { create: jest.Mock; update: jest.Mock };
    organization: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    organizationMember: { create: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      address: { create: jest.fn() },
      businessProfile: { create: jest.fn(), update: jest.fn() },
      organization: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      organizationMember: { create: jest.fn(), findMany: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [OrganizationService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(OrganizationService);
  });

  describe('create', () => {
    it('creates address, businessProfile, organization, and OWNER member in one transaction', async () => {
      prisma.address.create.mockResolvedValue({ id: 'addr-1' });
      prisma.businessProfile.create.mockResolvedValue({ id: 'bp-1' });
      prisma.organization.create.mockResolvedValue({ id: 'org-1' });
      prisma.organizationMember.create.mockResolvedValue({});

      const result = await service.create('user-1', {
        name: '테스트 주식회사',
        businessRegistrationNo: '1234567890',
        representativeName: '홍길동',
        zonecode: '06234',
        address: '서울시 강남구',
        memberName: '홍길동',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.address.create).toHaveBeenCalled();
      expect(prisma.businessProfile.create).toHaveBeenCalled();
      expect(prisma.organization.create).toHaveBeenCalled();
      expect(prisma.organizationMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: 'OWNER', isActive: true }) }),
      );
      expect(result).toEqual({ organizationId: 'org-1' });
    });
  });

  describe('findMyOrganizations', () => {
    it('returns list of organizations with name and role', async () => {
      prisma.organizationMember.findMany.mockResolvedValue([
        {
          role: 'OWNER',
          organization: { id: 'org-1', businessProfile: { name: '테스트 주식회사', businessRegistrationNo: '1234567890' } },
        },
      ]);

      const result = await service.findMyOrganizations('user-1');
      expect(result).toEqual([
        { id: 'org-1', name: '테스트 주식회사', businessRegistrationNo: '1234567890', role: 'OWNER' },
      ]);
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when organization not found', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.findById('org-x')).rejects.toThrow(NotFoundException);
    });

    it('returns organization with businessProfile', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', businessProfile: { name: 'A' } });
      const result = await service.findById('org-1');
      expect(result).toMatchObject({ id: 'org-1' });
    });
  });

  describe('update', () => {
    it('updates businessProfile fields', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', businessProfileId: 'bp-1', memo: null });
      prisma.businessProfile.update.mockResolvedValue({});

      await service.update('org-1', { name: '새 이름' });

      expect(prisma.businessProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bp-1' } }),
      );
    });
  });
});
