import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RentalContractStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceService } from '../invoice/invoice.service';

@Injectable()
export class InvoiceGenerationCron {
  private readonly logger = new Logger(InvoiceGenerationCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
  ) {}

  @Cron('0 9 1 * *')
  async generateMonthlyInvoices() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const billingMonth = kst.toISOString().slice(0, 7); // "YYYY-MM"

    this.logger.log(`[InvoiceGenerationCron] ${billingMonth} 월 청구서 생성 시작`);

    const contracts = await this.prisma.rentalContract.findMany({
      where: { status: RentalContractStatus.ACTIVE },
      include: { items: true },
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

        const result = await this.invoiceService.createRentalMonthlyInvoice(
          contract.organizationId,
          contract.id,
          billingMonth,
          contract.items.map((i) => ({ id: i.id, monthlyRentalPrice: i.monthlyRentalPrice })),
        );

        if (result) success++;
      } catch (err) {
        fail++;
        this.logger.error(
          `[InvoiceGenerationCron] 계약 ${contract.id} 청구서 생성 실패: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `[InvoiceGenerationCron] 완료 — 생성: ${success}, 건너뜀: ${skip}, 실패: ${fail}`,
    );
  }
}
