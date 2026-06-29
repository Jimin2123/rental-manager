import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { ScheduleForm } from './-components/ScheduleForm';

export const Route = createFileRoute('/_protected/maintenance-schedules/new')({
  component: NewSchedulePage,
});

function NewSchedulePage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/maintenance-schedules' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">점검 일정 등록</h1>
      </div>
      <ScheduleForm />
    </div>
  );
}
