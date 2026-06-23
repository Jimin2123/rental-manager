import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingType, RentalContractItemStatus, RentalContractStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService, type ContractItemInput } from '../invoice/invoice.service';

@Injectable()
export class InvoiceGenerationCron {
  private readonly logger = new Logger(InvoiceGenerationCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  @Cron('0 0 1 * *')
  async generateMonthlyInvoices() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const billingMonth = kst.toISOString().slice(0, 7); // "YYYY-MM"

    this.logger.log(`[InvoiceGenerationCron] ${billingMonth} 월 청구서 생성 시작`);

    const contracts = await this.prisma.rentalContract.findMany({
      where: { status: RentalContractStatus.ACTIVE },
      include: {
        items: {
          where: { status: RentalContractItemStatus.ACTIVE },
          include: {
            meterReadings: {
              where: { billingMonth, deletedAt: null, invoiceItemId: null },
              select: { id: true, blackUsage: true, colorUsage: true },
            },
          },
        },
      },
      take: 500,
    });

    let success = 0;
    let skip = 0;
    let fail = 0;

    for (const contract of contracts) {
      try {
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

        const contractItems: ContractItemInput[] = contract.items.map((item) => {
          if (item.billingType === BillingType.METER) {
            return {
              id: item.id,
              monthlyRentalPrice: item.monthlyRentalPrice,
              billingType: BillingType.METER,
              freeBlackCount: item.freeBlackCount,
              blackUnitPrice: item.blackUnitPrice,
              freeColorCount: item.freeColorCount,
              colorUnitPrice: item.colorUnitPrice,
              meterReadings: item.meterReadings,
            };
          }
          return {
            id: item.id,
            monthlyRentalPrice: item.monthlyRentalPrice,
            billingType: BillingType.FIXED,
          };
        });

        const result = await this.invoiceService.createRentalMonthlyInvoice(
          contract.organizationId,
          contract.id,
          billingMonth,
          contractItems,
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
