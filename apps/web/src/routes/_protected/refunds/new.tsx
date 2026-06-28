import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { RefundForm } from './-components/RefundForm';

export const Route = createFileRoute('/_protected/refunds/new')({
  component: NewRefundPage,
});

function NewRefundPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/refunds' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">환불 등록</h1>
      </div>
      <RefundForm />
    </div>
  );
}
