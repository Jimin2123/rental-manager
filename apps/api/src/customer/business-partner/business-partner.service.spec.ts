import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessPartnerService } from './business-partner.service';

describe('BusinessPartnerService', () => {
  let service: BusinessPartnerService;
  let prisma: {
    $transaction: jest.Mock;
    address: { create: jest.Mock; update: jest.Mock };
    businessProfile: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
    businessPartner: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    businessPartnerRole: { createMany: jest.Mock; deleteMany: jest.Mock; findMany: jest.Mock };
    businessPartnerContact: {
      createMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    customer: { updateMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      address: { create: jest.fn(), update: jest.fn() },
      businessProfile: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      businessPartner: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      businessPartnerRole: { createMany: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
      businessPartnerContact: {
        createMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      customer: { updateMany: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [BusinessPartnerService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BusinessPartnerService);
  });

  describe('create', () => {
    it('creates address, businessProfile, businessPartner, roles, and contacts in transaction', async () => {
      prisma.address.create.mockResolvedValue({ id: 'addr-1' });
      prisma.businessProfile.create.mockResolvedValue({ id: 'bp-1' });
      prisma.businessPartner.create.mockResolvedValue({ id: 'partner-1' });
      prisma.businessPartnerRole.createMany.mockResolvedValue({ count: 1 });
      prisma.businessPartnerContact.createMany.mockResolvedValue({ count: 1 });

      const result = await service.create('org-1', {
        roles: ['SALES'],
        businessProfile: {
          name: '(주)ABC',
          businessRegistrationNo: '000-00-00000',
          representativeName: '홍길동',
          address: { zonecode: '12345', address: '서울시 강남구' },
        },
        contacts: [{ name: '김담당', isPrimary: true }],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.address.create).toHaveBeenCalled();
      expect(prisma.businessProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: '(주)ABC', addressId: 'addr-1' }) }),
      );
      expect(prisma.businessPartner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', businessProfileId: 'bp-1' }),
        }),
      );
      expect(prisma.businessPartnerRole.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [{ organizationId: 'org-1', businessPartnerId: 'partner-1', type: 'SALES' }] }),
      );
      expect(result).toEqual({ id: 'partner-1' });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when partner not found', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(null);
      await expect(service.findOne('org-1', 'p-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when partner is soft-deleted', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: new Date() });
      await expect(service.findOne('org-1', 'p-1')).rejects.toThrow(NotFoundException);
    });

    it('returns partner with contacts', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null, contacts: [] });
      const result = await service.findOne('org-1', 'p-1');
      expect(result).toMatchObject({ id: 'p-1' });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when partner not found', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(null);
      await expect(service.update('org-1', 'p-x', {})).rejects.toThrow(NotFoundException);
    });

    it('updates businessProfile name', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', businessProfileId: 'bp-1', deletedAt: null });
      prisma.businessProfile.update.mockResolvedValue({});

      await service.update('org-1', 'p-1', { businessProfile: { name: '새이름' } });

      expect(prisma.businessProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bp-1' }, data: expect.objectContaining({ name: '새이름' }) }),
      );
    });

    it('replaces roles when roles array provided', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', businessProfileId: 'bp-1', deletedAt: null });
      // 서비스는 현재 역할을 조회해(diff) 빠진 것만 삭제하고 새 것만 생성한다.
      prisma.businessPartnerRole.findMany.mockResolvedValue([{ id: 'role-sale', type: 'SALE' }]);
      prisma.businessPartnerRole.deleteMany.mockResolvedValue({});
      prisma.businessPartnerRole.createMany.mockResolvedValue({});

      await service.update('org-1', 'p-1', { roles: ['PURCHASE'] });

      // SALE → 빠졌으니 id로 삭제
      expect(prisma.businessPartnerRole.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['role-sale'] } } }),
      );
      // PURCHASE → 새로 생성
      expect(prisma.businessPartnerRole.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ organizationId: 'org-1', businessPartnerId: 'p-1', type: 'PURCHASE' }),
          ]),
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('org-1', 'p-x')).rejects.toThrow(NotFoundException);
    });

    it('sets deletedAt and isActive=false on partner and cascades to linked customer', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null });
      prisma.businessPartner.update.mockResolvedValue({});
      prisma.customer.updateMany.mockResolvedValue({ count: 1 });

      await service.softDelete('org-1', 'p-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.businessPartner.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
      expect(prisma.businessPartner.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
      expect(prisma.customer.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1', businessPartnerId: 'p-1', deletedAt: null }),
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('succeeds even if no linked customer exists', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null });
      prisma.businessPartner.update.mockResolvedValue({});
      prisma.customer.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.softDelete('org-1', 'p-1')).resolves.toBeUndefined();
    });
  });

  describe('addContact', () => {
    it('throws NotFoundException when partner not found', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(null);
      await expect(service.addContact('org-1', 'p-x', { name: '김담당' })).rejects.toThrow(NotFoundException);
    });

    it('creates contact', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null });
      prisma.businessPartnerContact.create.mockResolvedValue({ id: 'c-1' });

      const result = await service.addContact('org-1', 'p-1', { name: '김담당', isPrimary: true });

      expect(prisma.businessPartnerContact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', businessPartnerId: 'p-1', name: '김담당' }),
        }),
      );
      expect(result).toEqual({ id: 'c-1' });
    });
  });

  describe('updateContact', () => {
    it('throws NotFoundException when contact not found or wrong partner', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue(null);
      await expect(service.updateContact('org-1', 'p-1', 'c-x', { name: '새이름' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when contact belongs to different partner', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue({ id: 'c-1', businessPartnerId: 'other-p' });
      await expect(service.updateContact('org-1', 'p-1', 'c-1', { name: '새이름' })).rejects.toThrow(NotFoundException);
    });

    it('updates contact fields', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue({ id: 'c-1', businessPartnerId: 'p-1' });
      prisma.businessPartnerContact.update.mockResolvedValue({});

      await service.updateContact('org-1', 'p-1', 'c-1', { name: '새이름' });

      expect(prisma.businessPartnerContact.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: '새이름' }) }),
      );
    });
  });

  describe('removeContact', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue(null);
      await expect(service.removeContact('org-1', 'p-1', 'c-x')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when contact is referenced by assignments', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue({ id: 'c-1', businessPartnerId: 'p-1' });
      const fkError = new Prisma.PrismaClientKnownRequestError('FK violation', { code: 'P2003', clientVersion: '7' });
      prisma.businessPartnerContact.delete.mockRejectedValue(fkError);

      await expect(service.removeContact('org-1', 'p-1', 'c-1')).rejects.toThrow(ConflictException);
    });

    it('deletes contact', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue({ id: 'c-1', businessPartnerId: 'p-1' });
      prisma.businessPartnerContact.delete.mockResolvedValue({});

      await service.removeContact('org-1', 'p-1', 'c-1');

      expect(prisma.businessPartnerContact.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_organizationId: { id: 'c-1', organizationId: 'org-1' } } }),
      );
    });
  });
});
