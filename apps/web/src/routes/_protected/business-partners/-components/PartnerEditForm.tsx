import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { api } from '@/lib/api';
import { TextField } from '@/components/form/TextField';
import type { BusinessPartnerDetail } from '../-types';
import { partnerEditSchema, type PartnerEditValues } from '../-schemas';
import { RolesField } from './fields';
import { ContactSection } from './ContactSection';

export function PartnerEditForm({
  partner,
  onCancel,
  onSaved,
  onContactChanged,
}: {
  partner: BusinessPartnerDetail;
  onCancel: () => void;
  onSaved: () => void;
  onContactChanged: () => void;
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
    onSuccess: () => {
      toast.success('거래처 정보가 수정되었습니다.');
      onSaved();
    },
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => void mutation.mutate(d))} className="space-y-4">
        {/* 역할 */}
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">
            역할 <span className="text-destructive">*</span>
          </h2>
          <RolesField control={form.control} name="roles" idPrefix="edit-role-" />
          {form.formState.errors.roles && (
            <p className="mt-2 text-xs text-destructive">{form.formState.errors.roles.message}</p>
          )}
        </div>

        {/* 사업자 정보 */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
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
            <TextField control={form.control} name="businessProfile.phone" label="대표전화" />
            <TextField control={form.control} name="businessProfile.email" label="대표이메일" type="email" />
          </div>
        </div>

        {/* 메모 */}
        <div className="rounded-lg border bg-card p-4">
          <TextField control={form.control} name="memo" label="메모" placeholder="내부 메모" />
        </div>

        {/* 담당자 섹션 — 편집 모드에서도 항상 표시 */}
        <ContactSection partnerId={partner.id} contacts={partner.contacts} onChanged={onContactChanged} />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
