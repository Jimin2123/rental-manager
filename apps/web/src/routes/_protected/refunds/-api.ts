import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RefundListItem, RefundDetail, RefundStatus, RefundReason } from './-types';

export type RefundFilters = {
  customerId?: string;
  status?: RefundStatus;
  reason?: RefundReason;
};

export const refundKeys = {
  all: ['refunds'] as const,
  lists: () => [...refundKeys.all, 'list'] as const,
  list: (filters: RefundFilters) => [...refundKeys.all, 'list', filters] as const,
  detail: (id: string) => [...refundKeys.all, 'detail', id] as const,
};

export const fetchRefunds = (filters: RefundFilters) =>
  api.get<RefundListItem[]>('/refunds', { params: { ...filters, limit: 100 } }).then((r) => r.data);

export const fetchRefund = (id: string) => api.get<RefundDetail>(`/refunds/${id}`).then((r) => r.data);

export function invalidateRefund(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: refundKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: refundKeys.lists() });
}
