import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from '@/components/ui/native-select';
import { TextField } from '@/components/form/TextField';
import { api } from '@/lib/api';
import { openKakaoAddressSearch } from '@/lib/kakao-address';
import { useAuthStore } from '@/store/auth.store';
import { customerKeys } from '../-api';
import { customerFormSchema, type CustomerFormValues } from '../-schemas';
import type { CustomerDetail } from '../-types';
import { IndividualFields, AddressFields } from './fields';
import { toAddressPayload } from './payload';
import { fetchMembers, memberKeys } from '../../settings/members/-api';
import { ROLE_LABEL } from '../../settings/members/-types';

export function IndividualForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.currentOrganization?.id);

  const [assignmentMemberId, setAssignmentMemberId] = useState('');
  const [assignmentStartedAt, setAssignmentStartedAt] = useState(new Date().toISOString().split('T')[0]);
  const [assignmentIsPrimary, setAssignmentIsPrimary] = useState(true);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: { zonecode: '', address: '', addressDetail: '', jibunAddress: '', roadAddress: '', buildingName: '' },
      memo: '',
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: orgId ? memberKeys.list(orgId) : ['members', 'none'],
    queryFn: () => fetchMembers(orgId!),
    enabled: !!orgId,
  });

  const mutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      const res = await api.post<{ id: string }>('/customers', {
        type: 'INDIVIDUAL',
        memo: values.memo || undefined,
        individualProfile: {
          name: values.name,
          phone: values.phone || undefined,
          email: values.email || undefined,
          address: toAddressPayload(values.address),
        },
      });

      if (assignmentMemberId) {
        const detail = await api.get<CustomerDetail>(`/customers/${res.data.id}`);
        await api.post(`/customers/${res.data.id}/assignments`, {
          organizationMemberId: assignmentMemberId,
          individualProfileId: detail.data.individualProfile?.id,
          startedAt: new Date(assignmentStartedAt).toISOString(),
          isPrimary: assignmentIsPrimary,
        });
      }

      return res;
    },
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success('고객이 등록되었습니다.');
      void navigate({ to: '/customers/$id', params: { id: res.data.id } });
    },
    onError: () => toast.error('고객 등록 중 오류가 발생했습니다.'),
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
      <form onSubmit={form.handleSubmit((d) => void mutation.mutate(d))} className="space-y-6">
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold">개인 정보</h2>
          <IndividualFields control={form.control} />
          <AddressFields control={form.control} onSearch={handleAddressSearch} />
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-4">
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

        <div className="rounded-lg border bg-card p-4">
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
