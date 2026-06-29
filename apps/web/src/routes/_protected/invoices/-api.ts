import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PAGE_SIZE, paginated } from '@/lib/pagination';
import type { InvoiceListItem, InvoiceDetail, InvoiceType, InvoiceStatus, InvoiceSettlementStatus } from './-types';

export type InvoiceFilters = {
  type?: InvoiceType;
  status?: InvoiceStatus;
  settlementStatus?: InvoiceSettlementStatus;
  billingMonth?: string;
};

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters, page: number) => [...invoiceKeys.all, 'list', filters, page] as const,
  detail: (id: string) => [...invoiceKeys.all, 'detail', id] as const,
};

// 서버사이드 필터 + 페이지네이션. total은 X-Total-Count 헤더로 온다.
export const fetchInvoices = (filters: InvoiceFilters, page = 1) =>
  api.get<InvoiceListItem[]>('/invoices', { params: { ...filters, page, limit: PAGE_SIZE } }).then(paginated);

export const fetchInvoice = (id: string) => api.get<InvoiceDetail>(`/invoices/${id}`).then((r) => r.data);

export function invalidateInvoice(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: invoiceKeys.lists() });
}
