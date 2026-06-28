import { toast } from 'sonner';
import { type AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { DetailRow } from '@/components/ui/detail-row';
import type { InvoiceDetail } from '../-types';
import {
  INVOICE_STATUS_LABEL,
  INVOICE_TYPE_LABEL,
  INVOICE_SETTLEMENT_LABEL,
  INVOICE_ITEM_TYPE_LABEL,
  INVOICE_ADJUSTMENT_TYPE_LABEL,
  PAYMENT_METHOD_LABEL,
  customerNameOf,
} from '../-types';
import { invalidateInvoice } from '../-api';

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('ko-KR') : '-');

export function InvoiceDetailView({ invoice }: { invoice: InvoiceDetail }) {
  const queryClient = useQueryClient();
  const canIssue = invoice.status === 'DRAFT';
  // 취소는 ISSUED + 수납액 0일 때만 (백엔드 제약 미러).
  const canCancel = invoice.status === 'ISSUED' && invoice.paidAmount === 0;

  const issueMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${invoice.id}/issue`, {}),
    onSuccess: () => {
      invalidateInvoice(queryClient, invoice.id);
      toast.success('청구서를 발행했습니다.');
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(s === 400 ? '발행할 수 없는 상태입니다.' : '발행 중 오류가 발생했습니다.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/invoices/${invoice.id}/cancel`, {}),
    onSuccess: () => {
      invalidateInvoice(queryClient, invoice.id);
      toast.success('청구서를 취소했습니다.');
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(s === 400 ? '취소할 수 없는 상태이거나 수납 내역이 있습니다.' : '취소 중 오류가 발생했습니다.');
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{invoice.invoiceNo}</h2>
            <Badge variant={invoice.status === 'ISSUED' ? 'default' : 'secondary'}>
              {INVOICE_STATUS_LABEL[invoice.status]}
            </Badge>
            <Badge variant={invoice.settlementStatus === 'PAID' ? 'default' : 'secondary'}>
              {INVOICE_SETTLEMENT_LABEL[invoice.settlementStatus]}
            </Badge>
          </div>
          <div className="flex gap-2">
            {canIssue && (
              <Button size="sm" disabled={issueMutation.isPending} onClick={() => issueMutation.mutate()}>
                발행
              </Button>
            )}
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
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <DetailRow label="타입" value={INVOICE_TYPE_LABEL[invoice.type]} />
          <DetailRow label="고객" value={customerNameOf(invoice.customer)} />
          <DetailRow label="청구월" value={invoice.billingMonth ?? '-'} />
          <DetailRow label="납기일" value={date(invoice.dueDate)} />
          <DetailRow label="기간" value={`${date(invoice.periodStart)} ~ ${date(invoice.periodEnd)}`} />
          <DetailRow label="발행일" value={date(invoice.issuedAt)} />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-4 text-sm">
          <DetailRow label="최종금액" value={won(invoice.finalAmount)} />
          <DetailRow label="수납액" value={won(invoice.paidAmount)} />
          <DetailRow label="환불액" value={won(invoice.refundedAmount)} />
          <DetailRow label="미수금" value={won(invoice.outstandingAmount)} />
        </div>
      </div>

      {/* 청구 항목 (읽기전용) */}
      <Section title="청구 항목">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>구분</TableHead>
              <TableHead>내용</TableHead>
              <TableHead className="text-right">수량</TableHead>
              <TableHead className="text-right">단가</TableHead>
              <TableHead className="text-right">금액</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.length === 0 ? (
              <EmptyRow colSpan={5} text="항목이 없습니다." />
            ) : (
              invoice.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{INVOICE_ITEM_TYPE_LABEL[it.type]}</TableCell>
                  <TableCell>{it.description ?? '-'}</TableCell>
                  <TableCell className="text-right">{it.quantity.toLocaleString('ko-KR')}</TableCell>
                  <TableCell className="text-right">{won(it.unitPrice)}</TableCell>
                  <TableCell className="text-right">{won(it.totalAmount)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Section>

      {/* 조정 내역 (읽기전용) — 항목이 있을 때만 표시 */}
      {invoice.adjustments.length > 0 && (
        <Section title="조정 내역">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>구분</TableHead>
                <TableHead>사유</TableHead>
                <TableHead className="text-right">금액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.adjustments.map((adj) => (
                <TableRow key={adj.id}>
                  <TableCell>{INVOICE_ADJUSTMENT_TYPE_LABEL[adj.type]}</TableCell>
                  <TableCell>{adj.reason ?? '-'}</TableCell>
                  <TableCell className="text-right">{won(adj.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}

      {/* 수납 내역 (읽기전용) — 항목이 있을 때만 표시 */}
      {invoice.allocations.length > 0 && (
        <Section title="수납 내역">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>수납번호</TableHead>
                <TableHead>수납일</TableHead>
                <TableHead>방법</TableHead>
                <TableHead className="text-right">배분액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.allocations.map((al) => (
                <TableRow key={al.id}>
                  <TableCell className="font-medium">{al.payment.paymentNo}</TableCell>
                  <TableCell>{date(al.payment.paidAt)}</TableCell>
                  <TableCell>{PAYMENT_METHOD_LABEL[al.payment.method]}</TableCell>
                  <TableCell className="text-right">{won(al.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card">
      <p className="border-b px-4 py-2 text-sm font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-6 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}
