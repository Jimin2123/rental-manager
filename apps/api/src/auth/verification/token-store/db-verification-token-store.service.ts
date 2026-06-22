import { Injectable } from '@nestjs/common';
import { Prisma, VerificationTokenType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { IVerificationTokenStore } from './verification-token-store.interface';

@Injectable()
export class DbVerificationTokenStore implements IVerificationTokenStore {
  constructor(private readonly prisma: PrismaService) {}

  async save(params: {
    token: string;
    type: VerificationTokenType;
    accountId: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.verificationToken.create({ data: params });
  }

  async findValid(token: string, type: VerificationTokenType): Promise<{ id: string; accountId: string } | null> {
    const record = await this.prisma.verificationToken.findUnique({ where: { token } });
    if (!record) return null;
    if (record.type !== type) return null;
    if (record.usedAt) return null;
    if (record.expiresAt < new Date()) return null;
    return { id: record.id, accountId: record.accountId };
  }

  async markUsed(id: string): Promise<void> {
    try {
      await this.prisma.verificationToken.update({ where: { id }, data: { usedAt: new Date() } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return;
      throw e;
    }
  }
}
