import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { won } from '@/lib/format';
import { DetailRow } from '@/components/ui/detail-row';
import { useAuthStore } from '@/store/auth.store';
import type { OrderDetail, OrderStatus } from '../-types';
import { ORDER_TYPE_LABEL, ORDER_STATUS_LABEL, ORDER_TRANSITIONS, customerNameOf, orderTotal } from '../-types';
import { orderKeys, invalidateOrder } from '../-api';
import { contractKeys } from '../../contracts/-api';
import { buildCreateContractBody, emptyContractForm, isContractSubmittable } from '../../contracts/-components/payload';
import type { ContractFormState } from '../../contracts/-components/payload';

export function OrderDetailView({ order }: { order: OrderDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.currentOrganization?.role);
  const canDelete = order.status === 'REGISTERED' && (role === 'OWNER' || role === 'ADMIN');

  const [memo, setMemo] = useState(order.memo ?? '');
  const [showContractForm, setShowContractForm] = useState(false);
  const existingContract = order.type === 'RENTAL' ? (order.rentalOrder?.contract ?? null) : null;

  const statusMutation = useMutation({
    mutationFn: (status: OrderStatus) => api.patch(`/orders/${order.id}/status`, { status }),
    onSuccess: () => {
      invalidateOrder(queryClient, order.id);
      toast.success('상태가 변경되었습니다.');
    },
    onError: (err) =>
      toastApiError(err, '상태 변경 중 오류가 발생했습니다.', { 400: '허용되지 않는 상태 전환입니다.' }),
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
    onError: (err) =>
      toastApiError(err, '삭제 중 오류가 발생했습니다.', { 400: '등록 상태의 거래만 삭제할 수 있습니다.' }),
  });

  const nextStatuses = ORDER_TRANSITIONS[order.status];

  return (
    <div className="space-y-6">
      {showContractForm && order.type === 'RENTAL' && order.rentalOrder && (
        <ContractCreateCard
          rentalOrderId={order.rentalOrder.id}
          rentalItems={order.rentalOrder.items}
          onClose={() => setShowContractForm(false)}
        />
      )}
      {/* 헤더 카드 */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{order.orderNo}</h2>
            <Badge variant={order.type === 'SALE' ? 'default' : 'secondary'}>{ORDER_TYPE_LABEL[order.type]}</Badge>
            <Badge variant="outline">{ORDER_STATUS_LABEL[order.status]}</Badge>
          </div>
          <div className="flex gap-2">
            {order.type === 'RENTAL' && existingContract && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate({ to: '/contracts/$id', params: { id: existingContract.id } })}
              >
                계약 보기
              </Button>
            )}
            {order.type === 'RENTAL' && !existingContract && (
              <Button size="sm" onClick={() => setShowContractForm((v) => !v)}>
                계약 생성
              </Button>
            )}
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
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <DetailRow label="고객" value={customerNameOf(order.customer)} />
          <DetailRow label="담당자" value={order.manager?.name ?? '-'} />
          <DetailRow label="주문일" value={new Date(order.orderDate).toLocaleDateString('ko-KR')} />
          <DetailRow label="합계" value={won(orderTotal(order))} />
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

function ContractCreateCard({
  rentalOrderId,
  rentalItems,
  onClose,
}: {
  rentalOrderId: string;
  rentalItems: { id: string; assetId: string | null; monthlyRentalPrice: number }[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContractFormState>(emptyContractForm());
  const patch = (p: Partial<ContractFormState>) => setForm((s) => ({ ...s, ...p }));
  const copyable = rentalItems.filter((i) => i.assetId);

  const mutation = useMutation({
    // 계약 + 자산 지정 항목을 한 번의 요청으로 생성한다(백엔드 트랜잭션, 부분 실패 시 전체 롤백).
    mutationFn: async () => {
      const items = copyable.map((it) => ({
        assetId: it.assetId as string,
        rentalOrderItemId: it.id,
        monthlyRentalPrice: it.monthlyRentalPrice,
      }));
      const res = await api.post<{ id: string }>(
        '/rental-contracts',
        buildCreateContractBody(rentalOrderId, form, items),
      );
      return res.data.id;
    },
    onSuccess: (contractId) => {
      void queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('계약이 생성되었습니다.');
      void navigate({ to: '/contracts/$id', params: { id: contractId } });
    },
    onError: (err) =>
      toastApiError(err, '계약 생성 중 오류가 발생했습니다.', {
        409: '이미 이 주문에 연결된 계약이 있습니다.',
        400: '계약 정보를 확인해주세요. (날짜·자산 상태)',
      }),
  });

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">계약 생성</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          닫기
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput label="시작일" type="date" value={form.startDate} onChange={(v) => patch({ startDate: v })} />
        <LabeledInput label="종료일" type="date" value={form.endDate} onChange={(v) => patch({ endDate: v })} />
        <LabeledInput
          label="계약개월"
          type="number"
          value={String(form.contractMonths)}
          onChange={(v) => patch({ contractMonths: Number(v) })}
        />
        <div className="space-y-1">
          <p className="text-xs font-medium">선/후불</p>
          <NativeSelect
            value={form.billingTiming}
            onChange={(e) => patch({ billingTiming: e.target.value as ContractFormState['billingTiming'] })}
          >
            <option value="PREPAID">선불</option>
            <option value="POSTPAID">후불</option>
          </NativeSelect>
        </div>
        <LabeledInput
          label="청구일(1-31)"
          type="number"
          value={form.billingDay}
          onChange={(v) => patch({ billingDay: v })}
        />
        <LabeledInput
          label="납부기한일(1-31)"
          type="number"
          value={form.paymentDueDay}
          onChange={(v) => patch({ paymentDueDay: v })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        자산이 지정된 주문 항목 {copyable.length}건이 계약 항목으로 복사됩니다.
      </p>
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!isContractSubmittable(form) || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? '생성 중...' : '생성'}
        </Button>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{label}</p>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
