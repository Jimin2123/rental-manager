import { useState } from 'react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { DetailRow } from '@/components/ui/detail-row';
import type { TaxInvoiceDetail } from '../-types';
import { TAX_INVOICE_STATUS_LABEL, TAX_INVOICE_TYPE_LABEL } from '../-types';
import { invalidateTaxInvoice } from '../-api';

import { won } from '@/lib/format';

const today = () => new Date().toISOString().slice(0, 10);

export function TaxInvoiceDetailView({ taxInvoice }: { taxInvoice: TaxInvoiceDetail }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isIssued = taxInvoice.status === 'ISSUED';
  const [amendDate, setAmendDate] = useState(today());

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/tax-invoices/${taxInvoice.id}/cancel`, {}),
    onSuccess: () => {
      invalidateTaxInvoice(queryClient, taxInvoice.id);
      toast.success('세금계산서를 취소했습니다.');
    },
    onError: (err) => toastApiError(err, '취소 중 오류가 발생했습니다.', { 400: '취소할 수 없는 상태입니다.' }),
  });

  const amendMutation = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/tax-invoices/${taxInvoice.id}/amend`, { issueDate: amendDate }),
    onSuccess: (res) => {
      invalidateTaxInvoice(queryClient, taxInvoice.id);
      toast.success('수정세금계산서를 발행했습니다.');
      void navigate({ to: '/tax-invoices/$id', params: { id: res.data.id } });
    },
    onError: (err) => toastApiError(err, '수정발행 중 오류가 발생했습니다.', { 400: '수정발행할 수 없는 상태입니다.' }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{taxInvoice.taxInvoiceNo}</h2>
            <Badge variant="secondary">{TAX_INVOICE_TYPE_LABEL[taxInvoice.type]}</Badge>
            <Badge variant={taxInvoice.status === 'ISSUED' ? 'default' : 'secondary'}>
              {TAX_INVOICE_STATUS_LABEL[taxInvoice.status]}
            </Badge>
          </div>
          {isIssued && (
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
          <DetailRow label="매입자" value={taxInvoice.buyerName} />
          <DetailRow label="사업자번호" value={taxInvoice.buyerBusinessNo} />
          <DetailRow label="대표자" value={taxInvoice.buyerCeoName ?? '-'} />
          <DetailRow label="이메일" value={taxInvoice.buyerEmail ?? '-'} />
          <DetailRow label="발행일" value={new Date(taxInvoice.issueDate).toLocaleDateString('ko-KR')} />
          <DetailRow label="연결 청구서" value={taxInvoice.invoice?.invoiceNo ?? '-'} />
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-4 text-sm">
          <DetailRow label="공급가액" value={won(taxInvoice.supplyAmount)} />
          <DetailRow label="세액" value={won(taxInvoice.vatAmount)} />
          <DetailRow label="합계" value={won(taxInvoice.totalAmount)} />
        </div>
      </div>

      {/* 수정발행 (ISSUED만) */}
      {isIssued && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium">수정발행</p>
          <div className="flex items-end gap-2">
            <Input type="date" className="w-44" value={amendDate} onChange={(e) => setAmendDate(e.target.value)} />
            <Button size="sm" disabled={amendMutation.isPending} onClick={() => amendMutation.mutate()}>
              수정세금계산서 발행
            </Button>
          </div>
        </div>
      )}

      {/* 수정본 목록 (있을 때만) */}
      {taxInvoice.amendments.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">수정본</p>
          <div className="space-y-1 text-sm">
            {taxInvoice.amendments.map((a) => (
              <button
                key={a.id}
                type="button"
                className="block text-left text-primary hover:underline"
                onClick={() => void navigate({ to: '/tax-invoices/$id', params: { id: a.id } })}
              >
                {a.taxInvoiceNo} ({TAX_INVOICE_STATUS_LABEL[a.status]})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
