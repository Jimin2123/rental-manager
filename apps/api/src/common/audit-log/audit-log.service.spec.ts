import { Test } from '@nestjs/testing';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prisma: { auditLog: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { auditLog: { findMany: jest.fn().mockResolvedValue([]) } };

    const module = await Test.createTestingModule({
      providers: [AuditLogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AuditLogService);
  });

  describe('log', () => {
    it('tx.auditLog.create를 올바른 payload로 호출한다', async () => {
      const tx = { auditLog: { create: jest.fn() } };

      await service.log(tx as any, {
        organizationId: 'org-1',
        actorId: 'mem-1',
        action: AuditAction.STATUS_CHANGE,
        targetType: 'Invoice',
        targetId: 'inv-1',
        before: { status: 'DRAFT' },
        after: { status: 'ISSUED' },
      });

      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          actorId: 'mem-1',
          action: AuditAction.STATUS_CHANGE,
          targetType: 'Invoice',
          targetId: 'inv-1',
          before: { status: 'DRAFT' },
          after: { status: 'ISSUED' },
          reason: undefined,
        },
      });
    });

    it('before/after가 없으면 해당 필드를 포함하지 않는다', async () => {
      const tx = { auditLog: { create: jest.fn() } };

      await service.log(tx as any, {
        organizationId: 'org-1',
        actorId: 'mem-1',
        action: AuditAction.CREATE,
        targetType: 'Payment',
        targetId: 'pay-1',
      });

      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ before: expect.anything() }),
      });
    });
  });

  describe('findAll', () => {
    it('organizationId로 필터링하고 페이지네이션을 적용한다', async () => {
      await service.findAll('org-1', { page: 2, limit: 10 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          orderBy: { createdAt: 'desc' },
          skip: 10,
          take: 10,
        }),
      );
    });

    it('targetType/targetId/action 필터를 적용한다', async () => {
      await service.findAll('org-1', {
        targetType: 'Invoice',
        targetId: 'inv-1',
        action: AuditAction.STATUS_CHANGE,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            targetType: 'Invoice',
            targetId: 'inv-1',
            action: AuditAction.STATUS_CHANGE,
          },
        }),
      );
    });

    it('page/limit 미입력 시 기본값(page=1, limit=20)을 사용한다', async () => {
      await service.findAll('org-1', {});

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
    });
  });
});
