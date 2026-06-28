import { useState } from 'react';
import { toast } from 'sonner';
import { type AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { DetailRow } from '@/components/ui/detail-row';
import { fetchProductOptions, fetchAssetOptions } from '../../orders/-api';
import type { ProductOption, AssetOption } from '../../orders/-api';
import type { ContractDetail, ContractStatus } from '../-types';
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_ITEM_STATUS_LABEL,
  CONTRACT_TRANSITIONS,
  customerNameOf,
  contractMonthlyTotal,
} from '../-types';
import { invalidateContract } from '../-api';

const STATUS_ACTION_LABEL: Record<ContractStatus, string> = {
  DRAFT: '작성중',
  ACTIVE: '활성화',
  ENDED: '종료',
  CANCELED: '취소',
};

export function ContractDetailView({ contract }: { contract: ContractDetail }) {
  const queryClient = useQueryClient();
  const isDraft = contract.status === 'DRAFT';
  const nextStatuses = CONTRACT_TRANSITIONS[contract.status];

  const statusMutation = useMutation({
    mutationFn: (status: ContractStatus) => api.patch(`/rental-contracts/${contract.id}/status`, { status }),
    onSuccess: () => {
      invalidateContract(queryClient, contract.id);
      toast.success('상태가 변경되었습니다.');
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(
        s === 400 ? '허용되지 않는 상태 전환이거나 활성화할 장비가 없습니다.' : '상태 변경 중 오류가 발생했습니다.',
      );
    },
  });

  const returnMutation = useMutation({
    mutationFn: (itemId: string) => api.post(`/rental-contracts/${contract.id}/items/${itemId}/return`, {}),
    onSuccess: () => {
      invalidateContract(queryClient, contract.id);
      toast.success('항목을 회수했습니다.');
    },
    onError: () => toast.error('회수 중 오류가 발생했습니다.'),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{contract.contractNo}</h2>
            <Badge variant={contract.status === 'ACTIVE' ? 'default' : 'secondary'}>
              {CONTRACT_STATUS_LABEL[contract.status]}
            </Badge>
          </div>
          {nextStatuses.length > 0 && (
            <div className="flex gap-2">
              {nextStatuses.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate(s)}
                >
                  {STATUS_ACTION_LABEL[s]}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <DetailRow label="고객" value={customerNameOf(contract.rentalOrder.order.customer)} />
          <DetailRow label="월 렌탈료" value={`${contractMonthlyTotal(contract.items).toLocaleString('ko-KR')}원`} />
          <DetailRow
            label="기간"
            value={`${new Date(contract.startDate).toLocaleDateString('ko-KR')} ~ ${new Date(
              contract.endDate,
            ).toLocaleDateString('ko-KR')} (${contract.contractMonths}개월)`}
          />
          <DetailRow
            label="청구"
            value={`${contract.billingTiming === 'PREPAID' ? '선불' : '후불'}${
              contract.billingDay ? ` · 매월 ${contract.billingDay}일` : ''
            }`}
          />
        </div>
      </div>

      {/* 항목 테이블 */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>제품</TableHead>
              <TableHead>시리얼</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">월 렌탈료</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contract.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  항목이 없습니다. {isDraft && '아래에서 추가하세요.'}
                </TableCell>
              </TableRow>
            ) : (
              contract.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.asset?.product.name ?? '-'}</TableCell>
                  <TableCell>{it.asset?.serialNumber ?? '-'}</TableCell>
                  <TableCell>{CONTRACT_ITEM_STATUS_LABEL[it.status]}</TableCell>
                  <TableCell className="text-right">{it.monthlyRentalPrice.toLocaleString('ko-KR')}</TableCell>
                  <TableCell className="text-right">
                    {it.status === 'ACTIVE' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={returnMutation.isPending}
                        onClick={() => returnMutation.mutate(it.id)}
                      >
                        회수
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {isDraft && <AddContractItemForm contractId={contract.id} />}
      </div>
    </div>
  );
}

function AddContractItemForm({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const [productId, setProductId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [price, setPrice] = useState('0');

  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ['products', 'options'],
    queryFn: fetchProductOptions,
  });
  const { data: assets = [] } = useQuery<AssetOption[]>({
    queryKey: ['assets', 'available', productId],
    queryFn: () => fetchAssetOptions(productId),
    enabled: productId !== '',
  });

  const mutation = useMutation({
    mutationFn: () => api.post(`/rental-contracts/${contractId}/items`, { assetId, monthlyRentalPrice: Number(price) }),
    onSuccess: () => {
      invalidateContract(queryClient, contractId);
      toast.success('항목이 추가되었습니다.');
      setProductId('');
      setAssetId('');
      setPrice('0');
    },
    onError: () => toast.error('항목 추가 중 오류가 발생했습니다.'),
  });

  const cellClass =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none';

  return (
    <div className="border-t p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">항목 추가</p>
      <div className="flex flex-wrap items-end gap-2">
        <select
          className={cellClass + ' max-w-48'}
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setAssetId('');
          }}
        >
          <option value="">제품 선택</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className={cellClass + ' max-w-44'}
          value={assetId}
          disabled={productId === ''}
          onChange={(e) => setAssetId(e.target.value)}
        >
          <option value="">자산 선택</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.serialNumber}
            </option>
          ))}
        </select>
        <Input
          className="w-32"
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="월 렌탈료"
        />
        <Button size="sm" disabled={assetId === '' || mutation.isPending} onClick={() => mutation.mutate()}>
          추가
        </Button>
      </div>
    </div>
  );
}
