import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { DetailRow } from '@/components/ui/detail-row';
import type { PaymentDetail } from '../-types';
import { PAYMENT_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_PROVIDER_LABEL, customerNameOf } from '../-types';
import { invalidatePayment } from '../-api';

import { won } from '@/lib/format';

export function PaymentDetailView({ payment }: { payment: PaymentDetail }) {
  const queryClient = useQueryClient();
  const canCancel = payment.status !== 'CANCELED';

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/payments/${payment.id}/cancel`, {}),
    onSuccess: () => {
      invalidatePayment(queryClient, payment.id);
      toast.success('수납을 취소했습니다.');
    },
    onError: (err) => toastApiError(err, '취소 중 오류가 발생했습니다.', { 400: '취소할 수 없는 상태입니다.' }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{payment.paymentNo}</h2>
            <Badge variant={payment.status === 'COMPLETED' ? 'default' : 'secondary'}>
              {PAYMENT_STATUS_LABEL[payment.status]}
            </Badge>
          </div>
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              취소
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <DetailRow label="고객" value={customerNameOf(payment.customer)} />
          <DetailRow label="금액" value={won(payment.amount)} />
          <DetailRow label="방법" value={PAYMENT_METHOD_LABEL[payment.method]} />
          <DetailRow label="수납일" value={new Date(payment.paidAt).toLocaleDateString('ko-KR')} />
          <DetailRow label="채널" value={PAYMENT_PROVIDER_LABEL[payment.provider]} />
          <DetailRow label="외부참조" value={payment.externalRef ?? '-'} />
          <DetailRow label="메모" value={payment.memo ?? '-'} />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <p className="border-b px-4 py-2 text-sm font-medium text-muted-foreground">배분 내역</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>청구번호</TableHead>
              <TableHead className="text-right">배분액</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payment.allocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                  배분된 청구서가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              payment.allocations.map((al) => (
                <TableRow key={al.id}>
                  <TableCell className="font-medium">{al.invoice.invoiceNo}</TableCell>
                  <TableCell className="text-right">{won(al.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
