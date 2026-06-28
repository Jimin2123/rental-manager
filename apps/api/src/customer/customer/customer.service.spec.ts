import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerService } from './customer.service';

describe('CustomerService', () => {
  let service: CustomerService;
  let prisma: {
    $transaction: jest.Mock;
    address: { create: jest.Mock; update: jest.Mock };
    businessProfile: { create: jest.Mock };
    businessPartner: { create: jest.Mock; findUnique: jest.Mock };
    businessPartnerRole: { createMany: jest.Mock };
    businessPartnerContact: { createMany: jest.Mock };
    individualProfile: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    customer: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      address: { create: jest.fn(), update: jest.fn() },
      businessProfile: { create: jest.fn() },
      businessPartner: { create: jest.fn(), findUnique: jest.fn() },
      businessPartnerRole: { createMany: jest.fn() },
      businessPartnerContact: { createMany: jest.fn() },
      individualProfile: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      customer: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [CustomerService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(CustomerService);
  });

  describe('create INDIVIDUAL', () => {
    it('creates IndividualProfile and Customer in transaction', async () => {
      prisma.individualProfile.create.mockResolvedValue({ id: 'profile-1' });
      prisma.customer.create.mockResolvedValue({ id: 'cust-1' });

      const result = await service.create('org-1', {
        type: 'INDIVIDUAL',
        individualProfile: { name: '홍길동', phone: '010-0000-0000' },
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.individualProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: '홍길동' }) }),
      );
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            type: 'INDIVIDUAL',
            individualProfileId: 'profile-1',
          }),
        }),
      );
      expect(result).toEqual({ id: 'cust-1' });
    });

    it('creates Address when address provided', async () => {
      prisma.address.create.mockResolvedValue({ id: 'addr-1' });
      prisma.individualProfile.create.mockResolvedValue({ id: 'profile-1' });
      prisma.customer.create.mockResolvedValue({ id: 'cust-1' });

      await service.create('org-1', {
        type: 'INDIVIDUAL',
        individualProfile: {
          name: '홍길동',
          address: { zonecode: '12345', address: '서울시' },
        },
      });

      expect(prisma.address.create).toHaveBeenCalled();
      expect(prisma.individualProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ addressId: 'addr-1' }) }),
      );
    });
  });

  describe('create BUSINESS', () => {
    it('links existing BusinessPartner without creating a new one', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'partner-1', deletedAt: null });
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: 'cust-1' });

      const result = await service.create('org-1', { type: 'BUSINESS', businessPartnerId: 'partner-1' });

      expect(prisma.businessPartner.create).not.toHaveBeenCalled();
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'BUSINESS', businessPartnerId: 'partner-1' }),
        }),
      );
      expect(result).toEqual({ id: 'cust-1' });
    });

    it('throws NotFoundException when partner missing or soft-deleted', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(null);
      await expect(service.create('org-1', { type: 'BUSINESS', businessPartnerId: 'nope' })).rejects.toThrow(
        NotFoundException,
      );

      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'partner-1', deletedAt: new Date() });
      await expect(service.create('org-1', { type: 'BUSINESS', businessPartnerId: 'partner-1' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when partner already linked to an active customer', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'partner-1', deletedAt: null });
      prisma.customer.findFirst.mockResolvedValue({ id: 'existing-cust' });

      await expect(service.create('org-1', { type: 'BUSINESS', businessPartnerId: 'partner-1' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when customer not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.findOne('org-1', 'c-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when soft-deleted', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: new Date() });
      await expect(service.findOne('org-1', 'c-1')).rejects.toThrow(NotFoundException);
    });

    it('returns customer', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c-1',
        deletedAt: null,
        individualProfile: { name: '홍길동' },
      });
      const result = await service.findOne('org-1', 'c-1');
      expect(result).toMatchObject({ id: 'c-1' });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.update('org-1', 'c-x', { memo: '...' })).rejects.toThrow(NotFoundException);
    });

    it('updates customer memo', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c-1',
        type: 'INDIVIDUAL',
        individualProfileId: 'p-1',
        deletedAt: null,
      });
      prisma.customer.update.mockResolvedValue({});

      await service.update('org-1', 'c-1', { memo: '새메모' });

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ memo: '새메모' }) }),
      );
    });

    it('updates individualProfile name for INDIVIDUAL customer', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c-1',
        type: 'INDIVIDUAL',
        individualProfileId: 'p-1',
        deletedAt: null,
      });
      prisma.individualProfile.update.mockResolvedValue({});

      await service.update('org-1', 'c-1', { individualProfile: { name: '새이름' } });

      expect(prisma.individualProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p-1' }, data: expect.objectContaining({ name: '새이름' }) }),
      );
    });
  });

  describe('softDelete', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('org-1', 'c-x')).rejects.toThrow(NotFoundException);
    });

    it('sets deletedAt and isActive=false', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.customer.update.mockResolvedValue({});

      await service.softDelete('org-1', 'c-1');

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
    });
  });
});
