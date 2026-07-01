import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuditAction,
  BillingType,
  DocumentSequenceType,
  InvoiceSettlementStatus,
  InvoiceStatus,
  InvoiceType,
  VatType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceDocumentSequenceService } from '../common/document-sequence.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
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
      count: jest.Mock;
    };
    invoiceItem: { create: jest.Mock; findFirst: jest.Mock; delete: jest.Mock };
    invoiceAdjustment: { create: jest.Mock };
    customer: { findUnique: jest.Mock };
    serviceRequest: { findUnique: jest.Mock };
    rentalContract: { findUnique: jest.Mock };
    meterReading: { updateMany: jest.Mock };
  };
  let docSeq: { generateNo: jest.Mock };
  let auditLog: { log: jest.Mock };

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
        count: jest.fn().mockResolvedValue(0),
      },
      invoiceItem: { create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
      invoiceAdjustment: { create: jest.fn() },
      rentalContract: { findUnique: jest.fn() },
      meterReading: { updateMany: jest.fn() },
      customer: { findUnique: jest.fn() },
      serviceRequest: { findUnique: jest.fn() },
    };
    docSeq = { generateNo: jest.fn().mockResolvedValue('20260623-0001') };
    auditLog = { log: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: prisma },
        { provide: FinanceDocumentSequenceService, useValue: docSeq },
        { provide: AuditLogService, useValue: auditLog },
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
      await expect(service.issue('org-1', 'inv-1', 'mem-1')).rejects.toThrow(NotFoundException);
    });

    it('DRAFT가 아니면 BadRequestException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.ISSUED }));
      await expect(service.issue('org-1', 'inv-1', 'mem-1')).rejects.toThrow(BadRequestException);
    });

    it('DRAFT → ISSUED, issuedAt 설정', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.invoice.update.mockResolvedValue({});
      await service.issue('org-1', 'inv-1', 'mem-1');
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: InvoiceStatus.ISSUED, issuedAt: expect.any(Date) }),
        }),
      );
    });

    it('DRAFT → ISSUED 시 STATUS_CHANGE 로그를 기록한다', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      prisma.invoice.update.mockResolvedValue({});

      await service.issue('org-1', 'inv-1', 'mem-1');

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organizationId: 'org-1',
          actorId: 'mem-1',
          action: AuditAction.STATUS_CHANGE,
          targetType: 'Invoice',
          targetId: 'inv-1',
          before: expect.objectContaining({ status: InvoiceStatus.DRAFT }),
          after: expect.objectContaining({ status: InvoiceStatus.ISSUED }),
        }),
      );
    });
  });

  describe('cancel', () => {
    it('ISSUED가 아니면 BadRequestException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.DRAFT }));
      await expect(service.cancel('org-1', 'inv-1', 'mem-1')).rejects.toThrow(BadRequestException);
    });

    it('paidAmount > 0이면 BadRequestException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.ISSUED, paidAmount: 50000 }));
      await expect(service.cancel('org-1', 'inv-1', 'mem-1')).rejects.toThrow(BadRequestException);
    });

    it('ISSUED + paidAmount=0 → CANCELED', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.ISSUED, paidAmount: 0 }));
      prisma.invoice.update.mockResolvedValue({});
      await service.cancel('org-1', 'inv-1', 'mem-1');
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: InvoiceStatus.CANCELED } }),
      );
    });

    it('ISSUED → CANCELED 시 CANCEL 로그를 기록한다', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice({ status: InvoiceStatus.ISSUED, paidAmount: 0 }));
      prisma.invoice.update.mockResolvedValue({});

      await service.cancel('org-1', 'inv-1', 'mem-1');

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AuditAction.CANCEL,
          targetType: 'Invoice',
          targetId: 'inv-1',
          actorId: 'mem-1',
        }),
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

  describe('createServiceFeeInvoice', () => {
    it('throws NotFoundException when service request not found', async () => {
      prisma.serviceRequest = { findUnique: jest.fn().mockResolvedValue(null) };
      await expect(
        service.createServiceFeeInvoice(
          'org-1',
          'sr-x',
          { laborCost: 50000, partsCost: 30000, travelCost: 20000 },
          'member-1',
          prisma as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates SERVICE_FEE invoice with item for sum of costs', async () => {
      prisma.serviceRequest = {
        findUnique: jest.fn().mockResolvedValue({ customerId: 'cust-1' }),
      };
      prisma.invoice.create.mockResolvedValue({ id: 'inv-sf-1' });
      prisma.invoiceItem.create.mockResolvedValue({});

      const result = await service.createServiceFeeInvoice(
        'org-1',
        'sr-1',
        { laborCost: 50000, partsCost: 30000, travelCost: 20000 },
        'member-1',
        prisma as any,
      );

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'SERVICE_FEE',
            customerId: 'cust-1',
            serviceRequestId: 'sr-1',
            createdById: 'member-1',
          }),
        }),
      );
      expect(prisma.invoiceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'SERVICE_FEE',
            unitPrice: 100000,
          }),
        }),
      );
      expect(result).toEqual({ id: 'inv-sf-1' });
    });
  });

  describe('createRentalMonthlyInvoice', () => {
    const mockContract = {
      id: 'contract-1',
      organizationId: 'org-1',
      rentalOrder: { order: { customerId: 'cust-1' } },
    };

    beforeEach(() => {
      prisma.rentalContract.findUnique.mockResolvedValue(mockContract);
      prisma.invoice.create.mockResolvedValue({ id: 'inv-monthly-1' });
      prisma.invoiceItem.create.mockResolvedValue({ id: 'item-1' });
    });

    it('FIXED 항목은 RENTAL_FEE 항목 하나를 생성한다', async () => {
      await service.createRentalMonthlyInvoice('org-1', 'contract-1', '2026-06', [
        { id: 'item-1', monthlyRentalPrice: 100000, billingType: BillingType.FIXED },
      ]);

      expect(prisma.invoiceItem.create).toHaveBeenCalledTimes(1);
      expect(prisma.invoiceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'RENTAL_FEE', unitPrice: 100000 }) }),
      );
    });

    it('METER 항목에서 초과분 없으면 METER_USAGE 항목을 생성하지 않는다', async () => {
      await service.createRentalMonthlyInvoice('org-1', 'contract-1', '2026-06', [
        {
          id: 'item-2',
          monthlyRentalPrice: 50000,
          billingType: BillingType.METER,
          freeBlackCount: 1000,
          blackUnitPrice: 10,
          freeColorCount: null,
          colorUnitPrice: null,
          meterReadings: [{ id: 'mr-1', blackUsage: 800, colorUsage: null }],
        },
      ]);

      const calls = prisma.invoiceItem.create.mock.calls;
      const types = calls.map((c: [{ data: { type: string } }]) => c[0].data.type);
      expect(types).toContain('RENTAL_FEE');
      expect(types).not.toContain('METER_USAGE');
    });

    it('METER 항목에서 초과분 있으면 METER_USAGE 항목을 생성하고 MeterReading을 연결한다', async () => {
      await service.createRentalMonthlyInvoice('org-1', 'contract-1', '2026-06', [
        {
          id: 'item-3',
          monthlyRentalPrice: 0,
          billingType: BillingType.METER,
          freeBlackCount: 1000,
          blackUnitPrice: 10,
          freeColorCount: null,
          colorUnitPrice: null,
          meterReadings: [{ id: 'mr-2', blackUsage: 1500, colorUsage: null }],
        },
      ]);

      expect(prisma.invoiceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'METER_USAGE', unitPrice: 5000 }) }),
      );
      expect(prisma.meterReading.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['mr-2'] } } }),
      );
    });

    it('METER 항목에서 당월 검침이 없으면 기본료만 생성한다', async () => {
      await service.createRentalMonthlyInvoice('org-1', 'contract-1', '2026-06', [
        {
          id: 'item-4',
          monthlyRentalPrice: 50000,
          billingType: BillingType.METER,
          freeBlackCount: 1000,
          blackUnitPrice: 10,
          freeColorCount: null,
          colorUnitPrice: null,
          meterReadings: [],
        },
      ]);

      expect(prisma.invoiceItem.create).toHaveBeenCalledTimes(1);
      expect(prisma.invoiceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'RENTAL_FEE' }) }),
      );
    });

    it('계약이 없으면 null을 반환한다', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(null);
      const result = await service.createRentalMonthlyInvoice('org-1', 'no-contract', '2026-06', []);
      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('고객 표시명(individualProfile/businessPartner)을 include 한다', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);
      await service.findAll('org-1', {});
      const arg = prisma.invoice.findMany.mock.calls[0][0];
      expect(arg.include.customer.select).toEqual({
        id: true,
        individualProfile: { select: { name: true } },
        businessPartner: { select: { businessProfile: { select: { name: true } } } },
      });
    });

    it('전달된 필터를 where 절에 반영한다', async () => {
      prisma.invoice.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { status: InvoiceStatus.ISSUED, type: InvoiceType.SALE });
      const arg = prisma.invoice.findMany.mock.calls[0][0];
      expect(arg.where).toMatchObject({
        organizationId: 'org-1',
        status: InvoiceStatus.ISSUED,
        type: InvoiceType.SALE,
      });
    });
  });

  describe('findOne', () => {
    it('항목/조정/수납과 함께 고객 표시명을 include 한다', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      await service.findOne('org-1', 'inv-1');
      const arg = prisma.invoice.findUnique.mock.calls[0][0];
      expect(arg.include.customer.select).toEqual({
        id: true,
        individualProfile: { select: { name: true } },
        businessPartner: { select: { businessProfile: { select: { name: true } } } },
      });
      expect(arg.include.items).toBe(true);
      expect(arg.include.adjustments).toBe(true);
      expect(arg.include.allocations).toEqual({ include: { payment: true } });
    });

    it('세금계산서(taxInvoice)를 include 한다', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice());
      await service.findOne('org-1', 'inv-1');
      const arg = prisma.invoice.findUnique.mock.calls[0][0];
      expect(arg.include.taxInvoice).toEqual({ select: { id: true, taxInvoiceNo: true, status: true } });
    });

    it('존재하지 않으면 NotFoundException', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.findOne('org-1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createForSaleOrder', () => {
    const saleItems = [
      {
        id: 'si-1',
        quantity: 1,
        unitPrice: 110000,
        vatType: VatType.INCLUDED,
        supplyAmount: 100000,
        vatAmount: 10000,
        totalAmount: 110000,
        product: { name: '복합기' },
      },
    ];

    it('SALE 청구서와 품목을 트랜잭션 안에서 생성한다', async () => {
      prisma.invoice.create.mockResolvedValue({ id: 'inv-1' });
      prisma.invoiceItem.create.mockResolvedValue({});

      await service.createForSaleOrder('org-1', 'c-1', 'so-1', saleItems, prisma as any);

      expect(docSeq.generateNo).toHaveBeenCalledWith('org-1', DocumentSequenceType.INVOICE, prisma);
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            type: InvoiceType.SALE,
            customerId: 'c-1',
            saleOrderId: 'so-1',
          }),
        }),
      );
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: InvoiceStatus.ISSUED, issuedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.invoiceItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceId: 'inv-1',
            saleOrderItemId: 'si-1',
            quantity: 1,
            unitPrice: 110000,
            totalAmount: 110000,
            description: '복합기',
          }),
        }),
      );
    });

    it('품목이 여러 개면 각각 InvoiceItem을 생성한다', async () => {
      const multiItems = [
        { ...saleItems[0] },
        { ...saleItems[0], id: 'si-2', product: { name: '토너' } },
      ];
      prisma.invoice.create.mockResolvedValue({ id: 'inv-2' });
      prisma.invoiceItem.create.mockResolvedValue({});

      await service.createForSaleOrder('org-1', 'c-1', 'so-1', multiItems, prisma as any);

      expect(prisma.invoiceItem.create).toHaveBeenCalledTimes(2);
    });
  });
});
