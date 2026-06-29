import { useState } from 'react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { fetchCustomers, customerKeys } from '../../customers/-api';
import type { CustomerListItem } from '../../customers/-types';
import { QUOTATION_TYPE_LABEL } from '../-types';
import { quotationKeys } from '../-api';
import { QuotationItemsEditor } from './QuotationItemsEditor';
import type { QuotationFormState } from './payload';
import { emptyItemRow, buildCreateQuotationBody, isSubmittable } from './payload';

function customerLabel(c: CustomerListItem): string {
  return c.individualProfile?.name ?? c.businessPartner?.businessProfile.name ?? '(이름 없음)';
}

export function QuotationForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [state, setState] = useState<QuotationFormState>({
    type: 'SALE',
    customerId: '',
    validUntil: '',
    memo: '',
    items: [emptyItemRow()],
  });
  const patch = (p: Partial<QuotationFormState>) => setState((s) => ({ ...s, ...p }));

  const { data: customers = [] } = useQuery<CustomerListItem[]>({
    queryKey: customerKeys.list({}),
    queryFn: () => fetchCustomers({}),
  });

  const mutation = useMutation({
    mutationFn: () => api.post<{ id: string }>('/quotations', buildCreateQuotationBody(state)),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
      toast.success('견적이 등록되었습니다.');
      void navigate({ to: '/quotations/$id', params: { id: res.data.id } });
    },
    onError: (err) => toastApiError(err, '견적 등록 중 오류가 발생했습니다.', { 404: '고객을 찾을 수 없습니다.' }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">
          견적 종류 <span className="text-destructive">*</span>
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
              {QUOTATION_TYPE_LABEL[t]}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            고객 <span className="text-destructive">*</span>
          </p>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none"
            value={state.customerId}
            onChange={(e) => patch({ customerId: e.target.value })}
          >
            <option value="">고객을 선택하세요</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {customerLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">유효기간</p>
          <Input type="date" value={state.validUntil} onChange={(e) => patch({ validUntil: e.target.value })} />
        </div>
        <div className="space-y-1 col-span-2">
          <p className="text-sm font-medium">메모</p>
          <Input placeholder="내부 메모 (선택)" value={state.memo} onChange={(e) => patch({ memo: e.target.value })} />
        </div>
      </div>

      <QuotationItemsEditor type={state.type} items={state.items} onChange={(items) => patch({ items })} />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/quotations' })}>
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
