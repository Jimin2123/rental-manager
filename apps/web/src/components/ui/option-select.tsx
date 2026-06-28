import { useQuery } from '@tanstack/react-query';
import { fetchProductOptions, fetchAssetOptions } from '@/lib/options-api';
import type { ProductOption, AssetOption } from '@/lib/options-api';

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none';

// 제품 native select — 옵션은 쿼리 키 캐싱으로 행이 여러 개여도 네트워크 1회.
export function ProductSelect({ value, onChange }: { value: string; onChange: (productId: string) => void }) {
  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ['products', 'options'],
    queryFn: fetchProductOptions,
  });
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">제품 선택</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

// 가용 자산 native select — productId 선택 시에만 조회. onChange로 선택 asset도 전달.
export function AssetSelect({
  productId,
  value,
  onChange,
}: {
  productId: string;
  value: string;
  onChange: (assetId: string, asset?: AssetOption) => void;
}) {
  const { data: assets = [] } = useQuery<AssetOption[]>({
    queryKey: ['assets', 'available', productId],
    queryFn: () => fetchAssetOptions(productId),
    enabled: productId !== '',
  });
  return (
    <select
      className={selectClass}
      value={value}
      disabled={productId === ''}
      onChange={(e) =>
        onChange(
          e.target.value,
          assets.find((a) => a.id === e.target.value),
        )
      }
    >
      <option value="">선택 안 함</option>
      {assets.map((a) => (
        <option key={a.id} value={a.id}>
          {a.serialNumber}
        </option>
      ))}
    </select>
  );
}
