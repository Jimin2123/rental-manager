import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { MeterReadingService } from './meter-reading.service';
import { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import { QueryMeterReadingDto } from './dto/query-meter-reading.dto';

@ApiTags('assets')
@Controller('assets/:assetId/meter-readings')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class AssetMeterReadingController {
  constructor(private readonly service: MeterReadingService) {}

  @Post()
  async create(
    @Param('assetId') assetId: string,
    @Body() dto: CreateMeterReadingDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.create(ctx.organizationId, assetId, dto);
  }

  @Get()
  async findByAsset(
    @Param('assetId') assetId: string,
    @Query() query: QueryMeterReadingDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.findByAsset(ctx.organizationId, assetId, query);
  }
}
