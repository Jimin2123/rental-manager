import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { ProductSelect, AssetSelect } from '@/components/option-select';
import type { QuotationType } from '../-types';
import type { ItemRow } from './payload';
import { emptyItemRow } from './payload';

type Props = {
  type: QuotationType;
  items: ItemRow[];
  onChange: (items: ItemRow[]) => void;
};

export function QuotationItemsEditor({ type, items, onChange }: Props) {
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
  type: QuotationType;
  item: ItemRow;
  index: number;
  onUpdate: (idx: number, patch: Partial<ItemRow>) => void;
  onRemove: (idx: number) => void;
}) {
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
          <ProductSelect value={item.productId} onChange={(v) => onUpdate(index, { productId: v, assetId: '' })} />
        </Field>
        <Field label="자산(시리얼)">
          <AssetSelect
            productId={item.productId}
            value={item.assetId}
            onChange={(assetId) => onUpdate(index, { assetId })}
          />
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
            <NativeSelect
              value={item.vatType}
              onChange={(e) => onUpdate(index, { vatType: e.target.value as ItemRow['vatType'] })}
            >
              <option value="INCLUDED">부가세 포함(10%)</option>
              <option value="NONE">부가세 없음</option>
            </NativeSelect>
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
          <Field label="계약개월" required>
            <Input
              type="number"
              min={1}
              value={item.contractMonths}
              onChange={(e) => onUpdate(index, { contractMonths: Number(e.target.value) })}
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
