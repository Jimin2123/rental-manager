import { useState } from 'react';
import { toast } from 'sonner';
import { toastApiError } from '@/lib/api-error';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { customerKeys } from '../-api';
import { partnerKeys, fetchPartners } from '../../business-partners/-api';
import type { BusinessPartnerListItem } from '../../business-partners/-types';

// 법인 고객 = 기존 거래처 연결. 새 거래처를 만들지 않는다.
export function BusinessForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [businessPartnerId, setBusinessPartnerId] = useState('');
  const [memo, setMemo] = useState('');

  // 고객 = 매출 대상. 매입 전용 거래처(공급자)는 제외하고 매출 거래처만 연결 대상으로 보여준다.
  const { data: partners = [] } = useQuery<BusinessPartnerListItem[]>({
    queryKey: partnerKeys.list({ role: 'SALES' }),
    queryFn: () => fetchPartners({ role: 'SALES' }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>('/customers', {
        type: 'BUSINESS',
        businessPartnerId,
        memo: memo || undefined,
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success('법인 고객이 등록되었습니다.');
      void navigate({ to: '/customers/$id', params: { id: res.data.id } });
    },
    onError: (err) =>
      toastApiError(err, '법인 고객 등록 중 오류가 발생했습니다.', {
        409: '이미 고객으로 등록된 거래처입니다.',
        404: '거래처를 찾을 수 없습니다.',
      }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">거래처 선택</h2>
          <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/business-partners/new' })}>
            + 새 거래처 등록
          </Button>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            거래처 <span className="text-destructive">*</span>
          </p>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none"
            value={businessPartnerId}
            onChange={(e) => setBusinessPartnerId(e.target.value)}
          >
            <option value="">거래처를 선택하세요</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.businessProfile.name} ({p.businessProfile.businessRegistrationNo})
              </option>
            ))}
          </select>
          {partners.length === 0 && (
            <p className="text-xs text-muted-foreground">
              등록된 매출 거래처가 없습니다. 거래처를 매출 역할로 먼저 등록하세요.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-1.5">
        <p className="text-sm font-medium">메모</p>
        <Input placeholder="내부 메모 (선택)" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/customers' })}>
          취소
        </Button>
        <Button
          type="button"
          disabled={!businessPartnerId || mutation.isPending}
          onClick={() => void mutation.mutate()}
        >
          {mutation.isPending ? '저장 중...' : '등록'}
        </Button>
      </div>
    </div>
  );
}
