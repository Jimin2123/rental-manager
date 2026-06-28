import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentSequenceType, InvoiceStatus, TaxInvoiceStatus, TaxInvoiceType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceDocumentSequenceService } from '../common/document-sequence.service';
import type { CreateTaxInvoiceDto } from './dto/create-tax-invoice.dto';
import type { AmendTaxInvoiceDto } from './dto/amend-tax-invoice.dto';
import type { QueryTaxInvoiceDto } from './dto/query-tax-invoice.dto';

@Injectable()
export class TaxInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: FinanceDocumentSequenceService,
  ) {}

  async create(organizationId: string, _memberId: string, dto: CreateTaxInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id_organizationId: { id: dto.invoiceId, organizationId } },
      include: { items: true, taxInvoice: true },
    });
    if (!invoice) throw new NotFoundException('청구서를 찾을 수 없습니다.');
    if (invoice.status !== InvoiceStatus.ISSUED)
      throw new BadRequestException('ISSUED 상태의 청구서에만 세금계산서를 발행할 수 있습니다.');
    if (invoice.taxInvoice) throw new ConflictException('이미 세금계산서가 발행된 청구서입니다.');

    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id: invoice.customerId, organizationId } },
      include: { businessPartner: { include: { businessProfile: true } } },
    });
    if (!customer?.businessPartner?.businessProfile)
      throw new BadRequestException('사업자 정보가 없는 고객에게는 세금계산서를 발행할 수 없습니다.');

    const bp = customer.businessPartner.businessProfile;
    const supplyAmount = invoice.items.reduce((sum, item) => sum + item.supplyAmount, 0);
    const vatAmount = invoice.items.reduce((sum, item) => sum + item.vatAmount, 0);
    const totalAmount = supplyAmount + vatAmount;

    return this.prisma.$transaction(async (tx) => {
      const taxInvoiceNo = await this.docSeq.generateNo(organizationId, DocumentSequenceType.TAX_INVOICE, tx);
      return tx.taxInvoice.create({
        data: {
          organizationId,
          taxInvoiceNo,
          type: TaxInvoiceType.TAX_INVOICE,
          invoiceId: dto.invoiceId,
          customerId: invoice.customerId,
          buyerBusinessNo: bp.businessRegistrationNo,
          buyerName: bp.name,
          buyerCeoName: bp.representativeName,
          buyerEmail: bp.email,
          supplyAmount,
          vatAmount,
          totalAmount,
          issueDate: new Date(dto.issueDate),
          status: TaxInvoiceStatus.ISSUED,
        },
        select: { id: true },
      });
    });
  }

  findAll(organizationId: string, dto: QueryTaxInvoiceDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    return this.prisma.taxInvoice.findMany({
      where: {
        organizationId,
        ...(dto.type && { type: dto.type }),
        ...(dto.status && { status: dto.status }),
        ...(dto.customerId && { customerId: dto.customerId }),
        ...(dto.issueDateFrom || dto.issueDateTo
          ? {
              issueDate: {
                ...(dto.issueDateFrom && { gte: new Date(dto.issueDateFrom) }),
                ...(dto.issueDateTo && { lte: new Date(dto.issueDateTo) }),
              },
            }
          : {}),
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
      orderBy: { issueDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(organizationId: string, id: string) {
    const taxInvoice = await this.prisma.taxInvoice.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: {
        invoice: { select: { id: true, invoiceNo: true } },
        amendments: { select: { id: true, taxInvoiceNo: true, status: true } },
        customer: {
          select: {
            id: true,
            individualProfile: { select: { name: true } },
            businessPartner: { select: { businessProfile: { select: { name: true } } } },
          },
        },
      },
    });
    if (!taxInvoice) throw new NotFoundException('세금계산서를 찾을 수 없습니다.');
    return taxInvoice;
  }

  async cancel(organizationId: string, id: string) {
    const taxInvoice = await this.prisma.taxInvoice.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { status: true },
    });
    if (!taxInvoice) throw new NotFoundException('세금계산서를 찾을 수 없습니다.');
    if (taxInvoice.status !== TaxInvoiceStatus.ISSUED)
      throw new BadRequestException('ISSUED 상태의 세금계산서만 취소할 수 있습니다.');

    await this.prisma.taxInvoice.update({
      where: { id_organizationId: { id, organizationId } },
      data: { status: TaxInvoiceStatus.CANCELED },
    });
  }

  async amend(organizationId: string, originalId: string, dto: AmendTaxInvoiceDto) {
    const original = await this.prisma.taxInvoice.findUnique({
      where: { id_organizationId: { id: originalId, organizationId } },
      include: { invoice: { include: { items: true } } },
    });
    if (!original) throw new NotFoundException('원본 세금계산서를 찾을 수 없습니다.');
    if (original.status !== TaxInvoiceStatus.ISSUED)
      throw new BadRequestException('ISSUED 상태의 세금계산서만 수정할 수 있습니다.');

    return this.prisma.$transaction(async (tx) => {
      const taxInvoiceNo = await this.docSeq.generateNo(organizationId, DocumentSequenceType.TAX_INVOICE, tx);
      return tx.taxInvoice.create({
        data: {
          organizationId,
          taxInvoiceNo,
          type: TaxInvoiceType.CREDIT_NOTE,
          originalTaxInvoiceId: originalId,
          customerId: original.customerId,
          buyerBusinessNo: original.buyerBusinessNo,
          buyerName: original.buyerName,
          buyerCeoName: original.buyerCeoName,
          buyerEmail: original.buyerEmail,
          supplyAmount: original.supplyAmount,
          vatAmount: original.vatAmount,
          totalAmount: original.totalAmount,
          issueDate: new Date(dto.issueDate),
          status: TaxInvoiceStatus.ISSUED,
        },
        select: { id: true },
      });
    });
  }
}
