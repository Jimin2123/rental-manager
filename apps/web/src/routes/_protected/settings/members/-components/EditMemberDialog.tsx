import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TextField } from '@/components/form/TextField';
import { api } from '@/lib/api';
import type { Member } from '../-types';
import { editMemberSchema, type EditMemberValues } from '../-schemas';
import { invalidateMembers } from '../-api';
import { RoleSelect } from './RoleSelect';

export function EditMemberDialog({
  member,
  orgId,
  open,
  onOpenChange,
}: {
  member: Member;
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm<EditMemberValues>({
    resolver: zodResolver(editMemberSchema),
    values: {
      name: member.name,
      department: member.department ?? '',
      position: member.position ?? '',
      memberPhone: member.phone ?? '',
      role: member.role === 'OWNER' ? 'ADMIN' : member.role,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: EditMemberValues) =>
      api.patch(`/organizations/${orgId}/members/${member.id}`, {
        name: data.name,
        department: data.department || undefined,
        position: data.position || undefined,
        memberPhone: data.memberPhone || undefined,
        role: data.role,
      }),
    onSuccess: () => {
      invalidateMembers(queryClient, orgId);
      toast.success('직원 정보가 수정되었습니다.');
      onOpenChange(false);
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      if (status === 403) toast.error('이 직원의 정보는 변경할 수 없습니다.');
      else toast.error('수정 중 오류가 발생했습니다.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>직원 수정</DialogTitle>
          <DialogDescription>{member.email ?? member.name}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => void mutation.mutate(d))} className="space-y-3">
            <TextField control={form.control} name="name" label="이름" required />
            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="department" label="부서" />
              <TextField control={form.control} name="position" label="직급" />
            </div>
            <TextField control={form.control} name="memberPhone" label="연락처" />
            <RoleSelect control={form.control} name="role" />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  취소
                </Button>
              </DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? '저장 중...' : '저장'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
