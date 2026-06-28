import { useState } from 'react';
import { toast } from 'sonner';
import { type AxiosError } from 'axios';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { OrderDetail, OrderStatus } from '../-types';
import { ORDER_TYPE_LABEL, ORDER_STATUS_LABEL, ORDER_TRANSITIONS, customerNameOf, orderTotal } from '../-types';
import { orderKeys, invalidateOrder } from '../-api';

export function OrderDetailView({ order }: { order: OrderDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.currentOrganization?.role);
  const canDelete = order.status === 'REGISTERED' && (role === 'OWNER' || role === 'ADMIN');

  const [memo, setMemo] = useState(order.memo ?? '');

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => api.patch(`/orders/${order.id}/status`, { status }),
    onSuccess: () => {
      invalidateOrder(queryClient, order.id);
      toast.success('상태가 변경되었습니다.');
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(s === 400 ? '허용되지 않는 상태 전환입니다.' : '상태 변경 중 오류가 발생했습니다.');
    },
  });

  const memoMutation = useMutation({
    mutationFn: () => api.patch(`/orders/${order.id}`, { memo }),
    onSuccess: () => {
      invalidateOrder(queryClient, order.id);
      toast.success('메모가 저장되었습니다.');
    },
    onError: () => toast.error('저장 중 오류가 발생했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/orders/${order.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      toast.success('거래가 삭제되었습니다.');
      void navigate({ to: '/orders' });
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(s === 400 ? '등록 상태의 거래만 삭제할 수 있습니다.' : '삭제 중 오류가 발생했습니다.');
    },
  });

  const nextStatuses = ORDER_TRANSITIONS[order.status];

  return (
    <div className="space-y-6">
      {/* 헤더 카드 */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{order.orderNo}</h2>
            <Badge variant={order.type === 'SALE' ? 'default' : 'secondary'}>{ORDER_TYPE_LABEL[order.type]}</Badge>
            <Badge variant="outline">{ORDER_STATUS_LABEL[order.status]}</Badge>
          </div>
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              삭제
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row label="고객" value={customerNameOf(order.customer)} />
          <Row label="담당자" value={order.manager?.name ?? '-'} />
          <Row label="주문일" value={new Date(order.orderDate).toLocaleDateString('ko-KR')} />
          <Row label="합계" value={`${orderTotal(order).toLocaleString('ko-KR')}원`} />
        </div>

        {/* 상태 전환 */}
        {nextStatuses.length > 0 && (
          <div className="flex items-center gap-2 border-t pt-3">
            <span className="text-sm text-muted-foreground">상태 변경:</span>
            {nextStatuses.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(s)}
              >
                {ORDER_STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        )}

        {/* 메모 인라인 수정 */}
        <div className="flex items-end gap-2 border-t pt-3">
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">메모</p>
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="내부 메모" />
          </div>
          <Button
            size="sm"
            disabled={memo === (order.memo ?? '') || memoMutation.isPending}
            onClick={() => memoMutation.mutate()}
          >
            저장
          </Button>
        </div>
      </div>

      {/* 품목 테이블 */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {order.type === 'SALE' ? (
              <TableRow>
                <TableHead>제품</TableHead>
                <TableHead>시리얼</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">금액</TableHead>
              </TableRow>
            ) : (
              <TableRow>
                <TableHead>제품</TableHead>
                <TableHead>시리얼</TableHead>
                <TableHead className="text-right">월 렌탈료</TableHead>
                <TableHead className="text-right">보증금</TableHead>
                <TableHead>설치 위치</TableHead>
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {order.type === 'SALE'
              ? (order.saleOrder?.items ?? []).map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.product.name}</TableCell>
                    <TableCell>{it.serialNumber ?? '-'}</TableCell>
                    <TableCell className="text-right">{it.quantity}</TableCell>
                    <TableCell className="text-right">{it.unitPrice.toLocaleString('ko-KR')}</TableCell>
                    <TableCell className="text-right">{it.totalAmount.toLocaleString('ko-KR')}</TableCell>
                  </TableRow>
                ))
              : (order.rentalOrder?.items ?? []).map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.product.name}</TableCell>
                    <TableCell>{it.serialNumber ?? '-'}</TableCell>
                    <TableCell className="text-right">{it.monthlyRentalPrice.toLocaleString('ko-KR')}</TableCell>
                    <TableCell className="text-right">{(it.depositAmount ?? 0).toLocaleString('ko-KR')}</TableCell>
                    <TableCell>{it.installationLocation ?? '-'}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
