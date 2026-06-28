import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QuotationStatus, QuotationType, VatType, OrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentSequenceService } from '../common/document-sequence.service';
import { QuotationService } from './quotation.service';

describe('QuotationService', () => {
  let service: QuotationService;
  let prisma: {
    $transaction: jest.Mock;
    customer: { findUnique: jest.Mock };
    quotation: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock; delete: jest.Mock };
    quotationItem: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
    order: { create: jest.Mock };
    saleOrder: { create: jest.Mock };
    saleOrderItem: { create: jest.Mock };
    rentalOrder: { create: jest.Mock };
    rentalOrderItem: { create: jest.Mock };
  };
  let docSeq: { generateNo: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      customer: { findUnique: jest.fn() },
      quotation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      quotationItem: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
      order: { create: jest.fn() },
      saleOrder: { create: jest.fn() },
      saleOrderItem: { create: jest.fn() },
      rentalOrder: { create: jest.fn() },
      rentalOrderItem: { create: jest.fn() },
    };
    docSeq = { generateNo: jest.fn().mockResolvedValue('20260623-0001') };

    const module = await Test.createTestingModule({
      providers: [
        QuotationService,
        { provide: PrismaService, useValue: prisma },
        { provide: DocumentSequenceService, useValue: docSeq },
      ],
    }).compile();
    service = module.get(QuotationService);
  });

  describe('create', () => {
    it('throws NotFoundException when customer not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(
        service.create('org-1', {
          type: QuotationType.SALE,
          customerId: 'c-x',
          items: [{ productId: 'p-1', quantity: 1, unitPrice: 1000, vatType: VatType.NONE }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates quotation and items in transaction, returns id', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1' });
      prisma.quotation.create.mockResolvedValue({ id: 'q-1' });
      prisma.quotationItem.create.mockResolvedValue({});

      const result = await service.create('org-1', {
        type: QuotationType.SALE,
        customerId: 'c-1',
        items: [{ productId: 'p-1', quantity: 2, unitPrice: 1000, vatType: VatType.NONE }],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(docSeq.generateNo).toHaveBeenCalledWith('org-1', 'QUOTATION', prisma);
      expect(prisma.quotation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', quotationNo: '20260623-0001' }),
        }),
      );
      expect(prisma.quotationItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ supplyAmount: 2000, vatAmount: 0, totalAmount: 2000 }),
        }),
      );
      expect(result).toEqual({ id: 'q-1' });
    });

    it('calculates INCLUDED vat amounts correctly', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1' });
      prisma.quotation.create.mockResolvedValue({ id: 'q-1' });
      prisma.quotationItem.create.mockResolvedValue({});

      await service.create('org-1', {
        type: QuotationType.SALE,
        customerId: 'c-1',
        items: [{ productId: 'p-1', quantity: 1, unitPrice: 11000, vatType: VatType.INCLUDED }],
      });

      expect(prisma.quotationItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ supplyAmount: 11000, vatAmount: 1100, totalAmount: 12100 }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundException when quotation not found', async () => {
      prisma.quotation.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus('org-1', 'q-x', { status: QuotationStatus.SENT })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows DRAFT → SENT and sets sentAt', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ id: 'q-1', status: QuotationStatus.DRAFT });
      prisma.quotation.update.mockResolvedValue({});

      await service.updateStatus('org-1', 'q-1', { status: QuotationStatus.SENT });

      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: QuotationStatus.SENT, sentAt: expect.any(Date) }),
        }),
      );
    });

    it('throws BadRequestException on invalid transition (ACCEPTED → SENT)', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ id: 'q-1', status: QuotationStatus.ACCEPTED });
      await expect(service.updateStatus('org-1', 'q-1', { status: QuotationStatus.SENT })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows SENT → ACCEPTED without sentAt', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ id: 'q-1', status: QuotationStatus.SENT });
      prisma.quotation.update.mockResolvedValue({});

      await service.updateStatus('org-1', 'q-1', { status: QuotationStatus.ACCEPTED });

      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: QuotationStatus.ACCEPTED }) }),
      );
      const callArg = prisma.quotation.update.mock.calls[0][0];
      expect(callArg.data.sentAt).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('throws BadRequestException when not DRAFT', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ id: 'q-1', status: QuotationStatus.SENT });
      await expect(service.remove('org-1', 'q-1')).rejects.toThrow(BadRequestException);
    });

    it('hard deletes DRAFT quotation', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ id: 'q-1', status: QuotationStatus.DRAFT });
      prisma.quotation.delete.mockResolvedValue({});

      await service.remove('org-1', 'q-1');

      expect(prisma.quotation.delete).toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('throws BadRequestException when quotation is ACCEPTED', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ id: 'q-1', status: QuotationStatus.ACCEPTED });
      await expect(
        service.addItem('org-1', 'q-1', { productId: 'p-1', quantity: 1, unitPrice: 1000, vatType: VatType.NONE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates item and returns id', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ id: 'q-1', status: QuotationStatus.DRAFT });
      prisma.quotationItem.create.mockResolvedValue({ id: 'qi-1' });

      const result = await service.addItem('org-1', 'q-1', {
        productId: 'p-1',
        quantity: 1,
        unitPrice: 1000,
        vatType: VatType.NONE,
      });

      expect(result).toEqual({ id: 'qi-1' });
    });
  });

  describe('removeItem', () => {
    it('throws BadRequestException when quotation is EXPIRED', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ id: 'q-1', status: QuotationStatus.EXPIRED });
      await expect(service.removeItem('org-1', 'q-1', 'qi-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when item not in this quotation', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ id: 'q-1', status: QuotationStatus.DRAFT });
      prisma.quotationItem.findFirst.mockResolvedValue(null);
      await expect(service.removeItem('org-1', 'q-1', 'qi-x')).rejects.toThrow(NotFoundException);
    });

    it('deletes item', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ id: 'q-1', status: QuotationStatus.DRAFT });
      prisma.quotationItem.findFirst.mockResolvedValue({ id: 'qi-1' });
      prisma.quotationItem.delete.mockResolvedValue({});

      await service.removeItem('org-1', 'q-1', 'qi-1');

      expect(prisma.quotationItem.delete).toHaveBeenCalled();
    });
  });

  describe('convert', () => {
    it('throws BadRequestException when status is DRAFT', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.DRAFT,
        convertedOrderId: null,
        items: [],
      });
      await expect(service.convert('org-1', 'q-1', {})).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when already converted', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.ACCEPTED,
        convertedOrderId: 'o-existing',
        items: [],
      });
      await expect(service.convert('org-1', 'q-1', {})).rejects.toThrow(ConflictException);
    });

    it('creates SALE order and items, updates quotation, returns orderId', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: 'q-1',
        status: QuotationStatus.SENT,
        convertedOrderId: null,
        customerId: 'c-1',
        type: OrderType.SALE,
        items: [
          {
            id: 'qi-1',
            productId: 'p-1',
            assetId: null,
            quantity: 1,
            unitPrice: 11000,
            vatType: VatType.INCLUDED,
            memo: null,
            monthlyRentalPrice: null,
          },
        ],
      });
      prisma.order.create.mockResolvedValue({ id: 'o-1' });
      prisma.saleOrder.create.mockResolvedValue({ id: 'so-1' });
      prisma.saleOrderItem.create.mockResolvedValue({});
      prisma.quotation.update.mockResolvedValue({});

      const result = await service.convert('org-1', 'q-1', {});

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(docSeq.generateNo).toHaveBeenCalledWith('org-1', 'ORDER', prisma);
      expect(prisma.saleOrder.create).toHaveBeenCalled();
      expect(prisma.saleOrderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ supplyAmount: 11000, vatAmount: 1100, totalAmount: 12100 }),
        }),
      );
      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: QuotationStatus.ACCEPTED, convertedOrderId: 'o-1' }),
        }),
      );
      expect(result).toEqual({ orderId: 'o-1' });
    });

    it('creates RENTAL order and items', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: 'q-2',
        status: QuotationStatus.SENT,
        convertedOrderId: null,
        customerId: 'c-1',
        type: OrderType.RENTAL,
        items: [{ id: 'qi-2', productId: 'p-1', assetId: null, monthlyRentalPrice: 50000, memo: null }],
      });
      prisma.order.create.mockResolvedValue({ id: 'o-2' });
      prisma.rentalOrder.create.mockResolvedValue({ id: 'ro-1' });
      prisma.rentalOrderItem.create.mockResolvedValue({});
      prisma.quotation.update.mockResolvedValue({});

      await service.convert('org-1', 'q-2', {});

      expect(prisma.rentalOrder.create).toHaveBeenCalled();
      expect(prisma.rentalOrderItem.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ monthlyRentalPrice: 50000 }) }),
      );
    });
  });

  describe('findAll', () => {
    it('includes customer/product 표시명', async () => {
      prisma.quotation.findMany.mockResolvedValue([]);
      await service.findAll('org-1', {});
      expect(prisma.quotation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            customer: expect.objectContaining({
              select: expect.objectContaining({
                id: true,
                individualProfile: { select: { name: true } },
                businessPartner: { select: { businessProfile: { select: { name: true } } } },
              }),
            }),
            items: { include: { product: { select: { name: true } } } },
          }),
        }),
      );
    });
  });

  describe('findOne include', () => {
    it('includes customer/product 표시명', async () => {
      prisma.quotation.findUnique.mockResolvedValue({ id: 'q-1' });
      await service.findOne('org-1', 'q-1');
      expect(prisma.quotation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            items: { include: { product: { select: { name: true } } } },
          }),
        }),
      );
    });
  });
});
