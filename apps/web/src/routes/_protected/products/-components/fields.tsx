import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { Supplier } from '../-types';

type TextFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: ReactNode;
  type?: 'text' | 'number' | 'date';
  placeholder?: string;
  required?: boolean;
  min?: number;
};

// 프로젝트 전역 입력 패턴(FormItem→Label→Control→Message)을 한곳에 모은다.
// 숫자 필드의 undefined 값은 '' 로 바꿔 controlled 상태를 유지한다.
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  type = 'text',
  placeholder,
  required,
  min,
}: TextFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label} {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Input type={type} placeholder={placeholder} min={min} {...field} value={field.value ?? ''} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

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
