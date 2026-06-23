import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingTiming, BillingType, RentalContractItemStatus, RentalContractStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService, type ContractItemInput } from '../invoice/invoice.service';

@Injectable()
export class InvoiceGenerationCron {
  private readonly logger = new Logger(InvoiceGenerationCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  // 매일 자정(KST) 실행 — billingDay가 오늘 날짜인 계약만 처리
  @Cron('0 0 * * *')
  async generateMonthlyInvoices() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = kst.getDate();

    this.logger.log(`[InvoiceGenerationCron] 실행 — KST ${kst.toISOString().slice(0, 10)}, billingDay=${today}`);

    const contracts = await this.prisma.rentalContract.findMany({
      where: { status: RentalContractStatus.ACTIVE },
      select: {
        id: true,
        organizationId: true,
        billingDay: true,
        paymentDueDay: true,
        billingTiming: true,
        items: {
          where: { status: RentalContractItemStatus.ACTIVE },
          select: {
            id: true,
            monthlyRentalPrice: true,
            billingType: true,
            freeBlackCount: true,
            blackUnitPrice: true,
            freeColorCount: true,
            colorUnitPrice: true,
          },
        },
      },
    });

    // billingDay가 오늘인 계약만 필터 (null이면 1일 기본)
    const todayContracts = contracts.filter((c) => (c.billingDay ?? 1) === today);

    this.logger.log(`[InvoiceGenerationCron] 대상 계약 ${todayContracts.length}건`);

    let success = 0;
    let skip = 0;
    let fail = 0;

    for (const contract of todayContracts) {
      try {
        const billingMonth = calculateBillingMonth(kst, contract.billingTiming);
        const dueDate = calculateDueDate(kst, today, contract.paymentDueDay);

        const existing = await this.prisma.invoice.findFirst({
          where: {
            organizationId: contract.organizationId,
            rentalContractId: contract.id,
            billingMonth,
            type: 'RENTAL_MONTHLY',
          },
        });

        if (existing) {
          skip++;
          continue;
        }

        // 검침 데이터는 METER 항목에 대해서만 조회
        const meterItemIds = contract.items.filter((i) => i.billingType === BillingType.METER).map((i) => i.id);

        const meterReadingsMap = new Map<
          string,
          Array<{ id: string; blackUsage: number; colorUsage: number | null }>
        >();

        if (meterItemIds.length > 0) {
          const readings = await this.prisma.meterReading.findMany({
            where: {
              rentalContractItemId: { in: meterItemIds },
              billingMonth,
              deletedAt: null,
              invoiceItemId: null,
            },
            select: { id: true, rentalContractItemId: true, blackUsage: true, colorUsage: true },
          });
          for (const r of readings) {
            if (!r.rentalContractItemId) continue;
            const list = meterReadingsMap.get(r.rentalContractItemId) ?? [];
            list.push({ id: r.id, blackUsage: r.blackUsage, colorUsage: r.colorUsage });
            meterReadingsMap.set(r.rentalContractItemId, list);
          }
        }

        const contractItems: ContractItemInput[] = contract.items.map((item) => {
          if (item.billingType === BillingType.METER) {
            return {
              id: item.id,
              monthlyRentalPrice: item.monthlyRentalPrice,
              billingType: 'METER',
              freeBlackCount: item.freeBlackCount,
              blackUnitPrice: item.blackUnitPrice,
              freeColorCount: item.freeColorCount,
              colorUnitPrice: item.colorUnitPrice,
              meterReadings: meterReadingsMap.get(item.id) ?? [],
            };
          }
          return {
            id: item.id,
            monthlyRentalPrice: item.monthlyRentalPrice,
            billingType: 'FIXED',
          };
        });

        const result = await this.invoiceService.createRentalMonthlyInvoice(
          contract.organizationId,
          contract.id,
          billingMonth,
          contractItems,
          dueDate,
        );

        if (result) success++;
      } catch (err) {
        fail++;
        this.logger.error(`[InvoiceGenerationCron] 계약 ${contract.id} 청구서 생성 실패: ${(err as Error).message}`);
      }
    }

    this.logger.log(`[InvoiceGenerationCron] 완료 — 생성: ${success}, 건너뜀: ${skip}, 실패: ${fail}`);
  }
}

function calculateBillingMonth(kst: Date, billingTiming: BillingTiming): string {
  if (billingTiming === BillingTiming.POSTPAID) {
    // 후불: 전월 사용분을 이번 달에 청구
    const d = new Date(kst);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }
  // 선불: 이번 달 청구
  return kst.toISOString().slice(0, 7);
}

function calculateDueDate(kst: Date, billingDay: number, paymentDueDay: number | null): Date | undefined {
  if (!paymentDueDay) return undefined;

  const year = kst.getFullYear();
  const month = kst.getMonth(); // 0-indexed

  if (paymentDueDay >= billingDay) {
    // 납부 기한일이 청구일보다 같거나 뒤 → 같은 달
    return new Date(year, month, paymentDueDay);
  } else {
    // 납부 기한일이 청구일보다 앞 → 다음 달
    return new Date(year, month + 1, paymentDueDay);
  }
}
