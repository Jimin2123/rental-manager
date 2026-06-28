import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OrderType } from '../-types';
import type { ItemRow } from './payload';
import { emptyItemRow } from './payload';
import { fetchProductOptions, fetchAssetOptions } from '@/lib/options-api';
import type { ProductOption, AssetOption } from '@/lib/options-api';

type Props = {
  type: OrderType;
  items: ItemRow[];
  onChange: (items: ItemRow[]) => void;
};

export function ItemsEditor({ type, items, onChange }: Props) {
  const update = (idx: number, patch: Partial<ItemRow>) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, emptyItemRow()]);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          품목 <span className="text-destructive">*</span>
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          + 품목 추가
        </Button>
      </div>

      {items.length === 0 && <p className="text-xs text-muted-foreground">품목을 1개 이상 추가하세요.</p>}

      {items.map((item, idx) => (
        <ItemRowEditor key={idx} type={type} item={item} index={idx} onUpdate={update} onRemove={remove} />
      ))}
    </div>
  );
}

function ItemRowEditor({
  type,
  item,
  index,
  onUpdate,
  onRemove,
}: {
  type: OrderType;
  item: ItemRow;
  index: number;
  onUpdate: (idx: number, patch: Partial<ItemRow>) => void;
  onRemove: (idx: number) => void;
}) {
  // 제품 선택 시에만 가용 자산을 조회한다.
  const { data: assets = [] } = useQuery<AssetOption[]>({
    queryKey: ['assets', 'available', item.productId],
    queryFn: () => fetchAssetOptions(item.productId),
    enabled: item.productId !== '',
  });

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">품목 {index + 1}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(index)}>
          삭제
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="제품" required>
          <ProductSelect
            value={item.productId}
            onChange={(v) => onUpdate(index, { productId: v, assetId: '', serialNumber: '' })}
          />
        </Field>
        <Field label="자산(시리얼)">
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none"
            value={item.assetId}
            disabled={item.productId === ''}
            onChange={(e) => {
              const asset = assets.find((a) => a.id === e.target.value);
              onUpdate(index, { assetId: e.target.value, serialNumber: asset?.serialNumber ?? '' });
            }}
          >
            <option value="">선택 안 함</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.serialNumber}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {type === 'SALE' ? (
        <div className="grid grid-cols-3 gap-3">
          <Field label="수량" required>
            <Input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => onUpdate(index, { quantity: Number(e.target.value) })}
            />
          </Field>
          <Field label="단가" required>
            <Input
              type="number"
              min={0}
              value={item.unitPrice}
              onChange={(e) => onUpdate(index, { unitPrice: Number(e.target.value) })}
            />
          </Field>
          <Field label="부가세">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none"
              value={item.vatType}
              onChange={(e) => onUpdate(index, { vatType: e.target.value as ItemRow['vatType'] })}
            >
              <option value="INCLUDED">부가세 포함(10%)</option>
              <option value="NONE">부가세 없음</option>
            </select>
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Field label="월 렌탈료" required>
            <Input
              type="number"
              min={0}
              value={item.monthlyRentalPrice}
              onChange={(e) => onUpdate(index, { monthlyRentalPrice: Number(e.target.value) })}
            />
          </Field>
          <Field label="보증금">
            <Input
              type="number"
              min={0}
              value={item.depositAmount}
              onChange={(e) => onUpdate(index, { depositAmount: Number(e.target.value) })}
            />
          </Field>
          <Field label="설치 위치">
            <Input
              value={item.installationLocation}
              onChange={(e) => onUpdate(index, { installationLocation: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </p>
      {children}
    </div>
  );
}

// 제품 native select — 제품 옵션을 직접 조회한다(쿼리 키 캐싱으로 행이 여러 개여도 네트워크 1회).
function ProductSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ['products', 'options'],
    queryFn: fetchProductOptions,
  });
  return (
    <select
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">제품 선택</option>
      {products.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
