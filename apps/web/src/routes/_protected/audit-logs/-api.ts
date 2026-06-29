import { api } from '@/lib/api';
import { PAGE_SIZE, paginated } from '@/lib/pagination';
import type { AuditLogItem, AuditAction } from './-types';

export type AuditLogFilters = {
  action?: AuditAction;
  targetType?: string;
};

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  list: (filters: AuditLogFilters, page: number) => [...auditLogKeys.all, 'list', filters, page] as const,
};

export const fetchAuditLogs = (filters: AuditLogFilters, page = 1) =>
  api.get<AuditLogItem[]>('/audit-logs', { params: { ...filters, page, limit: PAGE_SIZE } }).then(paginated);
