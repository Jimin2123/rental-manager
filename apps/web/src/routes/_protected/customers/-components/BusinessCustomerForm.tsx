import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { NativeSelect } from '@/components/ui/native-select';
import { TextField } from '@/components/form/TextField';
import { api } from '@/lib/api';
import { openKakaoAddressSearch } from '@/lib/kakao-address';
import { formatBrn, formatPhone } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import { customerKeys } from '../-api';
import { partnerKeys } from '../../business-partners/-api';
import { partnerCreateSchema, type PartnerCreateValues } from '../../business-partners/-schemas';
import { RolesField, ContactFields } from '../../business-partners/-components/fields';
import { fetchMembers, memberKeys } from '../../settings/members/-api';
import { ROLE_LABEL } from '../../settings/members/-types';

type BrnStatus = 'idle' | 'valid' | 'invalid';

export function BusinessCustomerForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.currentOrganization?.id);

  const [brnStatus, setBrnStatus] = useState<BrnStatus>('idle');
  const [brnMessage, setBrnMessage] = useState('');
  const [brnVerifying, setBrnVerifying] = useState(false);

  const [assignmentMemberId, setAssignmentMemberId] = useState('');
  const [assignmentStartedAt, setAssignmentStartedAt] = useState(new Date().toISOString().split('T')[0]);
  const [assignmentIsPrimary, setAssignmentIsPrimary] = useState(true);

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

  const { fields: contactFields, append: appendContact, remove: removeContact } = useFieldArray({
    control: form.control,
    name: 'contacts',
  });

  const { data: members = [] } = useQuery({
    queryKey: orgId ? memberKeys.list(orgId) : ['members', 'none'],
    queryFn: () => fetchMembers(orgId!),
    enabled: !!orgId,
  });

  const mutation = useMutation({
    mutationFn: async (data: PartnerCreateValues) => {
      const partnerRes = await api.post<{ id: string }>('/business-partners', {
        roles: data.roles,
        memo: data.memo || undefined,
        businessProfile: {
          ...data.businessProfile,
          email: data.businessProfile.email || undefined,
        },
        contacts: data.contacts?.map((c) => ({ ...c, email: c.email || undefined })) ?? [],
      });

      if (assignmentMemberId) {
        const partnerDetail = await api.get<{ customer: { id: string } | null }>(
          `/business-partners/${partnerRes.data.id}`,
        );
        if (partnerDetail.data.customer) {
          await api.post(`/customers/${partnerDetail.data.customer.id}/assignments`, {
            organizationMemberId: assignmentMemberId,
            startedAt: new Date(assignmentStartedAt).toISOString(),
            isPrimary: assignmentIsPrimary,
          });
        }
      }

      return partnerRes;
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      void queryClient.invalidateQueries({ queryKey: partnerKeys.all });
      toast.success('거래처가 등록되었습니다.');
      void navigate({ to: '/business-partners/$id', params: { id: res.data.id } });
    },
    onError: () => toast.error('거래처 등록 중 오류가 발생했습니다.'),
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
      form.clearErrors('businessProfile.businessRegistrationNo');
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
    void mutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 거래 유형 */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-3 text-sm font-semibold">
            거래 유형 <span className="text-destructive">*</span>
          </h2>
          <RolesField control={form.control} name="roles" idPrefix="biz-role-" />
          {form.formState.errors.roles && (
            <p className="mt-2 text-xs text-destructive">{form.formState.errors.roles.message}</p>
          )}
        </div>

        {/* 사업자 정보 */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold">사업자 정보</h2>

          <TextField
            control={form.control}
            name="businessProfile.name"
            label="상호명"
            required
            placeholder="(주)거래처명"
          />

          <div className="grid grid-cols-2 gap-4">
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
                  {brnStatus !== 'idle' ? (
                    <p className={`text-xs ${brnStatus === 'valid' ? 'text-green-600' : 'text-destructive'}`}>
                      {brnStatus === 'valid'
                        ? `✓ ${brnMessage}`
                        : `✗ 사용할 수 없는 사업자입니다.${brnMessage ? ` (${brnMessage})` : ''}`}
                    </p>
                  ) : (
                    <FormMessage />
                  )}
                </FormItem>
              )}
            />
            <TextField
              control={form.control}
              name="businessProfile.representativeName"
              label="대표자명"
              required
              placeholder="홍길동"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              control={form.control}
              name="businessProfile.businessType"
              label="업태"
              placeholder="예: 도소매"
            />
            <TextField
              control={form.control}
              name="businessProfile.businessItem"
              label="종목"
              placeholder="예: 사무기기"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextField
              control={form.control}
              name="businessProfile.phone"
              label="대표전화"
              placeholder="02-1234-5678"
              maxLength={13}
              format={formatPhone}
            />
            <TextField
              control={form.control}
              name="businessProfile.email"
              label="대표이메일"
              type="email"
              placeholder="contact@company.com"
            />
          </div>

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

        {/* 거래처 담당자 */}
        <div className="rounded-xl border bg-card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">거래처 담당자</h2>
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
                  isPrimary: contactFields.length === 0,
                  memo: '',
                })
              }
            >
              + 거래처 담당자 추가
            </Button>
          </div>
          {contactFields.length === 0 && (
            <p className="text-xs text-muted-foreground">거래처 담당자를 추가하면 함께 저장됩니다.</p>
          )}
          {contactFields.map((field, index) => (
            <div key={field.id} className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">거래처 담당자 {index + 1}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeContact(index)}>
                  삭제
                </Button>
              </div>
              <ContactFields control={form.control} namePrefix={`contacts.${index}.`} />
            </div>
          ))}
        </div>

        {/* 담당 직원 배정 */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h2 className="text-sm font-semibold">담당 직원 배정</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">담당 직원</p>
              <NativeSelect value={assignmentMemberId} onChange={(e) => setAssignmentMemberId(e.target.value)}>
                <option value="">선택 안 함</option>
                {members
                  .filter((m) => m.isActive)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({ROLE_LABEL[m.role]})
                    </option>
                  ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">배정 시작일</p>
              <Input
                type="date"
                value={assignmentStartedAt}
                disabled={!assignmentMemberId}
                onChange={(e) => setAssignmentStartedAt(e.target.value)}
              />
            </div>
          </div>
          {assignmentMemberId && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={assignmentIsPrimary} onCheckedChange={(v) => setAssignmentIsPrimary(!!v)} />
              주 담당자로 지정
            </label>
          )}
        </div>

        {/* 메모 */}
        <div className="rounded-xl border bg-card p-6">
          <TextField control={form.control} name="memo" label="메모" placeholder="특이사항, 요청사항 등 (선택)" />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => void navigate({ to: '/customers' })}>
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
