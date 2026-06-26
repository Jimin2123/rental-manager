import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  acceptMine,
  declineMine,
  fetchMineInvitations,
  fetchSentRecent,
  invalidateMine,
  inviteKeys,
} from '@/routes/invitations/-api';

const SEEN_AT_KEY = 'invite_seen_at';

function getSeenAt(): Date | null {
  try {
    const val = localStorage.getItem(SEEN_AT_KEY);
    return val ? new Date(val) : null;
  } catch {
    return null;
  }
}

function updateSeenAt(): void {
  try {
    localStorage.setItem(SEEN_AT_KEY, new Date().toISOString());
  } catch {
    // localStorage 접근 불가 — 무시
  }
}

export function InvitationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: mineData = [] } = useQuery({
    queryKey: inviteKeys.mine,
    queryFn: fetchMineInvitations,
  });

  const { data: sentData = [] } = useQuery({
    queryKey: inviteKeys.sent,
    queryFn: fetchSentRecent,
  });

  const seenAt = getSeenAt();

  const unreadSentCount = sentData.filter((r) => {
    const d = r.acceptedAt ?? r.declinedAt;
    if (!d) return false;
    if (!seenAt) return true;
    return new Date(d) > seenAt;
  }).length;

  const totalCount = mineData.length + unreadSentCount;

  const handleOpenChange = (next: boolean) => {
    if (next) updateSeenAt();
    setOpen(next);
  };

  const acceptMutation = useMutation({
    mutationFn: acceptMine,
    onSuccess: () => {
      invalidateMine(qc);
      void qc.invalidateQueries({ queryKey: ['members'] });
      void qc.invalidateQueries({ queryKey: ['organizations', 'me'] });
      toast.success('초대를 수락했습니다.');
    },
    onError: () => {
      toast.error('수락에 실패했습니다.');
    },
  });

  const declineMutation = useMutation({
    mutationFn: declineMine,
    onSuccess: () => {
      invalidateMine(qc);
      void qc.invalidateQueries({ queryKey: ['members'] });
      toast.success('초대를 거절했습니다.');
    },
    onError: () => {
      toast.error('거절에 실패했습니다.');
    },
  });

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="초대 알림" className="relative">
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px]">
              {totalCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {/* 받은 초대 섹션 */}
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">받은 초대</div>
        {mineData.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">받은 초대가 없습니다.</div>
        ) : (
          mineData.map((inv) => (
            <div key={inv.id} className="flex flex-col gap-1 border-b px-3 py-2 last:border-b-0">
              <div className="text-sm font-medium">{inv.organization.businessProfile.name}</div>
              <div className="text-xs text-muted-foreground">
                역할: {inv.role} · 초대자: {inv.invitedBy.name}
              </div>
              <div className="flex gap-1 pt-1">
                <Button
                  size="sm"
                  className="h-6 text-xs"
                  disabled={acceptMutation.isPending || declineMutation.isPending}
                  onClick={() => acceptMutation.mutate(inv.id)}
                >
                  수락
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  disabled={acceptMutation.isPending || declineMutation.isPending}
                  onClick={() => declineMutation.mutate(inv.id)}
                >
                  거절
                </Button>
              </div>
            </div>
          ))
        )}

        {/* 보낸 결과 섹션 */}
        <div className="mt-1 border-t px-3 py-2 text-xs font-semibold text-muted-foreground">보낸 결과</div>
        {sentData.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">보낸 결과가 없습니다.</div>
        ) : (
          sentData.map((r) => {
            const d = r.acceptedAt ?? r.declinedAt;
            const isUnread = d ? !seenAt || new Date(d) > seenAt : false;
            return (
              <div
                key={r.id}
                className={`flex items-center gap-2 border-b px-3 py-2 last:border-b-0${isUnread ? ' bg-muted/50' : ''}`}
              >
                <div className="flex-1 text-xs">
                  {r.email}님이{' '}
                  {r.result === 'ACCEPTED' ? (
                    <span className="text-green-600">수락했습니다</span>
                  ) : (
                    <span className="text-destructive">거절했습니다</span>
                  )}
                </div>
                {isUnread && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </div>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
