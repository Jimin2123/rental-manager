import { Body, Controller, Delete, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SaleOrderService } from './sale-order.service';
import { CreateSaleOrderItemDto } from './dto/create-sale-order-item.dto';
import { UpdateSaleOrderItemDto } from './dto/update-sale-order-item.dto';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class SaleOrderController {
  constructor(private readonly service: SaleOrderService) {}

  @Post(':id/sale-items')
  addItem(@Param('id') id: string, @Body() dto: CreateSaleOrderItemDto, @OrgCtx() ctx: OrgContext) {
    return this.service.addItem(ctx.organizationId, id, dto);
  }

  @Patch(':id/sale-items/:itemId')
  @HttpCode(200)
  updateItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateSaleOrderItemDto, @OrgCtx() ctx: OrgContext) {
    return this.service.updateItem(ctx.organizationId, id, itemId, dto);
  }

  @Delete(':id/sale-items/:itemId')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.removeItem(ctx.organizationId, id, itemId);
  }
}
