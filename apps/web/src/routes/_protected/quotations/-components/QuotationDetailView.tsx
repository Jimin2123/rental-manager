import { useState } from 'react';
import { toast } from 'sonner';
import { type AxiosError } from 'axios';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { DetailRow } from '@/components/ui/detail-row';
import { useAuthStore } from '@/store/auth.store';
import type { QuotationDetail, QuotationStatus } from '../-types';
import {
  QUOTATION_TYPE_LABEL,
  QUOTATION_STATUS_LABEL,
  QUOTATION_TRANSITIONS,
  LOCKED_STATUSES,
  CONVERTIBLE_STATUSES,
  customerNameOf,
  quotationTotal,
} from '../-types';
import { quotationKeys, invalidateQuotation } from '../-api';
import { ProductSelect, AssetSelect } from '@/components/option-select';
import { emptyItemRow, itemRowToBody, type ItemRow } from './payload';

// ISO 날짜 → date input 값(YYYY-MM-DD).
function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

export function QuotationDetailView({ quotation }: { quotation: QuotationDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.currentOrganization?.role);
  const isLocked = LOCKED_STATUSES.includes(quotation.status);
  const canDelete = quotation.status === 'DRAFT' && (role === 'OWNER' || role === 'ADMIN');
  const canConvert = CONVERTIBLE_STATUSES.includes(quotation.status) && !quotation.convertedOrderId;
  const nextStatuses = QUOTATION_TRANSITIONS[quotation.status];

  const initialValidUntil = toDateInput(quotation.validUntil);
  const [memo, setMemo] = useState(quotation.memo ?? '');
  const [validUntil, setValidUntil] = useState(initialValidUntil);
  const headerDirty = memo !== (quotation.memo ?? '') || validUntil !== initialValidUntil;

  const statusMutation = useMutation({
    mutationFn: (status: QuotationStatus) => api.patch(`/quotations/${quotation.id}/status`, { status }),
    onSuccess: () => {
      invalidateQuotation(queryClient, quotation.id);
      toast.success('상태가 변경되었습니다.');
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(s === 400 ? '허용되지 않는 상태 전환입니다.' : '상태 변경 중 오류가 발생했습니다.');
    },
  });

  const headerMutation = useMutation({
    mutationFn: () => {
      const body: { memo: string; validUntil?: string } = { memo };
      if (validUntil) body.validUntil = new Date(validUntil).toISOString();
      return api.patch(`/quotations/${quotation.id}`, body);
    },
    onSuccess: () => {
      invalidateQuotation(queryClient, quotation.id);
      toast.success('저장되었습니다.');
    },
    onError: () => toast.error('저장 중 오류가 발생했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/quotations/${quotation.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: quotationKeys.lists() });
      toast.success('견적이 삭제되었습니다.');
      void navigate({ to: '/quotations' });
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(s === 400 ? '작성중 상태의 견적만 삭제할 수 있습니다.' : '삭제 중 오류가 발생했습니다.');
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => api.post<{ orderId: string }>(`/quotations/${quotation.id}/convert`, {}),
    onSuccess: (res) => {
      invalidateQuotation(queryClient, quotation.id);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('주문으로 전환되었습니다.');
      void navigate({ to: '/orders/$id', params: { id: res.data.orderId } });
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      if (s === 409) toast.error('이미 주문으로 전환된 견적입니다.');
      else if (s === 400) toast.error('수락 가능한 상태의 견적만 전환할 수 있습니다.');
      else toast.error('주문 전환 중 오류가 발생했습니다.');
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{quotation.quotationNo}</h2>
            <Badge variant={quotation.type === 'SALE' ? 'default' : 'secondary'}>
              {QUOTATION_TYPE_LABEL[quotation.type]}
            </Badge>
            <Badge variant="outline">{QUOTATION_STATUS_LABEL[quotation.status]}</Badge>
          </div>
          <div className="flex gap-2">
            {quotation.convertedOrderId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void navigate({ to: '/orders/$id', params: { id: quotation.convertedOrderId as string } })
                }
              >
                주문 보기
              </Button>
            )}
            {canConvert && (
              <Button size="sm" disabled={convertMutation.isPending} onClick={() => convertMutation.mutate()}>
                주문으로 전환
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                삭제
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <DetailRow label="고객" value={customerNameOf(quotation.customer)} />
          <DetailRow label="합계" value={`${quotationTotal(quotation).toLocaleString('ko-KR')}원`} />
        </div>

        {nextStatuses.length > 0 && (
          <div className="flex items-center gap-2 border-t pt-3">
            <span className="text-sm text-muted-foreground">상태 변경:</span>
            {nextStatuses.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(s)}
              >
                {QUOTATION_STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        )}

        {/* 헤더 인라인 수정: 유효기간 + 메모 */}
        <div className="border-t pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">유효기간</p>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                disabled={isLocked}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">메모</p>
              <Input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="내부 메모"
                disabled={isLocked}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={isLocked || !headerDirty || headerMutation.isPending}
              onClick={() => headerMutation.mutate()}
            >
              저장
            </Button>
          </div>
        </div>
      </div>

      {/* 품목 테이블 */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {quotation.type === 'SALE' ? (
              <TableRow>
                <TableHead>제품</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead className="text-right">단가</TableHead>
                <TableHead className="text-right">금액</TableHead>
                {!isLocked && <TableHead className="w-16" />}
              </TableRow>
            ) : (
              <TableRow>
                <TableHead>제품</TableHead>
                <TableHead className="text-right">월 렌탈료</TableHead>
                <TableHead className="text-right">계약개월</TableHead>
                <TableHead className="text-right">보증금</TableHead>
                {!isLocked && <TableHead className="w-16" />}
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {quotation.items.map((it) =>
              quotation.type === 'SALE' ? (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.product.name}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{it.unitPrice.toLocaleString('ko-KR')}</TableCell>
                  <TableCell className="text-right">{it.totalAmount.toLocaleString('ko-KR')}</TableCell>
                  {!isLocked && (
                    <TableCell className="text-right">
                      <ItemDeleteButton quotationId={quotation.id} itemId={it.id} role={role} />
                    </TableCell>
                  )}
                </TableRow>
              ) : (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.product.name}</TableCell>
                  <TableCell className="text-right">{(it.monthlyRentalPrice ?? 0).toLocaleString('ko-KR')}</TableCell>
                  <TableCell className="text-right">{it.contractMonths ?? '-'}</TableCell>
                  <TableCell className="text-right">{(it.depositAmount ?? 0).toLocaleString('ko-KR')}</TableCell>
                  {!isLocked && (
                    <TableCell className="text-right">
                      <ItemDeleteButton quotationId={quotation.id} itemId={it.id} role={role} />
                    </TableCell>
                  )}
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>

        {!isLocked && <AddItemForm quotation={quotation} />}
      </div>
    </div>
  );
}

function ItemDeleteButton({
  quotationId,
  itemId,
  role,
}: {
  quotationId: string;
  itemId: string;
  role: string | undefined;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.delete(`/quotations/${quotationId}/items/${itemId}`),
    onSuccess: () => {
      invalidateQuotation(queryClient, quotationId);
      toast.success('품목이 삭제되었습니다.');
    },
    onError: () => toast.error('품목 삭제 중 오류가 발생했습니다.'),
  });
  // 백엔드 DELETE 품목은 OWNER/ADMIN만.
  if (role !== 'OWNER' && role !== 'ADMIN') return null;
  return (
    <Button type="button" variant="ghost" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      삭제
    </Button>
  );
}

function AddItemForm({ quotation }: { quotation: QuotationDetail }) {
  const queryClient = useQueryClient();
  const [row, setRow] = useState<ItemRow>(emptyItemRow());
  const patch = (p: Partial<ItemRow>) => setRow((r) => ({ ...r, ...p }));

  const mutation = useMutation({
    mutationFn: () => api.post(`/quotations/${quotation.id}/items`, itemRowToBody(quotation.type, row)),
    onSuccess: () => {
      invalidateQuotation(queryClient, quotation.id);
      toast.success('품목이 추가되었습니다.');
      setRow(emptyItemRow());
    },
    onError: () => toast.error('품목 추가 중 오류가 발생했습니다.'),
  });

  return (
    <div className="border-t p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">품목 추가</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full max-w-48">
          <ProductSelect value={row.productId} onChange={(v) => patch({ productId: v, assetId: '' })} />
        </div>
        <div className="w-full max-w-40">
          <AssetSelect
            productId={row.productId}
            value={row.assetId}
            onChange={(assetId) => patch({ assetId })}
            placeholder="자산 선택 안 함"
          />
        </div>
        {quotation.type === 'SALE' ? (
          <>
            <Input
              className="w-24"
              type="number"
              min={1}
              value={row.quantity}
              onChange={(e) => patch({ quantity: Number(e.target.value) })}
              placeholder="수량"
            />
            <Input
              className="w-28"
              type="number"
              min={0}
              value={row.unitPrice}
              onChange={(e) => patch({ unitPrice: Number(e.target.value) })}
              placeholder="단가"
            />
          </>
        ) : (
          <>
            <Input
              className="w-28"
              type="number"
              min={0}
              value={row.monthlyRentalPrice}
              onChange={(e) => patch({ monthlyRentalPrice: Number(e.target.value) })}
              placeholder="월 렌탈료"
            />
            <Input
              className="w-24"
              type="number"
              min={1}
              value={row.contractMonths}
              onChange={(e) => patch({ contractMonths: Number(e.target.value) })}
              placeholder="개월"
            />
          </>
        )}
        <Button size="sm" disabled={row.productId === '' || mutation.isPending} onClick={() => mutation.mutate()}>
          추가
        </Button>
      </div>
    </div>
  );
}
