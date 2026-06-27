import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { TextField } from '@/components/form/TextField';
import { api } from '@/lib/api';
import { openKakaoAddressSearch } from '@/lib/kakao-address';
import type { CustomerDetail } from '../-types';
import { customerFormSchema, type CustomerFormValues } from '../-schemas';
import { IndividualFields, AddressFields } from './fields';
import { toAddressPayload } from './payload';

export function CustomerEditForm({
  customer,
  onCancel,
  onSaved,
}: {
  customer: CustomerDetail;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const profile = customer.individualProfile!;
  const addr = profile.address;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: profile.name,
      phone: profile.phone ?? '',
      email: profile.email ?? '',
      address: {
        zonecode: addr?.zonecode ?? '',
        address: addr?.address ?? '',
        addressDetail: addr?.addressDetail ?? '',
        jibunAddress: addr?.jibunAddress ?? '',
        roadAddress: addr?.roadAddress ?? '',
        buildingName: addr?.buildingName ?? '',
      },
      memo: customer.memo ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: CustomerFormValues) =>
      api.patch(`/customers/${customer.id}`, {
        memo: values.memo || undefined,
        individualProfile: {
          name: values.name,
          phone: values.phone || undefined,
          email: values.email || undefined,
          address: toAddressPayload(values.address),
        },
      }),
    onSuccess: () => {
      toast.success('고객 정보가 수정되었습니다.');
      onSaved();
    },
    onError: () => toast.error('수정 중 오류가 발생했습니다.'),
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
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
