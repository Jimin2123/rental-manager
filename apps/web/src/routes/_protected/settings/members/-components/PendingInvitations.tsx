import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { PendingInvitation } from '../-types';
import { ROLE_LABEL } from '../-types';
import { fetchInvitations, invalidateInvitations, invitationKeys } from '../-api';
import { api } from '@/lib/api';

export function PendingInvitations({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();

  const { data: invitations = [], isLoading } = useQuery<PendingInvitation[]>({
    queryKey: invitationKeys.list(orgId),
    queryFn: () => fetchInvitations(orgId),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/organizations/${orgId}/invitations/${id}`),
    onSuccess: () => {
      invalidateInvitations(queryClient, orgId);
      toast.success('초대를 취소했습니다.');
    },
    onError: () => toast.error('초대 취소 중 오류가 발생했습니다.'),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/organizations/${orgId}/invitations/${id}/resend`),
    onSuccess: () => {
      invalidateInvitations(queryClient, orgId);
      toast.success('초대장을 다시 보냈습니다.');
    },
    onError: () => toast.error('재발송 중 오류가 발생했습니다.'),
  });

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">대기 중 초대 ({invitations.length})</h2>
      <Separator />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground">대기 중인 초대가 없습니다.</p>
      ) : (
        <ul className="divide-y">
          {invitations.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium">{inv.email}</p>
                <p className="text-xs text-muted-foreground">
                  {ROLE_LABEL[inv.role]} · 만료 {new Date(inv.expiresAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resendMutation.mutate(inv.id)}
                  disabled={resendMutation.isPending}
                >
                  재발송
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => cancelMutation.mutate(inv.id)}
                  disabled={cancelMutation.isPending}
                >
                  취소
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
