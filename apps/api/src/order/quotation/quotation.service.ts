import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentSequenceType, OrderStatus, OrderType, QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentSequenceService } from '../common/document-sequence.service';
import { calculateAmounts } from '../common/amount.util';
import type { CreateQuotationDto } from './dto/create-quotation.dto';
import type { UpdateQuotationDto } from './dto/update-quotation.dto';
import type { QueryQuotationDto } from './dto/query-quotation.dto';
import type { UpdateQuotationStatusDto } from './dto/update-quotation-status.dto';
import type { CreateQuotationItemDto } from './dto/create-quotation-item.dto';
import type { UpdateQuotationItemDto } from './dto/update-quotation-item.dto';
import type { ConvertQuotationDto } from './dto/convert-quotation.dto';

const LOCKED: QuotationStatus[] = [QuotationStatus.ACCEPTED, QuotationStatus.REJECTED, QuotationStatus.EXPIRED];

const TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  [QuotationStatus.DRAFT]: [
    QuotationStatus.SENT,
    QuotationStatus.ACCEPTED,
    QuotationStatus.REJECTED,
    QuotationStatus.EXPIRED,
  ],
  [QuotationStatus.SENT]: [QuotationStatus.ACCEPTED, QuotationStatus.REJECTED, QuotationStatus.EXPIRED],
  [QuotationStatus.ACCEPTED]: [],
  [QuotationStatus.REJECTED]: [],
  [QuotationStatus.EXPIRED]: [],
};

