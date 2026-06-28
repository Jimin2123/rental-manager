import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, DocumentSequenceType, RefundStatus } from '@prisma/client';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceDocumentSequenceService } from '../common/document-sequence.service';
import { computeSettlementStatus } from '../common/settlement.util';
import type { CreateRefundDto } from './dto/create-refund.dto';
import type { QueryRefundDto } from './dto/query-refund.dto';

@Injectable()
export class RefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: FinanceDocumentSequenceService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(organizationId: string, memberId: string, dto: CreateRefundDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id: dto.customerId, organizationId } },
    });
    if (!customer) throw new NotFoundException('고객을 찾을 수 없습니다.');

    return this.prisma.$transaction(async (tx) => {
      if (dto.invoiceId) {
        const invoice = await tx.invoice.findUnique({
          where: { id_organizationId: { id: dto.invoiceId, organizationId } },
          select: { paidAmount: true },
        });
        if (!invoice) throw new NotFoundException('청구서를 찾을 수 없습니다.');
        if (dto.amount > invoice.paidAmount)
          throw new BadRequestException('환불액이 수납된 금액을 초과할 수 없습니다.');
      }

      if (dto.paymentId) {
        const payment = await tx.payment.findUnique({
          where: { id_organizationId: { id: dto.paymentId, organizationId } },
          select: { amount: true },
        });
        if (!payment) throw new NotFoundException('수납 내역을 찾을 수 없습니다.');
        if (dto.amount > payment.amount) throw new BadRequestException('환불액이 수납 금액을 초과할 수 없습니다.');
      }

      const refundNo = await this.docSeq.generateNo(organizationId, DocumentSequenceType.REFUND, tx);
      const refund = await tx.refund.create({
        data: {
          organizationId,
          refundNo,
          customerId: dto.customerId,
          invoiceId: dto.invoiceId,
          paymentId: dto.paymentId,
          reason: dto.reason,
          amount: dto.amount,
          method: dto.method,
          memo: dto.memo,
          createdById: memberId,
        },
      });

      if (dto.invoiceId) {
        await this.recalcInvoiceAfterRefund(tx, organizationId, dto.invoiceId, dto.amount);
      }

      await this.auditLog.log(tx, {
        organizationId,
        actorId: memberId,
        action: AuditAction.CREATE,
        targetType: 'Refund',
        targetId: refund.id,
        after: refund,
      });

      return { id: refund.id };
    });
  }

  private async recalcInvoiceAfterRefund(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    organizationId: string,
    invoiceId: string,
    refundDelta: number,
  ) {
    const invoice = await tx.invoice.findUnique({
      where: { id_organizationId: { id: invoiceId, organizationId } },
      select: { paidAmount: true, finalAmount: true, refundedAmount: true },
    });
    if (!invoice) return;

    const newRefundedAmount = invoice.refundedAmount + refundDelta;
    const newOutstandingAmount = invoice.finalAmount - invoice.paidAmount + newRefundedAmount;
    const newSettlementStatus = computeSettlementStatus(invoice.paidAmount, invoice.finalAmount, newRefundedAmount);

    await tx.invoice.update({
      where: { id_organizationId: { id: invoiceId, organizationId } },
      data: {
        refundedAmount: newRefundedAmount,
        outstandingAmount: newOutstandingAmount,
        settlementStatus: newSettlementStatus,
      },
    });
  }

  findAll(organizationId: string, dto: QueryRefundDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    return this.prisma.refund.findMany({
      where: {
        organizationId,
        ...(dto.customerId && { customerId: dto.customerId }),
        ...(dto.status && { status: dto.status }),
        ...(dto.reason && { reason: dto.reason }),
      },
      include: {
        customer: {
          select: {
            id: true,
            individualProfile: { select: { name: true } },
            businessPartner: { select: { businessProfile: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(organizationId: string, id: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: {
        payment: { select: { id: true, paymentNo: true } },
        invoice: { select: { id: true, invoiceNo: true } },
        customer: {
          select: {
            id: true,
            individualProfile: { select: { name: true } },
            businessPartner: { select: { businessProfile: { select: { name: true } } } },
          },
        },
      },
    });
    if (!refund) throw new NotFoundException('환불 내역을 찾을 수 없습니다.');
    return refund;
  }

  async complete(organizationId: string, id: string, memberId: string) {
    const before = await this.prisma.refund.findUnique({
      where: { id_organizationId: { id, organizationId } },
    });
    if (!before) throw new NotFoundException('환불 내역을 찾을 수 없습니다.');
    if (before.status !== RefundStatus.PENDING)
      throw new BadRequestException('PENDING 상태의 환불만 완료 처리할 수 있습니다.');

    const refundedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id_organizationId: { id, organizationId } },
        data: { status: RefundStatus.COMPLETED, refundedAt },
      });
      await this.auditLog.log(tx, {
        organizationId,
        actorId: memberId,
        action: AuditAction.STATUS_CHANGE,
        targetType: 'Refund',
        targetId: id,
        before,
        after: { ...before, status: RefundStatus.COMPLETED, refundedAt },
      });
    });
  }

  async cancel(organizationId: string, id: string, memberId: string) {
    const before = await this.prisma.refund.findUnique({
      where: { id_organizationId: { id, organizationId } },
    });
    if (!before) throw new NotFoundException('환불 내역을 찾을 수 없습니다.');
    if (before.status !== RefundStatus.PENDING)
      throw new BadRequestException('PENDING 상태의 환불만 취소할 수 있습니다.');

    await this.prisma.$transaction(async (tx) => {
      if (before.invoiceId) {
        await this.recalcInvoiceAfterRefund(tx, organizationId, before.invoiceId, -before.amount);
      }
      await tx.refund.update({
        where: { id_organizationId: { id, organizationId } },
        data: { status: RefundStatus.CANCELED },
      });
      await this.auditLog.log(tx, {
        organizationId,
        actorId: memberId,
        action: AuditAction.CANCEL,
        targetType: 'Refund',
        targetId: id,
        before,
        after: { ...before, status: RefundStatus.CANCELED },
      });
    });
  }
}
