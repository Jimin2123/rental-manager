import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { OrderListItem, OrderType, OrderStatus } from './-types';
import { ORDER_TYPE_LABEL, ORDER_STATUS_LABEL, customerNameOf, orderTotal } from './-types';
import { CONTRACT_STATUS_LABEL } from '../contracts/-types';
import { orderKeys, fetchOrders } from './-api';
import { won } from '@/lib/format';

export const Route = createFileRoute('/_protected/orders/')({
  component: OrdersPage,
});

type TypeFilter = 'ALL' | OrderType;
type StatusFilter = 'ALL' | OrderStatus;

function OrdersPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<TypeFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');

  const filters = {
    type: type === 'ALL' ? undefined : type,
    status: status === 'ALL' ? undefined : status,
  };
  const { data = [], isLoading } = useQuery<OrderListItem[]>({
    queryKey: orderKeys.list(filters),
    queryFn: () => fetchOrders(filters),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">거래</h1>
        <Button onClick={() => void navigate({ to: '/orders/new' })}>거래 등록</Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex gap-1">
          {(['ALL', 'SALE', 'RENTAL'] as const).map((t) => (
            <Button key={t} variant={type === t ? 'default' : 'outline'} size="sm" onClick={() => setType(t)}>
              {t === 'ALL' ? '전체' : ORDER_TYPE_LABEL[t]}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['ALL', 'REGISTERED', 'CONFIRMED', 'IN_DELIVERY', 'DELIVERED', 'CANCELED'] as const).map((s) => (
            <Button key={s} variant={status === s ? 'default' : 'outline'} size="sm" onClick={() => setStatus(s)}>
              {s === 'ALL' ? '전체' : ORDER_STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>주문번호</TableHead>
              <TableHead>종류</TableHead>
              <TableHead>고객</TableHead>
              <TableHead>담당자</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>주문일</TableHead>
              <TableHead className="text-right">합계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  등록된 거래가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              data.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/orders/$id', params: { id: o.id } })}
                >
                  <TableCell className="font-medium">{o.orderNo}</TableCell>
                  <TableCell>
                    <Badge variant={o.type === 'SALE' ? 'default' : 'secondary'}>{ORDER_TYPE_LABEL[o.type]}</Badge>
                  </TableCell>
                  <TableCell>{customerNameOf(o.customer)}</TableCell>
                  <TableCell>{o.manager?.name ?? '-'}</TableCell>
                  <TableCell>
                    {o.type === 'RENTAL' && o.rentalOrder?.contract
                      ? (CONTRACT_STATUS_LABEL[o.rentalOrder.contract.status as keyof typeof CONTRACT_STATUS_LABEL] ??
                        ORDER_STATUS_LABEL[o.status])
                      : ORDER_STATUS_LABEL[o.status]}
                  </TableCell>
                  <TableCell>{new Date(o.orderDate).toLocaleDateString('ko-KR')}</TableCell>
                  <TableCell className="text-right">{won(orderTotal(o))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
