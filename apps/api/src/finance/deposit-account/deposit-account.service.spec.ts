import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { DepositAccountService } from './deposit-account.service';

describe('DepositAccountService', () => {
  let service: DepositAccountService;
  let prisma: {
    depositAccount: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const depositAccount = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
    prisma = {
      depositAccount,
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb({ depositAccount })),
    };
    const module = await Test.createTestingModule({
      providers: [DepositAccountService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(DepositAccountService);
  });

  describe('list', () => {
    it('기본은 활성 계좌만, deletedAt null 조건으로 조회한다', async () => {
      prisma.depositAccount.findMany.mockResolvedValue([]);
      await service.list('org-1');
      expect(prisma.depositAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1', deletedAt: null, isActive: true } }),
      );
    });
  });

  describe('create', () => {
    it('첫 계좌는 자동으로 기본계좌가 된다', async () => {
      prisma.depositAccount.count.mockResolvedValue(0);
      prisma.depositAccount.create.mockResolvedValue({ id: 'd-1' });
      await service.create('org-1', { bankName: '국민', accountNumber: '123', accountHolder: '김사장' });
      expect(prisma.depositAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDefault: true }) }),
      );
    });

    it('isDefault=true면 기존 기본계좌를 해제한다', async () => {
      prisma.depositAccount.count.mockResolvedValue(2);
      prisma.depositAccount.create.mockResolvedValue({ id: 'd-2' });
      await service.create('org-1', {
        bankName: '신한',
        accountNumber: '999',
        accountHolder: '김사장',
        isDefault: true,
      });
      expect(prisma.depositAccount.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-1', isDefault: true }) }),
      );
    });
  });

  describe('update', () => {
    it('미존재 계좌면 NotFoundException', async () => {
      prisma.depositAccount.findFirst.mockResolvedValue(null);
      await expect(service.update('org-1', 'nope', { label: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('소프트 삭제(deletedAt 세팅 + isDefault 해제)한다', async () => {
      prisma.depositAccount.findFirst.mockResolvedValue({ id: 'd-1' });
      prisma.depositAccount.update.mockResolvedValue({});
      await service.remove('org-1', 'd-1');
      expect(prisma.depositAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDefault: false }) }),
      );
      const arg = prisma.depositAccount.update.mock.calls[0][0];
      expect(arg.data.deletedAt).toBeInstanceOf(Date);
    });

    it('미존재 계좌면 NotFoundException', async () => {
      prisma.depositAccount.findFirst.mockResolvedValue(null);
      await expect(service.remove('org-1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });
});
