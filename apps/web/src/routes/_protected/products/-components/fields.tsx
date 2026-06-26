import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { Supplier } from '../-types';

// 공용 TextField는 @/components/form 으로 승격됨. 기존 import 호환을 위해 재노출.
export { TextField } from '@/components/form/TextField';

type SupplierFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  suppliers: Supplier[];
};

// 매입처 선택 드롭다운 — 선택 해제 시 undefined를 전달한다.
export function SupplierField<T extends FieldValues>({ control, name, suppliers }: SupplierFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>매입처</FormLabel>
          <FormControl>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none"
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || undefined)}
            >
              <option value="">선택 안 함</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.businessProfile.name}
                </option>
              ))}
            </select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