@Injectable()
export class QuotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: DocumentSequenceService,
  ) {}

  async create(organizationId: string, dto: CreateQuotationDto): Promise<{ id: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id: dto.customerId, organizationId } },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('고객을 찾을 수 없습니다.');

    const quotation = await this.prisma.$transaction(async (tx) => {
      const quotationNo = await this.docSeq.generateNo(organizationId, DocumentSequenceType.QUOTATION, tx);
      const created = await tx.quotation.create({
        data: {
          organizationId,
          quotationNo,
          type: dto.type,
          customerId: dto.customerId,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          memo: dto.memo,
        },
      });
      for (const item of dto.items) {
        await tx.quotationItem.create({
          data: {
            organizationId,
            quotationId: created.id,
            productId: item.productId,
            assetId: item.assetId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatType: item.vatType,
            monthlyRentalPrice: item.monthlyRentalPrice,
            contractMonths: item.contractMonths,
            depositAmount: item.depositAmount,
            memo: item.memo,
            ...calculateAmounts(item.quantity, item.unitPrice, item.vatType),
          },
        });
      }
      return created;
    });

    return { id: quotation.id };
  }

  async findAll(organizationId: string, query: QueryQuotationDto) {
    return this.prisma.quotation.findMany({
      where: {
        organizationId,
        ...(query.type && { type: query.type }),
        ...(query.status && { status: query.status }),
        ...(query.customerId && { customerId: query.customerId }),
      },
      include: { customer: { select: { id: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const q = await this.prisma.quotation.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: { customer: { select: { id: true } }, items: true },
    });
    if (!q) throw new NotFoundException('견적을 찾을 수 없습니다.');
    return q;
  }

  async update(organizationId: string, id: string, dto: UpdateQuotationDto): Promise<void> {
    const q = await this.prisma.quotation.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, status: true },
    });
    if (!q) throw new NotFoundException('견적을 찾을 수 없습니다.');
    if (LOCKED.includes(q.status)) throw new BadRequestException('수정할 수 없는 상태의 견적입니다.');

    await this.prisma.quotation.update({
      where: { id_organizationId: { id, organizationId } },
      data: {
        ...(dto.validUntil !== undefined && { validUntil: new Date(dto.validUntil) }),
        ...(dto.memo !== undefined && { memo: dto.memo }),
      },
    });
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const q = await this.prisma.quotation.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, status: true },
    });
    if (!q) throw new NotFoundException('견적을 찾을 수 없습니다.');
    if (q.status !== QuotationStatus.DRAFT) throw new BadRequestException('작성 중 상태의 견적만 삭제할 수 있습니다.');

    await this.prisma.quotation.delete({ where: { id_organizationId: { id, organizationId } } });
  }

  async updateStatus(organizationId: string, id: string, dto: UpdateQuotationStatusDto): Promise<void> {
    const q = await this.prisma.quotation.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, status: true },
    });
    if (!q) throw new NotFoundException('견적을 찾을 수 없습니다.');

    if (!TRANSITIONS[q.status].includes(dto.status)) {
      throw new BadRequestException(`${q.status} 상태에서 ${dto.status}로 전환할 수 없습니다.`);
    }

    await this.prisma.quotation.update({
      where: { id_organizationId: { id, organizationId } },
      data: {
        status: dto.status,
        ...(dto.status === QuotationStatus.SENT && { sentAt: new Date() }),
      },
    });
  }

  async addItem(organizationId: string, quotationId: string, dto: CreateQuotationItemDto): Promise<{ id: string }> {
    const q = await this.prisma.quotation.findUnique({
      where: { id_organizationId: { id: quotationId, organizationId } },
      select: { id: true, status: true },
    });
    if (!q) throw new NotFoundException('견적을 찾을 수 없습니다.');
    if (LOCKED.includes(q.status)) throw new BadRequestException('수정할 수 없는 상태의 견적입니다.');

    const item = await this.prisma.quotationItem.create({
      data: {
        organizationId,
        quotationId,
        productId: dto.productId,
        assetId: dto.assetId,
        description: dto.description,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        vatType: dto.vatType,
        monthlyRentalPrice: dto.monthlyRentalPrice,
        contractMonths: dto.contractMonths,
        depositAmount: dto.depositAmount,
        memo: dto.memo,
        ...calculateAmounts(dto.quantity, dto.unitPrice, dto.vatType),
      },
    });
    return { id: item.id };
  }

  async updateItem(
    organizationId: string,
    quotationId: string,
    itemId: string,
    dto: UpdateQuotationItemDto,
  ): Promise<void> {
    const q = await this.prisma.quotation.findUnique({
      where: { id_organizationId: { id: quotationId, organizationId } },
      select: { id: true, status: true },
    });
    if (!q) throw new NotFoundException('견적을 찾을 수 없습니다.');
    if (LOCKED.includes(q.status)) throw new BadRequestException('수정할 수 없는 상태의 견적입니다.');

    const item = await this.prisma.quotationItem.findFirst({
      where: { id: itemId, quotationId, organizationId },
      select: { id: true, quantity: true, unitPrice: true, vatType: true },
    });
    if (!item) throw new NotFoundException('견적 항목을 찾을 수 없습니다.');

    const qty = dto.quantity ?? item.quantity;
    const price = dto.unitPrice ?? item.unitPrice;
    const vat = dto.vatType ?? item.vatType;

    await this.prisma.quotationItem.update({
      where: { id: itemId },
      data: {
        ...(dto.productId !== undefined && { productId: dto.productId }),
        ...(dto.assetId !== undefined && { assetId: dto.assetId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.unitPrice !== undefined && { unitPrice: dto.unitPrice }),
        ...(dto.vatType !== undefined && { vatType: dto.vatType }),
        ...(dto.monthlyRentalPrice !== undefined && { monthlyRentalPrice: dto.monthlyRentalPrice }),
        ...(dto.contractMonths !== undefined && { contractMonths: dto.contractMonths }),
        ...(dto.depositAmount !== undefined && { depositAmount: dto.depositAmount }),
        ...(dto.memo !== undefined && { memo: dto.memo }),
        ...calculateAmounts(qty, price, vat),
      },
    });
  }

  async removeItem(organizationId: string, quotationId: string, itemId: string): Promise<void> {
    const q = await this.prisma.quotation.findUnique({
      where: { id_organizationId: { id: quotationId, organizationId } },
      select: { id: true, status: true },
    });
    if (!q) throw new NotFoundException('견적을 찾을 수 없습니다.');
    if (LOCKED.includes(q.status)) throw new BadRequestException('수정할 수 없는 상태의 견적입니다.');

    const item = await this.prisma.quotationItem.findFirst({
      where: { id: itemId, quotationId, organizationId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('견적 항목을 찾을 수 없습니다.');

    await this.prisma.quotationItem.delete({ where: { id: itemId } });
  }

  async convert(organizationId: string, quotationId: string, dto: ConvertQuotationDto): Promise<{ orderId: string }> {
    const q = await this.prisma.quotation.findUnique({
      where: { id_organizationId: { id: quotationId, organizationId } },
      include: { items: true },
    });
    if (!q) throw new NotFoundException('견적을 찾을 수 없습니다.');

    if (
      ([QuotationStatus.DRAFT, QuotationStatus.REJECTED, QuotationStatus.EXPIRED] as QuotationStatus[]).includes(
        q.status,
      )
    ) {
      throw new BadRequestException('수락 가능한 상태의 견적만 변환할 수 있습니다.');
    }
    if (q.convertedOrderId) throw new ConflictException('이미 주문으로 변환된 견적입니다.');

    const orderId = await this.prisma.$transaction(async (tx) => {
      const orderNo = await this.docSeq.generateNo(organizationId, DocumentSequenceType.ORDER, tx);
      const order = await tx.order.create({
        data: {
          organizationId,
          orderNo,
          type: q.type,
          status: OrderStatus.REGISTERED,
          customerId: q.customerId,
          managerId: dto.managerId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
          memo: dto.memo,
        },
      });

      const overrideMap = new Map(dto.items?.map((o) => [o.quotationItemId, o]) ?? []);

      if (q.type === OrderType.SALE) {
        const saleOrder = await tx.saleOrder.create({
          data: { organizationId, orderId: order.id, saleDate: new Date() },
        });
        for (const qi of q.items) {
          const ov = overrideMap.get(qi.id);
          const qty = ov?.quantity ?? qi.quantity;
          const price = ov?.unitPrice ?? qi.unitPrice;
          const vat = ov?.vatType ?? qi.vatType;
          await tx.saleOrderItem.create({
            data: {
              organizationId,
              saleOrderId: saleOrder.id,
              productId: qi.productId,
              assetId: qi.assetId,
              quantity: qty,
              unitPrice: price,
              vatType: vat,
              memo: ov?.memo ?? qi.memo,
              ...calculateAmounts(qty, price, vat),
            },
          });
        }
      } else {
        const rentalOrder = await tx.rentalOrder.create({
          data: { organizationId, orderId: order.id, contractDate: new Date() },
        });
        for (const qi of q.items) {
          const ov = overrideMap.get(qi.id);
          await tx.rentalOrderItem.create({
            data: {
              organizationId,
              rentalOrderId: rentalOrder.id,
              productId: qi.productId,
              assetId: qi.assetId,
              monthlyRentalPrice: ov?.monthlyRentalPrice ?? qi.monthlyRentalPrice ?? 0,
              depositAmount: ov?.depositAmount ?? qi.depositAmount,
              memo: ov?.memo ?? qi.memo,
            },
          });
        }
      }

      await tx.quotation.update({
        where: { id_organizationId: { id: quotationId, organizationId } },
        data: { status: QuotationStatus.ACCEPTED, convertedOrderId: order.id, convertedAt: new Date() },
      });

      return order.id;
    });

    return { orderId };
  }
}
