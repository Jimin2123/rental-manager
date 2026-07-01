import type { OrderType, VatType, SaleItem, RentalItem } from '../-types';

// 품목 입력 1행 — 판매/렌탈 필드를 한 모델에 담고, 거래종류에 따라 사용 필드만 전송한다.
export type ItemRow = {
  productId: string;
  assetId: string; // '' = 미선택
  serialNumber: string;
  // 판매
  quantity: number;
  unitPrice: number;
  vatType: VatType;
  // 렌탈
  monthlyRentalPrice: number;
  depositAmount: number;
  installationLocation: string;
};

export function emptyItemRow(): ItemRow {
  return {
    productId: '',
    assetId: '',
    serialNumber: '',
    quantity: 1,
    unitPrice: 0,
    vatType: 'INCLUDED',
    monthlyRentalPrice: 0,
    depositAmount: 0,
    installationLocation: '',
  };
}

export type CreateOrderBody = {
  type: OrderType;
  customerId: string;
  managerId?: string;
  orderDate?: string;
  memo?: string;
  saleOrder?: {
    items: Array<{
      productId: string;
      assetId?: string;
      serialNumber?: string;
      quantity: number;
      unitPrice: number;
      vatType: VatType;
    }>;
  };
  rentalOrder?: {
    items: Array<{
      productId: string;
      assetId?: string;
      serialNumber?: string;
      monthlyRentalPrice: number;
      depositAmount?: number;
      installationLocation?: string;
    }>;
  };
};

export type OrderFormState = {
  type: OrderType;
  customerId: string;
  managerId: string;
  orderDate: string;
  memo: string;
  items: ItemRow[];
};

export function buildCreateOrderBody(s: OrderFormState): CreateOrderBody {
  const base = {
    type: s.type,
    customerId: s.customerId,
    ...(s.managerId && { managerId: s.managerId }),
    ...(s.orderDate && { orderDate: new Date(s.orderDate).toISOString() }),
    ...(s.memo && { memo: s.memo }),
  };
  if (s.type === 'SALE') {
    return {
      ...base,
      saleOrder: {
        items: s.items.map((i) => ({
          productId: i.productId,
          ...(i.assetId && { assetId: i.assetId }),
          ...(i.serialNumber && { serialNumber: i.serialNumber }),
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          vatType: i.vatType,
        })),
      },
    };
  }
  return {
    ...base,
    rentalOrder: {
      items: s.items.map((i) => ({
        productId: i.productId,
        ...(i.assetId && { assetId: i.assetId }),
        ...(i.serialNumber && { serialNumber: i.serialNumber }),
        monthlyRentalPrice: i.monthlyRentalPrice,
        ...(i.depositAmount > 0 && { depositAmount: i.depositAmount }),
        ...(i.installationLocation && { installationLocation: i.installationLocation }),
      })),
    },
  };
}

// 등록 가능 여부: 고객 선택 + 품목 1개 이상 + 각 품목 제품 선택됨. 렌탈은 자산도 필수.
export function isSubmittable(s: OrderFormState): boolean {
  if (s.customerId === '' || s.items.length === 0) return false;
  return s.items.every((i) => {
    if (i.productId === '') return false;
    if (s.type === 'RENTAL' && i.assetId === '') return false;
    return true;
  });
}

// 서버 응답 품목 → ItemRow 변환 (수정 폼 초기화에 사용)
export function saleItemsToRows(items: SaleItem[]): ItemRow[] {
  return items.map((i) => ({
    productId: i.productId,
    assetId: i.assetId ?? '',
    serialNumber: i.serialNumber ?? '',
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    vatType: i.vatType,
    monthlyRentalPrice: 0,
    depositAmount: 0,
    installationLocation: '',
  }));
}

export function rentalItemsToRows(items: RentalItem[]): ItemRow[] {
  return items.map((i) => ({
    productId: i.productId,
    assetId: i.assetId ?? '',
    serialNumber: i.serialNumber ?? '',
    quantity: 1,
    unitPrice: 0,
    vatType: 'INCLUDED' as VatType,
    monthlyRentalPrice: i.monthlyRentalPrice,
    depositAmount: i.depositAmount ?? 0,
    installationLocation: i.installationLocation ?? '',
  }));
}

// ItemRow → API 요청 배열 변환 (수정 요청 body 구성에 사용)
export function buildSaleItemsPayload(rows: ItemRow[]) {
  return rows.map((i) => ({
    productId: i.productId,
    ...(i.assetId && { assetId: i.assetId }),
    ...(i.serialNumber && { serialNumber: i.serialNumber }),
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    vatType: i.vatType,
  }));
}

export function buildRentalItemsPayload(rows: ItemRow[]) {
  return rows.map((i) => ({
    productId: i.productId,
    ...(i.assetId && { assetId: i.assetId }),
    ...(i.serialNumber && { serialNumber: i.serialNumber }),
    monthlyRentalPrice: i.monthlyRentalPrice,
    ...(i.depositAmount > 0 && { depositAmount: i.depositAmount }),
    ...(i.installationLocation && { installationLocation: i.installationLocation }),
  }));
}
