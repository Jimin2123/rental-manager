import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TaxInvoiceStatus, TaxInvoiceType } from './-types';
import { TAX_INVOICE_STATUS_LABEL, TAX_INVOICE_TYPE_LABEL } from './-types';
import type { TaxInvoiceFilters } from './-api';
import { taxInvoiceKeys, fetchTaxInvoices } from './-api';
import { FilterRow } from '@/components/ui/filter-row';
import { Pagination } from '@/components/ui/pagination';
import { PAGE_SIZE } from '@/lib/pagination';
import { won } from '@/lib/format';

export const Route = createFileRoute('/_protected/tax-invoices/')({
  component: TaxInvoicesPage,
});

type TypeFilter = 'ALL' | TaxInvoiceType;
type StatusFilter = 'ALL' | TaxInvoiceStatus;

function TaxInvoicesPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<TypeFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);

  const filters: TaxInvoiceFilters = {
    ...(type !== 'ALL' && { type }),
    ...(status !== 'ALL' && { status }),
  };

  const { data, isLoading } = useQuery({
    queryKey: taxInvoiceKeys.list(filters, page),
    queryFn: () => fetchTaxInvoices(filters, page),
    placeholderData: keepPreviousData,
  });
  const taxInvoices = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">세금계산서</h1>
      </div>

      <div className="mb-4 space-y-2">
        <FilterRow<TypeFilter>
          label="구분"
          options={['ALL', 'TAX_INVOICE', 'CREDIT_NOTE']}
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          labelOf={(v) => (v === 'ALL' ? '전체' : TAX_INVOICE_TYPE_LABEL[v])}
        />
        <FilterRow<StatusFilter>
          label="상태"
          options={['ALL', 'DRAFT', 'ISSUED', 'CANCELED', 'NTS_CONFIRMED']}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          labelOf={(v) => (v === 'ALL' ? '전체' : TAX_INVOICE_STATUS_LABEL[v])}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>계산서번호</TableHead>
              <TableHead>구분</TableHead>
              <TableHead>매입자</TableHead>
              <TableHead>발행일</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">공급가액</TableHead>
              <TableHead className="text-right">세액</TableHead>
              <TableHead className="text-right">합계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : taxInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  세금계산서가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              taxInvoices.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/tax-invoices/$id', params: { id: t.id } })}
                >
                  <TableCell className="font-medium">{t.taxInvoiceNo}</TableCell>
                  <TableCell>{TAX_INVOICE_TYPE_LABEL[t.type]}</TableCell>
                  <TableCell>{t.buyerName}</TableCell>
                  <TableCell>{new Date(t.issueDate).toLocaleDateString('ko-KR')}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === 'ISSUED' ? 'default' : 'secondary'}>
                      {TAX_INVOICE_STATUS_LABEL[t.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{won(t.supplyAmount)}</TableCell>
                  <TableCell className="text-right">{won(t.vatAmount)}</TableCell>
                  <TableCell className="text-right">{won(t.totalAmount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && <Pagination page={page} limit={PAGE_SIZE} total={total} onPage={setPage} />}
    </div>
  );
}
