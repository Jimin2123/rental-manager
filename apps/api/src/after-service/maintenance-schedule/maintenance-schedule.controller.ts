import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MaintenanceScheduleService } from './maintenance-schedule.service';
import { CreateMaintenanceScheduleDto } from './dto/create-maintenance-schedule.dto';
import { UpdateMaintenanceScheduleDto } from './dto/update-maintenance-schedule.dto';
import { QueryMaintenanceScheduleDto } from './dto/query-maintenance-schedule.dto';

@ApiTags('maintenance-schedules')
@Controller('maintenance-schedules')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class MaintenanceScheduleController {
  constructor(private readonly service: MaintenanceScheduleService) {}

  @Post()
  @Roles('OWNER', 'ADMIN')
  async create(@Body() dto: CreateMaintenanceScheduleDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Get()
  async findAll(@Query() query: QueryMaintenanceScheduleDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateMaintenanceScheduleDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async deactivate(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.deactivate(ctx.organizationId, id);
  }
}
