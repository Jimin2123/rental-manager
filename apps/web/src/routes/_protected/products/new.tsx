import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { api } from '@/lib/api';

export const Route = createFileRoute('/_protected/products/new')({
  component: NewProductPage,
});

const schema = z.object({
  name: z.string().min(1, '제품명을 입력해주세요.'),
  manufacturer: z.string().optional(),
  modelName: z.string().optional(),
  category: z.string().optional(),
  memo: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function NewProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', manufacturer: '', modelName: '', category: '', memo: '' },
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      api.post<{ id: string }>('/products', {
        name: data.name,
        manufacturer: data.manufacturer || undefined,
        modelName: data.modelName || undefined,
        category: data.category || undefined,
        memo: data.memo || undefined,
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('제품이 등록되었습니다.');
      void navigate({ to: '/products/$id', params: { id: res.data.id } });
    },
    onError: (_err: AxiosError) => {
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
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>제품명 <span className="text-destructive">*</span></FormLabel>
                <FormControl><Input placeholder="복합기 MX450" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="manufacturer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>제조사</FormLabel>
                  <FormControl><Input placeholder="캐논" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="modelName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>모델명</FormLabel>
                  <FormControl><Input placeholder="MX450" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>카테고리</FormLabel>
                <FormControl><Input placeholder="복합기" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="memo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>메모</FormLabel>
                <FormControl><Input placeholder="내부 메모" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
