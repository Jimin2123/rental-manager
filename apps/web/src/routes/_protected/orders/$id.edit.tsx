import { useEffect } from 'react';
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

  useEffect(() => {
    if (order && order.status !== 'REGISTERED') {
      void navigate({ to: '/orders/$id', params: { id } });
    }
  }, [order, id, navigate]);

  if (isLoading || !order || order.status !== 'REGISTERED') {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-xl font-semibold">거래 수정</h1>
      <OrderEditForm order={order} />
    </div>
  );
}
