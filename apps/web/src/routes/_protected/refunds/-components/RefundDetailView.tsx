import { toast } from 'sonner';
import { type AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { DetailRow } from '@/components/ui/detail-row';
import type { RefundDetail } from '../-types';
import { REFUND_STATUS_LABEL, REFUND_REASON_LABEL, PAYMENT_METHOD_LABEL, customerNameOf } from '../-types';
import { invalidateRefund } from '../-api';

import { won } from '@/lib/format';

export function RefundDetailView({ refund }: { refund: RefundDetail }) {
  const queryClient = useQueryClient();
  const isPending = refund.status === 'PENDING';

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/refunds/${refund.id}/complete`, {}),
    onSuccess: () => {
      invalidateRefund(queryClient, refund.id);
      toast.success('환불을 완료 처리했습니다.');
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(s === 400 ? '완료할 수 없는 상태입니다.' : '완료 처리 중 오류가 발생했습니다.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/refunds/${refund.id}/cancel`, {}),
    onSuccess: () => {
      invalidateRefund(queryClient, refund.id);
      toast.success('환불을 취소했습니다.');
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(s === 400 ? '취소할 수 없는 상태입니다.' : '취소 중 오류가 발생했습니다.');
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{refund.refundNo}</h2>
            <Badge variant={refund.status === 'COMPLETED' ? 'default' : 'secondary'}>
              {REFUND_STATUS_LABEL[refund.status]}
            </Badge>
          </div>
          {isPending && (
            <div className="flex gap-2">
              <Button size="sm" disabled={completeMutation.isPending} onClick={() => completeMutation.mutate()}>
                완료
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                취소
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <DetailRow label="고객" value={customerNameOf(refund.customer)} />
          <DetailRow label="금액" value={won(refund.amount)} />
          <DetailRow label="사유" value={REFUND_REASON_LABEL[refund.reason]} />
          <DetailRow label="방법" value={refund.method ? PAYMENT_METHOD_LABEL[refund.method] : '-'} />
          <DetailRow label="연결 수납" value={refund.payment?.paymentNo ?? '-'} />
          <DetailRow label="연결 청구서" value={refund.invoice?.invoiceNo ?? '-'} />
          <DetailRow label="메모" value={refund.memo ?? '-'} />
        </div>
      </div>
    </div>
  );
}
