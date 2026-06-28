import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { RefundDetail } from './-types';
import { refundKeys, fetchRefund } from './-api';
import { RefundDetailView } from './-components/RefundDetailView';

export const Route = createFileRoute('/_protected/refunds/$id')({
  component: RefundDetailPage,
});

function RefundDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery<RefundDetail>({
    queryKey: refundKeys.detail(id),
    queryFn: () => fetchRefund(id),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/refunds' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">환불 상세</h1>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : isError || !data ? (
        <p className="text-muted-foreground">환불 내역을 찾을 수 없습니다.</p>
      ) : (
        <RefundDetailView refund={data} />
      )}
    </div>
  );
}
