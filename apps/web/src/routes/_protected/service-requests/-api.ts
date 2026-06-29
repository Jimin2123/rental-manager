import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ServiceRequestListItem, ServiceRequestDetail, ServiceRequestStatus, ServiceRequestType } from './-types';

export type ServiceRequestFilters = {
  status?: ServiceRequestStatus;
  type?: ServiceRequestType;
};

export const serviceRequestKeys = {
  all: ['service-requests'] as const,
  lists: () => [...serviceRequestKeys.all, 'list'] as const,
  list: (filters: ServiceRequestFilters) => [...serviceRequestKeys.all, 'list', filters] as const,
  detail: (id: string) => [...serviceRequestKeys.all, 'detail', id] as const,
};

export const fetchServiceRequests = (filters: ServiceRequestFilters) =>
  api.get<ServiceRequestListItem[]>('/service-requests', { params: { ...filters, limit: 100 } }).then((r) => r.data);

export const fetchServiceRequest = (id: string) =>
  api.get<ServiceRequestDetail>(`/service-requests/${id}`).then((r) => r.data);

export function invalidateServiceRequest(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: serviceRequestKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
}
