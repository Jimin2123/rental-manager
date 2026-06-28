import type { CustomerRef } from '@/lib/customer';

export type { CustomerRef };
export { customerNameOf } from '@/lib/customer';

export type InvoiceType = 'SALE' | 'RENTAL_MONTHLY' | 'SERVICE_FEE' | 'MANUAL';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELED';
export type InvoiceSettlementStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERPAID';
export type InvoiceItemType =
  | 'SALE_PRICE'
  | 'RENTAL_FEE'
  | 'METER_USAGE'
  | 'SERVICE_FEE'
  | 'INSTALLATION_FEE'
  | 'REMOVAL_FEE'
  | 'DELIVERY_FEE'
  | 'DEPOSIT'
  | 'PENALTY'
  | 'ETC';
export type InvoiceAdjustmentType =
  | 'DISCOUNT'
  | 'CANCELLATION'
  | 'RETURN'
  | 'RENTAL_PRORATION'
  | 'BILLING_ERROR'
  | 'EXTRA_CHARGE'
  | 'ETC';
export type VatType = 'NONE' | 'INCLUDED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'VIRTUAL_ACCOUNT' | 'CMS' | 'ETC';

export const INVOICE_TYPE_LABEL: Record<InvoiceType, string> = {
  SALE: '판매',
  RENTAL_MONTHLY: '월 렌탈',
  SERVICE_FEE: 'AS',
  MANUAL: '수동',
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: '작성중',
  ISSUED: '발행',
  CANCELED: '취소',
};

export const INVOICE_SETTLEMENT_LABEL: Record<InvoiceSettlementStatus, string> = {
  UNPAID: '미수납',
  PARTIALLY_PAID: '일부수납',
  PAID: '완납',
  OVERPAID: '초과수납',
};

export const INVOICE_ITEM_TYPE_LABEL: Record<InvoiceItemType, string> = {
  SALE_PRICE: '판매금액',
  RENTAL_FEE: '월 렌탈료',
  METER_USAGE: '카운터 초과',
  SERVICE_FEE: 'AS/출장비',
  INSTALLATION_FEE: '설치비',
  REMOVAL_FEE: '철거비',
  DELIVERY_FEE: '배송비',
  DEPOSIT: '보증금',
  PENALTY: '위약금',
  ETC: '기타',
};

export const INVOICE_ADJUSTMENT_TYPE_LABEL: Record<InvoiceAdjustmentType, string> = {
  DISCOUNT: '할인',
  CANCELLATION: '취소',
  RETURN: '반품',
  RENTAL_PRORATION: '일할 차감',
  BILLING_ERROR: '청구 오류',
  EXTRA_CHARGE: '추가 청구',
  ETC: '기타',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: '현금',
  BANK_TRANSFER: '계좌이체',
  CARD: '카드',
  VIRTUAL_ACCOUNT: '가상계좌',
  CMS: 'CMS',
  ETC: '기타',
};

// 백엔드 상태 전환 미러: 발행은 DRAFT→ISSUED, 취소는 ISSUED→CANCELED.
// (취소는 추가로 paidAmount===0 조건이 있어 화면에서 별도 판정한다.)
export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  DRAFT: ['ISSUED'],
  ISSUED: ['CANCELED'],
  CANCELED: [],
};

export type InvoiceListItem = {
  id: string;
  invoiceNo: string;
  type: InvoiceType;
  status: InvoiceStatus;
  settlementStatus: InvoiceSettlementStatus;
  billingMonth: string | null;
  dueDate: string | null;
  finalAmount: number;
  outstandingAmount: number;
  customer: CustomerRef;
};

export type InvoiceItem = {
  id: string;
  type: InvoiceItemType;
  description: string | null;
  quantity: number;
  unitPrice: number;
  supplyAmount: number;
  vatType: VatType;
  vatAmount: number;
  totalAmount: number;
  memo: string | null;
};

export type InvoiceAdjustment = {
  id: string;
  type: InvoiceAdjustmentType;
  amount: number;
  reason: string | null;
  memo: string | null;
};

export type InvoiceAllocation = {
  id: string;
  amount: number;
  payment: {
    id: string;
    paymentNo: string;
    method: PaymentMethod;
    paidAt: string;
  };
};

export type InvoiceDetail = InvoiceListItem & {
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  paidAmount: number;
  refundedAmount: number;
  memo: string | null;
  items: InvoiceItem[];
  adjustments: InvoiceAdjustment[];
  allocations: InvoiceAllocation[];
};
