import { Test } from '@nestjs/testing';
import { RentalContractStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RentalContractService } from '../rental-contract/rental-contract.service';
import { RentalContractExpiryCron } from './rental-contract-expiry.cron';

describe('RentalContractExpiryCron', () => {
  let cron: RentalContractExpiryCron;
  let prisma: { rentalContract: { findMany: jest.Mock } };
  let rentalContractService: { updateStatus: jest.Mock };

  beforeEach(async () => {
    prisma = { rentalContract: { findMany: jest.fn().mockResolvedValue([]) } };
    rentalContractService = { updateStatus: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        RentalContractExpiryCron,
        { provide: PrismaService, useValue: prisma },
        { provide: RentalContractService, useValue: rentalContractService },
      ],
    }).compile();

    cron = module.get(RentalContractExpiryCron);
  });

  it('endDate가 현재 시각보다 이전인 ACTIVE 계약을 조회한다', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-25T00:00:00Z'));

    await cron.expireRentalContracts();

    expect(prisma.rentalContract.findMany).toHaveBeenCalledWith({
      where: {
        status: RentalContractStatus.ACTIVE,
        endDate: { lt: new Date('2026-06-25T00:00:00Z') },
      },
      select: { id: true, organizationId: true },
    });

    jest.useRealTimers();
  });

  it('만료 대상 계약마다 updateStatus(ENDED)를 호출한다', async () => {
    prisma.rentalContract.findMany.mockResolvedValue([
      { id: 'c1', organizationId: 'org-1' },
      { id: 'c2', organizationId: 'org-1' },
    ]);

    await cron.expireRentalContracts();

    expect(rentalContractService.updateStatus).toHaveBeenCalledTimes(2);
    expect(rentalContractService.updateStatus).toHaveBeenCalledWith('org-1', 'c1', {
      status: RentalContractStatus.ENDED,
    });
    expect(rentalContractService.updateStatus).toHaveBeenCalledWith('org-1', 'c2', {
      status: RentalContractStatus.ENDED,
    });
  });

  it('만료 대상이 없으면 updateStatus를 호출하지 않는다', async () => {
    prisma.rentalContract.findMany.mockResolvedValue([]);

    await cron.expireRentalContracts();

    expect(rentalContractService.updateStatus).not.toHaveBeenCalled();
  });

  it('일부 계약 종료 실패 시 나머지 계약 처리를 계속 진행한다', async () => {
    prisma.rentalContract.findMany.mockResolvedValue([
      { id: 'c1', organizationId: 'org-1' },
      { id: 'c2', organizationId: 'org-1' },
    ]);
    rentalContractService.updateStatus.mockRejectedValueOnce(new Error('종료 실패')).mockResolvedValueOnce(undefined);

    await expect(cron.expireRentalContracts()).resolves.not.toThrow();
    expect(rentalContractService.updateStatus).toHaveBeenCalledTimes(2);
  });
});
