import { Test } from '@nestjs/testing';
import { QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QuotationExpiryCron } from './quotation-expiry.cron';

describe('QuotationExpiryCron', () => {
  let cron: QuotationExpiryCron;
  let prisma: { quotation: { updateMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { quotation: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };

    const module = await Test.createTestingModule({
      providers: [QuotationExpiryCron, { provide: PrismaService, useValue: prisma }],
    }).compile();

    cron = module.get(QuotationExpiryCron);
  });

  it('validUntil이 현재 시각보다 이전인 DRAFT/SENT 견적을 EXPIRED로 일괄 전환한다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-24T00:00:00Z'));
    prisma.quotation.updateMany.mockResolvedValue({ count: 3 });

    await cron.expireQuotations();

    expect(prisma.quotation.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: [QuotationStatus.DRAFT, QuotationStatus.SENT] },
        validUntil: { lt: new Date('2026-06-24T00:00:00Z') },
      },
      data: { status: QuotationStatus.EXPIRED },
    });

    jest.useRealTimers();
  });

  it('만료 대상이 없으면 0건으로 처리한다', async () => {
    prisma.quotation.updateMany.mockResolvedValue({ count: 0 });

    await cron.expireQuotations();

    expect(prisma.quotation.updateMany).toHaveBeenCalledTimes(1);
  });

  it('ACCEPTED/REJECTED 상태 견적은 만료 처리하지 않는다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-24T00:00:00Z'));

    await cron.expireQuotations();

    const callArg = prisma.quotation.updateMany.mock.calls[0][0];
    expect(callArg.where.status.in).not.toContain(QuotationStatus.ACCEPTED);
    expect(callArg.where.status.in).not.toContain(QuotationStatus.REJECTED);

    jest.useRealTimers();
  });
});
