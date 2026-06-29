import { useState } from 'react';
import { toast } from 'sonner';
import { type AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { ServiceVisitResult, AssetStatus } from '../-types';
import { VISIT_RESULT_LABEL, ASSET_STATUS_LABEL } from '../-types';
import { invalidateServiceRequest } from '../-api';

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none';

export function VisitCompleteForm({
  visitId,
  requestId,
  onDone,
}: {
  visitId: string;
  requestId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ServiceVisitResult>('REPAIRED');
  const [workDescription, setWorkDescription] = useState('');
  const [laborCost, setLaborCost] = useState('0');
  const [partsCost, setPartsCost] = useState('0');
  const [travelCost, setTravelCost] = useState('0');
  const [assetStatusAfter, setAssetStatusAfter] = useState<AssetStatus | ''>('');
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/service-visits/${visitId}/complete`, {
        result,
        ...(workDescription && { workDescription }),
        laborCost: Number(laborCost),
        partsCost: Number(partsCost),
        travelCost: Number(travelCost),
        ...(assetStatusAfter && { assetStatusAfter }),
        requiresFollowUp,
      }),
    onSuccess: () => {
      invalidateServiceRequest(queryClient, requestId);
      toast.success('방문을 완료 처리했습니다. (유상·비용 발생 시 AS 청구서가 생성됩니다)');
      onDone();
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(s === 400 ? '완료할 수 없는 방문입니다.' : '완료 처리 중 오류가 발생했습니다.');
    },
  });

  return (
    <div className="space-y-2 border-t p-3">
      <p className="text-xs font-medium text-muted-foreground">방문 완료 처리</p>
      <div className="grid grid-cols-2 gap-2">
        <select
          className={selectClass}
          value={result}
          onChange={(e) => setResult(e.target.value as ServiceVisitResult)}
        >
          {(Object.keys(VISIT_RESULT_LABEL) as ServiceVisitResult[]).map((r) => (
            <option key={r} value={r}>
              {VISIT_RESULT_LABEL[r]}
            </option>
          ))}
        </select>
        <select
          className={selectClass}
          value={assetStatusAfter}
          onChange={(e) => setAssetStatusAfter(e.target.value as AssetStatus | '')}
        >
          <option value="">자산 상태 변경 없음</option>
          {(Object.keys(ASSET_STATUS_LABEL) as AssetStatus[]).map((s) => (
            <option key={s} value={s}>
              자산→{ASSET_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={0}
          value={laborCost}
          onChange={(e) => setLaborCost(e.target.value)}
          placeholder="공임비"
        />
        <Input
          type="number"
          min={0}
          value={partsCost}
          onChange={(e) => setPartsCost(e.target.value)}
          placeholder="부품비"
        />
        <Input
          type="number"
          min={0}
          value={travelCost}
          onChange={(e) => setTravelCost(e.target.value)}
          placeholder="출장비"
        />
        <Input value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} placeholder="작업 내용" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={requiresFollowUp} onChange={(e) => setRequiresFollowUp(e.target.checked)} />
        재방문 필요
      </label>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onDone}>
          닫기
        </Button>
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          완료 처리
        </Button>
      </div>
    </div>
  );
}
