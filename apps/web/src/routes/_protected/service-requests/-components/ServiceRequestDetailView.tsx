import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { type AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { DetailRow } from '@/components/ui/detail-row';
import { useAuthStore } from '@/store/auth.store';
import { fetchMembers } from '../../settings/members/-api';
import type { Member } from '../../settings/members/-types';
import type { ServiceRequestDetail, ServiceRequestStatus } from '../-types';
import {
  REQUEST_STATUS_LABEL,
  REQUEST_TYPE_LABEL,
  REQUEST_TRANSITIONS,
  VISIT_STATUS_LABEL,
  VISIT_RESULT_LABEL,
  customerNameOf,
} from '../-types';
import { invalidateServiceRequest } from '../-api';
import { VisitCompleteForm } from './VisitCompleteForm';

const won = (n: number | null) => (n == null ? '-' : `${n.toLocaleString('ko-KR')}원`);
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('ko-KR') : '-');
const selectClass = 'flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none';

export function ServiceRequestDetailView({ request }: { request: ServiceRequestDetail }) {
  const queryClient = useQueryClient();
  const org = useAuthStore((s) => s.currentOrganization);
  const [completingId, setCompletingId] = useState<string | null>(null);
  // 현재 상태 + 백엔드 트리거가 허용하는 다음 상태만 드롭다운에 노출.
  const nextStatuses = REQUEST_TRANSITIONS[request.status];
  const [nextStatus, setNextStatus] = useState<ServiceRequestStatus>(request.status);

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['members', org?.id],
    queryFn: () => fetchMembers(org!.id),
    enabled: !!org,
  });

  const statusMutation = useMutation({
    mutationFn: (status: ServiceRequestStatus) => api.patch(`/service-requests/${request.id}/status`, { status }),
    onSuccess: () => {
      invalidateServiceRequest(queryClient, request.id);
      toast.success('상태를 변경했습니다.');
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(s === 400 ? '허용되지 않는 상태 전환입니다.' : '상태 변경 중 오류가 발생했습니다.');
    },
  });

  const cancelVisitMutation = useMutation({
    mutationFn: (visitId: string) => api.patch(`/service-visits/${visitId}/cancel`, {}),
    onSuccess: () => {
      invalidateServiceRequest(queryClient, request.id);
      toast.success('방문을 취소했습니다.');
    },
    onError: () => toast.error('방문 취소 중 오류가 발생했습니다.'),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{request.requestNo}</h2>
            <Badge variant="secondary">{REQUEST_TYPE_LABEL[request.type]}</Badge>
            <Badge variant={request.status === 'COMPLETED' ? 'default' : 'secondary'}>
              {REQUEST_STATUS_LABEL[request.status]}
            </Badge>
          </div>
          {nextStatuses.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                className={selectClass}
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as ServiceRequestStatus)}
              >
                {[request.status, ...nextStatuses].map((s) => (
                  <option key={s} value={s}>
                    {REQUEST_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={nextStatus === request.status || statusMutation.isPending}
                onClick={() => statusMutation.mutate(nextStatus)}
              >
                상태 변경
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <DetailRow label="고객" value={customerNameOf(request.customer)} />
          <DetailRow label="자산" value={`${request.asset.product.name} (${request.asset.serialNumber})`} />
          <DetailRow label="보증" value={request.isWarranty ? '보증(무상)' : '유상'} />
          <DetailRow label="요청 방문일" value={date(request.requestedVisitDate)} />
          <DetailRow label="증상/설명" value={request.description ?? '-'} />
          <DetailRow
            label="방문지"
            value={
              request.visitLocationAddress
                ? `${request.visitLocationAddress} ${request.visitLocationAddressDetail ?? ''}`.trim()
                : '-'
            }
          />
        </div>
      </div>

      {/* 방문 섹션 */}
      <div className="rounded-lg border bg-card">
        <p className="border-b px-4 py-2 text-sm font-medium text-muted-foreground">방문</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>예정일</TableHead>
              <TableHead>담당자</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>결과</TableHead>
              <TableHead className="text-right">비용합</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {request.visits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  방문 내역이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              request.visits.map((v) => {
                const total = (v.laborCost ?? 0) + (v.partsCost ?? 0) + (v.travelCost ?? 0);
                const actionable = v.status === 'SCHEDULED' || v.status === 'IN_PROGRESS';
                return (
                  <Fragment key={v.id}>
                    <TableRow>
                      <TableCell>{date(v.scheduledAt)}</TableCell>
                      <TableCell>{v.staff?.name ?? '-'}</TableCell>
                      <TableCell>{VISIT_STATUS_LABEL[v.status]}</TableCell>
                      <TableCell>{v.result ? VISIT_RESULT_LABEL[v.result] : '-'}</TableCell>
                      <TableCell className="text-right">{total > 0 ? won(total) : '-'}</TableCell>
                      <TableCell className="text-right">
                        {actionable && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setCompletingId(completingId === v.id ? null : v.id)}
                            >
                              완료
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={cancelVisitMutation.isPending}
                              onClick={() => cancelVisitMutation.mutate(v.id)}
                            >
                              취소
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                    {completingId === v.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0">
                          <VisitCompleteForm
                            visitId={v.id}
                            requestId={request.id}
                            onDone={() => setCompletingId(null)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
        <AddVisitForm requestId={request.id} members={members} />
      </div>
    </div>
  );
}

function AddVisitForm({ requestId, members }: { requestId: string; members: Member[] }) {
  const queryClient = useQueryClient();
  const [staffId, setStaffId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [memo, setMemo] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/service-requests/${requestId}/visits`, {
        ...(staffId && { staffId }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt).toISOString() }),
        ...(memo && { memo }),
      }),
    onSuccess: () => {
      invalidateServiceRequest(queryClient, requestId);
      toast.success('방문을 추가했습니다.');
      setStaffId('');
      setScheduledAt('');
      setMemo('');
    },
    onError: (err) => {
      const s = (err as AxiosError).response?.status;
      toast.error(s === 400 ? '완료/취소된 접수에는 방문을 추가할 수 없습니다.' : '방문 추가 중 오류가 발생했습니다.');
    },
  });

  return (
    <div className="border-t p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">방문 추가</p>
      <div className="flex flex-wrap items-end gap-2">
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
        >
          <option value="">담당자 미지정</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <Input type="date" className="w-40" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        <Input className="w-48" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)" />
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          추가
        </Button>
      </div>
    </div>
  );
}
