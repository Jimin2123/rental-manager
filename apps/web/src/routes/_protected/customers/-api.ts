import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CustomerListItem, CustomerDetail } from './-types';

export type CustomerListFilters = { q?: string; isActive?: boolean };

// ─── 쿼리 키 팩토리 ───────────────────────────────────────────────
export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (filters: CustomerListFilters = {}) => [...customerKeys.all, 'list', filters] as const,
  detail: (id: string) => [...customerKeys.all, 'detail', id] as const,
};

// ─── 조회 함수 ────────────────────────────────────────────────────
export const fetchCustomers = (filters: CustomerListFilters) =>
  api
    .get<CustomerListItem[]>('/customers', {
      params: {
        ...(filters.q && { q: filters.q }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      },
    })
    .then((r) => r.data);

export const fetchCustomer = (id: string) => api.get<CustomerDetail>(`/customers/${id}`).then((r) => r.data);

// ─── 무효화 헬퍼 ──────────────────────────────────────────────────
export function invalidateCustomer(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: customerKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: customerKeys.lists() });
}
