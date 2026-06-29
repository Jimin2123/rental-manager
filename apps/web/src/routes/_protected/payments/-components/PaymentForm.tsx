import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { fetchCustomers, customerKeys } from '../../customers/-api';
import type { CustomerListItem } from '../../customers/-types';
import type { PaymentMethod, PaymentProvider } from '../-types';
import { PAYMENT_METHOD_LABEL, PAYMENT_PROVIDER_LABEL } from '../-types';
import { paymentKeys } from '../-api';

function customerLabel(c: CustomerListItem): string {
  return c.individualProfile?.name ?? c.businessPartner?.businessProfile.name ?? '(이름 없음)';
}

export function PaymentForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('0');
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [provider, setProvider] = useState<PaymentProvider>('MANUAL');
  const [paidAt, setPaidAt] = useState('');
  const [externalRef, setExternalRef] = useState('');
  const [memo, setMemo] = useState('');

  const { data: customers = [] } = useQuery<CustomerListItem[]>({
    queryKey: customerKeys.list({}),
    queryFn: () => fetchCustomers({}),
  });

  const submittable = customerId !== '' && Number(amount) > 0 && paidAt !== '';

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/payments', {
        customerId,
        amount: Number(amount),
        method,
        provider,
        paidAt: new Date(paidAt).toISOString(),
        ...(externalRef && { externalRef }),
        ...(memo && { memo }),
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
      toast.success('수납이 등록되었습니다.');
      void navigate({ to: '/payments/$id', params: { id: res.data.id } });
    },
    onError: (err) => toastApiError(err, '수납 등록 중 오류가 발생했습니다.', { 404: '고객을 찾을 수 없습니다.' }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            고객 <span className="text-destructive">*</span>
          </p>
          <NativeSelect value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">고객을 선택하세요</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {customerLabel(c)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            금액 <span className="text-destructive">*</span>
          </p>
          <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            방법 <span className="text-destructive">*</span>
          </p>
          <NativeSelect value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">채널</p>
          <NativeSelect value={provider} onChange={(e) => setProvider(e.target.value as PaymentProvider)}>
            {(Object.keys(PAYMENT_PROVIDER_LABEL) as PaymentProvider[]).map((p) => (
              <option key={p} value={p}>
                {PAYMENT_PROVIDER_LABEL[p]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            수납일 <span className="text-destructive">*</span>
          </p>
          <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">외부참조</p>
          <Input value={externalRef} onChange={(e) => setExternalRef(e.target.value)} placeholder="거래 참조 (선택)" />
        </div>
        <div className="space-y-1 col-span-2">
          <p className="text-sm font-medium">메모</p>
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="내부 메모 (선택)" />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">등록 시 해당 고객의 미수 청구서에 오래된 순서로 자동 배분됩니다.</p>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/payments' })}>
          취소
        </Button>
        <Button type="button" disabled={!submittable || mutation.isPending} onClick={() => void mutation.mutate()}>
          {mutation.isPending ? '저장 중...' : '등록'}
        </Button>
      </div>
    </div>
  );
}
