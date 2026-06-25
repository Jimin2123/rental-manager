import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api } from '@/lib/api';
import type { Product } from './-types';

export const Route = createFileRoute('/_protected/assets/new')({
  component: NewAssetPage,
});

// ─── 제품 즉석 생성 폼 스키마 ─────────────────────────────────────
const newProductSchema = z.object({
  name: z.string().min(1, '제품명을 입력해주세요.'),
  manufacturer: z.string().optional(),
  modelName: z.string().optional(),
  category: z.string().optional(),
});
type NewProductValues = z.infer<typeof newProductSchema>;

// ─── 자산 등록 폼 스키마 ──────────────────────────────────────────
const assetSchema = z.object({
  productId: z.string().min(1, '제품을 선택해주세요.'),
  initialStatus: z.enum(['INCOMING', 'AVAILABLE']),
  serialNumber: z.string().optional(),
  supplierId: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(0).optional()),
  memo: z.string().optional(),
});
type AssetFormValues = z.infer<typeof assetSchema>;

// ─── 매입처 타입 ──────────────────────────────────────────────────
type Supplier = { id: string; businessProfile: { name: string } };

function NewAssetPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [productSearch, setProductSearch] = useState('');
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newProductDialogOpen, setNewProductDialogOpen] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products', 'list', productSearch],
    queryFn: () =>
      api
        .get<Product[]>('/products', { params: { ...(productSearch && { search: productSearch }) } })
        .then((r) => r.data),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['business-partners', 'list', { roleFilter: 'PURCHASE' }],
    queryFn: () => api.get<Supplier[]>('/business-partners', { params: { role: 'PURCHASE' } }).then((r) => r.data),
  });

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema) as Resolver<AssetFormValues>,
    defaultValues: { initialStatus: 'AVAILABLE' },
  });

  const newProductForm = useForm<NewProductValues>({
    resolver: zodResolver(newProductSchema),
    defaultValues: { name: '', manufacturer: '', modelName: '', category: '' },
  });

  const createProductMutation = useMutation({
    mutationFn: (data: NewProductValues) =>
      api.post<{ id: string }>('/products', {
        name: data.name,
        manufacturer: data.manufacturer || undefined,
        modelName: data.modelName || undefined,
        category: data.category || undefined,
      }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      const newProduct: Product = {
        id: res.data.id,
        name: newProductForm.getValues('name'),
        manufacturer: newProductForm.getValues('manufacturer') || null,
        modelName: newProductForm.getValues('modelName') || null,
        category: newProductForm.getValues('category') || null,
      };
      setSelectedProduct(newProduct);
      form.setValue('productId', res.data.id, { shouldValidate: true });
      setNewProductDialogOpen(false);
      newProductForm.reset();
      toast.success('제품이 등록되었습니다.');
    },
    onError: () => toast.error('제품 등록 중 오류가 발생했습니다.'),
  });

  const createAssetMutation = useMutation({
    mutationFn: (data: AssetFormValues) =>
      api.post<{ id: string }>('/assets', {
        productId: data.productId,
        initialStatus: data.initialStatus,
        serialNumber: data.serialNumber || undefined,
        supplierId: data.supplierId || undefined,
        purchaseDate: data.purchaseDate || undefined,
        purchasePrice: data.purchasePrice,
        memo: data.memo || undefined,
      }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast.success('자산이 등록되었습니다.');
      void navigate({ to: '/assets/$id', params: { id: res.data.id } });
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      if (status === 409) {
        toast.error('이미 등록된 시리얼 번호입니다.');
      } else {
        toast.error('자산 등록 중 오류가 발생했습니다.');
      }
    },
  });

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/assets' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">자산 등록</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => void createAssetMutation.mutate(d))} className="space-y-4">
          {/* 제품 선택 */}
          <FormField
            control={form.control}
            name="productId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  제품 <span className="text-destructive">*</span>
                </FormLabel>
                <Popover open={productPopoverOpen} onOpenChange={setProductPopoverOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {selectedProduct ? selectedProduct.name : '제품 선택...'}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="제품명 검색..."
                        value={productSearch}
                        onValueChange={setProductSearch}
                      />
                      <CommandList>
                        <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                        <CommandGroup>
                          {products.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => {
                                setSelectedProduct(p);
                                field.onChange(p.id);
                                setProductPopoverOpen(false);
                              }}
                            >
                              <span className="font-medium">{p.name}</span>
                              {p.category && <span className="ml-2 text-xs text-muted-foreground">{p.category}</span>}
                            </CommandItem>
                          ))}
                          <CommandItem
                            value="__new__"
                            onSelect={() => {
                              setProductPopoverOpen(false);
                              setNewProductDialogOpen(true);
                            }}
                            className="text-primary"
                          >
                            + 새 제품 추가
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 초기 상태 */}
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

          {/* 시리얼번호 */}
          <FormField
            control={form.control}
            name="serialNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>시리얼번호</FormLabel>
                <FormControl>
                  <Input placeholder="SN-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 매입처 */}
          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>매입처</FormLabel>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || undefined)}
                >
                  <option value="">선택 안 함</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.businessProfile.name}
                    </option>
                  ))}
                </select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 매입일 */}
          <FormField
            control={form.control}
            name="purchaseDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>매입일</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 매입가 */}
          <FormField
            control={form.control}
            name="purchasePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>매입가 (원)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 메모 */}
          <FormField
            control={form.control}
            name="memo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>메모</FormLabel>
                <FormControl>
                  <Input placeholder="내부 메모" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => void navigate({ to: '/assets' })}>
              취소
            </Button>
            <Button type="submit" disabled={createAssetMutation.isPending}>
              {createAssetMutation.isPending ? '등록 중...' : '등록'}
            </Button>
          </div>
        </form>
      </Form>

      {/* 제품 즉석 생성 Dialog */}
      <Dialog open={newProductDialogOpen} onOpenChange={setNewProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 제품 추가</DialogTitle>
          </DialogHeader>
          <Form {...newProductForm}>
            <form
              onSubmit={newProductForm.handleSubmit((d) => void createProductMutation.mutate(d))}
              className="space-y-3"
            >
              <FormField
                control={newProductForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      제품명 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="복합기 MX450" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={newProductForm.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>제조사</FormLabel>
                    <FormControl>
                      <Input placeholder="캐논" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={newProductForm.control}
                name="modelName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>모델명</FormLabel>
                    <FormControl>
                      <Input placeholder="MX450" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={newProductForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>카테고리</FormLabel>
                    <FormControl>
                      <Input placeholder="복합기" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewProductDialogOpen(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={createProductMutation.isPending}>
                  {createProductMutation.isPending ? '등록 중...' : '추가'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
