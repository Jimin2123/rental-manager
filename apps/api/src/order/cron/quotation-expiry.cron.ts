import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class QuotationExpiryCron {
  private readonly logger = new Logger(QuotationExpiryCron.name);

  constructor(private readonly prisma: PrismaService) {}

  // 매일 UTC 자정(KST 09:00) 실행 — KST 기준 오늘 시작 이전에 만료된 DRAFT/SENT 견적을 EXPIRED로 전환
  @Cron('0 0 * * *')
  async expireQuotations() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const kstTodayStartUTC = new Date(
      Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 60 * 60 * 1000,
    );

    const { count } = await this.prisma.quotation.updateMany({
      where: {
        status: { in: [QuotationStatus.DRAFT, QuotationStatus.SENT] },
        validUntil: { lt: kstTodayStartUTC },
      },
      data: { status: QuotationStatus.EXPIRED },
    });

    this.logger.log(`[QuotationExpiryCron] 만료 처리 완료 — ${count}건`);
  }
}
