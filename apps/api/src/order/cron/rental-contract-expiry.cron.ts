import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RentalContractStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RentalContractService } from '../rental-contract/rental-contract.service';

@Injectable()
export class RentalContractExpiryCron {
  private readonly logger = new Logger(RentalContractExpiryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rentalContractService: RentalContractService,
  ) {}

  // 매일 UTC 자정(KST 09:00) 실행 — KST 기준 오늘 시작 이전에 만료된 ACTIVE 계약을 ENDED로 전환
  @Cron('0 0 * * *')
  async expireRentalContracts() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const kstTodayStartUTC = new Date(
      Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 60 * 60 * 1000,
    );

    const contracts = await this.prisma.rentalContract.findMany({
      where: {
        status: RentalContractStatus.ACTIVE,
        autoExpire: true,
        endDate: { lt: kstTodayStartUTC },
      },
      select: { id: true, organizationId: true },
    });

    this.logger.log(`[RentalContractExpiryCron] 만료 대상 계약 ${contracts.length}건`);

    let success = 0;
    let fail = 0;

    for (const contract of contracts) {
      try {
        await this.rentalContractService.updateStatus(contract.organizationId, contract.id, {
          status: RentalContractStatus.ENDED,
        }, null);
        success++;
      } catch (err) {
        fail++;
        this.logger.error(`[RentalContractExpiryCron] 계약 ${contract.id} 종료 실패: ${(err as Error).message}`);
      }
    }

    this.logger.log(`[RentalContractExpiryCron] 완료 — 종료: ${success}, 실패: ${fail}`);
  }
}
