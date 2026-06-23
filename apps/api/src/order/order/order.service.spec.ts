import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderStatus, OrderType, VatType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentSequenceService } from '../common/document-sequence.service';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let prisma: {
    $transaction: jest.Mock;
    customer: { findUnique: jest.Mock };
    order: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock; delete: jest.Mock };
    saleOrder: { create: jest.Mock; delete: jest.Mock };
    saleOrderItem: { create: jest.Mock; deleteMany: jest.Mock };
    rentalOrder: { create: jest.Mock; delete: jest.Mock };
    rentalOrderItem: { create: jest.Mock; deleteMany: jest.Mock };
  };
  let docSeq: { generateNo: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      customer: { findUnique: jest.fn() },
      order: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
      saleOrder: { create: jest.fn(), delete: jest.fn() },
      saleOrderItem: { create: jest.fn(), deleteMany: jest.fn() },
      rentalOrder: { create: jest.fn(), delete: jest.fn() },
      rentalOrderItem: { create: jest.fn(), deleteMany: jest.fn() },
    };
    docSeq = { generateNo: jest.fn().mockResolvedValue('20260623-0001') };

    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: prisma },
        { provide: DocumentSequenceService, useValue: docSeq },
      ],
    }).compile();
    service = module.get(OrderService);
  });

  describe('create', () => {
    it('throws NotFoundException when customer not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.create('org-1', { type: OrderType.SALE, customerId: 'c-x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates SALE order with items in transaction', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1' });
      prisma.order.create.mockResolvedValue({ id: 'o-1' });
      prisma.saleOrder.create.mockResolvedValue({ id: 'so-1' });
      prisma.saleOrderItem.create.mockResolvedValue({});

      const result = await service.create('org-1', {
        type: OrderType.SALE,
        customerId: 'c-1',
        saleOrder: { items: [{ productId: 'p-1', quantity: 1, unitPrice: 11000, vatType: VatType.INCLUDED }] },
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(docSeq.generateNo).toHaveBeenCalledWith('org-1', 'ORDER', prisma);
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: OrderType.SALE, status: OrderStatus.REGISTERED }),
        }),
      );
      expect(prisma.saleOrder.create).toHaveBeenCalled();
      expect(prisma.saleOrderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ supplyAmount: 11000, vatAmount: 1100, totalAmount: 12100 }),
        }),
      );
      expect(result).toEqual({ orderId: 'o-1' });
    });

    it('creates RENTAL order with items', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1' });
      prisma.order.create.mockResolvedValue({ id: 'o-2' });
      prisma.rentalOrder.create.mockResolvedValue({ id: 'ro-1' });
      prisma.rentalOrderItem.create.mockResolvedValue({});

      const result = await service.create('org-1', {
        type: OrderType.RENTAL,
        customerId: 'c-1',
        rentalOrder: { items: [{ productId: 'p-1', monthlyRentalPrice: 50000 }] },
      });

      expect(prisma.rentalOrder.create).toHaveBeenCalled();
      expect(prisma.rentalOrderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ monthlyRentalPrice: 50000 }) }),
      );
      expect(result).toEqual({ orderId: 'o-2' });
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundException when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus('org-1', 'o-x', { status: OrderStatus.CONFIRMED })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows REGISTERED → CONFIRMED', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o-1', status: OrderStatus.REGISTERED });
      prisma.order.update.mockResolvedValue({});

      await service.updateStatus('org-1', 'o-1', { status: OrderStatus.CONFIRMED });

      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: OrderStatus.CONFIRMED } }),
      );
    });

    it('throws BadRequestException on invalid transition (DELIVERED → CONFIRMED)', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o-1', status: OrderStatus.DELIVERED });
      await expect(service.updateStatus('org-1', 'o-1', { status: OrderStatus.CONFIRMED })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('throws BadRequestException when not REGISTERED', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: OrderStatus.CONFIRMED,
        type: OrderType.SALE,
        saleOrder: { id: 'so-1' },
        rentalOrder: null,
      });
      await expect(service.remove('org-1', 'o-1')).rejects.toThrow(BadRequestException);
    });

    it('hard deletes SALE order and related records', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o-1',
        status: OrderStatus.REGISTERED,
        type: OrderType.SALE,
        saleOrder: { id: 'so-1' },
        rentalOrder: null,
      });
      prisma.saleOrderItem.deleteMany.mockResolvedValue({});
      prisma.saleOrder.delete.mockResolvedValue({});
      prisma.order.delete.mockResolvedValue({});

      await service.remove('org-1', 'o-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.saleOrderItem.deleteMany).toHaveBeenCalledWith({ where: { saleOrderId: 'so-1' } });
      expect(prisma.saleOrder.delete).toHaveBeenCalled();
      expect(prisma.order.delete).toHaveBeenCalled();
    });
  });
});
