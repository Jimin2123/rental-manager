export type OrderType = 'SALE' | 'RENTAL';
export type OrderStatus = 'REGISTERED' | 'CONFIRMED' | 'IN_DELIVERY' | 'DELIVERED' | 'CANCELED';
export type VatType = 'NONE' | 'INCLUDED';

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  SALE: '판매',
  RENTAL: '렌탈',
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  REGISTERED: '등록',
  CONFIRMED: '확정',
  IN_DELIVERY: '배송중',
  DELIVERED: '납품완료',
  CANCELED: '취소',
};

// 백엔드 ORDER_TRANSITIONS 미러 — UI는 허용된 다음 상태 버튼만 노출한다.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  REGISTERED: ['CONFIRMED', 'CANCELED'],
  CONFIRMED: ['IN_DELIVERY', 'CANCELED'],
  IN_DELIVERY: ['DELIVERED', 'CANCELED'],
  DELIVERED: [],
  CANCELED: [],
};

import type { CustomerRef } from '@/lib/customer';
export type { CustomerRef };

export type ManagerRef = { id: string; name: string } | null;

export type SaleItem = {
  id: string;
  productId: string;
  product: { name: string };
  serialNumber: string | null;
  assetId: string | null;
  quantity: number;
  unitPrice: number;
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
  vatType: VatType;
};

export type RentalItem = {
  id: string;
  productId: string;
  product: { name: string };
  serialNumber: string | null;
  assetId: string | null;
  monthlyRentalPrice: number;
  depositAmount: number | null;
  installationLocation: string | null;
};

export type OrderListItem = {
  id: string;
  orderNo: string;
  type: OrderType;
  status: OrderStatus;
  orderDate: string;
  createdAt: string;
  customer: CustomerRef;
  manager: ManagerRef;
  saleOrder: { items: SaleItem[] } | null;
  rentalOrder: { id: string; items: RentalItem[]; contract: { id: string; status: string } | null } | null;
};

export type OrderDetail = OrderListItem & { memo: string | null };

export { customerNameOf } from '@/lib/customer';

// 합계: 판매=품목 totalAmount 합, 렌탈=월 렌탈료 합.
export function orderTotal(o: Pick<OrderListItem, 'saleOrder' | 'rentalOrder'>): number {
  if (o.saleOrder) return o.saleOrder.items.reduce((s, i) => s + i.totalAmount, 0);
  if (o.rentalOrder) return o.rentalOrder.items.reduce((s, i) => s + i.monthlyRentalPrice, 0);
  return 0;
}
