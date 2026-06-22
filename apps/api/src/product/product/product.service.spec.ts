import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: {
    product: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    asset: { count: jest.Mock; groupBy: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      product: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      asset: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [ProductService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ProductService);
  });

  describe('create', () => {
    it('creates product and returns id', async () => {
      prisma.product.create.mockResolvedValue({ id: 'prod-1' });
      const result = await service.create('org-1', { name: '복합기 A' });
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-1', name: '복합기 A' }) }),
      );
      expect(result).toEqual({ id: 'prod-1' });
    });
  });

  describe('findAll', () => {
    it('returns products filtered by category', async () => {
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }]);
      const result = await service.findAll('org-1', { category: '복합기' });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1', deletedAt: null, category: '복합기' }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('filters by isActive=false', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { isActive: false });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: false }) }),
      );
    });

    it('filters by search term (name contains)', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { search: 'A4' });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ name: { contains: 'A4' } }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('org-1', 'prod-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when soft-deleted', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: new Date() });
      await expect(service.findOne('org-1', 'prod-1')).rejects.toThrow(NotFoundException);
    });

    it('returns product with asset stats', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', name: '복합기 A', deletedAt: null });
      prisma.asset.groupBy.mockResolvedValue([
        { status: 'AVAILABLE', _count: { status: 2 } },
        { status: 'RENTED', _count: { status: 1 } },
      ]);
      const result = await service.findOne('org-1', 'prod-1');
      expect(result.assetStats).toEqual({ total: 3, byStatus: { AVAILABLE: 2, RENTED: 1 } });
    });

    it('returns empty assetStats when no assets', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: null });
      prisma.asset.groupBy.mockResolvedValue([]);
      const result = await service.findOne('org-1', 'prod-1');
      expect(result.assetStats).toEqual({ total: 0, byStatus: {} });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.update('org-1', 'prod-x', { name: '신제품' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when soft-deleted', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: new Date() });
      await expect(service.update('org-1', 'prod-1', { name: '신제품' })).rejects.toThrow(NotFoundException);
    });

    it('updates product fields', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: null });
      prisma.product.update.mockResolvedValue({});
      await service.update('org-1', 'prod-1', { name: '신제품', category: '프린터' });
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_organizationId: { id: 'prod-1', organizationId: 'org-1' } },
          data: expect.objectContaining({ name: '신제품', category: '프린터' }),
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('throws NotFoundException when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('org-1', 'prod-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when already soft-deleted', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: new Date() });
      await expect(service.softDelete('org-1', 'prod-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when active assets exist', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: null });
      prisma.asset.count.mockResolvedValue(3);
      await expect(service.softDelete('org-1', 'prod-1')).rejects.toThrow(ConflictException);
    });

    it('soft-deletes product when no active assets', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: null });
      prisma.asset.count.mockResolvedValue(0);
      prisma.product.update.mockResolvedValue({});
      await service.softDelete('org-1', 'prod-1');
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
