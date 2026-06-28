import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { OrderDetail } from './-types';
import { orderKeys, fetchOrder } from './-api';
import { OrderDetailView } from './-components/OrderDetailView';

export const Route = createFileRoute('/_protected/orders/$id')({
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery<OrderDetail>({
    queryKey: orderKeys.detail(id),
    queryFn: () => fetchOrder(id),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/orders' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">거래 상세</h1>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : isError || !data ? (
        <p className="text-muted-foreground">거래를 찾을 수 없습니다.</p>
      ) : (
        <OrderDetailView order={data} />
      )}
    </div>
  );
}
