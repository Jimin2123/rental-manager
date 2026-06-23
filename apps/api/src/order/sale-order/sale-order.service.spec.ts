import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderStatus, OrderType, VatType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SaleOrderService } from './sale-order.service';

describe('SaleOrderService', () => {
  let service: SaleOrderService;
  let prisma: {
    order: { findUnique: jest.Mock };
    saleOrderItem: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
    asset: { findUnique: jest.Mock };
  };

  const mockOrder = (overrides = {}) => ({
    id: 'o-1',
    type: OrderType.SALE,
    status: OrderStatus.REGISTERED,
    saleOrder: { id: 'so-1' },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn() },
      saleOrderItem: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
      asset: { findUnique: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [SaleOrderService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(SaleOrderService);
  });

  describe('addItem', () => {
    it('throws NotFoundException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        service.addItem('org-1', 'o-x', { productId: 'p-1', quantity: 1, unitPrice: 1000, vatType: VatType.NONE }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when order type is RENTAL', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ type: OrderType.RENTAL }));
      await expect(
        service.addItem('org-1', 'o-1', { productId: 'p-1', quantity: 1, unitPrice: 1000, vatType: VatType.NONE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when order is DELIVERED', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ status: OrderStatus.DELIVERED }));
      await expect(
        service.addItem('org-1', 'o-1', { productId: 'p-1', quantity: 1, unitPrice: 1000, vatType: VatType.NONE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when assetId given but asset not in org', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder());
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(
        service.addItem('org-1', 'o-1', {
          productId: 'p-1',
          assetId: 'a-x',
          quantity: 1,
          unitPrice: 1000,
          vatType: VatType.NONE,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates item with calculated amounts, returns id', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder());
      prisma.saleOrderItem.create.mockResolvedValue({ id: 'soi-1' });

      const result = await service.addItem('org-1', 'o-1', {
        productId: 'p-1',
        quantity: 2,
        unitPrice: 11000,
        vatType: VatType.INCLUDED,
      });

      expect(prisma.saleOrderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ supplyAmount: 22000, vatAmount: 2200, totalAmount: 24200 }),
        }),
      );
      expect(result).toEqual({ id: 'soi-1' });
    });
  });

  describe('removeItem', () => {
    it('throws BadRequestException when order is CANCELED', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder({ status: OrderStatus.CANCELED }));
      await expect(service.removeItem('org-1', 'o-1', 'soi-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when item not in this order', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder());
      prisma.saleOrderItem.findFirst.mockResolvedValue(null);
      await expect(service.removeItem('org-1', 'o-1', 'soi-x')).rejects.toThrow(NotFoundException);
    });

    it('deletes item', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder());
      prisma.saleOrderItem.findFirst.mockResolvedValue({ id: 'soi-1' });
      prisma.saleOrderItem.delete.mockResolvedValue({});

      await service.removeItem('org-1', 'o-1', 'soi-1');

      expect(prisma.saleOrderItem.delete).toHaveBeenCalledWith({ where: { id: 'soi-1' } });
    });
  });
});
