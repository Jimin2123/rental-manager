import { api } from '@/lib/api';
import type { AuditLogItem, AuditAction } from './-types';

export type AuditLogFilters = {
  action?: AuditAction;
  targetType?: string;
};

export const auditLogKeys = {
  all: ['audit-logs'] as const,
  list: (filters: AuditLogFilters) => [...auditLogKeys.all, 'list', filters] as const,
};

export const fetchAuditLogs = (filters: AuditLogFilters) =>
  api.get<AuditLogItem[]>('/audit-logs', { params: { ...filters, limit: 100 } }).then((r) => r.data);
