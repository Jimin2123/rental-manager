import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { MeterReadingService } from './meter-reading.service';

describe('MeterReadingService', () => {
  let service: MeterReadingService;
  let prisma: {
    asset: { findUnique: jest.Mock };
    meterReading: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      asset: { findUnique: jest.fn() },
      meterReading: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [MeterReadingService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(MeterReadingService);
  });

  describe('create', () => {
    it('throws NotFoundException when asset not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.create('org-1', 'asset-1', { readingDate: '2026-06-23', blackCount: 100 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when asset is deleted', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', deletedAt: new Date() });
      await expect(service.create('org-1', 'asset-1', { readingDate: '2026-06-23', blackCount: 100 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sets blackUsage = blackCount when no previous reading', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', deletedAt: null });
      prisma.meterReading.findFirst.mockResolvedValue(null);
      prisma.meterReading.create.mockResolvedValue({ id: 'mr-1' });

      await service.create('org-1', 'asset-1', { readingDate: '2026-06-23', blackCount: 200 });

      expect(prisma.meterReading.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ blackUsage: 200 }) }),
      );
    });

    it('calculates blackUsage as delta from previous reading', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', deletedAt: null });
      prisma.meterReading.findFirst.mockResolvedValue({ blackCount: 150, colorCount: null });
      prisma.meterReading.create.mockResolvedValue({ id: 'mr-1' });

      await service.create('org-1', 'asset-1', { readingDate: '2026-06-23', blackCount: 200 });

      expect(prisma.meterReading.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ blackUsage: 50 }) }),
      );
    });

    it('throws BadRequestException when blackCount is lower than previous', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', deletedAt: null });
      prisma.meterReading.findFirst.mockResolvedValue({ blackCount: 300, colorCount: null });

      await expect(service.create('org-1', 'asset-1', { readingDate: '2026-06-23', blackCount: 200 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when colorCount is lower than previous', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', deletedAt: null });
      prisma.meterReading.findFirst.mockResolvedValue({ blackCount: 100, colorCount: 200 });

      await expect(
        service.create('org-1', 'asset-1', { readingDate: '2026-06-23', blackCount: 150, colorCount: 150 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calculates colorUsage from prev.colorCount when prev.colorCount is null (treats as 0)', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', deletedAt: null });
      prisma.meterReading.findFirst.mockResolvedValue({ blackCount: 100, colorCount: null });
      prisma.meterReading.create.mockResolvedValue({ id: 'mr-1' });

      await service.create('org-1', 'asset-1', { readingDate: '2026-06-23', blackCount: 150, colorCount: 50 });

      expect(prisma.meterReading.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ colorUsage: 50 }) }),
      );
    });
  });

  describe('findByAsset', () => {
    it('throws NotFoundException when asset not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.findByAsset('org-1', 'asset-1', {})).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when asset is deleted', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', deletedAt: new Date() });
      await expect(service.findByAsset('org-1', 'asset-1', {})).rejects.toThrow(NotFoundException);
    });

    it('applies billingMonth filter', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', deletedAt: null });
      prisma.meterReading.findMany.mockResolvedValue([]);

      await service.findByAsset('org-1', 'asset-1', { billingMonth: '2026-06' });

      expect(prisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ billingMonth: '2026-06' }),
        }),
      );
    });

    it('excludes deleted readings', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'asset-1', deletedAt: null });
      prisma.meterReading.findMany.mockResolvedValue([]);

      await service.findByAsset('org-1', 'asset-1', {});

      expect(prisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('applies assetId filter', async () => {
      prisma.meterReading.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { assetId: 'asset-1' });
      expect(prisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ assetId: 'asset-1' }) }),
      );
    });

    it('applies billingMonth filter', async () => {
      prisma.meterReading.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { billingMonth: '2026-06' });
      expect(prisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ billingMonth: '2026-06' }) }),
      );
    });

    it('applies rentalContractItemId filter', async () => {
      prisma.meterReading.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { rentalContractItemId: 'rci-1' });
      expect(prisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ rentalContractItemId: 'rci-1' }) }),
      );
    });

    it('excludes deleted readings', async () => {
      prisma.meterReading.findMany.mockResolvedValue([]);
      await service.findAll('org-1', {});
      expect(prisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });
  });

  describe('cancel', () => {
    it('throws NotFoundException when reading not found', async () => {
      prisma.meterReading.findUnique.mockResolvedValue(null);
      await expect(service.cancel('org-1', 'mr-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when reading is already deleted', async () => {
      prisma.meterReading.findUnique.mockResolvedValue({ id: 'mr-1', deletedAt: new Date(), invoiceItemId: null });
      await expect(service.cancel('org-1', 'mr-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when reading is linked to an invoice item', async () => {
      prisma.meterReading.findUnique.mockResolvedValue({ id: 'mr-1', deletedAt: null, invoiceItemId: 'inv-1' });
      await expect(service.cancel('org-1', 'mr-1')).rejects.toThrow(BadRequestException);
    });

    it('sets deletedAt on cancel', async () => {
      prisma.meterReading.findUnique.mockResolvedValue({ id: 'mr-1', deletedAt: null, invoiceItemId: null });
      prisma.meterReading.update.mockResolvedValue({});

      await service.cancel('org-1', 'mr-1');

      expect(prisma.meterReading.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });
});
