import { useQuery } from '@tanstack/react-query';
import { fetchProductOptions, fetchAssetOptions } from '@/lib/options-api';
import type { ProductOption, AssetOption } from '@/lib/options-api';
import { NativeSelect } from '@/components/ui/native-select';

// 제품 native select — 옵션은 쿼리 키 캐싱으로 행이 여러 개여도 네트워크 1회.
export function ProductSelect({ value, onChange }: { value: string; onChange: (productId: string) => void }) {
  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ['products', 'options'],
    queryFn: fetchProductOptions,
  });
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">제품 선택</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </NativeSelect>
  );
}

// 가용 자산 native select — productId 선택 시에만 조회. onChange로 선택 asset도 전달.
// placeholder: 빈 옵션 라벨. 자산이 선택사항인 곳은 '선택 안 함'(기본), 필수인 곳은 '자산 선택'.
export function AssetSelect({
  productId,
  value,
  onChange,
  placeholder = '선택 안 함',
}: {
  productId: string;
  value: string;
  onChange: (assetId: string, asset?: AssetOption) => void;
  placeholder?: string;
}) {
  const { data: assets = [] } = useQuery<AssetOption[]>({
    queryKey: ['assets', 'available', productId],
    queryFn: () => fetchAssetOptions(productId),
    enabled: productId !== '',
  });
  return (
    <NativeSelect
      value={value}
      disabled={productId === ''}
      onChange={(e) =>
        onChange(
          e.target.value,
          assets.find((a) => a.id === e.target.value),
        )
      }
    >
      <option value="">{placeholder}</option>
      {assets.map((a) => (
        <option key={a.id} value={a.id}>
          {a.serialNumber}
        </option>
      ))}
    </NativeSelect>
  );
}
