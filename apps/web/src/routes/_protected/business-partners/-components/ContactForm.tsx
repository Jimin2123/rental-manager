import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { contactSchema, type ContactFormValues } from '../-schemas';
import { ContactFields } from './fields';

// 담당자 추가/수정 공용 폼. 상위 <form> 안에 중첩될 수 있어 div + onClick 제출을 사용한다.
export function ContactForm({
  defaultValues,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  defaultValues: ContactFormValues;
  onSubmit: (data: ContactFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <div className="rounded-md border p-3 space-y-3 bg-muted/30">
        <ContactFields control={form.control} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            취소
          </Button>
          <Button type="button" size="sm" onClick={form.handleSubmit(onSubmit)} disabled={isPending}>
            {isPending ? '처리 중...' : submitLabel}
          </Button>
        </div>
      </div>
    </Form>
  );
}
