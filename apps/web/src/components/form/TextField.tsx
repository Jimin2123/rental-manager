import type { ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

type TextFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label?: ReactNode;
  type?: 'text' | 'number' | 'date' | 'email';
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  min?: number;
  maxLength?: number;
  format?: (value: string) => string;
};

// 전역 입력 패턴(FormItem→Label→Control→Message)을 한곳에 모은 공용 폼 필드.
// 숫자 등 undefined 값은 '' 로 바꿔 controlled 상태를 유지한다.
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  type = 'text',
  placeholder,
  required,
  readOnly,
  min,
  maxLength,
  format,
}: TextFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label !== undefined && (
            <FormLabel>
              {label} {required && <span className="text-destructive">*</span>}
            </FormLabel>
          )}
          <FormControl>
            <Input
              type={type}
              placeholder={placeholder}
              readOnly={readOnly}
              min={min}
              maxLength={maxLength}
              {...field}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(format ? format(e.target.value) : e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
