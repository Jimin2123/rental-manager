import type { QuotationType, VatType } from '../-types';

// 품목 입력 1행 — 판매/렌탈 필드를 한 모델에 담는다.
// 백엔드 CreateQuotationItemDto는 렌탈이어도 quantity/unitPrice/vatType이 필수다.
export type ItemRow = {
  productId: string;
  assetId: string; // '' = 미선택
  quantity: number;
  unitPrice: number;
  vatType: VatType;
  // 렌탈
  monthlyRentalPrice: number;
  contractMonths: number;
  depositAmount: number;
};

export function emptyItemRow(): ItemRow {
  return {
    productId: '',
    assetId: '',
    quantity: 1,
    unitPrice: 0,
    vatType: 'INCLUDED',
    monthlyRentalPrice: 0,
    contractMonths: 12,
    depositAmount: 0,
  };
}

export type CreateQuotationItemBody = {
  productId: string;
  assetId?: string;
  quantity: number;
  unitPrice: number;
  vatType: VatType;
  monthlyRentalPrice?: number;
  contractMonths?: number;
  depositAmount?: number;
};

export type CreateQuotationBody = {
  type: QuotationType;
  customerId: string;
  validUntil?: string;
  memo?: string;
  items: CreateQuotationItemBody[];
};

export type QuotationFormState = {
  type: QuotationType;
  customerId: string;
  validUntil: string;
  memo: string;
  items: ItemRow[];
};

// 품목 1행 → 생성 바디. 렌탈이면 렌탈 필드를 덧붙인다.
export function itemRowToBody(type: QuotationType, i: ItemRow): CreateQuotationItemBody {
  const base: CreateQuotationItemBody = {
    productId: i.productId,
    ...(i.assetId && { assetId: i.assetId }),
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    vatType: i.vatType,
  };
  if (type === 'RENTAL') {
    return {
      ...base,
      monthlyRentalPrice: i.monthlyRentalPrice,
      contractMonths: i.contractMonths,
      ...(i.depositAmount > 0 && { depositAmount: i.depositAmount }),
    };
  }
  return base;
}

export function buildCreateQuotationBody(s: QuotationFormState): CreateQuotationBody {
  return {
    type: s.type,
    customerId: s.customerId,
    ...(s.validUntil && { validUntil: new Date(s.validUntil).toISOString() }),
    ...(s.memo && { memo: s.memo }),
    items: s.items.map((i) => itemRowToBody(s.type, i)),
  };
}

// 등록 가능: 고객 선택 + 품목 1개 이상 + 각 품목 제품 선택됨.
export function isSubmittable(s: QuotationFormState): boolean {
  return s.customerId !== '' && s.items.length > 0 && s.items.every((i) => i.productId !== '');
}
