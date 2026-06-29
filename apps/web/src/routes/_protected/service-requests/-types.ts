import type { CustomerRef } from '@/lib/customer';

export type { CustomerRef };
export { customerNameOf } from '@/lib/customer';

export type ServiceRequestStatus =
  | 'RECEIVED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_PARTS'
  | 'COMPLETED'
  | 'CANCELED';
export type ServiceRequestType = 'REPAIR' | 'MAINTENANCE' | 'INSTALLATION' | 'REMOVAL' | 'INSPECTION' | 'ETC';
export type ServiceVisitStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
export type ServiceVisitResult = 'REPAIRED' | 'PARTS_REPLACED' | 'CANNOT_REPAIR' | 'DEFERRED' | 'ETC';
export type AssetStatus = 'INCOMING' | 'AVAILABLE' | 'RENTED' | 'SOLD' | 'REPAIR' | 'DISPOSED' | 'LOST' | 'UNAVAILABLE';

export const REQUEST_STATUS_LABEL: Record<ServiceRequestStatus, string> = {
  RECEIVED: '접수',
  SCHEDULED: '방문예정',
  IN_PROGRESS: '처리중',
  WAITING_FOR_PARTS: '부품대기',
  COMPLETED: '완료',
  CANCELED: '취소',
};

export const REQUEST_TYPE_LABEL: Record<ServiceRequestType, string> = {
  REPAIR: '수리',
  MAINTENANCE: '유지보수',
  INSTALLATION: '설치',
  REMOVAL: '철거',
  INSPECTION: '점검',
  ETC: '기타',
};

export const VISIT_STATUS_LABEL: Record<ServiceVisitStatus, string> = {
  SCHEDULED: '방문예정',
  IN_PROGRESS: '처리중',
  COMPLETED: '완료',
  CANCELED: '취소',
};

export const VISIT_RESULT_LABEL: Record<ServiceVisitResult, string> = {
  REPAIRED: '수리완료',
  PARTS_REPLACED: '부품교체',
  CANNOT_REPAIR: '수리불가',
  DEFERRED: '재방문필요',
  ETC: '기타',
};

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  INCOMING: '입고예정',
  AVAILABLE: '가용',
  RENTED: '렌탈중',
  SOLD: '판매완료',
  REPAIR: '수리중',
  DISPOSED: '폐기',
  LOST: '분실',
  UNAVAILABLE: '사용불가',
};

export type AssetRef = {
  id: string;
  serialNumber: string;
  status: AssetStatus;
  product: { name: string };
};

export type ServiceRequestListItem = {
  id: string;
  requestNo: string;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  isWarranty: boolean;
  requestedVisitDate: string | null;
  createdAt: string;
  customer: CustomerRef;
  asset: AssetRef;
};

export type ServiceVisit = {
  id: string;
  status: ServiceVisitStatus;
  scheduledAt: string | null;
  visitedAt: string | null;
  result: ServiceVisitResult | null;
  workDescription: string | null;
  laborCost: number | null;
  partsCost: number | null;
  travelCost: number | null;
  requiresFollowUp: boolean;
  followUpNote: string | null;
  memo: string | null;
  staff: { id: string; name: string } | null;
};

export type ServiceRequestDetail = ServiceRequestListItem & {
  description: string | null;
  visitLocationZonecode: string | null;
  visitLocationAddress: string | null;
  visitLocationAddressDetail: string | null;
  completedAt: string | null;
  visits: ServiceVisit[];
};
