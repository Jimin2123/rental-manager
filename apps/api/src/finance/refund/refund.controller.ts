import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { CreateRefundDto } from './dto/create-refund.dto';
import { QueryRefundDto } from './dto/query-refund.dto';
import { RefundService } from './refund.service';

@ApiTags('refunds')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('refunds')
export class RefundController {
  constructor(private readonly service: RefundService) {}

  @Post()
  create(@Body() dto: CreateRefundDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, ctx.memberId, dto);
  }

  @Get()
  findAll(@Query() dto: QueryRefundDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.complete(ctx.organizationId, id, ctx.memberId);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.cancel(ctx.organizationId, id, ctx.memberId);
  }
}
