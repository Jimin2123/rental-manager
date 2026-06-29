import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { won } from '@/lib/format';
import { fetchCustomers, customerKeys } from '../../customers/-api';
import type { CustomerListItem } from '../../customers/-types';
import { fetchPayments, paymentKeys } from '../../payments/-api';
import type { RefundReason } from '../-types';
import { REFUND_REASON_LABEL } from '../-types';
import { refundKeys } from '../-api';

function customerLabel(c: CustomerListItem): string {
  return c.individualProfile?.name ?? c.businessPartner?.businessProfile.name ?? '(이름 없음)';
}

export function RefundForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [reason, setReason] = useState<RefundReason>('OVERPAYMENT');
  const [amount, setAmount] = useState('0');
  const [memo, setMemo] = useState('');

  const { data: customers = [] } = useQuery<CustomerListItem[]>({
    queryKey: customerKeys.list({}),
    queryFn: () => fetchCustomers({}),
  });

  // 고객 선택 시 그 고객의 완료된 수납만 조회 (환불 원천은 완료 수납이어야 함). 선택용이라 1페이지.
  const { data: paymentsPage } = useQuery({
    queryKey: paymentKeys.list({ customerId, status: 'COMPLETED' }, 1),
    queryFn: () => fetchPayments({ customerId, status: 'COMPLETED' }, 1),
    enabled: customerId !== '',
  });
  const payments = paymentsPage?.data ?? [];

  const submittable = customerId !== '' && paymentId !== '' && Number(amount) > 0;

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/refunds', {
        customerId,
        paymentId,
        reason,
        amount: Number(amount),
        ...(memo && { memo }),
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: refundKeys.lists() });
      toast.success('환불이 등록되었습니다.');
      void navigate({ to: '/refunds/$id', params: { id: res.data.id } });
    },
    onError: (err) =>
      toastApiError(err, '환불 등록 중 오류가 발생했습니다.', {
        400: '환불액이 수납 금액을 초과할 수 없습니다.',
        404: '고객 또는 수납 내역을 찾을 수 없습니다.',
      }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            고객 <span className="text-destructive">*</span>
          </p>
          <NativeSelect
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setPaymentId('');
            }}
          >
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
            원천 수납 <span className="text-destructive">*</span>
          </p>
          <NativeSelect value={paymentId} onChange={(e) => setPaymentId(e.target.value)} disabled={customerId === ''}>
            <option value="">{customerId === '' ? '고객 먼저 선택' : '수납을 선택하세요'}</option>
            {payments.map((p) => (
              <option key={p.id} value={p.id}>
                {p.paymentNo} ({won(p.amount)})
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            사유 <span className="text-destructive">*</span>
          </p>
          <NativeSelect value={reason} onChange={(e) => setReason(e.target.value as RefundReason)}>
            {(Object.keys(REFUND_REASON_LABEL) as RefundReason[]).map((r) => (
              <option key={r} value={r}>
                {REFUND_REASON_LABEL[r]}
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
        <div className="space-y-1 col-span-2">
          <p className="text-sm font-medium">메모</p>
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="내부 메모 (선택)" />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/refunds' })}>
          취소
        </Button>
        <Button type="button" disabled={!submittable || mutation.isPending} onClick={() => void mutation.mutate()}>
          {mutation.isPending ? '저장 중...' : '등록'}
        </Button>
      </div>
    </div>
  );
}
