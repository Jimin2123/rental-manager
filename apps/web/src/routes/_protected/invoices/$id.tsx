import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { InvoiceDetail } from './-types';
import { invoiceKeys, fetchInvoice } from './-api';
import { InvoiceDetailView } from './-components/InvoiceDetailView';

export const Route = createFileRoute('/_protected/invoices/$id')({
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery<InvoiceDetail>({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => fetchInvoice(id),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/invoices' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">청구서 상세</h1>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : isError || !data ? (
        <p className="text-muted-foreground">청구서를 찾을 수 없습니다.</p>
      ) : (
        <InvoiceDetailView invoice={data} />
      )}
    </div>
  );
}
