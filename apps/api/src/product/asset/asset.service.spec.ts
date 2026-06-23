import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetService } from './asset.service';

describe('AssetService', () => {
  let service: AssetService;
  let prisma: {
    $transaction: jest.Mock;
    product: { findUnique: jest.Mock };
    asset: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    assetEvent: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      product: { findUnique: jest.fn() },
      asset: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      assetEvent: { create: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [AssetService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AssetService);
  });

  describe('create', () => {
    it('throws NotFoundException when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.create('org-1', { productId: 'p-x', initialStatus: 'AVAILABLE' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when product is deleted', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: new Date() });
      await expect(service.create('org-1', { productId: 'p-1', initialStatus: 'AVAILABLE' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates asset and AssetEvent in transaction', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null });
      prisma.asset.create.mockResolvedValue({ id: 'asset-1' });
      prisma.assetEvent.create.mockResolvedValue({});

      const result = await service.create('org-1', { productId: 'p-1', initialStatus: 'AVAILABLE' });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', productId: 'p-1', status: 'AVAILABLE' }),
        }),
      );
      expect(prisma.assetEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromStatus: null, toStatus: 'AVAILABLE', sourceType: 'MANUAL' }),
        }),
      );
      expect(result).toEqual({ id: 'asset-1' });
    });

    it('creates asset with INCOMING status', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null });
      prisma.asset.create.mockResolvedValue({ id: 'asset-2' });
      prisma.assetEvent.create.mockResolvedValue({});

      await service.create('org-1', { productId: 'p-1', initialStatus: 'INCOMING', serialNumber: 'SN-001' });

      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INCOMING', serialNumber: 'SN-001' }),
        }),
      );
      expect(prisma.assetEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromStatus: null, toStatus: 'INCOMING' }),
        }),
      );
    });

    it('throws ConflictException on duplicate serialNumber (P2002)', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
        code: 'P2002',
        clientVersion: '7.0.0',
      });
      prisma.$transaction.mockRejectedValue(p2002);
      await expect(
        service.create('org-1', { productId: 'p-1', initialStatus: 'AVAILABLE', serialNumber: 'SN-DUPE' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns assets filtered by productId and status', async () => {
      prisma.asset.findMany.mockResolvedValue([{ id: 'a-1' }]);
      await service.findAll('org-1', { productId: 'p-1', status: 'AVAILABLE' });
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            productId: 'p-1',
            status: 'AVAILABLE',
            deletedAt: null,
          }),
        }),
      );
    });

    it('filters by serialNumber search', async () => {
      prisma.asset.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { search: 'SN-00' });
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ serialNumber: { contains: 'SN-00' } }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.findOne('org-1', 'asset-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when soft-deleted', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: new Date() });
      await expect(service.findOne('org-1', 'a-1')).rejects.toThrow(NotFoundException);
    });

    it('returns asset with product info', async () => {
      prisma.asset.findUnique.mockResolvedValue({
        id: 'a-1',
        deletedAt: null,
        product: { id: 'p-1', name: '복합기 A' },
      });
      const result = await service.findOne('org-1', 'a-1');
      expect(result).toMatchObject({ id: 'a-1' });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.update('org-1', 'a-x', { memo: '...' })).rejects.toThrow(NotFoundException);
    });

    it('updates asset fields', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      prisma.asset.update.mockResolvedValue({});
      await service.update('org-1', 'a-1', { memo: '새 메모' });
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ memo: '새 메모' }) }),
      );
    });

    it('throws ConflictException on duplicate serialNumber (P2002)', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
        code: 'P2002',
        clientVersion: '7.0.0',
      });
      prisma.asset.update.mockRejectedValue(p2002);
      await expect(service.update('org-1', 'a-1', { serialNumber: 'SN-DUPE' })).rejects.toThrow(ConflictException);
    });
  });

  describe('changeStatus', () => {
    it('throws NotFoundException when asset not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.changeStatus('a-x', 'org-1', 'REPAIR', 'MANUAL')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when soft-deleted', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: new Date() });
      await expect(service.changeStatus('a-1', 'org-1', 'REPAIR', 'MANUAL')).rejects.toThrow(NotFoundException);
    });

    it('no-op when status is same (does not call $transaction)', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: null });
      await service.changeStatus('a-1', 'org-1', 'AVAILABLE', 'MANUAL');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates status and creates AssetEvent in transaction', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: null });
      prisma.asset.update.mockResolvedValue({});
      prisma.assetEvent.create.mockResolvedValue({});

      await service.changeStatus('a-1', 'org-1', 'REPAIR', 'MANUAL', undefined, '수리 요청');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_organizationId: { id: 'a-1', organizationId: 'org-1' } },
          data: { status: 'REPAIR' },
        }),
      );
      expect(prisma.assetEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'AVAILABLE',
            toStatus: 'REPAIR',
            sourceType: 'MANUAL',
            note: '수리 요청',
          }),
        }),
      );
    });

    it('passes sourceType and sourceId for non-MANUAL source', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: null });
      prisma.asset.update.mockResolvedValue({});
      prisma.assetEvent.create.mockResolvedValue({});

      await service.changeStatus('a-1', 'org-1', 'RENTED', 'RENTAL_CONTRACT', 'contract-123');

      expect(prisma.assetEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sourceType: 'RENTAL_CONTRACT', sourceId: 'contract-123' }),
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('org-1', 'a-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when already deleted', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: new Date() });
      await expect(service.softDelete('org-1', 'a-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when status is RENTED', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'RENTED', deletedAt: null });
      await expect(service.softDelete('org-1', 'a-1')).rejects.toThrow(ConflictException);
    });

    it('soft-deletes asset (sets deletedAt only)', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: null });
      prisma.asset.update.mockResolvedValue({});
      await service.softDelete('org-1', 'a-1');
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });
  });
});
