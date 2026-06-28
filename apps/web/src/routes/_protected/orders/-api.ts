import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { OrderListItem, OrderDetail, OrderType, OrderStatus } from './-types';

export type OrderListFilters = { type?: OrderType; status?: OrderStatus };

// ─── 쿼리 키 팩토리 ───────────────────────────────────────────────
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrderListFilters = {}) => [...orderKeys.all, 'list', filters] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
};

// ─── 조회 함수 ────────────────────────────────────────────────────
export const fetchOrders = (filters: OrderListFilters) =>
  api
    .get<OrderListItem[]>('/orders', {
      params: {
        ...(filters.type && { type: filters.type }),
        ...(filters.status && { status: filters.status }),
      },
    })
    .then((r) => r.data);

export const fetchOrder = (id: string) => api.get<OrderDetail>(`/orders/${id}`).then((r) => r.data);

// ─── 무효화 헬퍼 ──────────────────────────────────────────────────
export function invalidateOrder(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: orderKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: orderKeys.lists() });
}

// ─── 품목 입력용 옵션 ─────────────────────────────────────────────
export type ProductOption = { id: string; name: string };
export type AssetOption = { id: string; serialNumber: string };

export const fetchProductOptions = () =>
  api
    .get<Array<{ id: string; name: string }>>('/products')
    .then((r) => r.data.map((p) => ({ id: p.id, name: p.name })));

// 제품의 가용(AVAILABLE) 자산만.
export const fetchAssetOptions = (productId: string) =>
  api
    .get<Array<{ id: string; serialNumber: string }>>('/assets', {
      params: { productId, status: 'AVAILABLE' },
    })
    .then((r) => r.data.map((a) => ({ id: a.id, serialNumber: a.serialNumber })));
