import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PaymentListItem, PaymentDetail, PaymentMethod, PaymentStatus } from './-types';

export type PaymentFilters = {
  customerId?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
};

export const paymentKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
  list: (filters: PaymentFilters) => [...paymentKeys.all, 'list', filters] as const,
  detail: (id: string) => [...paymentKeys.all, 'detail', id] as const,
};

export const fetchPayments = (filters: PaymentFilters) =>
  api.get<PaymentListItem[]>('/payments', { params: { ...filters, limit: 100 } }).then((r) => r.data);

export const fetchPayment = (id: string) => api.get<PaymentDetail>(`/payments/${id}`).then((r) => r.data);

export function invalidatePayment(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: paymentKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: paymentKeys.lists() });
}
