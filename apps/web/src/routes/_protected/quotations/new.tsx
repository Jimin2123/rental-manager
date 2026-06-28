import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { QuotationForm } from './-components/QuotationForm';

export const Route = createFileRoute('/_protected/quotations/new')({
  component: NewQuotationPage,
});

function NewQuotationPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/quotations' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">견적 등록</h1>
      </div>
      <QuotationForm />
    </div>
  );
}
