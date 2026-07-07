import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IndividualForm } from './-components/IndividualForm';
import { BusinessCustomerForm } from './-components/BusinessCustomerForm';

export const Route = createFileRoute('/_protected/customers/new')({
  component: NewCustomerPage,
});

type CustomerType = 'INDIVIDUAL' | 'BUSINESS';

const TYPE_LABELS: Record<CustomerType, string> = {
  INDIVIDUAL: '개인',
  BUSINESS: '거래처',
};

function NewCustomerPage() {
  const navigate = useNavigate();
  const [customerType, setCustomerType] = useState<CustomerType>('INDIVIDUAL');

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/customers' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">고객 등록</h1>
      </div>

      <div className="rounded-lg border bg-card p-4 mb-6 space-y-3">
        <p className="text-sm font-semibold">고객 구분</p>
        <div className="flex gap-2">
          {(['INDIVIDUAL', 'BUSINESS'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCustomerType(t)}
              className={[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                t === customerType
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'bg-muted/30 text-muted-foreground border border-border hover:bg-muted/50',
              ].join(' ')}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {customerType === 'INDIVIDUAL' ? <IndividualForm /> : <BusinessCustomerForm />}
    </div>
  );
}
