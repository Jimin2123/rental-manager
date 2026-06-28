import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { OrderForm } from './-components/OrderForm';

export const Route = createFileRoute('/_protected/orders/new')({
  component: NewOrderPage,
});

function NewOrderPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/orders' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">거래 등록</h1>
      </div>
      <OrderForm />
    </div>
  );
}
