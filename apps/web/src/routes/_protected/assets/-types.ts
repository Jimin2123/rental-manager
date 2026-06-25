export type AssetStatus = 'INCOMING' | 'AVAILABLE' | 'RENTED' | 'SOLD' | 'REPAIR' | 'DISPOSED' | 'LOST' | 'UNAVAILABLE';

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

export type Product = {
  id: string;
  name: string;
  manufacturer: string | null;
  modelName: string | null;
  category: string | null;
};

export type AssetListItem = {
  id: string;
  serialNumber: string | null;
  status: AssetStatus;
  purchaseDate: string | null;
  product: Pick<Product, 'name' | 'category'>;
};

export type AssetDetail = {
  id: string;
  serialNumber: string | null;
  status: AssetStatus;
  purchaseDate: string | null;
  purchasePrice: number | null;
  memo: string | null;
  product: Product;
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
