import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, OrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateAmounts } from '../common/amount.util';
import type { CreateSaleOrderItemDto } from './dto/create-sale-order-item.dto';
import type { UpdateSaleOrderItemDto } from './dto/update-sale-order-item.dto';

const BLOCKED_STATUSES: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELED];

@Injectable()
export class SaleOrderService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrder(organizationId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id_organizationId: { id: orderId, organizationId } },
      select: { id: true, type: true, status: true, saleOrder: { select: { id: true } } },
    });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다.');
    if (order.type !== OrderType.SALE) throw new BadRequestException('판매 주문에서만 판매 항목을 관리할 수 있습니다.');
    if (BLOCKED_STATUSES.includes(order.status))
      throw new BadRequestException('납품 완료 또는 취소된 주문은 항목을 변경할 수 없습니다.');
    return order;
  }

  async addItem(organizationId: string, orderId: string, dto: CreateSaleOrderItemDto): Promise<{ id: string }> {
    const order = await this.getOrder(organizationId, orderId);

    if (dto.assetId) {
      const asset = await this.prisma.asset.findUnique({
        where: { id_organizationId: { id: dto.assetId, organizationId } },
        select: { id: true },
      });
      if (!asset) throw new NotFoundException('자산을 찾을 수 없습니다.');
    }

    const item = await this.prisma.saleOrderItem.create({
      data: {
        organizationId,
        saleOrderId: order.saleOrder!.id,
        productId: dto.productId,
        assetId: dto.assetId,
        serialNumber: dto.serialNumber,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        vatType: dto.vatType,
        isUsedAssetShipment: dto.isUsedAssetShipment ?? false,
        warrantyStartDate: dto.warrantyStartDate ? new Date(dto.warrantyStartDate) : undefined,
        warrantyEndDate: dto.warrantyEndDate ? new Date(dto.warrantyEndDate) : undefined,
        marginAmount: dto.marginAmount,
        memo: dto.memo,
        ...calculateAmounts(dto.quantity, dto.unitPrice, dto.vatType),
      },
    });
    return { id: item.id };
  }

  async updateItem(
    organizationId: string,
    orderId: string,
    itemId: string,
    dto: UpdateSaleOrderItemDto,
  ): Promise<void> {
    const order = await this.getOrder(organizationId, orderId);

    const item = await this.prisma.saleOrderItem.findFirst({
      where: { id: itemId, saleOrderId: order.saleOrder!.id, organizationId },
      select: { id: true, quantity: true, unitPrice: true, vatType: true },
    });
    if (!item) throw new NotFoundException('판매 항목을 찾을 수 없습니다.');

    if (dto.assetId) {
      const asset = await this.prisma.asset.findUnique({
        where: { id_organizationId: { id: dto.assetId, organizationId } },
        select: { id: true },
      });
      if (!asset) throw new NotFoundException('자산을 찾을 수 없습니다.');
    }

    const qty = dto.quantity ?? item.quantity;
    const price = dto.unitPrice ?? item.unitPrice;
    const vat = dto.vatType ?? item.vatType;

    await this.prisma.saleOrderItem.update({
      where: { id: itemId },
      data: {
        ...(dto.productId !== undefined && { productId: dto.productId }),
        ...(dto.assetId !== undefined && { assetId: dto.assetId }),
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.unitPrice !== undefined && { unitPrice: dto.unitPrice }),
        ...(dto.vatType !== undefined && { vatType: dto.vatType }),
        ...(dto.isUsedAssetShipment !== undefined && { isUsedAssetShipment: dto.isUsedAssetShipment }),
        ...(dto.warrantyStartDate !== undefined && { warrantyStartDate: new Date(dto.warrantyStartDate) }),
        ...(dto.warrantyEndDate !== undefined && { warrantyEndDate: new Date(dto.warrantyEndDate) }),
        ...(dto.marginAmount !== undefined && { marginAmount: dto.marginAmount }),
        ...(dto.memo !== undefined && { memo: dto.memo }),
        ...calculateAmounts(qty, price, vat),
      },
    });
  }

  async removeItem(organizationId: string, orderId: string, itemId: string): Promise<void> {
    const order = await this.getOrder(organizationId, orderId);

    const item = await this.prisma.saleOrderItem.findFirst({
      where: { id: itemId, saleOrderId: order.saleOrder!.id, organizationId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('판매 항목을 찾을 수 없습니다.');

    await this.prisma.saleOrderItem.delete({ where: { id: itemId } });
  }
}
