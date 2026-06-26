import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TextField } from '@/components/form/TextField';
import { api } from '@/lib/api';
import { addMemberSchema, type AddMemberValues } from '../-schemas';
import { invalidateInvitations, invalidateMembers } from '../-api';
import { RoleSelect } from './RoleSelect';

export function AddMemberDialog({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // 직접 추가가 '계정 없음(404)'으로 실패하면 초대 확인 화면으로 전환
  const [inviteFor, setInviteFor] = useState<AddMemberValues | null>(null);

  const form = useForm<AddMemberValues>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { email: '', name: '', department: '', position: '', role: 'STAFF' },
  });

  const reset = () => {
    setInviteFor(null);
    form.reset({ email: '', name: '', department: '', position: '', role: 'STAFF' });
  };

  const addMutation = useMutation({
    mutationFn: (data: AddMemberValues) =>
      api.post(`/organizations/${orgId}/members`, {
        email: data.email,
        role: data.role,
        name: data.name,
        department: data.department || undefined,
        position: data.position || undefined,
      }),
    onSuccess: () => {
      invalidateMembers(queryClient, orgId);
      toast.success('직원이 추가되었습니다.');
      setOpen(false);
      reset();
    },
    onError: (err, variables) => {
      const status = (err as AxiosError).response?.status;
      if (status === 404) {
        setInviteFor(variables); // 가입 계정 없음 → 초대 확인 모드
      } else if (status === 409) {
        toast.error('이미 조직의 활성 직원입니다.');
      } else {
        toast.error('직원 추가 중 오류가 발생했습니다.');
      }
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (data: AddMemberValues) =>
      api.post(`/organizations/${orgId}/invitations`, { email: data.email, role: data.role }),
    onSuccess: () => {
      invalidateInvitations(queryClient, orgId);
      toast.success('초대장을 보냈습니다.');
      setOpen(false);
      reset();
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      if (status === 409) toast.error('이미 조직의 활성 직원입니다.');
      else toast.error('초대 발송 중 오류가 발생했습니다.');
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          + 직원 추가
        </Button>
      </DialogTrigger>
      <DialogContent>
        {inviteFor ? (
          <>
            <DialogHeader>
              <DialogTitle>초대장 보내기</DialogTitle>
              <DialogDescription>
                <strong>{inviteFor.email}</strong> 로 가입된 계정이 없습니다. 이 이메일로 초대장을 보낼까요?
                이름·부서·직급은 본인이 가입한 뒤 수정할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteFor(null)}>
                뒤로
              </Button>
              <Button disabled={inviteMutation.isPending} onClick={() => inviteMutation.mutate(inviteFor)}>
                {inviteMutation.isPending ? '발송 중...' : '초대 보내기'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>직원 추가</DialogTitle>
              <DialogDescription>가입된 직원이면 즉시 추가되고, 아니면 초대장을 보냅니다.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => void addMutation.mutate(d))} className="space-y-3">
                <TextField
                  control={form.control}
                  name="email"
                  label="이메일"
                  type="email"
                  required
                  placeholder="staff@company.com"
                />
                <TextField control={form.control} name="name" label="이름" required placeholder="홍길동" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField control={form.control} name="department" label="부서" />
                  <TextField control={form.control} name="position" label="직급" />
                </div>
                <RoleSelect control={form.control} name="role" />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    취소
                  </Button>
                  <Button type="submit" disabled={addMutation.isPending}>
                    {addMutation.isPending ? '추가 중...' : '추가'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
