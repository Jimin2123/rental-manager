import { Controller, Delete, Get, HttpCode, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MeterReadingService } from './meter-reading.service';
import { QueryMeterReadingDto } from './dto/query-meter-reading.dto';

@ApiTags('meter-readings')
@Controller('meter-readings')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class MeterReadingController {
  constructor(private readonly service: MeterReadingService) {}

  @Get()
  async findAll(@Query() query: QueryMeterReadingDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, query);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async cancel(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.cancel(ctx.organizationId, id);
  }
}
