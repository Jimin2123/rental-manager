import { useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth.store';
import type { Assignment } from '../-types';
import { assignmentKeys, fetchAssignments } from '../-api';
import { api } from '@/lib/api';
import { fetchMembers, memberKeys } from '../../settings/members/-api';
import { ROLE_LABEL } from '../../settings/members/-types';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR');

export function AssignmentSection({
  customerId,
  individualProfileId,
}: {
  customerId: string;
  individualProfileId: string;
}) {
  const queryClient = useQueryClient();
  const orgId = useAuthStore((s) => s.currentOrganization?.id);

  const [showAddForm, setShowAddForm] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [role, setRole] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: assignmentKeys.list(customerId),
    queryFn: () => fetchAssignments(customerId),
  });

  const { data: members = [] } = useQuery({
    queryKey: orgId ? memberKeys.list(orgId) : ['members', 'none'],
    queryFn: () => fetchMembers(orgId!),
    enabled: !!orgId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: assignmentKeys.list(customerId) });

  const resetForm = () => {
    setShowAddForm(false);
    setMemberId('');
    setRole('');
    setIsPrimary(false);
  };

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/customers/${customerId}/assignments`, {
        organizationMemberId: memberId,
        // 개인 고객 배정은 해당 고객의 개인 프로필을 가리켜야 한다(DB 가드).
        individualProfileId,
        role: role || undefined,
        isPrimary,
      }),
    onSuccess: () => {
      toast.success('담당자가 배정되었습니다.');
      resetForm();
      void invalidate();
    },
    onError: () => toast.error('담당자 배정 중 오류가 발생했습니다.'),
  });

  const endMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      api.patch(`/customers/${customerId}/assignments/${assignmentId}`, { endedAt: new Date().toISOString() }),
    onSuccess: () => {
      toast.success('담당자 배정이 해제되었습니다.');
      void invalidate();
    },
    onError: () => toast.error('배정 해제 중 오류가 발생했습니다.'),
  });

  const primaryMutation = useMutation({
    mutationFn: (assignmentId: string) =>
      api.patch(`/customers/${customerId}/assignments/${assignmentId}`, { isPrimary: true }),
    onSuccess: () => {
      toast.success('주담당자가 변경되었습니다.');
      void invalidate();
    },
    onError: () => toast.error('주담당자 변경 중 오류가 발생했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (assignmentId: string) => api.delete(`/customers/${customerId}/assignments/${assignmentId}`),
    onSuccess: () => {
      toast.success('배정 이력이 삭제되었습니다.');
      void invalidate();
    },
    onError: () => toast.error('배정 삭제 중 오류가 발생했습니다.'),
  });

  const current = assignments.filter((a) => !a.endedAt);
  const ended = assignments.filter((a) => a.endedAt);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">담당자 배정 ({current.length}명)</h2>
        {!showAddForm && (
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
            + 담당자 배정
          </Button>
        )}
      </div>

      {current.length === 0 && !showAddForm && (
        <p className="text-xs text-muted-foreground">배정된 담당자가 없습니다.</p>
      )}

      {/* 현재 배정 */}
      {current.map((a) => (
        <div key={a.id} className="flex items-start justify-between rounded-md border p-3 text-sm">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-medium">{a.organizationMember.name}</span>
              {a.isPrimary && (
                <Badge variant="outline" className="text-xs">
                  주담당
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {ROLE_LABEL[a.organizationMember.role]}
              </Badge>
            </div>
            {a.role && <p className="text-muted-foreground text-xs">{a.role}</p>}
            <p className="text-muted-foreground text-xs">배정일 {formatDate(a.startedAt)}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            {!a.isPrimary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void primaryMutation.mutate(a.id)}
                disabled={primaryMutation.isPending}
              >
                주담당 지정
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => void endMutation.mutate(a.id)}
              disabled={endMutation.isPending}
            >
              해제
            </Button>
          </div>
        </div>
      ))}

      {/* 배정 추가 폼 */}
      {showAddForm && (
        <div className="rounded-md border p-3 space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium">담당 직원</p>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              <option value="">직원을 선택하세요</option>
              {members
                .filter((m) => m.isActive)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({ROLE_LABEL[m.role]})
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium">역할 (선택)</p>
            <Input placeholder="예: 계약 담당자" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isPrimary} onCheckedChange={(v) => setIsPrimary(!!v)} />
            주담당자로 지정
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={resetForm}>
              취소
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!memberId || addMutation.isPending}
              onClick={() => void addMutation.mutate()}
            >
              {addMutation.isPending ? '배정 중...' : '배정'}
            </Button>
          </div>
        </div>
      )}

      {/* 이전 배정 이력 (흐리게) */}
      {ended.length > 0 && (
        <>
          <Separator />
          <p className="text-xs font-medium text-muted-foreground">이전 담당자</p>
          {ended.map((a) => (
            <div key={a.id} className="flex items-start justify-between rounded-md border p-3 text-sm opacity-50">
              <div className="space-y-0.5">
                <span className="font-medium">{a.organizationMember.name}</span>
                {a.role && <p className="text-muted-foreground text-xs">{a.role}</p>}
                <p className="text-muted-foreground text-xs">
                  {formatDate(a.startedAt)} ~ {a.endedAt ? formatDate(a.endedAt) : ''} 종료
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => void deleteMutation.mutate(a.id)}
                disabled={deleteMutation.isPending}
              >
                삭제
              </Button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
