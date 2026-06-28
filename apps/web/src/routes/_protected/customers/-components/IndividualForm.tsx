import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { TextField } from '@/components/form/TextField';
import { api } from '@/lib/api';
import { openKakaoAddressSearch } from '@/lib/kakao-address';
import { customerKeys } from '../-api';
import { customerFormSchema, type CustomerFormValues } from '../-schemas';
import { IndividualFields, AddressFields } from './fields';
import { toAddressPayload } from './payload';

export function IndividualForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: { zonecode: '', address: '', addressDetail: '', jibunAddress: '', roadAddress: '', buildingName: '' },
      memo: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      api.post<{ id: string }>('/customers', {
        type: 'INDIVIDUAL',
        memo: values.memo || undefined,
        individualProfile: {
          name: values.name,
          phone: values.phone || undefined,
          email: values.email || undefined,
          address: toAddressPayload(values.address),
        },
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      toast.success('고객이 등록되었습니다.');
      void navigate({ to: '/customers/$id', params: { id: res.data.id } });
    },
    onError: () => toast.error('고객 등록 중 오류가 발생했습니다.'),
  });

  const handleAddressSearch = () => {
    openKakaoAddressSearch((result) => {
      form.setValue('address.zonecode', result.zonecode, { shouldValidate: true });
      form.setValue('address.address', result.address, { shouldValidate: true });
      form.setValue('address.jibunAddress', result.jibunAddress);
      form.setValue('address.roadAddress', result.roadAddress);
      form.setValue('address.buildingName', result.buildingName);
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => void mutation.mutate(d))} className="space-y-6">
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h2 className="text-sm font-semibold">고객 정보</h2>
          <IndividualFields control={form.control} />
          <AddressFields control={form.control} onSearch={handleAddressSearch} />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <TextField control={form.control} name="memo" label="메모" placeholder="내부 메모 (선택)" />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => void navigate({ to: '/customers' })}>
            취소
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? '저장 중...' : '등록'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
