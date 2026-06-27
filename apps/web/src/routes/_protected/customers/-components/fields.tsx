import type { Control } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/form/TextField';
import type { CustomerFormValues } from '../-schemas';

// ─── 개인 기본 정보 (이름/전화/이메일) ───────────────────────────
export function IndividualFields({ control }: { control: Control<CustomerFormValues> }) {
  return (
    <div className="space-y-4">
      <TextField control={control} name="name" label="이름" required placeholder="홍길동" />
      <div className="grid grid-cols-2 gap-4">
        <TextField control={control} name="phone" label="전화" placeholder="010-1234-5678" />
        <TextField control={control} name="email" label="이메일" type="email" placeholder="hong@example.com" />
      </div>
    </div>
  );
}

// ─── 주소 입력 (카카오 검색, 선택) ───────────────────────────────
// setValue는 부모가 소유하고, 여기선 우편번호/기본주소(읽기) + 상세주소만 그린다.
export function AddressFields({ control, onSearch }: { control: Control<CustomerFormValues>; onSearch: () => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">주소</p>
      <div className="flex gap-2">
        <FormField
          control={control}
          name="address.zonecode"
          render={({ field }) => (
            <FormItem className="w-28 shrink-0">
              <FormControl>
                <Input placeholder="우편번호" readOnly {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="button" variant="outline" onClick={onSearch}>
          주소 검색
        </Button>
      </div>
      <FormField
        control={control}
        name="address.address"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input placeholder="기본주소" readOnly {...field} value={field.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="address.addressDetail"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input placeholder="상세주소 (선택)" {...field} value={field.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
