import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { TextField } from '@/components/form/TextField';
import { api } from '@/lib/api';
import { openKakaoAddressSearch } from '@/lib/kakao-address';
import { formatPhone } from '@/lib/format';
import type { CustomerDetail } from '../-types';
import { customerFormSchema, type CustomerFormValues } from '../-schemas';
import { partnerEditSchema, type PartnerEditValues } from '../../business-partners/-schemas';
import { RolesField } from '../../business-partners/-components/fields';
import { IndividualFields, AddressFields } from './fields';
import { toAddressPayload } from './payload';

type Props = { customer: CustomerDetail; onCancel: () => void; onSaved: () => void };

export function CustomerEditForm({ customer, onCancel, onSaved }: Props) {
  if (customer.type === 'INDIVIDUAL') {
    return <IndividualEditForm customer={customer} onCancel={onCancel} onSaved={onSaved} />;
  }
  return <BusinessCustomerEditForm customer={customer} onCancel={onCancel} onSaved={onSaved} />;
}

// ─── 개인 ────────────────────────────────────────────────────────────────────
function IndividualEditForm({ customer, onCancel, onSaved }: Props) {
  const profile = customer.individualProfile!;
  const addr = profile.address;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: profile.name,
      phone: profile.phone ?? '',
      email: profile.email ?? '',
      address: {
        zonecode: addr?.zonecode ?? '',
        address: addr?.address ?? '',
        addressDetail: addr?.addressDetail ?? '',
        jibunAddress: addr?.jibunAddress ?? '',
        roadAddress: addr?.roadAddress ?? '',
        buildingName: addr?.buildingName ?? '',
      },
      memo: customer.memo ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      api.patch(`/customers/${customer.id}`, {
        memo: values.memo || undefined,
        individualProfile: {
          name: values.name,
          phone: values.phone || undefined,
          email: values.email || undefined,
          address: toAddressPayload(values.address),
        },
      }),
    onSuccess: () => { toast.success('고객 정보가 수정되었습니다.'); onSaved(); },
    onError: () => toast.error('수정 중 오류가 발생했습니다.'),
  });

  const handleAddressSearch = () => {
    openKakaoAddressSearch((result) => {
      form.setValue('address.zonecode', result.zonecode, { shouldValidate: true });
      form.setValue('address.address', result.address, { shouldValidate: true });
      form.setValue('address.jibunAddress', result.jibunAddress);
      form.setValue('address.roadAddress', result.roadAddress);
      form.setValue('address.buildingName', result.buildingName);
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => void mutation.mutate(d))} className="space-y-4">
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold">기본 정보</h2>
          <IndividualFields control={form.control} />
          <AddressFields control={form.control} onSearch={handleAddressSearch} />
        </div>

        <div className="rounded-xl border bg-card p-6">
          <TextField control={form.control} name="memo" label="메모" placeholder="내부 메모 (선택)" />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── 사업자 ──────────────────────────────────────────────────────────────────
function BusinessCustomerEditForm({ customer, onCancel, onSaved }: Props) {
  const bp = customer.businessPartner!;
  const bpf = bp.businessProfile;
  const addr = bpf.address;

  const form = useForm<PartnerEditValues>({
    resolver: zodResolver(partnerEditSchema),
    defaultValues: {
      roles: bp.roles.map((r) => r.type),
      memo: customer.memo ?? '',
      businessProfile: {
        name: bpf.name,
        representativeName: bpf.representativeName,
        businessType: bpf.businessType ?? '',
        businessItem: bpf.businessItem ?? '',
        email: bpf.email ?? '',
        phone: bpf.phone ?? '',
        address: {
          zonecode: addr?.zonecode ?? '',
          address: addr?.address ?? '',
          addressDetail: addr?.addressDetail ?? '',
        },
      },
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: PartnerEditValues) => {
      await Promise.all([
        api.patch(`/business-partners/${bp.id}`, {
          roles: values.roles,
          businessProfile: {
            name: values.businessProfile.name,
            representativeName: values.businessProfile.representativeName,
            businessType: values.businessProfile.businessType || undefined,
            businessItem: values.businessProfile.businessItem || undefined,
            email: values.businessProfile.email || undefined,
            phone: values.businessProfile.phone || undefined,
            address: {
              zonecode: values.businessProfile.address.zonecode || undefined,
              address: values.businessProfile.address.address || undefined,
              addressDetail: values.businessProfile.address.addressDetail || undefined,
            },
          },
        }),
        api.patch(`/customers/${customer.id}`, { memo: values.memo || undefined }),
      ]);
    },
    onSuccess: () => { toast.success('고객 정보가 수정되었습니다.'); onSaved(); },
    onError: () => toast.error('수정 중 오류가 발생했습니다.'),
  });

  const handleAddressSearch = () => {
    openKakaoAddressSearch((result) => {
      form.setValue('businessProfile.address.zonecode', result.zonecode, { shouldValidate: true });
      form.setValue('businessProfile.address.address', result.address, { shouldValidate: true });
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => void mutation.mutate(d))} className="space-y-4">
        {/* 거래 유형 */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-3 text-sm font-semibold">
            거래 유형 <span className="text-destructive">*</span>
          </h2>
          <RolesField control={form.control} name="roles" idPrefix="biz-cust-edit-" />
          {form.formState.errors.roles && (
            <p className="mt-2 text-xs text-destructive">{form.formState.errors.roles.message}</p>
          )}
        </div>

        {/* 사업자 정보 */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold">사업자 정보</h2>

          <div className="grid grid-cols-2 gap-4">
            <TextField control={form.control} name="businessProfile.name" label="상호명" required />
            <div>
              <p className="text-sm font-medium mb-1.5">사업자등록번호</p>
              <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/50">
                {bpf.businessRegistrationNo}
              </p>
              <p className="text-xs text-muted-foreground mt-1">사업자번호는 수정할 수 없습니다.</p>
            </div>
          </div>

          <TextField control={form.control} name="businessProfile.representativeName" label="대표자명" required />

          <div className="grid grid-cols-2 gap-4">
            <TextField control={form.control} name="businessProfile.businessType" label="업태" />
            <TextField control={form.control} name="businessProfile.businessItem" label="종목" />
            <TextField
              control={form.control}
              name="businessProfile.phone"
              label="대표전화"
              maxLength={13}
              format={formatPhone}
            />
            <TextField control={form.control} name="businessProfile.email" label="대표이메일" type="email" />
          </div>

          {/* 주소 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">주소</p>
            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="businessProfile.address.zonecode"
                render={({ field }) => (
                  <FormItem className="w-28 shrink-0">
                    <FormControl>
                      <Input placeholder="우편번호" readOnly {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" variant="outline" onClick={handleAddressSearch}>주소 검색</Button>
            </div>
            <FormField
              control={form.control}
              name="businessProfile.address.address"
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
              control={form.control}
              name="businessProfile.address.addressDetail"
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
        </div>

        {/* 메모 */}
        <div className="rounded-xl border bg-card p-6">
          <TextField control={form.control} name="memo" label="메모" placeholder="내부 메모 (선택)" />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
