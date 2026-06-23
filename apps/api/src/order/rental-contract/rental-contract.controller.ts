import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { CreateRentalContractDto } from './dto/create-rental-contract.dto';
import { CreateRentalContractItemDto } from './dto/create-rental-contract-item.dto';
import { ExtendRentalContractDto } from './dto/extend-rental-contract.dto';
import { ReplaceRentalContractItemDto } from './dto/replace-rental-contract-item.dto';
import { ReturnRentalContractItemDto } from './dto/return-rental-contract-item.dto';
import { UpdateRentalContractDto } from './dto/update-rental-contract.dto';
import { UpdateRentalContractItemDto } from './dto/update-rental-contract-item.dto';
import { UpdateRentalContractStatusDto } from './dto/update-rental-contract-status.dto';
import { RentalContractService } from './rental-contract.service';

@ApiTags('rental-contracts')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('rental-contracts')
export class RentalContractController {
  constructor(private readonly service: RentalContractService) {}

  @Post()
  create(@Body() dto: CreateRentalContractDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Get()
  findAll(@OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRentalContractDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateRentalContractStatusDto, @OrgCtx() ctx: OrgContext) {
    return this.service.updateStatus(ctx.organizationId, id, dto);
  }

  @Patch(':id/extend')
  @HttpCode(204)
  extend(@Param('id') id: string, @Body() dto: ExtendRentalContractDto, @OrgCtx() ctx: OrgContext) {
    return this.service.extend(ctx.organizationId, id, dto);
  }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() dto: CreateRentalContractItemDto, @OrgCtx() ctx: OrgContext) {
    return this.service.addItem(ctx.organizationId, id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateRentalContractItemDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.updateItem(ctx.organizationId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(204)
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.removeItem(ctx.organizationId, id, itemId);
  }

  @Post(':id/items/:itemId/replace')
  replaceItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ReplaceRentalContractItemDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.replaceItem(ctx.organizationId, id, itemId, dto);
  }

  @Post(':id/items/:itemId/return')
  @HttpCode(200)
  returnItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ReturnRentalContractItemDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.returnItem(ctx.organizationId, id, itemId, dto);
  }
}
