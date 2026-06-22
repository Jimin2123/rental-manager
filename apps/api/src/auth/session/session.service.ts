import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from './token.service';

interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async create(accountId: string, rawToken: string, expiresAt: Date, meta: SessionMeta): Promise<void> {
    const tokenHash = this.tokenService.hashToken(rawToken);
    await this.prisma.refreshToken.create({ data: { accountId, tokenHash, expiresAt, ...meta } });
  }

  async findByHash(hash: string) {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  }

  async findValidByHash(hash: string) {
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) return null;
    return record;
  }

  async rotate(oldId: string, rawToken: string, accountId: string, expiresAt: Date, meta: SessionMeta): Promise<void> {
    const tokenHash = this.tokenService.hashToken(rawToken);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: oldId }, data: { revokedAt: now } }),
      this.prisma.refreshToken.create({ data: { accountId, tokenHash, expiresAt, ...meta } }),
    ]);
  }

  async revokeAll(accountId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeById(id: string, accountId: string): Promise<void> {
    try {
      await this.prisma.refreshToken.update({
        where: { id, accountId },
        data: { revokedAt: new Date() },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return;
      throw e;
    }
  }

  async listActive(accountId: string) {
    return this.prisma.refreshToken.findMany({
      where: { accountId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
