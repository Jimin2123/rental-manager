import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, OrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateRentalOrderItemDto } from './dto/create-rental-order-item.dto';
import type { UpdateRentalOrderItemDto } from './dto/update-rental-order-item.dto';

const BLOCKED_STATUSES: OrderStatus[] = [OrderStatus.DELIVERED, OrderStatus.CANCELED];

@Injectable()
export class RentalOrderService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrder(organizationId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id_organizationId: { id: orderId, organizationId } },
      select: { id: true, type: true, status: true, rentalOrder: { select: { id: true } } },
    });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다.');
    if (order.type !== OrderType.RENTAL)
      throw new BadRequestException('렌탈 주문에서만 렌탈 항목을 관리할 수 있습니다.');
    if (BLOCKED_STATUSES.includes(order.status))
      throw new BadRequestException('납품 완료 또는 취소된 주문은 항목을 변경할 수 없습니다.');
    return order;
  }

  async addItem(organizationId: string, orderId: string, dto: CreateRentalOrderItemDto): Promise<{ id: string }> {
    const order = await this.getOrder(organizationId, orderId);

    if (dto.assetId) {
      const asset = await this.prisma.asset.findUnique({
        where: { id_organizationId: { id: dto.assetId, organizationId } },
        select: { id: true },
      });
      if (!asset) throw new NotFoundException('자산을 찾을 수 없습니다.');
    }

    const item = await this.prisma.rentalOrderItem.create({
      data: {
        organizationId,
        rentalOrderId: order.rentalOrder!.id,
        productId: dto.productId,
        assetId: dto.assetId,
        serialNumber: dto.serialNumber,
        monthlyRentalPrice: dto.monthlyRentalPrice,
        depositAmount: dto.depositAmount,
        installationLocation: dto.installationLocation,
        specialTerms: dto.specialTerms,
        isUsedAssetShipment: dto.isUsedAssetShipment ?? false,
        purchaseAmount: dto.purchaseAmount,
        warrantyExpiresAt: dto.warrantyExpiresAt ? new Date(dto.warrantyExpiresAt) : undefined,
        memo: dto.memo,
      },
    });
    return { id: item.id };
  }

  async updateItem(
    organizationId: string,
    orderId: string,
    itemId: string,
    dto: UpdateRentalOrderItemDto,
  ): Promise<void> {
    const order = await this.getOrder(organizationId, orderId);

    const item = await this.prisma.rentalOrderItem.findFirst({
      where: { id: itemId, rentalOrderId: order.rentalOrder!.id, organizationId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('렌탈 항목을 찾을 수 없습니다.');

    if (dto.assetId) {
      const asset = await this.prisma.asset.findUnique({
        where: { id_organizationId: { id: dto.assetId, organizationId } },
        select: { id: true },
      });
      if (!asset) throw new NotFoundException('자산을 찾을 수 없습니다.');
    }

    await this.prisma.rentalOrderItem.update({
      where: { id: itemId },
      data: {
        ...(dto.productId !== undefined && { productId: dto.productId }),
        ...(dto.assetId !== undefined && { assetId: dto.assetId }),
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
        ...(dto.monthlyRentalPrice !== undefined && { monthlyRentalPrice: dto.monthlyRentalPrice }),
        ...(dto.depositAmount !== undefined && { depositAmount: dto.depositAmount }),
        ...(dto.installationLocation !== undefined && { installationLocation: dto.installationLocation }),
        ...(dto.specialTerms !== undefined && { specialTerms: dto.specialTerms }),
        ...(dto.isUsedAssetShipment !== undefined && { isUsedAssetShipment: dto.isUsedAssetShipment }),
        ...(dto.purchaseAmount !== undefined && { purchaseAmount: dto.purchaseAmount }),
        ...(dto.warrantyExpiresAt !== undefined && { warrantyExpiresAt: new Date(dto.warrantyExpiresAt) }),
        ...(dto.memo !== undefined && { memo: dto.memo }),
      },
    });
  }

  async removeItem(organizationId: string, orderId: string, itemId: string): Promise<void> {
    const order = await this.getOrder(organizationId, orderId);

    const item = await this.prisma.rentalOrderItem.findFirst({
      where: { id: itemId, rentalOrderId: order.rentalOrder!.id, organizationId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('렌탈 항목을 찾을 수 없습니다.');

    await this.prisma.rentalOrderItem.delete({ where: { id: itemId } });
  }
}
