import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { QuotationDetail } from './-types';
import { quotationKeys, fetchQuotation } from './-api';
import { QuotationDetailView } from './-components/QuotationDetailView';

export const Route = createFileRoute('/_protected/quotations/$id')({
  component: QuotationDetailPage,
});

function QuotationDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery<QuotationDetail>({
    queryKey: quotationKeys.detail(id),
    queryFn: () => fetchQuotation(id),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/quotations' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">견적 상세</h1>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : isError || !data ? (
        <p className="text-muted-foreground">견적을 찾을 수 없습니다.</p>
      ) : (
        <QuotationDetailView quotation={data} />
      )}
    </div>
  );
}
