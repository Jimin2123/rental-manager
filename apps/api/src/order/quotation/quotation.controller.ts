import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { QuotationService } from './quotation.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QueryQuotationDto } from './dto/query-quotation.dto';
import { UpdateQuotationStatusDto } from './dto/update-quotation-status.dto';
import { ConvertQuotationDto } from './dto/convert-quotation.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';
import { UpdateQuotationItemDto } from './dto/update-quotation-item.dto';

@ApiTags('quotations')
@Controller('quotations')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class QuotationController {
  constructor(private readonly service: QuotationService) {}

  @Post()
  create(@Body() dto: CreateQuotationDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Get()
  findAll(@Query() query: QueryQuotationDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  update(@Param('id') id: string, @Body() dto: UpdateQuotationDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  remove(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.remove(ctx.organizationId, id);
  }

  @Patch(':id/status')
  @HttpCode(200)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateQuotationStatusDto, @OrgCtx() ctx: OrgContext) {
    return this.service.updateStatus(ctx.organizationId, id, dto);
  }

  @Post(':id/convert')
  convert(@Param('id') id: string, @Body() dto: ConvertQuotationDto, @OrgCtx() ctx: OrgContext) {
    return this.service.convert(ctx.organizationId, id, dto);
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() dto: CreateQuotationItemDto, @OrgCtx() ctx: OrgContext) {
    return this.service.addItem(ctx.organizationId, id, dto);
  }

  @Patch(':id/items/:itemId')
  @HttpCode(200)
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQuotationItemDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.updateItem(ctx.organizationId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.removeItem(ctx.organizationId, id, itemId);
  }
}
