import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
  list: (filters: InvoiceFilters) => [...invoiceKeys.all, 'list', filters] as const,
  detail: (id: string) => [...invoiceKeys.all, 'detail', id] as const,
};

// 백엔드 GET /invoices는 서버사이드 필터를 지원한다. limit은 최대 100(DTO 제약).
export const fetchInvoices = (filters: InvoiceFilters) =>
  api.get<InvoiceListItem[]>('/invoices', { params: { ...filters, limit: 100 } }).then((r) => r.data);

export const fetchInvoice = (id: string) => api.get<InvoiceDetail>(`/invoices/${id}`).then((r) => r.data);

export function invalidateInvoice(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: invoiceKeys.lists() });
}
