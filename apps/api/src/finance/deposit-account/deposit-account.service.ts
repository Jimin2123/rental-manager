import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateDepositAccountDto } from './dto/create-deposit-account.dto';
import type { UpdateDepositAccountDto } from './dto/update-deposit-account.dto';

@Injectable()
export class DepositAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, includeInactive = false) {
    return this.prisma.depositAccount.findMany({
      where: { organizationId, deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(organizationId: string, dto: CreateDepositAccountDto) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.depositAccount.count({ where: { organizationId, deletedAt: null } });
      const makeDefault = dto.isDefault ?? count === 0; // 첫 계좌는 자동 기본
      if (makeDefault) {
        await tx.depositAccount.updateMany({
          where: { organizationId, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      }
      return tx.depositAccount.create({
        data: {
          organizationId,
          bankName: dto.bankName,
          accountNumber: dto.accountNumber,
          accountHolder: dto.accountHolder,
          label: dto.label,
          isDefault: makeDefault,
          isActive: dto.isActive ?? true,
          memo: dto.memo,
        },
      });
    });
  }

  async update(organizationId: string, id: string, dto: UpdateDepositAccountDto) {
    const account = await this.prisma.depositAccount.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!account) throw new NotFoundException('입금계좌를 찾을 수 없습니다.');
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.depositAccount.updateMany({
          where: { organizationId, isDefault: true, deletedAt: null, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return tx.depositAccount.update({
        where: { id_organizationId: { id, organizationId } },
        data: {
          bankName: dto.bankName,
          accountNumber: dto.accountNumber,
          accountHolder: dto.accountHolder,
          label: dto.label,
          isDefault: dto.isDefault,
          isActive: dto.isActive,
          memo: dto.memo,
        },
      });
    });
  }

  async remove(organizationId: string, id: string) {
    const account = await this.prisma.depositAccount.findFirst({ where: { id, organizationId, deletedAt: null } });
    if (!account) throw new NotFoundException('입금계좌를 찾을 수 없습니다.');
    await this.prisma.depositAccount.update({
      where: { id_organizationId: { id, organizationId } },
      data: { deletedAt: new Date(), isDefault: false },
    });
  }
}
