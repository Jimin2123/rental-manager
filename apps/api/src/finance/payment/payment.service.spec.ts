import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditAction, InvoiceSettlementStatus, InvoiceStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceDocumentSequenceService } from '../common/document-sequence.service';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: {
    $transaction: jest.Mock;
    payment: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; count: jest.Mock };
    paymentAllocation: { create: jest.Mock; findMany: jest.Mock; deleteMany: jest.Mock };
    invoice: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    customer: { findUnique: jest.Mock };
    depositAccount: { findFirst: jest.Mock };
  };
  let docSeq: { generateNo: jest.Mock };
  let auditLog: { log: jest.Mock };

  const mockInvoice = (overrides = {}) => ({
    id: 'inv-1',
    organizationId: 'org-1',
    status: InvoiceStatus.ISSUED,
    settlementStatus: InvoiceSettlementStatus.UNPAID,
    finalAmount: 110000,
    paidAmount: 0,
    refundedAmount: 0,
    outstandingAmount: 110000,
    dueDate: new Date('2026-07-01'),
    createdAt: new Date('2026-06-01'),
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      payment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      paymentAllocation: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      customer: { findUnique: jest.fn() },
      depositAccount: { findFirst: jest.fn() },
    };
    docSeq = { generateNo: jest.fn().mockResolvedValue('20260623-0001') };
    auditLog = { log: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: FinanceDocumentSequenceService, useValue: docSeq },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = module.get(PaymentService);
  });

  describe('create — FIFO 자동 배분', () => {
    it('고객 없으면 NotFoundException', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(
        service.create('org-1', 'mem-1', {
          customerId: 'c1',
          method: PaymentMethod.BANK_TRANSFER,
          amount: 50000,
          paidAt: '2026-06-23',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('미존재/타조직 depositAccountId면 NotFoundException', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1' });
      prisma.depositAccount.findFirst.mockResolvedValue(null);
      await expect(
        service.create('org-1', 'm-1', {
          customerId: 'c-1',
          method: 'BANK_TRANSFER',
          amount: 1000,
          paidAt: '2026-06-30T00:00:00.000Z',
          depositAccountId: 'bad',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('미수 Invoice 없으면 배분 없이 Payment만 생성', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.invoice.findMany.mockResolvedValue([]);
      const result = await service.create('org-1', 'mem-1', {
        customerId: 'cust-1',
        method: PaymentMethod.BANK_TRANSFER,
        amount: 100000,
        paidAt: '2026-06-23',
      });
      expect(result).toEqual({ id: 'pay-1' });
      expect(prisma.paymentAllocation.create).not.toHaveBeenCalled();
    });

    it('단일 Invoice 정확히 일치 → PAID', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.invoice.findMany.mockResolvedValue([mockInvoice()]);

      await service.create('org-1', 'mem-1', {
        customerId: 'cust-1',
        method: PaymentMethod.BANK_TRANSFER,
        amount: 110000,
        paidAt: '2026-06-23',
      });

      expect(prisma.paymentAllocation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 110000, invoiceId: 'inv-1' }) }),
      );
      // 정산필드는 DB 트리거가 재계산 — 서비스는 invoice.update 하지 않는다 (#114).
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('두 Invoice FIFO — 수납액이 첫 번째 청산 후 두 번째에 부분 배분', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.invoice.findMany.mockResolvedValue([
        mockInvoice({ id: 'inv-1', outstandingAmount: 50000, finalAmount: 50000 }),
        mockInvoice({ id: 'inv-2', outstandingAmount: 100000, finalAmount: 100000, dueDate: new Date('2026-08-01') }),
      ]);

      await service.create('org-1', 'mem-1', {
        customerId: 'cust-1',
        method: PaymentMethod.BANK_TRANSFER,
        amount: 80000,
        paidAt: '2026-06-23',
      });

      const calls = prisma.paymentAllocation.create.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][0].data).toMatchObject({ invoiceId: 'inv-1', amount: 50000 });
      expect(calls[1][0].data).toMatchObject({ invoiceId: 'inv-2', amount: 30000 });
    });
  });

  describe('cancel', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      prisma.payment.findUnique.mockResolvedValue(null);
      await expect(service.cancel('org-1', 'pay-1', 'mem-1')).rejects.toThrow(NotFoundException);
    });

    it('이미 CANCELED면 BadRequestException', async () => {
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', status: PaymentStatus.CANCELED });
      await expect(service.cancel('org-1', 'pay-1', 'mem-1')).rejects.toThrow(BadRequestException);
    });

    it('COMPLETED → CANCELED, 배분 삭제, Invoice 재계산', async () => {
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', status: PaymentStatus.COMPLETED });
      prisma.paymentAllocation.findMany.mockResolvedValue([{ invoiceId: 'inv-1', amount: 50000 }]);
      prisma.invoice.findUnique = jest
        .fn()
        .mockResolvedValue(mockInvoice({ paidAmount: 50000, outstandingAmount: 60000, finalAmount: 110000 }));

      await service.cancel('org-1', 'pay-1', 'mem-1');

      expect(prisma.paymentAllocation.deleteMany).toHaveBeenCalled();
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: PaymentStatus.CANCELED } }),
      );
    });

    it('Payment 취소 시 CANCEL 로그를 기록한다', async () => {
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', status: PaymentStatus.COMPLETED });
      prisma.paymentAllocation.findMany.mockResolvedValue([]);

      await service.cancel('org-1', 'pay-1', 'mem-1');

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AuditAction.CANCEL,
          targetType: 'Payment',
          targetId: 'pay-1',
          actorId: 'mem-1',
        }),
      );
    });
  });

  describe('create — 감사 로그', () => {
    it('Payment 생성 시 CREATE 로그를 기록한다', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1' });
      prisma.invoice.findMany.mockResolvedValue([]);

      await service.create('org-1', 'mem-1', {
        customerId: 'cust-1',
        method: PaymentMethod.BANK_TRANSFER,
        amount: 100000,
        paidAt: '2026-06-23',
      });

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organizationId: 'org-1',
          actorId: 'mem-1',
          action: AuditAction.CREATE,
          targetType: 'Payment',
          targetId: 'pay-1',
        }),
      );
    });
  });

  describe('findAll', () => {
    it('고객 표시명을 include 한다', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      await service.findAll('org-1', {});
      const arg = prisma.payment.findMany.mock.calls[0][0];
      expect(arg.include.customer.select).toEqual({
        id: true,
        individualProfile: { select: { name: true } },
        businessPartner: { select: { businessProfile: { select: { name: true } } } },
      });
    });
  });

  describe('findOne', () => {
    it('배분(invoice)과 고객 표시명을 include 한다', async () => {
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay-1' });
      await service.findOne('org-1', 'pay-1');
      const arg = prisma.payment.findUnique.mock.calls[0][0];
      expect(arg.include.allocations).toEqual({ include: { invoice: true } });
      expect(arg.include.customer.select).toEqual({
        id: true,
        individualProfile: { select: { name: true } },
        businessPartner: { select: { businessProfile: { select: { name: true } } } },
      });
    });
  });
});
