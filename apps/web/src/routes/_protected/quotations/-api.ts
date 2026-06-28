import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { QuotationListItem, QuotationDetail, QuotationType, QuotationStatus } from './-types';

export type QuotationListFilters = { type?: QuotationType; status?: QuotationStatus };

export const quotationKeys = {
  all: ['quotations'] as const,
  lists: () => [...quotationKeys.all, 'list'] as const,
  list: (filters: QuotationListFilters = {}) => [...quotationKeys.all, 'list', filters] as const,
  detail: (id: string) => [...quotationKeys.all, 'detail', id] as const,
};

export const fetchQuotations = (filters: QuotationListFilters) =>
  api
    .get<QuotationListItem[]>('/quotations', {
      params: {
        ...(filters.type && { type: filters.type }),
        ...(filters.status && { status: filters.status }),
      },
    })
    .then((r) => r.data);

export const fetchQuotation = (id: string) => api.get<QuotationDetail>(`/quotations/${id}`).then((r) => r.data);

export function invalidateQuotation(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: quotationKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: quotationKeys.lists() });
}
