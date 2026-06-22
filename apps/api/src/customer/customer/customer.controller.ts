import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  @Get()
  async findAll(@Query() query: QueryCustomerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, query);
  }

  @Post()
  async create(@Body() dto: CreateCustomerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async softDelete(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.softDelete(ctx.organizationId, id);
  }
}
