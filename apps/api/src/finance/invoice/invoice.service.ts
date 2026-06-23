import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentSequenceType, InvoiceItemType, InvoiceStatus, InvoiceType, VatType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceDocumentSequenceService } from '../common/document-sequence.service';
import { calculateAmounts } from '../common/amount.util';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';
import type { CreateInvoiceItemDto } from './dto/create-invoice-item.dto';
import type { CreateInvoiceAdjustmentDto } from './dto/create-invoice-adjustment.dto';
import type { QueryInvoiceDto } from './dto/query-invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: FinanceDocumentSequenceService,
  ) {}

  async create(organizationId: string, memberId: string, dto: CreateInvoiceDto) {
    if (dto.type === InvoiceType.RENTAL_MONTHLY) {
      throw new BadRequestException('RENTAL_MONTHLY 청구서는 시스템이 자동 생성합니다.');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id: dto.customerId, organizationId } },
    });
    if (!customer) throw new NotFoundException('고객을 찾을 수 없습니다.');

    return this.prisma.$transaction(async (tx) => {
      const invoiceNo = await this.docSeq.generateNo(organizationId, DocumentSequenceType.INVOICE, tx);
      return tx.invoice.create({
        data: {
          organizationId,
          invoiceNo,
          type: dto.type,
          customerId: dto.customerId,
          saleOrderId: dto.saleOrderId,
          rentalContractId: dto.rentalContractId,
          serviceRequestId: dto.serviceRequestId,
          billingMonth: dto.billingMonth,
          periodStart: dto.periodStart ? new Date(dto.periodStart) : undefined,
          periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          createdById: memberId,
          memo: dto.memo,
        },
        select: { id: true },
      });
    });
  }

  findAll(organizationId: string, dto: QueryInvoiceDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    return this.prisma.invoice.findMany({
      where: {
        organizationId,
        ...(dto.type && { type: dto.type }),
        ...(dto.status && { status: dto.status }),
        ...(dto.settlementStatus && { settlementStatus: dto.settlementStatus }),
        ...(dto.billingMonth && { billingMonth: dto.billingMonth }),
        ...(dto.customerId && { customerId: dto.customerId }),
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(organizationId: string, id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: { items: true, adjustments: true, allocations: { include: { payment: true } } },
    });
    if (!invoice) throw new NotFoundException('청구서를 찾을 수 없습니다.');
    return invoice;
  }

  async update(organizationId: string, id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { status: true },
    });
    if (!invoice) throw new NotFoundException('청구서를 찾을 수 없습니다.');
    if (invoice.status !== InvoiceStatus.DRAFT)
      throw new BadRequestException('DRAFT 상태의 청구서만 수정할 수 있습니다.');

    await this.prisma.invoice.update({
      where: { id_organizationId: { id, organizationId } },
      data: {
        ...(dto.customerId && { customerId: dto.customerId }),
        ...(dto.billingMonth !== undefined && { billingMonth: dto.billingMonth }),
        ...(dto.periodStart && { periodStart: new Date(dto.periodStart) }),
        ...(dto.periodEnd && { periodEnd: new Date(dto.periodEnd) }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.memo !== undefined && { memo: dto.memo }),
      },
    });
  }

  async issue(organizationId: string, id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { status: true },
    });
    if (!invoice) throw new NotFoundException('청구서를 찾을 수 없습니다.');
    if (invoice.status !== InvoiceStatus.DRAFT)
      throw new BadRequestException('DRAFT 상태의 청구서만 발행할 수 있습니다.');

    await this.prisma.invoice.update({
      where: { id_organizationId: { id, organizationId } },
      data: { status: InvoiceStatus.ISSUED, issuedAt: new Date() },
    });
  }

  async cancel(organizationId: string, id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { status: true, paidAmount: true },
    });
    if (!invoice) throw new NotFoundException('청구서를 찾을 수 없습니다.');
    if (invoice.status !== InvoiceStatus.ISSUED)
      throw new BadRequestException('ISSUED 상태의 청구서만 취소할 수 있습니다.');
    if (invoice.paidAmount > 0)
      throw new BadRequestException('수납된 금액이 있어 취소할 수 없습니다. 환불 처리 후 취소하세요.');

    await this.prisma.invoice.update({
      where: { id_organizationId: { id, organizationId } },
      data: { status: InvoiceStatus.CANCELED },
    });
  }

  async addItem(organizationId: string, invoiceId: string, dto: CreateInvoiceItemDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id_organizationId: { id: invoiceId, organizationId } },
      select: { status: true },
    });
    if (!invoice) throw new NotFoundException('청구서를 찾을 수 없습니다.');
    if (invoice.status !== InvoiceStatus.DRAFT)
      throw new BadRequestException('DRAFT 상태의 청구서에만 항목을 추가할 수 있습니다.');

    const vatType = dto.vatType ?? VatType.INCLUDED;
    const { supplyAmount, vatAmount, totalAmount } = calculateAmounts(dto.quantity, dto.unitPrice, vatType);

    const item = await this.prisma.invoiceItem.create({
      data: {
        organizationId,
        invoiceId,
        type: dto.type,
        description: dto.description,
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        supplyAmount,
        vatType,
        vatAmount,
        totalAmount,
        saleOrderItemId: dto.saleOrderItemId,
        rentalOrderItemId: dto.rentalOrderItemId,
        rentalContractItemId: dto.rentalContractItemId,
        memo: dto.memo,
      },
      select: { id: true },
    });

    return { id: item.id };
  }

  async removeItem(organizationId: string, invoiceId: string, itemId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id_organizationId: { id: invoiceId, organizationId } },
      select: { status: true },
    });
    if (!invoice) throw new NotFoundException('청구서를 찾을 수 없습니다.');
    if (invoice.status !== InvoiceStatus.DRAFT)
      throw new BadRequestException('DRAFT 상태의 청구서에서만 항목을 삭제할 수 있습니다.');

    const item = await this.prisma.invoiceItem.findFirst({
      where: { id: itemId, invoiceId, organizationId },
    });
    if (!item) throw new NotFoundException('청구 항목을 찾을 수 없습니다.');

    await this.prisma.invoiceItem.delete({ where: { id: itemId } });
  }

  async addAdjustment(organizationId: string, invoiceId: string, dto: CreateInvoiceAdjustmentDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id_organizationId: { id: invoiceId, organizationId } },
      select: { status: true },
    });
    if (!invoice) throw new NotFoundException('청구서를 찾을 수 없습니다.');
    if (invoice.status !== InvoiceStatus.DRAFT)
      throw new BadRequestException('DRAFT 상태의 청구서에만 조정 항목을 추가할 수 있습니다.');

    const adjustment = await this.prisma.invoiceAdjustment.create({
      data: { organizationId, invoiceId, type: dto.type, amount: dto.amount, reason: dto.reason, memo: dto.memo },
      select: { id: true },
    });

    return { id: adjustment.id };
  }

  async createRentalMonthlyInvoice(
    organizationId: string,
    contractId: string,
    billingMonth: string,
    contractItems: Array<{ id: string; monthlyRentalPrice: number }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoiceNo = await this.docSeq.generateNo(organizationId, DocumentSequenceType.INVOICE, tx);

      const contract = await tx.rentalContract.findUnique({
        where: { id_organizationId: { id: contractId, organizationId } },
        include: { rentalOrder: { include: { order: true } } },
      });
      if (!contract) return null;

      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNo,
          type: InvoiceType.RENTAL_MONTHLY,
          customerId: contract.rentalOrder.order.customerId,
          rentalContractId: contractId,
          billingMonth,
        },
        select: { id: true },
      });

      for (const item of contractItems) {
        const { supplyAmount, vatAmount, totalAmount } = calculateAmounts(1, item.monthlyRentalPrice, VatType.INCLUDED);
        await tx.invoiceItem.create({
          data: {
            organizationId,
            invoiceId: invoice.id,
            rentalContractItemId: item.id,
            type: InvoiceItemType.RENTAL_FEE,
            quantity: 1,
            unitPrice: item.monthlyRentalPrice,
            supplyAmount,
            vatType: VatType.INCLUDED,
            vatAmount,
            totalAmount,
          },
        });
      }

      return invoice;
    });
  }
}
