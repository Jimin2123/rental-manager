import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InvoiceStatus, InvoiceType, InvoiceSettlementStatus } from './-types';
import { INVOICE_STATUS_LABEL, INVOICE_TYPE_LABEL, INVOICE_SETTLEMENT_LABEL, customerNameOf } from './-types';
import type { InvoiceFilters } from './-api';
import { invoiceKeys, fetchInvoices } from './-api';
import { FilterRow } from '@/components/ui/filter-row';
import { Pagination } from '@/components/ui/pagination';
import { PAGE_SIZE } from '@/lib/pagination';
import { won } from '@/lib/format';

export const Route = createFileRoute('/_protected/invoices/')({
  component: InvoicesPage,
});

type TypeFilter = 'ALL' | InvoiceType;
type StatusFilter = 'ALL' | InvoiceStatus;
type SettlementFilter = 'ALL' | InvoiceSettlementStatus;

function InvoicesPage() {
  const navigate = useNavigate();
  const [type, setType] = useState<TypeFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [settlement, setSettlement] = useState<SettlementFilter>('ALL');
  const [page, setPage] = useState(1);

  const filters: InvoiceFilters = {
    ...(type !== 'ALL' && { type }),
    ...(status !== 'ALL' && { status }),
    ...(settlement !== 'ALL' && { settlementStatus: settlement }),
  };

  const { data, isLoading } = useQuery({
    queryKey: invoiceKeys.list(filters, page),
    queryFn: () => fetchInvoices(filters, page),
    placeholderData: keepPreviousData,
  });
  const invoices = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">청구서</h1>
      </div>

      <div className="mb-4 space-y-2">
        <FilterRow<TypeFilter>
          label="타입"
          options={['ALL', 'SALE', 'RENTAL_MONTHLY', 'SERVICE_FEE', 'MANUAL']}
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          labelOf={(v) => (v === 'ALL' ? '전체' : INVOICE_TYPE_LABEL[v])}
        />
        <FilterRow<StatusFilter>
          label="상태"
          options={['ALL', 'DRAFT', 'ISSUED', 'CANCELED']}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          labelOf={(v) => (v === 'ALL' ? '전체' : INVOICE_STATUS_LABEL[v])}
        />
        <FilterRow<SettlementFilter>
          label="수납"
          options={['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERPAID']}
          value={settlement}
          onChange={(v) => {
            setSettlement(v);
            setPage(1);
          }}
          labelOf={(v) => (v === 'ALL' ? '전체' : INVOICE_SETTLEMENT_LABEL[v])}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>청구번호</TableHead>
              <TableHead>타입</TableHead>
              <TableHead>고객</TableHead>
              <TableHead>청구월</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>수납</TableHead>
              <TableHead className="text-right">최종금액</TableHead>
              <TableHead className="text-right">미수금</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  청구서가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/invoices/$id', params: { id: inv.id } })}
                >
                  <TableCell className="font-medium">{inv.invoiceNo}</TableCell>
                  <TableCell>{INVOICE_TYPE_LABEL[inv.type]}</TableCell>
                  <TableCell>{customerNameOf(inv.customer)}</TableCell>
                  <TableCell>{inv.billingMonth ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === 'ISSUED' ? 'default' : 'secondary'}>
                      {INVOICE_STATUS_LABEL[inv.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={inv.settlementStatus === 'PAID' ? 'default' : 'secondary'}>
                      {INVOICE_SETTLEMENT_LABEL[inv.settlementStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{won(inv.finalAmount)}</TableCell>
                  <TableCell className="text-right">{won(inv.outstandingAmount)}</TableCell>
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
