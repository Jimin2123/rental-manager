import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import { TextField } from '@/components/form/TextField';
import { formatPhone } from '@/lib/format';
import { openKakaoAddressSearch } from '@/lib/kakao-address';
import type { BusinessPartnerDetail } from '../-types';
import { partnerEditSchema, type PartnerEditValues } from '../-schemas';
import { RolesField } from './fields';
import { ContactSection } from './ContactSection';
import { AssignmentSection } from '../../customers/-components/AssignmentSection';

export function PartnerEditForm({
  partner,
  onCancel,
  onSaved,
  onContactChanged,
  customerId,
}: {
  partner: BusinessPartnerDetail;
  onCancel: () => void;
  onSaved: () => void;
  onContactChanged: () => void;
  customerId?: string;
}) {
  const bp = partner.businessProfile;
  const form = useForm<PartnerEditValues>({
    resolver: zodResolver(partnerEditSchema),
    defaultValues: {
      roles: partner.roles.map((r) => r.type),
      memo: partner.memo ?? '',
      businessProfile: {
        name: bp.name,
        representativeName: bp.representativeName,
        businessType: bp.businessType ?? '',
        businessItem: bp.businessItem ?? '',
        email: bp.email ?? '',
        phone: bp.phone ?? '',
        address: {
          zonecode: bp.address.zonecode,
          address: bp.address.address,
          addressDetail: bp.address.addressDetail ?? '',
        },
      },
    },
  });

  const mutation = useMutation({
    mutationFn: (data: PartnerEditValues) =>
      api.patch(`/business-partners/${partner.id}`, {
        roles: data.roles,
        memo: data.memo || undefined,
        businessProfile: {
          name: data.businessProfile.name,
          representativeName: data.businessProfile.representativeName,
          businessType: data.businessProfile.businessType || undefined,
          businessItem: data.businessProfile.businessItem || undefined,
          email: data.businessProfile.email || undefined,
          phone: data.businessProfile.phone || undefined,
          address: {
            zonecode: data.businessProfile.address.zonecode || undefined,
            address: data.businessProfile.address.address || undefined,
            addressDetail: data.businessProfile.address.addressDetail || undefined,
          },
        },
      }),
    onSuccess: () => { toast.success('거래처 정보가 수정되었습니다.'); onSaved(); },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      const message = (err as AxiosError<{ message?: string }>).response?.data?.message;
      if (status === 409 && message) {
        toast.error(message);
      } else {
        toast.error('수정 중 오류가 발생했습니다.');
      }
    },
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
        {/* 역할 */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-3 text-sm font-semibold">
            역할 <span className="text-destructive">*</span>
          </h2>
          <RolesField control={form.control} name="roles" idPrefix="edit-role-" />
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
                {bp.businessRegistrationNo}
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
          <TextField control={form.control} name="memo" label="메모" placeholder="내부 메모" />
        </div>

        {/* 담당자 */}
        <ContactSection partnerId={partner.id} contacts={partner.contacts} onChanged={onContactChanged} />

        {/* 담당 직원 배정 */}
        {customerId && <AssignmentSection customerId={customerId} />}

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
