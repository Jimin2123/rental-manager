import { Test } from '@nestjs/testing';
import { BillingTiming, BillingType, RentalContractItemStatus, RentalContractStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';
import { InvoiceGenerationCron } from './invoice-generation.cron';

const makeContract = (overrides: Record<string, unknown> = {}) => ({
  id: 'contract-1',
  organizationId: 'org-1',
  billingDay: 1,
  paymentDueDay: 25,
  billingTiming: BillingTiming.PREPAID,
  items: [{ id: 'item-1', monthlyRentalPrice: 100000, billingType: BillingType.FIXED }],
  ...overrides,
});

describe('InvoiceGenerationCron', () => {
  let cron: InvoiceGenerationCron;
  let prisma: {
    rentalContract: { findMany: jest.Mock };
    invoice: { findFirst: jest.Mock };
    meterReading: { findMany: jest.Mock };
  };
  let invoiceService: { createRentalMonthlyInvoice: jest.Mock };

  beforeEach(async () => {
    prisma = {
      rentalContract: { findMany: jest.fn() },
      invoice: { findFirst: jest.fn().mockResolvedValue(null) },
      meterReading: { findMany: jest.fn().mockResolvedValue([]) },
    };
    invoiceService = { createRentalMonthlyInvoice: jest.fn().mockResolvedValue({ id: 'inv-1' }) };

    const module = await Test.createTestingModule({
      providers: [
        InvoiceGenerationCron,
        { provide: PrismaService, useValue: prisma },
        { provide: InvoiceService, useValue: invoiceService },
      ],
    }).compile();

    cron = module.get(InvoiceGenerationCron);
  });

  // KST 특정 날짜를 가리키는 UTC Date를 반환
  const kstDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d) - 9 * 60 * 60 * 1000);

  describe('billingDay 필터링', () => {
    it('billingDay가 오늘과 같은 계약만 처리한다', async () => {
      jest.useFakeTimers().setSystemTime(kstDate(2026, 6, 15));

      prisma.rentalContract.findMany.mockResolvedValue([
        makeContract({ billingDay: 15 }),
        makeContract({ id: 'contract-2', billingDay: 1 }),
      ]);

      await cron.generateMonthlyInvoices();

      expect(invoiceService.createRentalMonthlyInvoice).toHaveBeenCalledTimes(1);
      expect(invoiceService.createRentalMonthlyInvoice).toHaveBeenCalledWith(
        'org-1',
        'contract-1',
        expect.any(String),
        expect.any(Array),
        expect.anything(),
      );

      jest.useRealTimers();
    });

    it('billingDay가 null이면 1일 기본으로 처리한다', async () => {
      jest.useFakeTimers().setSystemTime(kstDate(2026, 6, 1));

      prisma.rentalContract.findMany.mockResolvedValue([makeContract({ billingDay: null })]);

      await cron.generateMonthlyInvoices();

      expect(invoiceService.createRentalMonthlyInvoice).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('오늘이 billingDay가 아닌 계약은 건너뛴다', async () => {
      jest.useFakeTimers().setSystemTime(kstDate(2026, 6, 10));

      prisma.rentalContract.findMany.mockResolvedValue([makeContract({ billingDay: 15 })]);

      await cron.generateMonthlyInvoices();

      expect(invoiceService.createRentalMonthlyInvoice).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('billingMonth 계산', () => {
    it('PREPAID는 당월을 billingMonth로 사용한다', async () => {
      jest.useFakeTimers().setSystemTime(kstDate(2026, 6, 1));

      prisma.rentalContract.findMany.mockResolvedValue([
        makeContract({ billingDay: 1, billingTiming: BillingTiming.PREPAID }),
      ]);

      await cron.generateMonthlyInvoices();

      expect(invoiceService.createRentalMonthlyInvoice).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        '2026-06',
        expect.any(Array),
        expect.anything(),
      );

      jest.useRealTimers();
    });

    it('POSTPAID는 전월을 billingMonth로 사용한다', async () => {
      jest.useFakeTimers().setSystemTime(kstDate(2026, 6, 1));

      prisma.rentalContract.findMany.mockResolvedValue([
        makeContract({ billingDay: 1, billingTiming: BillingTiming.POSTPAID }),
      ]);

      await cron.generateMonthlyInvoices();

      expect(invoiceService.createRentalMonthlyInvoice).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        '2026-05',
        expect.any(Array),
        expect.anything(),
      );

      jest.useRealTimers();
    });
  });

  describe('dueDate 계산', () => {
    it('paymentDueDay가 billingDay보다 크면 같은 달로 설정한다', async () => {
      jest.useFakeTimers().setSystemTime(kstDate(2026, 6, 15));

      prisma.rentalContract.findMany.mockResolvedValue([
        makeContract({ billingDay: 15, paymentDueDay: 25 }),
      ]);

      await cron.generateMonthlyInvoices();

      const callArgs = invoiceService.createRentalMonthlyInvoice.mock.calls[0];
      const dueDate: Date = callArgs[4];
      expect(dueDate.getFullYear()).toBe(2026);
      expect(dueDate.getMonth()).toBe(5); // 0-indexed → June
      expect(dueDate.getDate()).toBe(25);

      jest.useRealTimers();
    });

    it('paymentDueDay가 billingDay보다 작으면 다음 달로 설정한다', async () => {
      jest.useFakeTimers().setSystemTime(kstDate(2026, 6, 25));

      prisma.rentalContract.findMany.mockResolvedValue([
        makeContract({ billingDay: 25, paymentDueDay: 5 }),
      ]);

      await cron.generateMonthlyInvoices();

      const callArgs = invoiceService.createRentalMonthlyInvoice.mock.calls[0];
      const dueDate: Date = callArgs[4];
      expect(dueDate.getFullYear()).toBe(2026);
      expect(dueDate.getMonth()).toBe(6); // 0-indexed → July
      expect(dueDate.getDate()).toBe(5);

      jest.useRealTimers();
    });

    it('paymentDueDay가 null이면 dueDate를 설정하지 않는다', async () => {
      jest.useFakeTimers().setSystemTime(kstDate(2026, 6, 1));

      prisma.rentalContract.findMany.mockResolvedValue([
        makeContract({ billingDay: 1, paymentDueDay: null }),
      ]);

      await cron.generateMonthlyInvoices();

      const callArgs = invoiceService.createRentalMonthlyInvoice.mock.calls[0];
      expect(callArgs[4]).toBeUndefined();

      jest.useRealTimers();
    });
  });

  describe('중복 방지', () => {
    it('이미 청구서가 존재하면 생성하지 않는다', async () => {
      jest.useFakeTimers().setSystemTime(kstDate(2026, 6, 1));

      prisma.rentalContract.findMany.mockResolvedValue([makeContract()]);
      prisma.invoice.findFirst.mockResolvedValue({ id: 'existing-inv' });

      await cron.generateMonthlyInvoices();

      expect(invoiceService.createRentalMonthlyInvoice).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('METER 항목 처리', () => {
    it('METER 항목의 검침 데이터를 billingMonth로 조회하여 전달한다', async () => {
      jest.useFakeTimers().setSystemTime(kstDate(2026, 6, 1));

      prisma.rentalContract.findMany.mockResolvedValue([
        makeContract({
          items: [
            {
              id: 'meter-item-1',
              monthlyRentalPrice: 0,
              billingType: BillingType.METER,
              freeBlackCount: 1000,
              blackUnitPrice: 10,
              freeColorCount: null,
              colorUnitPrice: null,
            },
          ],
        }),
      ]);
      prisma.meterReading.findMany.mockResolvedValue([
        { id: 'mr-1', rentalContractItemId: 'meter-item-1', blackUsage: 1500, colorUsage: null },
      ]);

      await cron.generateMonthlyInvoices();

      expect(prisma.meterReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ billingMonth: '2026-06' }),
        }),
      );

      const contractItems = invoiceService.createRentalMonthlyInvoice.mock.calls[0][3];
      expect(contractItems[0]).toMatchObject({
        billingType: 'METER',
        meterReadings: [{ id: 'mr-1', blackUsage: 1500 }],
      });

      jest.useRealTimers();
    });
  });
});
