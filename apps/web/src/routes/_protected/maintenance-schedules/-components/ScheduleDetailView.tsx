import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { DetailRow } from '@/components/ui/detail-row';
import { useAuthStore } from '@/store/auth.store';
import { fetchMembers, memberKeys } from '../../settings/members/-api';
import type { Member } from '../../settings/members/-types';
import type { MaintenanceScheduleDetail, MaintenanceIntervalUnit } from '../-types';
import { INTERVAL_UNIT_LABEL, intervalLabel, contractCustomerName } from '../-types';
import { invalidateSchedule } from '../-api';

import { date } from '@/lib/format';

export function ScheduleDetailView({ schedule }: { schedule: MaintenanceScheduleDetail }) {
  const queryClient = useQueryClient();
  const org = useAuthStore((s) => s.currentOrganization);
  const canManage = org?.role === 'OWNER' || org?.role === 'ADMIN';
  const [editing, setEditing] = useState(false);

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: memberKeys.list(org?.id ?? ''),
    queryFn: () => fetchMembers(org!.id),
    enabled: !!org && editing,
  });

  const [intervalUnit, setIntervalUnit] = useState<MaintenanceIntervalUnit>(schedule.intervalUnit);
  const [intervalValue, setIntervalValue] = useState(String(schedule.intervalValue));
  const [nextScheduledAt, setNextScheduledAt] = useState(schedule.nextScheduledAt.slice(0, 10));
  const [assignedStaffId, setAssignedStaffId] = useState(schedule.assignedStaffId ?? '');
  const [memo, setMemo] = useState(schedule.memo ?? '');

  const updateMutation = useMutation({
    mutationFn: () =>
      api.patch(`/maintenance-schedules/${schedule.id}`, {
        intervalUnit,
        intervalValue: Number(intervalValue),
        nextScheduledAt: new Date(nextScheduledAt).toISOString(),
        assignedStaffId: assignedStaffId || null,
        memo: memo || null,
      }),
    onSuccess: () => {
      invalidateSchedule(queryClient, schedule.id);
      toast.success('점검 일정을 수정했습니다.');
      setEditing(false);
    },
    onError: (err) => toastApiError(err, '수정 중 오류가 발생했습니다.', { 403: '수정 권한이 없습니다.' }),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => api.delete(`/maintenance-schedules/${schedule.id}`),
    onSuccess: () => {
      invalidateSchedule(queryClient, schedule.id);
      toast.success('점검 일정을 비활성화했습니다.');
    },
    onError: (err) => toastApiError(err, '비활성화 중 오류가 발생했습니다.', { 403: '비활성화 권한이 없습니다.' }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{schedule.rentalContract.contractNo}</h2>
            <Badge variant={schedule.isActive ? 'default' : 'secondary'}>{schedule.isActive ? '활성' : '비활성'}</Badge>
          </div>
          {canManage && !editing && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                수정
              </Button>
              {schedule.isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={deactivateMutation.isPending}
                  onClick={() => deactivateMutation.mutate()}
                >
                  비활성화
                </Button>
              )}
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">주기 단위</p>
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
              <p className="text-sm font-medium">주기 값</p>
              <Input type="number" min={1} value={intervalValue} onChange={(e) => setIntervalValue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">다음 예정일</p>
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
            <div className="col-span-2 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                취소
              </Button>
              <Button size="sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                저장
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <DetailRow label="고객" value={contractCustomerName(schedule.rentalContract)} />
            <DetailRow label="주기" value={intervalLabel(schedule.intervalUnit, schedule.intervalValue)} />
            <DetailRow label="다음 예정일" value={date(schedule.nextScheduledAt)} />
            <DetailRow label="마지막 점검" value={date(schedule.lastInspectedAt)} />
            <DetailRow label="담당자" value={schedule.assignedStaff?.name ?? '-'} />
            <DetailRow label="메모" value={schedule.memo ?? '-'} />
          </div>
        )}
      </div>
    </div>
  );
}
