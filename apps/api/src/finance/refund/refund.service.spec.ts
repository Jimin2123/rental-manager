import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  DocumentSequenceType,
  InvoiceSettlementStatus,
  RefundReason,
  RefundStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceDocumentSequenceService } from '../common/document-sequence.service';
import { RefundService } from './refund.service';

describe('RefundService', () => {
  let service: RefundService;
  let prisma: {
    $transaction: jest.Mock;
    refund: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    invoice: { findUnique: jest.Mock; update: jest.Mock };
    customer: { findUnique: jest.Mock };
  };
  let docSeq: { generateNo: jest.Mock };

  const mockInvoice = (overrides = {}) => ({
    id: 'inv-1',
    organizationId: 'org-1',
    finalAmount: 110000,
    paidAmount: 110000,
    refundedAmount: 0,
    outstandingAmount: 0,
    settlementStatus: InvoiceSettlementStatus.PAID,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      refund: {
        create: jest.fn().mockResolvedValue({ id: 'ref-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      customer: { findUnique: jest.fn() },
    };
    docSeq = { generateNo: jest.fn().mockResolvedValue('20260623-0001') };

    const module = await Test.createTestingModule({
      providers: [
        RefundService,
        { provide: PrismaService, useValue: prisma },
        { provide: FinanceDocumentSequenceService, useValue: docSeq },
      ],
    }).compile();

    service = module.get(RefundService);
  });

  describe('create', () => {
    it('고객 없으면 NotFoundException', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(
        service.create('org-1', 'mem-1', { customerId: 'c1', reason: RefundReason.OVERPAYMENT, amount: 1000 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('invoiceId 지정 시 paidAmount 초과 환불 불가', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ paidAmount: 50000 }));
      await expect(
        service.create('org-1', 'mem-1', {
          customerId: 'cust-1', invoiceId: 'inv-1', reason: RefundReason.BILLING_ERROR, amount: 60000,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('invoiceId 지정 → Invoice refundedAmount 업데이트', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());

      await service.create('org-1', 'mem-1', {
        customerId: 'cust-1', invoiceId: 'inv-1', reason: RefundReason.BILLING_ERROR, amount: 50000,
      } as any);

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ refundedAmount: 50000 }),
        }),
      );
      expect(docSeq.generateNo).toHaveBeenCalledWith('org-1', DocumentSequenceType.REFUND, prisma);
    });
  });

  describe('cancel', () => {
    it('PENDING이 아니면 BadRequestException', async () => {
      prisma.refund.findUnique.mockResolvedValue({
        id: 'ref-1', status: RefundStatus.COMPLETED, invoiceId: null,
      });
      await expect(service.cancel('org-1', 'ref-1')).rejects.toThrow(BadRequestException);
    });

    it('PENDING 취소 시 Invoice 금액 원복', async () => {
      prisma.refund.findUnique.mockResolvedValue({
        id: 'ref-1', status: RefundStatus.PENDING, invoiceId: 'inv-1', amount: 50000,
      });
      prisma.invoice.findUnique.mockResolvedValue(
        mockInvoice({ refundedAmount: 50000, outstandingAmount: 50000, settlementStatus: InvoiceSettlementStatus.PARTIALLY_PAID }),
      );

      await service.cancel('org-1', 'ref-1');

      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ refundedAmount: 0 }),
        }),
      );
      expect(prisma.refund.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: RefundStatus.CANCELED } }),
      );
    });
  });
});
