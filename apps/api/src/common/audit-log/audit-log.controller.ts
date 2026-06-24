import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrgCtx } from '../decorators/org-context.decorator';
import { OrganizationGuard } from '../guards/organization.guard';
import type { OrgContext } from '../guards/organization.guard';
import { AuditLogService } from './audit-log.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@ApiTags('audit-logs')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  findAll(@Query() dto: QueryAuditLogDto, @OrgCtx() ctx: OrgContext) {
    return this.auditLogService.findAll(ctx.organizationId, dto);
  }
}
