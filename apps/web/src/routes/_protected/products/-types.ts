export type AssetStatus =
  | 'INCOMING' | 'AVAILABLE' | 'RENTED' | 'SOLD'
  | 'REPAIR' | 'DISPOSED' | 'LOST' | 'UNAVAILABLE';

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  INCOMING: '입고예정',
  AVAILABLE: '사용가능',
  RENTED: '렌탈중',
  SOLD: '판매완료',
  REPAIR: '수리중',
  DISPOSED: '폐기',
  LOST: '분실',
  UNAVAILABLE: '사용불가',
};

export const ASSET_STATUS_VARIANT: Record<AssetStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  AVAILABLE: 'default',
  RENTED: 'secondary',
  INCOMING: 'outline',
  REPAIR: 'outline',
  SOLD: 'outline',
  DISPOSED: 'destructive',
  LOST: 'destructive',
  UNAVAILABLE: 'outline',
};

// 수동으로 전환 가능한 상태 규칙
export type StatusTransition = {
  toStatus: AssetStatus;
  label: string;
  variant: 'default' | 'destructive' | 'outline';
};

export const MANUAL_STATUS_TRANSITIONS: Partial<Record<AssetStatus, StatusTransition[]>> = {
  INCOMING: [{ toStatus: 'AVAILABLE', label: '입고 완료', variant: 'default' }],
  AVAILABLE: [
    { toStatus: 'REPAIR', label: '수리 접수', variant: 'outline' },
    { toStatus: 'LOST', label: '분실 신고', variant: 'destructive' },
    { toStatus: 'UNAVAILABLE', label: '사용 중단', variant: 'outline' },
  ],
  REPAIR: [{ toStatus: 'AVAILABLE', label: '수리 완료', variant: 'default' }],
  LOST: [{ toStatus: 'AVAILABLE', label: '발견', variant: 'default' }],
  UNAVAILABLE: [{ toStatus: 'AVAILABLE', label: '사용 재개', variant: 'default' }],
};

export type AssetStats = {
  total: number;
  byStatus: Partial<Record<AssetStatus, number>>;
};

export type Product = {
  id: string;
  name: string;
  manufacturer: string | null;
  modelName: string | null;
  category: string | null;
  memo: string | null;
  isActive: boolean;
  createdAt: string;
  assetStats: AssetStats;
};

export type AssetListItem = {
  id: string;
  serialNumber: string | null;
  status: AssetStatus;
  purchaseDate: string | null;
  product: { id: string; name: string; manufacturer: string | null; modelName: string | null; category: string | null };
};

export type AssetDetail = {
  id: string;
  serialNumber: string | null;
  status: AssetStatus;
  purchaseDate: string | null;
  purchasePrice: number | null;
  memo: string | null;
  supplier: { id: string; businessProfile: { name: string } } | null;
};

export type AssetEvent = {
  id: string;
  fromStatus: AssetStatus | null;
  toStatus: AssetStatus;
  sourceType: string;
  note: string | null;
  createdAt: string;
};

export type MeterReading = {
  id: string;
  readingDate: string;
  blackCount: number;
  colorCount: number | null;
  blackUsage: number;
  colorUsage: number | null;
  readingMethod: string;
  note: string | null;
};

export type Supplier = { id: string; businessProfile: { name: string } };
