import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { QueryAuditLogDto } from './dto/query-audit-log.dto';

type PrismaTransaction = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

type AuditLogInput = {
  organizationId: string;
  actorId: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string;
  before?: object;
  after?: object;
  reason?: string;
};

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(tx: PrismaTransaction, input: AuditLogInput): Promise<void> {
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ...(input.before !== undefined && { before: input.before }),
        ...(input.after !== undefined && { after: input.after }),
        reason: input.reason,
      },
    });
  }

  async findAll(organizationId: string, dto: QueryAuditLogDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const where = {
      organizationId,
      ...(dto.targetType && { targetType: dto.targetType }),
      ...(dto.targetId && { targetId: dto.targetId }),
      ...(dto.action && { action: dto.action }),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total };
  }
}
