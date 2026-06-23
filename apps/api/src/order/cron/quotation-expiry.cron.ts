import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuotationExpiryCron {
  private readonly logger = new Logger(QuotationExpiryCron.name);

  constructor(private readonly prisma: PrismaService) {}

  // 매일 자정(KST) 실행 — validUntil이 지난 DRAFT/SENT 견적을 EXPIRED로 전환
  @Cron('0 0 * * *')
  async expireQuotations() {
    const now = new Date();

    const { count } = await this.prisma.quotation.updateMany({
      where: {
        status: { in: [QuotationStatus.DRAFT, QuotationStatus.SENT] },
        validUntil: { lt: now },
      },
      data: { status: QuotationStatus.EXPIRED },
    });

    this.logger.log(`[QuotationExpiryCron] 만료 처리 완료 — ${count}건`);
  }
}
