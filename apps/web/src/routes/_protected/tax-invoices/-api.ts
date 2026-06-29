import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PAGE_SIZE, paginated } from '@/lib/pagination';
import type { TaxInvoiceListItem, TaxInvoiceDetail, TaxInvoiceType, TaxInvoiceStatus } from './-types';

export type TaxInvoiceFilters = {
  type?: TaxInvoiceType;
  status?: TaxInvoiceStatus;
};

export const taxInvoiceKeys = {
  all: ['tax-invoices'] as const,
  lists: () => [...taxInvoiceKeys.all, 'list'] as const,
  list: (filters: TaxInvoiceFilters, page: number) => [...taxInvoiceKeys.all, 'list', filters, page] as const,
  detail: (id: string) => [...taxInvoiceKeys.all, 'detail', id] as const,
};

export const fetchTaxInvoices = (filters: TaxInvoiceFilters, page = 1) =>
  api.get<TaxInvoiceListItem[]>('/tax-invoices', { params: { ...filters, page, limit: PAGE_SIZE } }).then(paginated);

export const fetchTaxInvoice = (id: string) => api.get<TaxInvoiceDetail>(`/tax-invoices/${id}`).then((r) => r.data);

export function invalidateTaxInvoice(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: taxInvoiceKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: taxInvoiceKeys.lists() });
}
