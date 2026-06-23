import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetEventService } from './asset-event.service';

describe('AssetEventService', () => {
  let service: AssetEventService;
  let prisma: {
    asset: { findUnique: jest.Mock };
    assetEvent: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      asset: { findUnique: jest.fn() },
      assetEvent: { findMany: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [AssetEventService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AssetEventService);
  });

  describe('findByAsset', () => {
    it('throws NotFoundException when asset not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.findByAsset('org-1', 'a-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when asset is soft-deleted', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: new Date() });
      await expect(service.findByAsset('org-1', 'a-1')).rejects.toThrow(NotFoundException);
    });

    it('returns events ordered by createdAt desc', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      prisma.assetEvent.findMany.mockResolvedValue([
        { id: 'ev-2', toStatus: 'REPAIR', createdAt: new Date('2026-06-23T10:00:00Z') },
        { id: 'ev-1', toStatus: 'AVAILABLE', createdAt: new Date('2026-06-23T09:00:00Z') },
      ]);
      const result = await service.findByAsset('org-1', 'a-1');
      expect(prisma.assetEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assetId: 'a-1', organizationId: 'org-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });
});
