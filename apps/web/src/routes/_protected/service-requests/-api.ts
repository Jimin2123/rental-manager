import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PAGE_SIZE, paginated } from '@/lib/pagination';
import type { ServiceRequestListItem, ServiceRequestDetail, ServiceRequestStatus, ServiceRequestType } from './-types';

export type ServiceRequestFilters = {
  status?: ServiceRequestStatus;
  type?: ServiceRequestType;
};

export const serviceRequestKeys = {
  all: ['service-requests'] as const,
  lists: () => [...serviceRequestKeys.all, 'list'] as const,
  list: (filters: ServiceRequestFilters, page: number) => [...serviceRequestKeys.all, 'list', filters, page] as const,
  detail: (id: string) => [...serviceRequestKeys.all, 'detail', id] as const,
};

export const fetchServiceRequests = (filters: ServiceRequestFilters, page = 1) =>
  api
    .get<ServiceRequestListItem[]>('/service-requests', { params: { ...filters, page, limit: PAGE_SIZE } })
    .then(paginated);

export const fetchServiceRequest = (id: string) =>
  api.get<ServiceRequestDetail>(`/service-requests/${id}`).then((r) => r.data);

export function invalidateServiceRequest(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: serviceRequestKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
}
