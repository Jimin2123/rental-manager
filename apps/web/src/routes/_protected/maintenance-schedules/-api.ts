import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MaintenanceScheduleListItem, MaintenanceScheduleDetail } from './-types';

export type ScheduleFilters = {
  isActive?: boolean;
};

export const scheduleKeys = {
  all: ['maintenance-schedules'] as const,
  lists: () => [...scheduleKeys.all, 'list'] as const,
  list: (filters: ScheduleFilters) => [...scheduleKeys.all, 'list', filters] as const,
  detail: (id: string) => [...scheduleKeys.all, 'detail', id] as const,
};

export const fetchSchedules = (filters: ScheduleFilters) =>
  api
    .get<MaintenanceScheduleListItem[]>('/maintenance-schedules', { params: { ...filters, limit: 100 } })
    .then((r) => r.data);

export const fetchSchedule = (id: string) =>
  api.get<MaintenanceScheduleDetail>(`/maintenance-schedules/${id}`).then((r) => r.data);

export function invalidateSchedule(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: scheduleKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: scheduleKeys.lists() });
}
