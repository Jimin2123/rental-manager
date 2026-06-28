import { api } from '@/lib/api';

// 품목 입력용 제품/자산 옵션 — 견적/주문/계약 공용.
export type ProductOption = { id: string; name: string };
export type AssetOption = { id: string; serialNumber: string };

export const fetchProductOptions = () =>
  api
    .get<Array<{ id: string; name: string }>>('/products')
    .then((r) => r.data.map((p) => ({ id: p.id, name: p.name })));

// 제품의 가용(AVAILABLE) 자산만.
export const fetchAssetOptions = (productId: string) =>
  api
    .get<Array<{ id: string; serialNumber: string }>>('/assets', {
      params: { productId, status: 'AVAILABLE' },
    })
    .then((r) => r.data.map((a) => ({ id: a.id, serialNumber: a.serialNumber })));
