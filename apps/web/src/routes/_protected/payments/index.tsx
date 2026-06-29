import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PaymentListItem, PaymentMethod, PaymentStatus } from './-types';
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, customerNameOf } from './-types';
import type { PaymentFilters } from './-api';
import { paymentKeys, fetchPayments } from './-api';
import { FilterRow } from '@/components/ui/filter-row';
import { won } from '@/lib/format';

export const Route = createFileRoute('/_protected/payments/')({
  component: PaymentsPage,
});

type MethodFilter = 'ALL' | PaymentMethod;
type StatusFilter = 'ALL' | PaymentStatus;

function PaymentsPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<MethodFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');

  const filters: PaymentFilters = {
    ...(method !== 'ALL' && { method }),
    ...(status !== 'ALL' && { status }),
  };

  const { data = [], isLoading } = useQuery<PaymentListItem[]>({
    queryKey: paymentKeys.list(filters),
    queryFn: () => fetchPayments(filters),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">수납</h1>
        <Button size="sm" onClick={() => void navigate({ to: '/payments/new' })}>
          수납 등록
        </Button>
      </div>

      <div className="mb-4 space-y-2">
        <FilterRow<MethodFilter>
          label="방법"
          options={['ALL', 'CASH', 'BANK_TRANSFER', 'CARD', 'VIRTUAL_ACCOUNT', 'CMS', 'ETC']}
          value={method}
          onChange={setMethod}
          labelOf={(v) => (v === 'ALL' ? '전체' : PAYMENT_METHOD_LABEL[v])}
        />
        <FilterRow<StatusFilter>
          label="상태"
          options={['ALL', 'PENDING', 'COMPLETED', 'CANCELED', 'FAILED']}
          value={status}
          onChange={setStatus}
          labelOf={(v) => (v === 'ALL' ? '전체' : PAYMENT_STATUS_LABEL[v])}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>수납번호</TableHead>
              <TableHead>고객</TableHead>
              <TableHead>방법</TableHead>
              <TableHead>수납일</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">금액</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  수납 내역이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              data.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/payments/$id', params: { id: p.id } })}
                >
                  <TableCell className="font-medium">{p.paymentNo}</TableCell>
                  <TableCell>{customerNameOf(p.customer)}</TableCell>
                  <TableCell>{PAYMENT_METHOD_LABEL[p.method]}</TableCell>
                  <TableCell>{new Date(p.paidAt).toLocaleDateString('ko-KR')}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'COMPLETED' ? 'default' : 'secondary'}>
                      {PAYMENT_STATUS_LABEL[p.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{won(p.amount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
