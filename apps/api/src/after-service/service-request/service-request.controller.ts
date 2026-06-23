import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ServiceRequestService } from './service-request.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestDto } from './dto/update-service-request.dto';
import { ChangeServiceRequestStatusDto } from './dto/change-service-request-status.dto';
import { QueryServiceRequestDto } from './dto/query-service-request.dto';

@ApiTags('service-requests')
@Controller('service-requests')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class ServiceRequestController {
  constructor(private readonly service: ServiceRequestService) {}

  @Post()
  async create(@Body() dto: CreateServiceRequestDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Get()
  async findAll(@Query() query: QueryServiceRequestDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateServiceRequestDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Patch(':id/status')
  @HttpCode(200)
  async changeStatus(@Param('id') id: string, @Body() dto: ChangeServiceRequestStatusDto, @OrgCtx() ctx: OrgContext) {
    return this.service.changeStatus(ctx.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async softDelete(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.softDelete(ctx.organizationId, id);
  }
}
