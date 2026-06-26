import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { PaymentService } from './payment.service';

@ApiTags('payments')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @Post()
  create(@Body() dto: CreatePaymentDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, ctx.memberId, dto);
  }

  @Get()
  findAll(@Query() dto: QueryPaymentDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.cancel(ctx.organizationId, id, ctx.memberId);
  }
}
