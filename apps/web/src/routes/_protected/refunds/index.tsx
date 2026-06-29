import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RefundListItem, RefundReason, RefundStatus } from './-types';
import { REFUND_REASON_LABEL, REFUND_STATUS_LABEL, customerNameOf } from './-types';
import type { RefundFilters } from './-api';
import { refundKeys, fetchRefunds } from './-api';
import { FilterRow } from '@/components/ui/filter-row';
import { won } from '@/lib/format';

export const Route = createFileRoute('/_protected/refunds/')({
  component: RefundsPage,
});

type StatusFilter = 'ALL' | RefundStatus;
type ReasonFilter = 'ALL' | RefundReason;

function RefundsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [reason, setReason] = useState<ReasonFilter>('ALL');

  const filters: RefundFilters = {
    ...(status !== 'ALL' && { status }),
    ...(reason !== 'ALL' && { reason }),
  };

  const { data = [], isLoading } = useQuery<RefundListItem[]>({
    queryKey: refundKeys.list(filters),
    queryFn: () => fetchRefunds(filters),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">환불</h1>
        <Button size="sm" onClick={() => void navigate({ to: '/refunds/new' })}>
          환불 등록
        </Button>
      </div>

      <div className="mb-4 space-y-2">
        <FilterRow<StatusFilter>
          label="상태"
          options={['ALL', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELED']}
          value={status}
          onChange={setStatus}
          labelOf={(v) => (v === 'ALL' ? '전체' : REFUND_STATUS_LABEL[v])}
        />
        <FilterRow<ReasonFilter>
          label="사유"
          options={[
            'ALL',
            'SALE_CANCEL',
            'SALE_RETURN',
            'RENTAL_CANCEL',
            'RENTAL_PRORATION',
            'OVERPAYMENT',
            'BILLING_ERROR',
            'ETC',
          ]}
          value={reason}
          onChange={setReason}
          labelOf={(v) => (v === 'ALL' ? '전체' : REFUND_REASON_LABEL[v])}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>환불번호</TableHead>
              <TableHead>고객</TableHead>
              <TableHead>사유</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">금액</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  환불 내역이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/refunds/$id', params: { id: r.id } })}
                >
                  <TableCell className="font-medium">{r.refundNo}</TableCell>
                  <TableCell>{customerNameOf(r.customer)}</TableCell>
                  <TableCell>{REFUND_REASON_LABEL[r.reason]}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'COMPLETED' ? 'default' : 'secondary'}>
                      {REFUND_STATUS_LABEL[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{won(r.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
