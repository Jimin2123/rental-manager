import { Body, Controller, Delete, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RentalOrderService } from './rental-order.service';
import { CreateRentalOrderItemDto } from './dto/create-rental-order-item.dto';
import { UpdateRentalOrderItemDto } from './dto/update-rental-order-item.dto';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class RentalOrderController {
  constructor(private readonly service: RentalOrderService) {}

  @Post(':id/rental-items')
  addItem(@Param('id') id: string, @Body() dto: CreateRentalOrderItemDto, @OrgCtx() ctx: OrgContext) {
    return this.service.addItem(ctx.organizationId, id, dto);
  }

  @Patch(':id/rental-items/:itemId')
  @HttpCode(200)
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateRentalOrderItemDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.updateItem(ctx.organizationId, id, itemId, dto);
  }

  @Delete(':id/rental-items/:itemId')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.removeItem(ctx.organizationId, id, itemId);
  }
}
