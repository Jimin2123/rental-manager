import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { fetchMembers, memberKeys } from '../../settings/members/-api';
import type { Member } from '../../settings/members/-types';
import { fetchCustomers, customerKeys } from '../../customers/-api';
import type { CustomerListItem } from '../../customers/-types';
import { ORDER_TYPE_LABEL } from '../-types';
import { ItemsEditor } from './ItemsEditor';
import type { OrderFormState } from './payload';
import { emptyItemRow, buildCreateOrderBody, isSubmittable } from './payload';
import { buildCreateContractBody, emptyContractForm, isContractSubmittable } from '../../contracts/-components/payload';
import type { ContractFormState } from '../../contracts/-components/payload';

function customerLabel(c: CustomerListItem): string {
  return c.individualProfile?.name ?? c.businessPartner?.businessProfile.name ?? '(이름 없음)';
}

export function OrderForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.currentOrganization?.id);

  const [state, setState] = useState<OrderFormState>({
    type: 'SALE',
    customerId: '',
    managerId: '',
    orderDate: '',
    memo: '',
    items: [emptyItemRow()],
  });
  const [contractForm, setContractForm] = useState<ContractFormState>(emptyContractForm());
  const patchContract = (p: Partial<ContractFormState>) => setContractForm((s) => ({ ...s, ...p }));

  const patch = (p: Partial<OrderFormState>) => {
    if (p.type && p.type !== state.type) setContractForm(emptyContractForm());
    setState((s) => ({ ...s, ...p }));
  };

  const { data: customers = [] } = useQuery<CustomerListItem[]>({
    queryKey: customerKeys.list({}),
    queryFn: () => fetchCustomers({}),
  });
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: orgId ? memberKeys.list(orgId) : ['members', 'none'],
    queryFn: () => fetchMembers(orgId as string),
    enabled: !!orgId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ orderId: string; rentalOrderId?: string }>(
        '/orders',
        buildCreateOrderBody(state),
      );
      const { orderId, rentalOrderId } = res.data;
      if (rentalOrderId && isContractSubmittable(contractForm)) {
        try {
          const contractItems = state.items
            .filter((i) => i.assetId)
            .map((i) => ({ assetId: i.assetId, monthlyRentalPrice: i.monthlyRentalPrice }));
          await api.post('/rental-contracts', buildCreateContractBody(rentalOrderId, contractForm, contractItems));
        } catch {
          toast.error('계약 생성에 실패했습니다. 주문 상세에서 다시 시도하세요.');
        }
      }
      return orderId;
    },
    onSuccess: (orderId) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('거래가 등록되었습니다.');
      void navigate({ to: '/orders/$id', params: { id: orderId } });
    },
    onError: (err) => toastApiError(err, '거래 등록 중 오류가 발생했습니다.', { 404: '고객을 찾을 수 없습니다.' }),
  });

  return (
    <div className="space-y-6">
      {/* 거래종류 토글 */}
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">
          거래 종류 <span className="text-destructive">*</span>
        </p>
        <div className="flex gap-2">
          {(['SALE', 'RENTAL'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={state.type === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => patch({ type: t })}
            >
              {ORDER_TYPE_LABEL[t]}
            </Button>
          ))}
        </div>
      </div>

      {/* 공통 헤더 */}
      <div className="rounded-lg border bg-card p-4 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            고객 <span className="text-destructive">*</span>
          </p>
          <NativeSelect value={state.customerId} onChange={(e) => patch({ customerId: e.target.value })}>
            <option value="">고객을 선택하세요</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {customerLabel(c)}
              </option>
            ))}
          </NativeSelect>
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
        <div className="space-y-1">
          <p className="text-sm font-medium">메모</p>
          <Input placeholder="내부 메모 (선택)" value={state.memo} onChange={(e) => patch({ memo: e.target.value })} />
        </div>
      </div>

      {/* 품목 */}
      <ItemsEditor type={state.type} items={state.items} onChange={(items) => patch({ items })} />

      {/* 계약 (렌탈만, 선택 — 시작일·종료일·계약개월 입력 시 자동 생성) */}
      {state.type === 'RENTAL' && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">계약 <span className="text-xs font-normal text-muted-foreground">(선택)</span></p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs font-medium">시작일</p>
              <Input type="date" value={contractForm.startDate} onChange={(e) => patchContract({ startDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">종료일</p>
              <Input type="date" value={contractForm.endDate} onChange={(e) => patchContract({ endDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">계약개월</p>
              <Input
                type="number"
                min={1}
                value={contractForm.contractMonths}
                onChange={(e) => patchContract({ contractMonths: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">선/후불</p>
              <NativeSelect
                value={contractForm.billingTiming}
                onChange={(e) => patchContract({ billingTiming: e.target.value as ContractFormState['billingTiming'] })}
              >
                <option value="PREPAID">선불</option>
                <option value="POSTPAID">후불</option>
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">청구일(1-31)</p>
              <Input
                type="number"
                value={contractForm.billingDay}
                onChange={(e) => patchContract({ billingDay: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium">납부기한일(1-31)</p>
              <Input
                type="number"
                value={contractForm.paymentDueDay}
                onChange={(e) => patchContract({ paymentDueDay: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/orders' })}>
          취소
        </Button>
        <Button
          type="button"
          disabled={!isSubmittable(state) || mutation.isPending}
          onClick={() => void mutation.mutate()}
        >
          {mutation.isPending ? '저장 중...' : '등록'}
        </Button>
      </div>
    </div>
  );
}
