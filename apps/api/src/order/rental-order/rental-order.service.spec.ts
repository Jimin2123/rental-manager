import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderStatus, OrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RentalOrderService } from './rental-order.service';

describe('RentalOrderService', () => {
  let service: RentalOrderService;
  let prisma: {
    order: { findUnique: jest.Mock };
    rentalOrderItem: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
    asset: { findUnique: jest.Mock };
  };

  const mockOrder = (overrides = {}) => ({
    id: 'o-1',
    type: OrderType.RENTAL,
    status: OrderStatus.REGISTERED,
    rentalOrder: { id: 'ro-1' },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn() },
      rentalOrderItem: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
      asset: { findUnique: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [RentalOrderService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(RentalOrderService);
  });

  describe('addItem', () => {
    it('throws NotFoundException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.addItem('org-1', 'o-x', { productId: 'p-1', monthlyRentalPrice: 50000 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when order type is SALE', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ type: OrderType.SALE }));
      await expect(service.addItem('org-1', 'o-1', { productId: 'p-1', monthlyRentalPrice: 50000 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when order is CANCELED', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ status: OrderStatus.CANCELED }));
      await expect(service.addItem('org-1', 'o-1', { productId: 'p-1', monthlyRentalPrice: 50000 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when assetId given but asset not in org', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder());
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(
        service.addItem('org-1', 'o-1', { productId: 'p-1', assetId: 'a-x', monthlyRentalPrice: 50000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates item and returns id', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder());
      prisma.rentalOrderItem.create.mockResolvedValue({ id: 'roi-1' });

      const result = await service.addItem('org-1', 'o-1', { productId: 'p-1', monthlyRentalPrice: 50000 });

      expect(prisma.rentalOrderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ monthlyRentalPrice: 50000, rentalOrderId: 'ro-1' }),
        }),
      );
      expect(result).toEqual({ id: 'roi-1' });
    });
  });

  describe('removeItem', () => {
    it('throws NotFoundException when item not in this order', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder());
      prisma.rentalOrderItem.findFirst.mockResolvedValue(null);
      await expect(service.removeItem('org-1', 'o-1', 'roi-x')).rejects.toThrow(NotFoundException);
    });

    it('deletes item', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder());
      prisma.rentalOrderItem.findFirst.mockResolvedValue({ id: 'roi-1' });
      prisma.rentalOrderItem.delete.mockResolvedValue({});

      await service.removeItem('org-1', 'o-1', 'roi-1');

      expect(prisma.rentalOrderItem.delete).toHaveBeenCalledWith({ where: { id: 'roi-1' } });
    });
  });
});
