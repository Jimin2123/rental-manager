import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { partnerKeys } from '../business-partners/-api';
import type { Product, AssetListItem, AssetDetail, AssetEvent, MeterReading, Supplier } from './-types';

// ─── 쿼리 키 팩토리 ───────────────────────────────────────────────
// 키 모양을 한곳에서 정의해 조회/무효화가 항상 일치하도록 한다.
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (search: string) => [...productKeys.all, 'list', { search }] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
};

export const assetKeys = {
  all: ['assets'] as const,
  list: (productId: string) => [...assetKeys.all, 'list', { productId }] as const,
  detail: (id: string) => [...assetKeys.all, 'detail', id] as const,
  events: (id: string) => [...assetKeys.all, 'events', id] as const,
  meterReadings: (id: string) => [...assetKeys.all, 'meter-readings', id] as const,
};

// 매입처 드롭다운은 거래처 목록(role=PURCHASE)을 재사용한다 — 거래처 변경 시 함께 무효화되도록 키를 공유.
export const supplierKeys = {
  purchaseList: () => partnerKeys.list({ role: 'PURCHASE' }),
};

// ─── 조회 함수 ────────────────────────────────────────────────────
export const fetchProducts = (search: string) =>
  api.get<Product[]>('/products', { params: { ...(search && { search }) } }).then((r) => r.data);

export const fetchProduct = (id: string) => api.get<Product>(`/products/${id}`).then((r) => r.data);

export const fetchAssets = (productId: string) =>
  api.get<AssetListItem[]>('/assets', { params: { productId } }).then((r) => r.data);

export const fetchAsset = (id: string) => api.get<AssetDetail>(`/assets/${id}`).then((r) => r.data);

export const fetchAssetEvents = (id: string) => api.get<AssetEvent[]>(`/assets/${id}/events`).then((r) => r.data);

export const fetchMeterReadings = (id: string) =>
  api.get<MeterReading[]>(`/assets/${id}/meter-readings`).then((r) => r.data);

export const fetchPurchaseSuppliers = () =>
  api.get<Supplier[]>('/business-partners', { params: { role: 'PURCHASE' } }).then((r) => r.data);

// ─── 무효화 헬퍼 ──────────────────────────────────────────────────
// 자산 수량/상태가 바뀌면(추가·상태변경·삭제) 재고 통계까지 갱신해야 한다.
export function invalidateAssetStats(qc: QueryClient, productId: string): void {
  void qc.invalidateQueries({ queryKey: assetKeys.list(productId) });
  void qc.invalidateQueries({ queryKey: productKeys.detail(productId) });
  void qc.invalidateQueries({ queryKey: productKeys.lists() });
}
