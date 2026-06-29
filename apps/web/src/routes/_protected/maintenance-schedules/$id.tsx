import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { MaintenanceScheduleDetail } from './-types';
import { scheduleKeys, fetchSchedule } from './-api';
import { ScheduleDetailView } from './-components/ScheduleDetailView';

export const Route = createFileRoute('/_protected/maintenance-schedules/$id')({
  component: ScheduleDetailPage,
});

function ScheduleDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery<MaintenanceScheduleDetail>({
    queryKey: scheduleKeys.detail(id),
    queryFn: () => fetchSchedule(id),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/maintenance-schedules' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">점검 일정 상세</h1>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : isError || !data ? (
        <p className="text-muted-foreground">점검 일정을 찾을 수 없습니다.</p>
      ) : (
        <ScheduleDetailView schedule={data} />
      )}
    </div>
  );
}
