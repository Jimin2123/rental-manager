import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateInvoiceItemDto } from './dto/create-invoice-item.dto';
import { CreateInvoiceAdjustmentDto } from './dto/create-invoice-adjustment.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { InvoiceService } from './invoice.service';

@ApiTags('invoices')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly service: InvoiceService) {}

  @Post()
  create(@Body() dto: CreateInvoiceDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, ctx.memberId, dto);
  }

  @Get()
  findAll(@Query() dto: QueryInvoiceDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Post(':id/issue')
  @HttpCode(200)
  issue(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.issue(ctx.organizationId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.cancel(ctx.organizationId, id);
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() dto: CreateInvoiceItemDto, @OrgCtx() ctx: OrgContext) {
    return this.service.addItem(ctx.organizationId, id, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(204)
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.removeItem(ctx.organizationId, id, itemId);
  }

  @Post(':id/adjustments')
  addAdjustment(@Param('id') id: string, @Body() dto: CreateInvoiceAdjustmentDto, @OrgCtx() ctx: OrgContext) {
    return this.service.addAdjustment(ctx.organizationId, id, dto);
  }
}
