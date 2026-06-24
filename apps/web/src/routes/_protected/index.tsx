import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/')({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">대시보드</h1>
      <p className="mt-2 text-muted-foreground">레이아웃은 Task 5에서 추가됩니다.</p>
    </div>
  );
}
