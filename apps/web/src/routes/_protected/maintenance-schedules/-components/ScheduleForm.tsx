import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { fetchContracts, contractKeys } from '../../contracts/-api';
import type { ContractListItem } from '../../contracts/-types';
import { customerNameOf } from '../../contracts/-types';
import { fetchMembers, memberKeys } from '../../settings/members/-api';
import type { Member } from '../../settings/members/-types';
import type { MaintenanceIntervalUnit } from '../-types';
import { INTERVAL_UNIT_LABEL } from '../-types';
import { scheduleKeys } from '../-api';

export function ScheduleForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const org = useAuthStore((s) => s.currentOrganization);

  const [rentalContractId, setRentalContractId] = useState('');
  const [intervalUnit, setIntervalUnit] = useState<MaintenanceIntervalUnit>('MONTH');
  const [intervalValue, setIntervalValue] = useState('3');
  const [nextScheduledAt, setNextScheduledAt] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [memo, setMemo] = useState('');

  const { data: contracts = [] } = useQuery<ContractListItem[]>({
    queryKey: contractKeys.list(),
    queryFn: fetchContracts,
  });
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: memberKeys.list(org?.id ?? ''),
    queryFn: () => fetchMembers(org!.id),
    enabled: !!org,
  });

  const submittable = rentalContractId !== '' && Number(intervalValue) > 0 && nextScheduledAt !== '';

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/maintenance-schedules', {
        rentalContractId,
        intervalUnit,
        intervalValue: Number(intervalValue),
        nextScheduledAt: new Date(nextScheduledAt).toISOString(),
        ...(assignedStaffId && { assignedStaffId }),
        ...(memo && { memo }),
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
      toast.success('점검 일정이 등록되었습니다.');
      void navigate({ to: '/maintenance-schedules/$id', params: { id: res.data.id } });
    },
    onError: (err) =>
      toastApiError(err, '점검 일정 등록 중 오류가 발생했습니다.', {
        403: '점검 일정 등록 권한이 없습니다.',
        404: '계약 또는 담당자를 찾을 수 없습니다.',
      }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 grid grid-cols-2 gap-4">
        <div className="space-y-1 col-span-2">
          <p className="text-sm font-medium">
            계약 <span className="text-destructive">*</span>
          </p>
          <NativeSelect value={rentalContractId} onChange={(e) => setRentalContractId(e.target.value)}>
            <option value="">계약을 선택하세요</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.contractNo} · {customerNameOf(c.rentalOrder.order.customer)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            주기 단위 <span className="text-destructive">*</span>
          </p>
          <NativeSelect
            value={intervalUnit}
            onChange={(e) => setIntervalUnit(e.target.value as MaintenanceIntervalUnit)}
          >
            {(Object.keys(INTERVAL_UNIT_LABEL) as MaintenanceIntervalUnit[]).map((u) => (
              <option key={u} value={u}>
                {INTERVAL_UNIT_LABEL[u]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            주기 값 <span className="text-destructive">*</span>
          </p>
          <Input type="number" min={1} value={intervalValue} onChange={(e) => setIntervalValue(e.target.value)} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            다음 예정일 <span className="text-destructive">*</span>
          </p>
          <Input type="date" value={nextScheduledAt} onChange={(e) => setNextScheduledAt(e.target.value)} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">담당자</p>
          <NativeSelect value={assignedStaffId} onChange={(e) => setAssignedStaffId(e.target.value)}>
            <option value="">담당자 미지정</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1 col-span-2">
          <p className="text-sm font-medium">메모</p>
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="점검 메모 (선택)" />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/maintenance-schedules' })}>
          취소
        </Button>
        <Button type="button" disabled={!submittable || mutation.isPending} onClick={() => void mutation.mutate()}>
          {mutation.isPending ? '저장 중...' : '등록'}
        </Button>
      </div>
    </div>
  );
}
