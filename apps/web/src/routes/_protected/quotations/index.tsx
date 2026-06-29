import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { QuotationListItem, QuotationType, QuotationStatus } from './-types';
import { QUOTATION_TYPE_LABEL, QUOTATION_STATUS_LABEL, customerNameOf, quotationTotal } from './-types';
import { quotationKeys, fetchQuotations } from './-api';
import { won } from '@/lib/format';

export const Route = createFileRoute('/_protected/quotations/')({
  component: QuotationsPage,
});

type TypeFilter = 'ALL' | QuotationType;
type StatusFilter = 'ALL' | QuotationStatus;

function QuotationsPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<TypeFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');

  const filters = {
    type: type === 'ALL' ? undefined : type,
    status: status === 'ALL' ? undefined : status,
  };
  const { data = [], isLoading } = useQuery<QuotationListItem[]>({
    queryKey: quotationKeys.list(filters),
    queryFn: () => fetchQuotations(filters),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">견적</h1>
        <Button onClick={() => void navigate({ to: '/quotations/new' })}>견적 등록</Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex gap-1">
          {(['ALL', 'SALE', 'RENTAL'] as const).map((t) => (
            <Button key={t} variant={type === t ? 'default' : 'outline'} size="sm" onClick={() => setType(t)}>
              {t === 'ALL' ? '전체' : QUOTATION_TYPE_LABEL[t]}
            </Button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const).map((s) => (
            <Button key={s} variant={status === s ? 'default' : 'outline'} size="sm" onClick={() => setStatus(s)}>
              {s === 'ALL' ? '전체' : QUOTATION_STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>견적번호</TableHead>
              <TableHead>종류</TableHead>
              <TableHead>고객</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>유효기간</TableHead>
              <TableHead className="text-right">합계</TableHead>
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
                  등록된 견적이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              data.map((q) => (
                <TableRow
                  key={q.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/quotations/$id', params: { id: q.id } })}
                >
                  <TableCell className="font-medium">{q.quotationNo}</TableCell>
                  <TableCell>
                    <Badge variant={q.type === 'SALE' ? 'default' : 'secondary'}>{QUOTATION_TYPE_LABEL[q.type]}</Badge>
                  </TableCell>
                  <TableCell>{customerNameOf(q.customer)}</TableCell>
                  <TableCell>{QUOTATION_STATUS_LABEL[q.status]}</TableCell>
                  <TableCell>{q.validUntil ? new Date(q.validUntil).toLocaleDateString('ko-KR') : '-'}</TableCell>
                  <TableCell className="text-right">{won(quotationTotal(q))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
