import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentSequenceType, InvoiceSettlementStatus, InvoiceStatus, InvoiceType, VatType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceDocumentSequenceService } from '../common/document-sequence.service';
import { InvoiceService } from './invoice.service';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: {
    $transaction: jest.Mock;
    invoice: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    invoiceItem: { create: jest.Mock; findFirst: jest.Mock; delete: jest.Mock };
    invoiceAdjustment: { create: jest.Mock };
    customer: { findUnique: jest.Mock };
  };
  let docSeq: { generateNo: jest.Mock };

  const mockInvoice = (overrides = {}) => ({
    id: 'inv-1',
    organizationId: 'org-1',
    invoiceNo: '20260623-0001',
    type: InvoiceType.SALE,
    status: InvoiceStatus.DRAFT,
    customerId: 'cust-1',
    finalAmount: 110000,
    paidAmount: 0,
    refundedAmount: 0,
    outstandingAmount: 110000,
    settlementStatus: InvoiceSettlementStatus.UNPAID,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      invoice: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      invoiceItem: { create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
      invoiceAdjustment: { create: jest.fn() },
      customer: { findUnique: jest.fn() },
    };
    docSeq = { generateNo: jest.fn().mockResolvedValue('20260623-0001') };

    const module = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: prisma },
        { provide: FinanceDocumentSequenceService, useValue: docSeq },
      ],
    }).compile();

    service = module.get(InvoiceService);
  });

  describe('create', () => {
    it('RENTAL_MONTHLY 타입은 수동 생성 불가', async () => {
      await expect(
        service.create('org-1', 'mem-1', { type: InvoiceType.RENTAL_MONTHLY, customerId: 'c1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('고객이 없으면 NotFoundException', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(
        service.create('org-1', 'mem-1', { type: InvoiceType.SALE, customerId: 'c1' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('정상 생성 → id 반환', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.invoice.create.mockResolvedValue({ id: 'inv-1' });
      const result = await service.create('org-1', 'mem-1', {
        type: InvoiceType.SALE,
        customerId: 'cust-1',
      });
      expect(result).toEqual({ id: 'inv-1' });
      expect(docSeq.generateNo).toHaveBeenCalledWith('org-1', DocumentSequenceType.INVOICE, prisma);
    });
  });

  describe('issue', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.issue('org-1', 'inv-1')).rejects.toThrow(NotFoundException);
    });

    it('DRAFT가 아니면 BadRequestException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.ISSUED }));
      await expect(service.issue('org-1', 'inv-1')).rejects.toThrow(BadRequestException);
    });

    it('DRAFT → ISSUED, issuedAt 설정', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.invoice.update.mockResolvedValue({});
      await service.issue('org-1', 'inv-1');
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: InvoiceStatus.ISSUED, issuedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('cancel', () => {
    it('ISSUED가 아니면 BadRequestException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.DRAFT }));
      await expect(service.cancel('org-1', 'inv-1')).rejects.toThrow(BadRequestException);
    });

    it('paidAmount > 0이면 BadRequestException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.ISSUED, paidAmount: 50000 }));
      await expect(service.cancel('org-1', 'inv-1')).rejects.toThrow(BadRequestException);
    });

    it('ISSUED + paidAmount=0 → CANCELED', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.ISSUED, paidAmount: 0 }));
      prisma.invoice.update.mockResolvedValue({});
      await service.cancel('org-1', 'inv-1');
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: InvoiceStatus.CANCELED } }),
      );
    });
  });

  describe('addItem', () => {
    it('DRAFT가 아니면 BadRequestException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.ISSUED }));
      await expect(
        service.addItem('org-1', 'inv-1', { type: 'RENTAL_FEE', quantity: 1, unitPrice: 100000 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('VatType.INCLUDED → supplyAmount*0.1 vatAmount 계산', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.invoiceItem.create.mockResolvedValue({ id: 'item-1' });
      await service.addItem('org-1', 'inv-1', {
        type: 'RENTAL_FEE',
        quantity: 1,
        unitPrice: 100000,
        vatType: VatType.INCLUDED,
      } as any);
      expect(prisma.invoiceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supplyAmount: 100000,
            vatAmount: 10000,
            totalAmount: 110000,
          }),
        }),
      );
    });
  });

  describe('removeItem', () => {
    it('DRAFT가 아니면 BadRequestException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.ISSUED }));
      prisma.invoiceItem.findFirst.mockResolvedValue({ id: 'item-1' });
      await expect(service.removeItem('org-1', 'inv-1', 'item-1')).rejects.toThrow(BadRequestException);
    });
  });
});
