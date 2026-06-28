export type QuotationType = 'SALE' | 'RENTAL';
export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type VatType = 'NONE' | 'INCLUDED';

export const QUOTATION_TYPE_LABEL: Record<QuotationType, string> = {
  SALE: '판매',
  RENTAL: '렌탈',
};

export const QUOTATION_STATUS_LABEL: Record<QuotationStatus, string> = {
  DRAFT: '작성중',
  SENT: '발송',
  ACCEPTED: '수락',
  REJECTED: '거절',
  EXPIRED: '만료',
};

// 백엔드 TRANSITIONS 미러 — UI는 허용된 다음 상태 버튼만 노출한다.
export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ['SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
  SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

// 수정·품목편집 불가 상태.
export const LOCKED_STATUSES: QuotationStatus[] = ['ACCEPTED', 'REJECTED', 'EXPIRED'];
// 주문 전환 가능 상태.
export const CONVERTIBLE_STATUSES: QuotationStatus[] = ['SENT', 'ACCEPTED'];

import type { CustomerRef } from '@/lib/customer';
export type { CustomerRef };

export type QuotationItem = {
  id: string;
  productId: string;
  product: { name: string };
  assetId: string | null;
  description: string | null;
  quantity: number;
  unitPrice: number;
  vatType: VatType;
  monthlyRentalPrice: number | null;
  contractMonths: number | null;
  depositAmount: number | null;
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
};

export type QuotationListItem = {
  id: string;
  quotationNo: string;
  type: QuotationType;
  status: QuotationStatus;
  validUntil: string | null;
  createdAt: string;
  customer: CustomerRef;
  items: QuotationItem[];
  convertedOrderId: string | null;
};

export type QuotationDetail = QuotationListItem & { memo: string | null };

export { customerNameOf } from '@/lib/customer';

// 합계: 판매=품목 totalAmount 합, 렌탈=월 렌탈료 합.
export function quotationTotal(q: Pick<QuotationListItem, 'type' | 'items'>): number {
  if (q.type === 'RENTAL') return q.items.reduce((s, i) => s + (i.monthlyRentalPrice ?? 0), 0);
  return q.items.reduce((s, i) => s + i.totalAmount, 0);
}
