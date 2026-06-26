import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { invalidateInvitations } from '../-api';
import { RoleSelect } from './RoleSelect';

const inviteSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.'),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']),
});
type InviteValues = z.infer<typeof inviteSchema>;

export function AddMemberDialog({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'STAFF' },
  });

  const reset = () => {
    form.reset({ email: '', role: 'STAFF' });
  };

  const inviteMutation = useMutation({
    mutationFn: (data: InviteValues) =>
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
        <DialogHeader>
          <DialogTitle>직원 초대</DialogTitle>
          <DialogDescription>이메일로 초대장을 보냅니다.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => void inviteMutation.mutate(d))} className="space-y-3">
            <TextField
              control={form.control}
              name="email"
              label="이메일"
              type="email"
              required
              placeholder="staff@company.com"
            />
            <RoleSelect control={form.control} name="role" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? '발송 중...' : '초대 보내기'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
