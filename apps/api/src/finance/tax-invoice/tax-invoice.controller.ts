import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { CreateTaxInvoiceDto } from './dto/create-tax-invoice.dto';
import { AmendTaxInvoiceDto } from './dto/amend-tax-invoice.dto';
import { QueryTaxInvoiceDto } from './dto/query-tax-invoice.dto';
import { TaxInvoiceService } from './tax-invoice.service';

@ApiTags('tax-invoices')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('tax-invoices')
export class TaxInvoiceController {
  constructor(private readonly service: TaxInvoiceService) {}

  @Post()
  create(@Body() dto: CreateTaxInvoiceDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, ctx.memberId, dto);
  }

  @Get()
  findAll(@Query() dto: QueryTaxInvoiceDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.cancel(ctx.organizationId, id);
  }

  @Post(':id/amend')
  amend(@Param('id') id: string, @Body() dto: AmendTaxInvoiceDto, @OrgCtx() ctx: OrgContext) {
    return this.service.amend(ctx.organizationId, id, dto);
  }
}
