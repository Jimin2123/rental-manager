export type AuditAction = 'CREATE' | 'UPDATE' | 'STATUS_CHANGE' | 'CANCEL';

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: '생성',
  UPDATE: '수정',
  STATUS_CHANGE: '상태변경',
  CANCEL: '취소',
};

// 알려진 targetType 한국어 매핑 — 미매핑은 원문 그대로 표시.
const TARGET_TYPE_LABEL: Record<string, string> = {
  Invoice: '청구서',
  Payment: '수납',
  Refund: '환불',
  TaxInvoice: '세금계산서',
  RentalContract: '계약',
  SaleOrder: '판매주문',
  Order: '주문',
  Quotation: '견적',
  Asset: '자산',
  Customer: '고객',
  ServiceRequest: 'AS접수',
  ServiceVisit: 'AS방문',
  MaintenanceSchedule: '점검일정',
};

export const targetTypeLabel = (t: string): string => TARGET_TYPE_LABEL[t] ?? t;

export type AuditLogItem = {
  id: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  before: unknown | null;
  after: unknown | null;
  reason: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
};
