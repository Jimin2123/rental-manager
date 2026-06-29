import { useState } from 'react';
import { toastApiError } from '@/lib/api-error';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { Member } from '../-types';
import { ROLE_LABEL } from '../-types';
import { fetchMembers, invalidateMembers, memberKeys } from '../-api';
import { EditMemberDialog } from './EditMemberDialog';
import { AddMemberDialog } from './AddMemberDialog';

export function MemberTable({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Member | null>(null);
  const [deactivating, setDeactivating] = useState<Member | null>(null);

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: memberKeys.list(orgId),
    queryFn: () => fetchMembers(orgId),
  });

  const deactivateMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/organizations/${orgId}/members/${memberId}`),
    onSuccess: () => {
      invalidateMembers(queryClient, orgId);
      toast.success('직원이 비활성화되었습니다.');
      setDeactivating(null);
    },
    onError: (err) =>
      toastApiError(err, '비활성화 중 오류가 발생했습니다.', { 403: '이 직원은 비활성화할 수 없습니다.' }),
  });

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">직원 ({members.length}명)</h2>
        <AddMemberDialog orgId={orgId} />
      </div>
      <Separator />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>부서</TableHead>
            <TableHead>직급</TableHead>
            <TableHead>역할</TableHead>
            <TableHead>이메일</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                불러오는 중...
              </TableCell>
            </TableRow>
          ) : members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                등록된 직원이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.department ?? '-'}</TableCell>
                <TableCell>{m.position ?? '-'}</TableCell>
                <TableCell>
                  <Badge variant={m.role === 'OWNER' ? 'default' : 'secondary'}>{ROLE_LABEL[m.role]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{m.email ?? '-'}</TableCell>
                <TableCell>
                  {m.role !== 'OWNER' && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
                        수정
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeactivating(m)}>
                        비활성화
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {editing && (
        <EditMemberDialog
          member={editing}
          orgId={orgId}
          open={!!editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}

      <Dialog open={!!deactivating} onOpenChange={(open) => !open && setDeactivating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>직원 비활성화</DialogTitle>
            <DialogDescription>
              &ldquo;{deactivating?.name}&rdquo; 직원을 비활성화하시겠습니까? 다시 추가하면 복구됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">취소</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deactivateMutation.isPending}
              onClick={() => deactivating && deactivateMutation.mutate(deactivating.id)}
            >
              {deactivateMutation.isPending ? '처리 중...' : '비활성화'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
