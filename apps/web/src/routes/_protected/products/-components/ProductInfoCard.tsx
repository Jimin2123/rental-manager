import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toastApiError } from '@/lib/api-error';
import { toast } from 'sonner';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { Product } from '../-types';
import { productKeys } from '../-api';
import { productSchema, type ProductFormValues } from '../-schemas';
import { TextField } from './fields';

export function ProductInfoCard({ product, onDeleted }: { product: Product; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    values: {
      name: product.name,
      manufacturer: product.manufacturer ?? '',
      modelName: product.modelName ?? '',
      category: product.category ?? '',
      memo: product.memo ?? '',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProductFormValues) =>
      api.patch(`/products/${product.id}`, {
        name: data.name,
        manufacturer: data.manufacturer || null,
        modelName: data.modelName || null,
        category: data.category || null,
        memo: data.memo || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('제품 정보가 수정되었습니다.');
      setIsEditing(false);
    },
    onError: () => toast.error('수정 중 오류가 발생했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/products/${product.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('제품이 삭제되었습니다.');
      onDeleted();
    },
    onError: (err) =>
      toastApiError(err, '삭제 중 오류가 발생했습니다.', { 409: '연결된 자산이 있어 삭제할 수 없습니다.' }),
  });

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex justify-end gap-2">
        {!isEditing && (
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            수정
          </Button>
        )}
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="destructive">
              삭제
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>제품 삭제</DialogTitle>
              <DialogDescription>이 제품을 삭제하시겠습니까? 자산이 있으면 삭제할 수 없습니다.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">취소</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => void deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isEditing ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => void updateMutation.mutate(d))} className="space-y-3">
            <TextField control={form.control} name="name" label="제품명" required />
            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="manufacturer" label="제조사" />
              <TextField control={form.control} name="modelName" label="모델명" />
            </div>
            <TextField control={form.control} name="category" label="카테고리" />
            <TextField control={form.control} name="memo" label="메모" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                취소
              </Button>
              <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">제품명</dt>
            <dd className="font-medium">{product.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">카테고리</dt>
            <dd>{product.category ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">제조사</dt>
            <dd>{product.manufacturer ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">모델명</dt>
            <dd>{product.modelName ?? '-'}</dd>
          </div>
          {product.memo && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">메모</dt>
              <dd>{product.memo}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
