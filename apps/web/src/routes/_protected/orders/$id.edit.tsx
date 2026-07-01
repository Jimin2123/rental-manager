import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { OrderDetail } from './-types';
import { orderKeys, fetchOrder } from './-api';
import { OrderEditForm } from './-components/OrderEditForm';

export const Route = createFileRoute('/_protected/orders/$id/edit')({
  component: OrderEditPage,
});

function OrderEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: orderKeys.detail(id),
    queryFn: () => fetchOrder(id),
  });

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">불러오는 중...</div>;
  }
  if (!order) {
    return <div className="p-6 text-muted-foreground">거래를 찾을 수 없습니다.</div>;
  }
  if (order.status !== 'REGISTERED') {
    void navigate({ to: '/orders/$id', params: { id } });
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-xl font-semibold">거래 수정</h1>
      <OrderEditForm order={order} />
    </div>
  );
}
