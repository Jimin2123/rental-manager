import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { ServiceVisitService } from './service-visit.service';
import { CreateServiceVisitDto } from './dto/create-service-visit.dto';
import { UpdateServiceVisitDto } from './dto/update-service-visit.dto';
import { CompleteServiceVisitDto } from './dto/complete-service-visit.dto';

@ApiTags('service-requests')
@Controller('service-requests/:requestId/visits')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class ServiceVisitNestedController {
  constructor(private readonly service: ServiceVisitService) {}

  @Post()
  async create(@Param('requestId') requestId: string, @Body() dto: CreateServiceVisitDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, requestId, dto);
  }

  @Get()
  async findByRequest(@Param('requestId') requestId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findByRequest(ctx.organizationId, requestId);
  }
}

@ApiTags('service-visits')
@Controller('service-visits')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class ServiceVisitController {
  constructor(private readonly service: ServiceVisitService) {}

  @Get(':id')
  async findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateServiceVisitDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Patch(':id/complete')
  @HttpCode(200)
  async complete(@Param('id') id: string, @Body() dto: CompleteServiceVisitDto, @OrgCtx() ctx: OrgContext) {
    return this.service.complete(ctx.organizationId, id, dto, ctx.memberId);
  }

  @Patch(':id/cancel')
  @HttpCode(200)
  async cancel(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.cancel(ctx.organizationId, id);
  }
}
