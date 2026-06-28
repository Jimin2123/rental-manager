import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { TaxInvoiceDetail } from './-types';
import { taxInvoiceKeys, fetchTaxInvoice } from './-api';
import { TaxInvoiceDetailView } from './-components/TaxInvoiceDetailView';

export const Route = createFileRoute('/_protected/tax-invoices/$id')({
  component: TaxInvoiceDetailPage,
});

function TaxInvoiceDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery<TaxInvoiceDetail>({
    queryKey: taxInvoiceKeys.detail(id),
    queryFn: () => fetchTaxInvoice(id),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/tax-invoices' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">세금계산서 상세</h1>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : isError || !data ? (
        <p className="text-muted-foreground">세금계산서를 찾을 수 없습니다.</p>
      ) : (
        <TaxInvoiceDetailView taxInvoice={data} />
      )}
    </div>
  );
}
