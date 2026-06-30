import type { Control, FieldPath, FieldPathByValue, FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/form/TextField';
import { formatPhone } from '@/lib/format';
import type { RoleType } from '../-types';

// ─── 역할 체크박스 그룹 (매출/매입) ──────────────────────────────
// 헤딩·에러 표시는 부모(타입드 formState 보유)가 담당하고, 여기선 체크박스 행만 그린다.
export function RolesField<T extends FieldValues>({
  control,
  name,
  idPrefix,
}: {
  control: Control<T>;
  name: FieldPathByValue<T, RoleType[]>;
  idPrefix: string;
}) {
  return (
    <div className="flex gap-6">
      {(['SALES', 'PURCHASE'] as const).map((role) => (
        <FormField
          key={role}
          control={control}
          name={name}
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  id={`${idPrefix}${role}`}
                  checked={field.value.includes(role)}
                  onCheckedChange={(checked) => {
                    if (checked) field.onChange([...field.value, role]);
                    else field.onChange(field.value.filter((v: RoleType) => v !== role));
                  }}
                />
              </FormControl>
              <FormLabel htmlFor={`${idPrefix}${role}`} className="cursor-pointer font-normal">
                {role === 'SALES' ? '매출 거래처' : '매입 거래처'}
              </FormLabel>
            </FormItem>
          )}
        />
      ))}
    </div>
  );
}

// ─── 담당자 입력 필드 묶음 ────────────────────────────────────────
// 생성 폼(useFieldArray, namePrefix="contacts.N.")과 상세 폼(namePrefix="")에서 공용.
export function ContactFields<T extends FieldValues>({
  control,
  namePrefix = '',
}: {
  control: Control<T>;
  namePrefix?: string;
}) {
  const n = (f: string) => `${namePrefix}${f}` as FieldPath<T>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <TextField control={control} name={n('name')} label="이름" required placeholder="홍길동" />
        <TextField control={control} name={n('department')} label="부서" placeholder="영업부" />
        <TextField control={control} name={n('position')} label="직급" placeholder="과장" />
        <TextField control={control} name={n('role')} label="역할" placeholder="계약 담당자" />
        <TextField
          control={control}
          name={n('phone')}
          label="전화"
          placeholder="010-1234-5678"
          maxLength={13}
          format={formatPhone}
        />
        <TextField control={control} name={n('email')} label="이메일" type="email" placeholder="hong@company.com" />
      </div>
      <FormField
        control={control}
        name={n('isPrimary')}
        render={({ field }) => (
          <FormItem className="flex items-center gap-2 space-y-0">
            <FormControl>
              <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <FormLabel className="cursor-pointer font-normal text-sm">대표 담당자</FormLabel>
          </FormItem>
        )}
      />
    </>
  );
}
