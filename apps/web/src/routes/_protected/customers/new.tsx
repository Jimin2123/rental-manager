import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { IndividualForm } from './-components/IndividualForm';

export const Route = createFileRoute('/_protected/customers/new')({
  component: NewCustomerPage,
});

function NewCustomerPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/customers' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">고객 등록</h1>
      </div>
      <IndividualForm />
    </div>
  );
}
