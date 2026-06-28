import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { PaymentForm } from './-components/PaymentForm';

export const Route = createFileRoute('/_protected/payments/new')({
  component: NewPaymentPage,
});

function NewPaymentPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/payments' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">수납 등록</h1>
      </div>
      <PaymentForm />
    </div>
  );
}
