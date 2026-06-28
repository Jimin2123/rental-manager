export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'ENDED' | 'CANCELED';
export type ContractItemStatus = 'PENDING' | 'ACTIVE' | 'RETURNED' | 'REPLACED' | 'CANCELED';

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: '작성중',
  ACTIVE: '진행중',
  ENDED: '종료',
  CANCELED: '취소',
};

export const CONTRACT_ITEM_STATUS_LABEL: Record<ContractItemStatus, string> = {
  PENDING: '대기',
  ACTIVE: '렌탈중',
  RETURNED: '회수',
  REPLACED: '교체',
  CANCELED: '취소',
};

// 백엔드 CONTRACT_TRANSITIONS 미러.
export const CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  DRAFT: ['ACTIVE', 'CANCELED'],
  ACTIVE: ['ENDED', 'CANCELED'],
  ENDED: [],
  CANCELED: [],
};

export type CustomerRef = {
  id: string;
  individualProfile: { name: string } | null;
  businessPartner: { businessProfile: { name: string } } | null;
};

export type ContractItem = {
  id: string;
  assetId: string;
  status: ContractItemStatus;
  monthlyRentalPrice: number;
  asset: { id: string; serialNumber: string; product: { name: string } } | null;
};

export type ContractListItem = {
  id: string;
  contractNo: string;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  contractMonths: number;
  rentalOrder: { order: { customer: CustomerRef } };
  items: ContractItem[];
};

export type ContractDetail = ContractListItem & {
  billingDay: number | null;
  paymentDueDay: number | null;
  billingTiming: 'PREPAID' | 'POSTPAID';
};

export function customerNameOf(c: CustomerRef): string {
  return c.individualProfile?.name ?? c.businessPartner?.businessProfile.name ?? '-';
}

// 월 렌탈료 합계 — 취소/회수 제외하고 합산.
export function contractMonthlyTotal(items: ContractItem[]): number {
  return items
    .filter((i) => i.status === 'ACTIVE' || i.status === 'PENDING')
    .reduce((s, i) => s + i.monthlyRentalPrice, 0);
}
