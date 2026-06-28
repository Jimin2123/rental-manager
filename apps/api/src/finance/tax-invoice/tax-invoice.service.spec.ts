import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentSequenceType, InvoiceStatus, TaxInvoiceStatus, VatType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceDocumentSequenceService } from '../common/document-sequence.service';
import { TaxInvoiceService } from './tax-invoice.service';

describe('TaxInvoiceService', () => {
  let service: TaxInvoiceService;
  let prisma: {
    $transaction: jest.Mock;
    taxInvoice: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    invoice: { findUnique: jest.Mock };
    customer: { findUnique: jest.Mock };
  };
  let docSeq: { generateNo: jest.Mock };

  const mockInvoice = (overrides = {}) => ({
    id: 'inv-1',
    organizationId: 'org-1',
    status: InvoiceStatus.ISSUED,
    customerId: 'cust-1',
    finalAmount: 110000,
    taxInvoice: null,
    items: [{ supplyAmount: 100000, vatAmount: 10000, totalAmount: 110000, vatType: VatType.INCLUDED }],
    ...overrides,
  });

  const mockCustomer = () => ({
    id: 'cust-1',
    businessPartner: {
      businessProfile: {
        businessRegistrationNo: '123-45-67890',
        name: '(주)테스트',
        representativeName: '홍길동',
        email: 'test@example.com',
      },
    },
  });

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      taxInvoice: {
        create: jest.fn().mockResolvedValue({ id: 'ti-1' }),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      invoice: { findUnique: jest.fn() },
      customer: { findUnique: jest.fn() },
    };
    docSeq = { generateNo: jest.fn().mockResolvedValue('20260623-0001') };

    const module = await Test.createTestingModule({
      providers: [
        TaxInvoiceService,
        { provide: PrismaService, useValue: prisma },
        { provide: FinanceDocumentSequenceService, useValue: docSeq },
      ],
    }).compile();

    service = module.get(TaxInvoiceService);
  });

  describe('create', () => {
    it('Invoice가 ISSUED가 아니면 BadRequestException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.DRAFT }));
      await expect(service.create('org-1', 'mem-1', { invoiceId: 'inv-1', issueDate: '2026-06-23' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('이미 TaxInvoice가 있으면 ConflictException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ taxInvoice: { id: 'ti-existing' } }));
      await expect(service.create('org-1', 'mem-1', { invoiceId: 'inv-1', issueDate: '2026-06-23' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('정상 발행 — InvoiceItem 합산으로 금액 계산', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.customer.findUnique.mockResolvedValue(mockCustomer());

      const result = await service.create('org-1', 'mem-1', { invoiceId: 'inv-1', issueDate: '2026-06-23' });

      expect(result).toEqual({ id: 'ti-1' });
      expect(prisma.taxInvoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            supplyAmount: 100000,
            vatAmount: 10000,
            totalAmount: 110000,
            buyerBusinessNo: '123-45-67890',
          }),
        }),
      );
      expect(docSeq.generateNo).toHaveBeenCalledWith('org-1', DocumentSequenceType.TAX_INVOICE, prisma);
    });
  });

  describe('cancel', () => {
    it('ISSUED가 아니면 BadRequestException', async () => {
      prisma.taxInvoice.findUnique.mockResolvedValue({
        id: 'ti-1',
        status: TaxInvoiceStatus.DRAFT,
        organizationId: 'org-1',
      });
      await expect(service.cancel('org-1', 'ti-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('고객 표시명을 include 한다', async () => {
      prisma.taxInvoice.findMany.mockResolvedValue([]);
      await service.findAll('org-1', {});
      const arg = prisma.taxInvoice.findMany.mock.calls[0][0];
      expect(arg.include.customer.select).toEqual({
        id: true,
        individualProfile: { select: { name: true } },
        businessPartner: { select: { businessProfile: { select: { name: true } } } },
      });
    });
  });

  describe('findOne', () => {
    it('청구서/수정본과 고객 표시명을 include 한다', async () => {
      prisma.taxInvoice.findUnique.mockResolvedValue({ id: 'tax-1' });
      await service.findOne('org-1', 'tax-1');
      const arg = prisma.taxInvoice.findUnique.mock.calls[0][0];
      expect(arg.include.invoice).toEqual({ select: { id: true, invoiceNo: true } });
      expect(arg.include.amendments).toEqual({ select: { id: true, taxInvoiceNo: true, status: true } });
      expect(arg.include.customer.select).toEqual({
        id: true,
        individualProfile: { select: { name: true } },
        businessPartner: { select: { businessProfile: { select: { name: true } } } },
      });
    });
  });
});
