import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useAuthStore } from '@/store/auth.store';
import { fetchMembers, memberKeys } from '../../settings/members/-api';
import type { Member } from '../../settings/members/-types';
import type { OrderDetail } from '../-types';
import { ORDER_TYPE_LABEL, customerNameOf } from '../-types';
import { invalidateOrder } from '../-api';
import { ItemsEditor } from './ItemsEditor';
import {
  saleItemsToRows,
  rentalItemsToRows,
  buildSaleItemsPayload,
  buildRentalItemsPayload,
} from './payload';
import type { ItemRow } from './payload';

type EditState = {
  managerId: string;
  orderDate: string;
  memo: string;
  items: ItemRow[];
};

export function OrderEditForm({ order }: { order: OrderDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.currentOrganization?.id);

  const hasContract = order.type === 'RENTAL' && !!order.rentalOrder?.contract;

  const [state, setState] = useState<EditState>({
    managerId: order.manager?.id ?? '',
    orderDate: order.orderDate.slice(0, 10),
    memo: order.memo ?? '',
    items:
      order.type === 'SALE'
        ? saleItemsToRows(order.saleOrder?.items ?? [])
        : rentalItemsToRows(order.rentalOrder?.items ?? []),
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: orgId ? memberKeys.list(orgId) : ['members', 'none'],
    queryFn: () => fetchMembers(orgId as string),
    enabled: !!orgId,
  });

  const patch = (p: Partial<EditState>) => setState((s) => ({ ...s, ...p }));

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/orders/${order.id}`, {
        ...(state.managerId ? { managerId: state.managerId } : { managerId: null }),
        ...(state.orderDate && { orderDate: new Date(state.orderDate).toISOString() }),
        memo: state.memo,
        ...(order.type === 'SALE' && { saleItems: buildSaleItemsPayload(state.items) }),
        ...(!hasContract && order.type === 'RENTAL' && { rentalItems: buildRentalItemsPayload(state.items) }),
      }),
    onSuccess: () => {
      invalidateOrder(queryClient, order.id);
      toast.success('거래가 수정되었습니다.');
      void navigate({ to: '/orders/$id', params: { id: order.id } });
    },
    onError: (err) =>
      toastApiError(err, '수정 중 오류가 발생했습니다.', {
        400: '등록 상태의 주문만 수정할 수 있습니다.',
      }),
  });

  const isValid = state.items.length > 0 && state.items.every((i) => i.productId !== '');

  return (
    <div className="space-y-6">
      {/* 읽기 전용 정보 + 수정 가능 헤더 */}
      <div className="rounded-lg border bg-card p-4 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">고객</p>
          <p className="text-sm">{customerNameOf(order.customer)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">거래 종류</p>
          <p className="text-sm">{ORDER_TYPE_LABEL[order.type]}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">담당자</p>
          <NativeSelect value={state.managerId} onChange={(e) => patch({ managerId: e.target.value })}>
            <option value="">선택 안 함</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">주문일</p>
          <Input type="date" value={state.orderDate} onChange={(e) => patch({ orderDate: e.target.value })} />
        </div>
        <div className="col-span-2 space-y-1">
          <p className="text-sm font-medium">메모</p>
          <Input
            placeholder="내부 메모 (선택)"
            value={state.memo}
            onChange={(e) => patch({ memo: e.target.value })}
          />
        </div>
      </div>

      {/* 품목 */}
      {hasContract ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          계약이 연결된 주문의 품목은 수정할 수 없습니다.
        </div>
      ) : (
        <ItemsEditor type={order.type} items={state.items} onChange={(items) => patch({ items })} />
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => void navigate({ to: '/orders/$id', params: { id: order.id } })}
        >
          취소
        </Button>
        <Button
          type="button"
          disabled={(!hasContract && !isValid) || mutation.isPending}
          onClick={() => void mutation.mutate()}
        >
          {mutation.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}
