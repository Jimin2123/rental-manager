import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import type { Supplier } from '../-types';
import { fetchPurchaseSuppliers, invalidateAssetStats, supplierKeys } from '../-api';
import { addAssetSchema, type AddAssetFormValues } from '../-schemas';
import { TextField, SupplierField } from './fields';

export function AddAssetDialog({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: supplierKeys.purchaseList(),
    queryFn: fetchPurchaseSuppliers,
    enabled: open,
  });

  const form = useForm<AddAssetFormValues>({
    resolver: zodResolver(addAssetSchema) as Resolver<AddAssetFormValues>,
    defaultValues: { initialStatus: 'AVAILABLE' },
  });

  const addMutation = useMutation({
    mutationFn: (data: AddAssetFormValues) =>
      api.post<{ id: string }>('/assets', {
        productId,
        initialStatus: data.initialStatus,
        serialNumber: data.serialNumber || undefined,
        supplierId: data.supplierId || undefined,
        purchaseDate: data.purchaseDate || undefined,
        purchasePrice: data.purchasePrice,
        memo: data.memo || undefined,
      }),
    onSuccess: () => {
      invalidateAssetStats(queryClient, productId);
      toast.success('자산이 등록되었습니다.');
      setOpen(false);
      form.reset({ initialStatus: 'AVAILABLE' });
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      if (status === 409) toast.error('이미 등록된 시리얼 번호입니다.');
      else toast.error('자산 등록 중 오류가 발생했습니다.');
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset({ initialStatus: 'AVAILABLE' });
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          + 자산 추가
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>자산 추가</DialogTitle>
          <DialogDescription>이 제품에 자산을 추가합니다.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => void addMutation.mutate(d))} className="space-y-3">
            <FormField
              control={form.control}
              name="initialStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    초기 상태 <span className="text-destructive">*</span>
                  </FormLabel>
                  <div className="flex gap-4">
                    {(['AVAILABLE', 'INCOMING'] as const).map((s) => (
                      <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value={s}
                          checked={field.value === s}
                          onChange={() => field.onChange(s)}
                          className="accent-primary"
                        />
                        {s === 'AVAILABLE' ? '사용가능' : '입고예정'}
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <TextField control={form.control} name="serialNumber" label="시리얼번호" placeholder="SN-001" />
            <SupplierField control={form.control} name="supplierId" suppliers={suppliers} />

            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="purchaseDate" label="매입일" type="date" />
              <TextField
                control={form.control}
                name="purchasePrice"
                label="매입가 (원)"
                type="number"
                min={0}
                placeholder="0"
              />
            </div>

            <TextField control={form.control} name="memo" label="메모" placeholder="내부 메모" />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? '등록 중...' : '추가'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
