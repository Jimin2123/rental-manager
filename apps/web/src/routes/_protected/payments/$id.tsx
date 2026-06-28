import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { PaymentDetail } from './-types';
import { paymentKeys, fetchPayment } from './-api';
import { PaymentDetailView } from './-components/PaymentDetailView';

export const Route = createFileRoute('/_protected/payments/$id')({
  component: PaymentDetailPage,
});

function PaymentDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery<PaymentDetail>({
    queryKey: paymentKeys.detail(id),
    queryFn: () => fetchPayment(id),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/payments' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">수납 상세</h1>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : isError || !data ? (
        <p className="text-muted-foreground">수납 내역을 찾을 수 없습니다.</p>
      ) : (
        <PaymentDetailView payment={data} />
      )}
    </div>
  );
}
