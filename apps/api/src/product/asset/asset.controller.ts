import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssetEventSourceType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { ChangeAssetStatusDto } from './dto/change-asset-status.dto';
import { QueryAssetDto } from './dto/query-asset.dto';

@ApiTags('assets')
@Controller('assets')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class AssetController {
  constructor(private readonly service: AssetService) {}

  @Get()
  async findAll(@Query() query: QueryAssetDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, query);
  }

  @Post()
  async create(@Body() dto: CreateAssetDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateAssetDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Patch(':id/status')
  @HttpCode(200)
  async changeStatus(@Param('id') id: string, @Body() dto: ChangeAssetStatusDto, @OrgCtx() ctx: OrgContext) {
    return this.service.changeStatus(id, ctx.organizationId, dto.status, AssetEventSourceType.MANUAL, undefined, dto.note);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async softDelete(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.softDelete(ctx.organizationId, id);
  }
}
