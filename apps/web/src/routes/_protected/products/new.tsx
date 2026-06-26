import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { api } from '@/lib/api';
import { productKeys } from './-api';
import { productSchema, type ProductFormValues } from './-schemas';
import { TextField } from './-components/fields';

export const Route = createFileRoute('/_protected/products/new')({
  component: NewProductPage,
});

function NewProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: '', manufacturer: '', modelName: '', category: '', memo: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: ProductFormValues) =>
      api.post<{ id: string }>('/products', {
        name: data.name,
        manufacturer: data.manufacturer || undefined,
        modelName: data.modelName || undefined,
        category: data.category || undefined,
        memo: data.memo || undefined,
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('제품이 등록되었습니다.');
      void navigate({ to: '/products/$id', params: { id: res.data.id } });
    },
    onError: () => {
      toast.error('제품 등록 중 오류가 발생했습니다.');
    },
  });

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/products' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">제품 등록</h1>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) => void mutation.mutate(d))}
          className="space-y-4 rounded-lg border bg-card p-4"
        >
          <TextField control={form.control} name="name" label="제품명" placeholder="복합기 MX450" required />
          <div className="grid grid-cols-2 gap-3">
            <TextField control={form.control} name="manufacturer" label="제조사" placeholder="캐논" />
            <TextField control={form.control} name="modelName" label="모델명" placeholder="MX450" />
          </div>
          <TextField control={form.control} name="category" label="카테고리" placeholder="복합기" />
          <TextField control={form.control} name="memo" label="메모" placeholder="내부 메모" />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => void navigate({ to: '/products' })}>
              취소
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? '등록 중...' : '등록'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
