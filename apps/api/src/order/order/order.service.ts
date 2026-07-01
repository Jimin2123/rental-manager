import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetEventSourceType, AssetStatus, DocumentSequenceType, OrderStatus, OrderType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentSequenceService } from '../common/document-sequence.service';
import { calculateAmounts } from '../common/amount.util';
import { InvoiceService } from '../../finance/invoice/invoice.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { UpdateOrderDto } from './dto/update-order.dto';
import type { QueryOrderDto } from './dto/query-order.dto';
import type { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.REGISTERED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELED],
  [OrderStatus.CONFIRMED]: [OrderStatus.IN_DELIVERY, OrderStatus.CANCELED],
  [OrderStatus.IN_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELED]: [],
};

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: DocumentSequenceService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async create(organizationId: string, dto: CreateOrderDto): Promise<{ orderId: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id: dto.customerId, organizationId } },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('고객을 찾을 수 없습니다.');

    const orderId = await this.prisma.$transaction(async (tx) => {
      const orderNo = await this.docSeq.generateNo(organizationId, DocumentSequenceType.ORDER, tx);
      const order = await tx.order.create({
        data: {
          organizationId,
          orderNo,
          type: dto.type,
          status: OrderStatus.REGISTERED,
          customerId: dto.customerId,
          managerId: dto.managerId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
          memo: dto.memo,
        },
      });

      if (dto.type === OrderType.SALE && dto.saleOrder) {
        const saleOrder = await tx.saleOrder.create({
          data: {
            organizationId,
            orderId: order.id,
            deliveryStaffId: dto.saleOrder.deliveryStaffId,
            saleDate: dto.saleOrder.saleDate ? new Date(dto.saleOrder.saleDate) : new Date(),
          },
        });
        for (const item of dto.saleOrder.items) {
          await tx.saleOrderItem.create({
            data: {
              organizationId,
              saleOrderId: saleOrder.id,
              productId: item.productId,
              assetId: item.assetId,
              serialNumber: item.serialNumber,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              vatType: item.vatType,
              isUsedAssetShipment: item.isUsedAssetShipment ?? false,
              warrantyStartDate: item.warrantyStartDate ? new Date(item.warrantyStartDate) : undefined,
              warrantyEndDate: item.warrantyEndDate ? new Date(item.warrantyEndDate) : undefined,
              marginAmount: item.marginAmount,
              memo: item.memo,
              ...calculateAmounts(item.quantity, item.unitPrice, item.vatType),
            },
          });
        }
      }

      if (dto.type === OrderType.RENTAL && dto.rentalOrder) {
        const rentalOrder = await tx.rentalOrder.create({
          data: {
            organizationId,
            orderId: order.id,
            managementNo: dto.rentalOrder.managementNo,
            isRenewal: dto.rentalOrder.isRenewal ?? false,
            contractDate: dto.rentalOrder.contractDate ? new Date(dto.rentalOrder.contractDate) : new Date(),
          },
        });
        for (const item of dto.rentalOrder.items) {
          await tx.rentalOrderItem.create({
            data: {
              organizationId,
              rentalOrderId: rentalOrder.id,
              productId: item.productId,
              assetId: item.assetId,
              serialNumber: item.serialNumber,
              monthlyRentalPrice: item.monthlyRentalPrice,
              depositAmount: item.depositAmount,
              installationLocation: item.installationLocation,
              specialTerms: item.specialTerms,
              isUsedAssetShipment: item.isUsedAssetShipment ?? false,
              purchaseAmount: item.purchaseAmount,
              warrantyExpiresAt: item.warrantyExpiresAt ? new Date(item.warrantyExpiresAt) : undefined,
              memo: item.memo,
            },
          });
        }
      }

      return order.id;
    });

    return { orderId };
  }

  async findAll(organizationId: string, query: QueryOrderDto) {
    return this.prisma.order.findMany({
      where: {
        organizationId,
        ...(query.type && { type: query.type }),
        ...(query.status && { status: query.status }),
        ...(query.customerId && { customerId: query.customerId }),
      },
      include: {
        customer: {
          select: {
            id: true,
            individualProfile: { select: { name: true } },
            businessPartner: { select: { businessProfile: { select: { name: true } } } },
          },
        },
        manager: { select: { id: true, name: true } },
        saleOrder: { include: { items: { include: { product: { select: { name: true } } } } } },
        rentalOrder: {
          include: {
            items: { include: { product: { select: { name: true } } } },
            contract: { select: { id: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: {
        customer: {
          select: {
            id: true,
            individualProfile: { select: { name: true } },
            businessPartner: { select: { businessProfile: { select: { name: true } } } },
          },
        },
        manager: { select: { id: true, name: true } },
        saleOrder: { include: { items: { include: { product: { select: { name: true } } } } } },
        rentalOrder: {
          include: {
            items: { include: { product: { select: { name: true } } } },
            contract: { select: { id: true, status: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다.');
    return order;
  }

  async update(organizationId: string, id: string, dto: UpdateOrderDto): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true },
    });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다.');

    await this.prisma.order.update({
      where: { id_organizationId: { id, organizationId } },
      data: {
        ...(dto.managerId !== undefined && { managerId: dto.managerId }),
        ...(dto.orderDate !== undefined && { orderDate: new Date(dto.orderDate) }),
        ...(dto.memo !== undefined && { memo: dto.memo }),
      },
    });
  }

  async updateStatus(organizationId: string, id: string, dto: UpdateOrderStatusDto): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: {
        id: true,
        status: true,
        type: true,
        customerId: true,
        saleOrder: {
          select: {
            id: true,
            items: {
              select: {
                id: true,
                assetId: true,
                asset: { select: { status: true } },
                quantity: true,
                unitPrice: true,
                vatType: true,
                supplyAmount: true,
                vatAmount: true,
                totalAmount: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다.');

    if (!ORDER_TRANSITIONS[order.status].includes(dto.status)) {
      throw new BadRequestException(`${order.status} 상태에서 ${dto.status}로 전환할 수 없습니다.`);
    }

    if (dto.status === OrderStatus.DELIVERED && order.type === OrderType.SALE) {
      const saleItems = order.saleOrder?.items ?? [];
      const assetItems = saleItems.filter((item) => item.assetId && item.asset);
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id_organizationId: { id, organizationId } }, data: { status: dto.status } });
        for (const item of assetItems) {
          await tx.asset.update({
            where: { id_organizationId: { id: item.assetId!, organizationId } },
            data: { status: AssetStatus.SOLD },
          });
          await tx.assetEvent.create({
            data: {
              organizationId,
              assetId: item.assetId!,
              sourceType: AssetEventSourceType.SALE_ORDER,
              sourceId: order.saleOrder!.id,
              fromStatus: item.asset!.status,
              toStatus: AssetStatus.SOLD,
            },
          });
        }
        await this.invoiceService.createForSaleOrder(
          organizationId,
          order.customerId,
          order.saleOrder!.id,
          saleItems,
          tx,
        );
      });
      return;
    }

    await this.prisma.order.update({
      where: { id_organizationId: { id, organizationId } },
      data: { status: dto.status },
    });
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: {
        id: true,
        status: true,
        type: true,
        saleOrder: { select: { id: true } },
        rentalOrder: { select: { id: true } },
      },
    });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다.');
    if (order.status !== OrderStatus.REGISTERED)
      throw new BadRequestException('등록 상태의 주문만 삭제할 수 있습니다.');

    await this.prisma.$transaction(async (tx) => {
      if (order.saleOrder) {
        await tx.saleOrderItem.deleteMany({ where: { saleOrderId: order.saleOrder.id } });
        await tx.saleOrder.delete({ where: { id: order.saleOrder.id } });
      }
      if (order.rentalOrder) {
        await tx.rentalOrderItem.deleteMany({ where: { rentalOrderId: order.rentalOrder.id } });
        await tx.rentalOrder.delete({ where: { id: order.rentalOrder.id } });
      }
      await tx.order.delete({ where: { id_organizationId: { id, organizationId } } });
    });
  }
}
