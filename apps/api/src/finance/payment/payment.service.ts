import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  DocumentSequenceType,
  InvoiceSettlementStatus,
  InvoiceStatus,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceDocumentSequenceService } from '../common/document-sequence.service';
import { computeSettlementStatus } from '../common/settlement.util';
import type { CreatePaymentDto } from './dto/create-payment.dto';
import type { QueryPaymentDto } from './dto/query-payment.dto';

type PrismaTransaction = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: FinanceDocumentSequenceService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(organizationId: string, memberId: string, dto: CreatePaymentDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id: dto.customerId, organizationId } },
    });
    if (!customer) throw new NotFoundException('고객을 찾을 수 없습니다.');

    return this.prisma.$transaction(async (tx) => {
      const paymentNo = await this.docSeq.generateNo(organizationId, DocumentSequenceType.PAYMENT, tx);
      const payment = await tx.payment.create({
        data: {
          organizationId,
          paymentNo,
          customerId: dto.customerId,
          method: dto.method,
          provider: dto.provider ?? PaymentProvider.MANUAL,
          amount: dto.amount,
          paidAt: new Date(dto.paidAt),
          createdById: memberId,
          externalRef: dto.externalRef,
          memo: dto.memo,
        },
      });

      await this.allocateFifo(tx, organizationId, payment.id, dto.customerId, dto.amount);

      await this.auditLog.log(tx, {
        organizationId,
        actorId: memberId,
        action: AuditAction.CREATE,
        targetType: 'Payment',
        targetId: payment.id,
        after: payment,
      });

      return { id: payment.id };
    });
  }

  private async allocateFifo(
    tx: PrismaTransaction,
    organizationId: string,
    paymentId: string,
    customerId: string,
    amount: number,
  ) {
    const invoices = await tx.invoice.findMany({
      where: {
        organizationId,
        customerId,
        status: InvoiceStatus.ISSUED,
        settlementStatus: { in: [InvoiceSettlementStatus.UNPAID, InvoiceSettlementStatus.PARTIALLY_PAID] },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    let remaining = amount;

    for (const invoice of invoices) {
      if (remaining <= 0) break;

      const allocate = Math.min(remaining, invoice.outstandingAmount);
      if (allocate <= 0) continue;

      await tx.paymentAllocation.create({
        data: { organizationId, paymentId, invoiceId: invoice.id, amount: allocate },
      });

      const newPaidAmount = invoice.paidAmount + allocate;
      const newSettlementStatus = computeSettlementStatus(newPaidAmount, invoice.finalAmount, invoice.refundedAmount);
      const newOutstandingAmount = invoice.finalAmount - newPaidAmount + invoice.refundedAmount;

      await tx.invoice.update({
        where: { id_organizationId: { id: invoice.id, organizationId } },
        data: {
          paidAmount: newPaidAmount,
          outstandingAmount: newOutstandingAmount,
          settlementStatus: newSettlementStatus,
        },
      });

      remaining -= allocate;
    }
  }

  findAll(organizationId: string, dto: QueryPaymentDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    return this.prisma.payment.findMany({
      where: {
        organizationId,
        ...(dto.customerId && { customerId: dto.customerId }),
        ...(dto.method && { method: dto.method }),
        ...(dto.status && { status: dto.status }),
      },
      orderBy: { paidAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(organizationId: string, id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: { allocations: { include: { invoice: true } } },
    });
    if (!payment) throw new NotFoundException('수납 내역을 찾을 수 없습니다.');
    return payment;
  }

  async cancel(organizationId: string, id: string, memberId: string) {
    const before = await this.prisma.payment.findUnique({
      where: { id_organizationId: { id, organizationId } },
    });
    if (!before) throw new NotFoundException('수납 내역을 찾을 수 없습니다.');
    if (before.status === PaymentStatus.CANCELED) throw new BadRequestException('이미 취소된 수납입니다.');

    await this.prisma.$transaction(async (tx) => {
      const allocations = await tx.paymentAllocation.findMany({
        where: { paymentId: id, organizationId },
      });

      await tx.paymentAllocation.deleteMany({ where: { paymentId: id, organizationId } });

      for (const alloc of allocations) {
        const invoice = await tx.invoice.findUnique({
          where: { id_organizationId: { id: alloc.invoiceId, organizationId } },
          select: { paidAmount: true, finalAmount: true, refundedAmount: true },
        });
        if (!invoice) continue;

        const newPaidAmount = invoice.paidAmount - alloc.amount;
        const newSettlementStatus = computeSettlementStatus(newPaidAmount, invoice.finalAmount, invoice.refundedAmount);
        const newOutstandingAmount = invoice.finalAmount - newPaidAmount + invoice.refundedAmount;

        await tx.invoice.update({
          where: { id_organizationId: { id: alloc.invoiceId, organizationId } },
          data: {
            paidAmount: newPaidAmount,
            outstandingAmount: newOutstandingAmount,
            settlementStatus: newSettlementStatus,
          },
        });
      }

      await tx.payment.update({
        where: { id_organizationId: { id, organizationId } },
        data: { status: PaymentStatus.CANCELED },
      });

      await this.auditLog.log(tx, {
        organizationId,
        actorId: memberId,
        action: AuditAction.CANCEL,
        targetType: 'Payment',
        targetId: id,
        before,
        after: { ...before, status: PaymentStatus.CANCELED },
      });
    });
  }
}
