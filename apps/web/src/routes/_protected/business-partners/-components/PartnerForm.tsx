import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toastApiError } from '@/lib/api-error';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { TextField } from '@/components/form/TextField';
import { api } from '@/lib/api';
import { openKakaoAddressSearch } from '@/lib/kakao-address';
import { partnerKeys } from '../-api';
import { partnerCreateSchema, type PartnerCreateValues } from '../-schemas';
import { RolesField, ContactFields } from './fields';

type BrnStatus = 'idle' | 'valid' | 'invalid';

const formatBrn = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
};

export function PartnerForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [brnStatus, setBrnStatus] = useState<BrnStatus>('idle');
  const [brnMessage, setBrnMessage] = useState('');
  const [brnVerifying, setBrnVerifying] = useState(false);

  const form = useForm<PartnerCreateValues>({
    resolver: zodResolver(partnerCreateSchema),
    defaultValues: {
      roles: [],
      businessProfile: {
        name: '',
        businessRegistrationNo: '',
        representativeName: '',
        businessType: '',
        businessItem: '',
        email: '',
        phone: '',
        address: { zonecode: '', address: '', addressDetail: '', jibunAddress: '', roadAddress: '', buildingName: '' },
      },
      contacts: [],
      memo: '',
    },
  });

  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContact,
  } = useFieldArray({
    control: form.control,
    name: 'contacts',
  });

  const mutation = useMutation({
    mutationFn: (data: PartnerCreateValues) => api.post<{ id: string }>('/business-partners', data),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      toast.success('거래처가 등록되었습니다.');
      void navigate({ to: '/business-partners/$id', params: { id: res.data.id } });
    },
    onError: (err) =>
      toastApiError(err, '거래처 등록 중 오류가 발생했습니다.', { 409: '이미 등록된 사업자번호입니다.' }),
  });

  const handleVerifyBrn = async () => {
    const brn = form.getValues('businessProfile.businessRegistrationNo').replace(/-/g, '');
    if (brn.length !== 10) return;
    setBrnVerifying(true);
    try {
      const { data } = await api.post<{ valid: boolean; status: string }>('/organizations/brn/verify', {
        businessRegistrationNo: brn,
      });
      setBrnStatus(data.valid ? 'valid' : 'invalid');
      setBrnMessage(data.status);
      if (!data.valid) {
        form.setError('businessProfile.businessRegistrationNo', {
          message: `사용할 수 없는 사업자입니다. (${data.status})`,
        });
      } else {
        form.clearErrors('businessProfile.businessRegistrationNo');
      }
    } catch {
      setBrnStatus('invalid');
      setBrnMessage('조회 실패');
      toast.error('사업자등록번호 조회 중 오류가 발생했습니다.');
    } finally {
      setBrnVerifying(false);
    }
  };

  const handleAddressSearch = () => {
    openKakaoAddressSearch((result) => {
      form.setValue('businessProfile.address.zonecode', result.zonecode, { shouldValidate: true });
      form.setValue('businessProfile.address.address', result.address, { shouldValidate: true });
      form.setValue('businessProfile.address.jibunAddress', result.jibunAddress);
      form.setValue('businessProfile.address.roadAddress', result.roadAddress);
      form.setValue('businessProfile.address.buildingName', result.buildingName);
    });
  };

  const onSubmit = (values: PartnerCreateValues) => {
    if (brnStatus !== 'valid') {
      form.setError('businessProfile.businessRegistrationNo', {
        message: '사업자등록번호 조회를 먼저 완료해주세요.',
      });
      return;
    }
    const payload = {
      ...values,
      businessProfile: {
        ...values.businessProfile,
        businessRegistrationNo: values.businessProfile.businessRegistrationNo.replace(/-/g, ''),
        email: values.businessProfile.email || undefined,
      },
      contacts: values.contacts?.map((c) => ({ ...c, email: c.email || undefined })) ?? [],
      memo: values.memo || undefined,
    };
    void mutation.mutate(payload);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 역할 */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">
            역할 <span className="text-destructive">*</span>
          </h2>
          <RolesField control={form.control} name="roles" idPrefix="role-" />
          {form.formState.errors.roles && (
            <p className="mt-2 text-xs text-destructive">{form.formState.errors.roles.message}</p>
          )}
        </div>

        {/* 사업자 정보 */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold">사업자 정보</h2>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              control={form.control}
              name="businessProfile.name"
              label="상호명"
              required
              placeholder="(주)거래처명"
            />
            <FormField
              control={form.control}
              name="businessProfile.businessRegistrationNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    사업자등록번호 <span className="text-destructive">*</span>
                  </FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        placeholder="123-45-67890"
                        maxLength={12}
                        {...field}
                        onChange={(e) => {
                          field.onChange(formatBrn(e.target.value));
                          setBrnStatus('idle');
                        }}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={field.value.replace(/-/g, '').length !== 10 || brnVerifying}
                      onClick={() => void handleVerifyBrn()}
                    >
                      {brnVerifying ? '조회 중...' : '조회'}
                    </Button>
                  </div>
                  <FormMessage />
                  {brnStatus !== 'idle' && (
                    <p className={`text-xs ${brnStatus === 'valid' ? 'text-green-600' : 'text-destructive'}`}>
                      {brnStatus === 'valid' ? `✓ ${brnMessage}` : `✗ ${brnMessage}`}
                    </p>
                  )}
                </FormItem>
              )}
            />
          </div>

          <TextField
            control={form.control}
            name="businessProfile.representativeName"
            label="대표자명"
            required
            placeholder="홍길동"
          />

          <div className="grid grid-cols-2 gap-4">
            <TextField control={form.control} name="businessProfile.businessType" label="업태" placeholder="서비스업" />
            <TextField control={form.control} name="businessProfile.businessItem" label="종목" placeholder="렌탈업" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              control={form.control}
              name="businessProfile.phone"
              label="대표전화"
              placeholder="02-1234-5678"
            />
            <TextField
              control={form.control}
              name="businessProfile.email"
              label="대표이메일"
              type="email"
              placeholder="contact@company.com"
            />
          </div>

          {/* 주소 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              주소 <span className="text-destructive">*</span>
            </p>
            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="businessProfile.address.zonecode"
                render={({ field }) => (
                  <FormItem className="w-28 shrink-0">
                    <FormControl>
                      <Input placeholder="우편번호" readOnly {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" variant="outline" onClick={handleAddressSearch}>
                주소 검색
              </Button>
            </div>
            <FormField
              control={form.control}
              name="businessProfile.address.address"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="기본주소" readOnly {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="businessProfile.address.addressDetail"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="상세주소 (선택)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* 담당자 */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">담당자</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendContact({
                  name: '',
                  department: '',
                  position: '',
                  role: '',
                  phone: '',
                  email: '',
                  isPrimary: false,
                  memo: '',
                })
              }
            >
              + 담당자 추가
            </Button>
          </div>

          {contactFields.length === 0 && (
            <p className="text-xs text-muted-foreground">담당자를 추가하면 거래처와 함께 저장됩니다.</p>
          )}

          {contactFields.map((field, index) => (
            <div key={field.id} className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">담당자 {index + 1}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeContact(index)}>
                  삭제
                </Button>
              </div>
              <ContactFields control={form.control} namePrefix={`contacts.${index}.`} />
            </div>
          ))}
        </div>

        {/* 메모 */}
        <div className="rounded-lg border bg-card p-4">
          <TextField control={form.control} name="memo" label="메모" placeholder="내부 메모 (선택)" />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => void navigate({ to: '/business-partners' })}>
            취소
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? '저장 중...' : '등록'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
