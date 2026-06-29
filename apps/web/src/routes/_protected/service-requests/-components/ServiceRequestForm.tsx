import { useState } from 'react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { fetchCustomers, customerKeys } from '../../customers/-api';
import type { CustomerListItem } from '../../customers/-types';
import { fetchAllAssets } from '@/lib/options-api';
import type { ServiceRequestType, AssetStatus } from '../-types';
import { REQUEST_TYPE_LABEL, ASSET_STATUS_LABEL } from '../-types';
import { serviceRequestKeys } from '../-api';

function customerLabel(c: CustomerListItem): string {
  return c.individualProfile?.name ?? c.businessPartner?.businessProfile.name ?? '(이름 없음)';
}

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none';

export function ServiceRequestForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [type, setType] = useState<ServiceRequestType>('REPAIR');
  const [customerId, setCustomerId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [isWarranty, setIsWarranty] = useState(false);
  const [requestedVisitDate, setRequestedVisitDate] = useState('');
  const [description, setDescription] = useState('');

  const { data: customers = [] } = useQuery<CustomerListItem[]>({
    queryKey: customerKeys.list({}),
    queryFn: () => fetchCustomers({}),
  });
  const { data: assets = [] } = useQuery({
    queryKey: ['assets', 'all'],
    queryFn: fetchAllAssets,
  });

  const submittable = customerId !== '' && assetId !== '';

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/service-requests', {
        type,
        customerId,
        assetId,
        isWarranty,
        ...(requestedVisitDate && { requestedVisitDate: new Date(requestedVisitDate).toISOString() }),
        ...(description && { description }),
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: serviceRequestKeys.lists() });
      toast.success('AS 접수가 등록되었습니다.');
      void navigate({ to: '/service-requests/$id', params: { id: res.data.id } });
    },
    onError: (err) =>
      toastApiError(err, 'AS 접수 등록 중 오류가 발생했습니다.', { 404: '고객 또는 자산을 찾을 수 없습니다.' }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">
            유형 <span className="text-destructive">*</span>
          </p>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as ServiceRequestType)}>
            {(Object.keys(REQUEST_TYPE_LABEL) as ServiceRequestType[]).map((t) => (
              <option key={t} value={t}>
                {REQUEST_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">보증 여부</p>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={isWarranty} onChange={(e) => setIsWarranty(e.target.checked)} />
            보증(무상) 처리
          </label>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            고객 <span className="text-destructive">*</span>
          </p>
          <select className={selectClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">고객을 선택하세요</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {customerLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            자산 <span className="text-destructive">*</span>
          </p>
          <select className={selectClass} value={assetId} onChange={(e) => setAssetId(e.target.value)}>
            <option value="">자산을 선택하세요</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.product.name} ({a.serialNumber}) · {ASSET_STATUS_LABEL[a.status as AssetStatus] ?? a.status}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">요청 방문일</p>
          <Input type="date" value={requestedVisitDate} onChange={(e) => setRequestedVisitDate(e.target.value)} />
        </div>
        <div className="space-y-1 col-span-2">
          <p className="text-sm font-medium">증상/설명</p>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="고장 증상 등 (선택)"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/service-requests' })}>
          취소
        </Button>
        <Button type="button" disabled={!submittable || mutation.isPending} onClick={() => void mutation.mutate()}>
          {mutation.isPending ? '저장 중...' : '등록'}
        </Button>
      </div>
    </div>
  );
}
