import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthStore } from '@/store/auth.store';
import type { MaintenanceScheduleListItem } from './-types';
import { intervalLabel, contractCustomerName } from './-types';
import type { ScheduleFilters } from './-api';
import { scheduleKeys, fetchSchedules } from './-api';

export const Route = createFileRoute('/_protected/maintenance-schedules/')({
  component: SchedulesPage,
});

type ActiveFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

function SchedulesPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.currentOrganization?.role);
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const [active, setActive] = useState<ActiveFilter>('ALL');

  const filters: ScheduleFilters = {
    ...(active !== 'ALL' && { isActive: active === 'ACTIVE' }),
  };

  const { data = [], isLoading } = useQuery<MaintenanceScheduleListItem[]>({
    queryKey: scheduleKeys.list(filters),
    queryFn: () => fetchSchedules(filters),
  });

  // 마운트 시 1회 계산 (렌더 중 Date 호출 회피).
  const [todayStart] = useState(() => new Date().setHours(0, 0, 0, 0));
  const isOverdue = (s: MaintenanceScheduleListItem) =>
    s.isActive && new Date(s.nextScheduledAt).getTime() < todayStart;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">정기점검</h1>
        {canManage && (
          <Button size="sm" onClick={() => void navigate({ to: '/maintenance-schedules/new' })}>
            일정 등록
          </Button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-1">
        {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((a) => (
          <Button key={a} variant={active === a ? 'default' : 'outline'} size="sm" onClick={() => setActive(a)}>
            {a === 'ALL' ? '전체' : a === 'ACTIVE' ? '활성' : '비활성'}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>계약</TableHead>
              <TableHead>고객</TableHead>
              <TableHead>주기</TableHead>
              <TableHead>다음 예정일</TableHead>
              <TableHead>마지막 점검</TableHead>
              <TableHead>담당자</TableHead>
              <TableHead>활성</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  점검 일정이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              data.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/maintenance-schedules/$id', params: { id: s.id } })}
                >
                  <TableCell className="font-medium">{s.rentalContract.contractNo}</TableCell>
                  <TableCell>{contractCustomerName(s.rentalContract)}</TableCell>
                  <TableCell>{intervalLabel(s.intervalUnit, s.intervalValue)}</TableCell>
                  <TableCell className={isOverdue(s) ? 'font-medium text-destructive' : undefined}>
                    {new Date(s.nextScheduledAt).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell>
                    {s.lastInspectedAt ? new Date(s.lastInspectedAt).toLocaleDateString('ko-KR') : '-'}
                  </TableCell>
                  <TableCell>{s.assignedStaff?.name ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? '활성' : '비활성'}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
