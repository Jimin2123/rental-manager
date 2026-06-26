import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Fragment, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import type {
  Product,
  AssetListItem,
  Supplier,
  AssetDetail,
  AssetEvent,
  MeterReading,
  StatusTransition,
  AssetStatus,
} from './-types';
import { ASSET_STATUS_LABEL, ASSET_STATUS_VARIANT, MANUAL_STATUS_TRANSITIONS } from './-types';

export const Route = createFileRoute('/_protected/products/$id')({
  component: ProductDetailPage,
});

// ─── 제품 편집 폼 스키마 ──────────────────────────────────────────
const productSchema = z.object({
  name: z.string().min(1, '제품명을 입력해주세요.'),
  manufacturer: z.string().optional(),
  modelName: z.string().optional(),
  category: z.string().optional(),
  memo: z.string().optional(),
});
type ProductFormValues = z.infer<typeof productSchema>;

// ─── 자산 추가 폼 스키마 ──────────────────────────────────────────
const addAssetSchema = z.object({
  initialStatus: z.enum(['AVAILABLE', 'INCOMING']),
  serialNumber: z.string().optional(),
  supplierId: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(0).optional()),
  memo: z.string().optional(),
});
type AddAssetFormValues = z.infer<typeof addAssetSchema>;

// ─── 메인 페이지 ─────────────────────────────────────────────────
function ProductDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['products', 'detail', id],
    queryFn: () => api.get<Product>(`/products/${id}`).then((r) => r.data),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중...</div>;
  if (!product) return <div className="p-6 text-muted-foreground">제품을 찾을 수 없습니다.</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/products' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{product.name}</h1>
      </div>

      <div className="space-y-4">
        <ProductInfoCard product={product} onDeleted={() => void navigate({ to: '/products' })} />
        <AssetTable productId={id} />
      </div>
    </div>
  );
}

// ─── 제품 정보 카드 ───────────────────────────────────────────────
function ProductInfoCard({ product, onDeleted }: { product: Product; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
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
        manufacturer: data.manufacturer || undefined,
        modelName: data.modelName || undefined,
        category: data.category || undefined,
        memo: data.memo || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('제품 정보가 수정되었습니다.');
      setIsEditing(false);
      form.reset({
        name: product.name,
        manufacturer: product.manufacturer ?? '',
        modelName: product.modelName ?? '',
        category: product.category ?? '',
        memo: product.memo ?? '',
      });
    },
    onError: () => toast.error('수정 중 오류가 발생했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/products/${product.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('제품이 삭제되었습니다.');
      onDeleted();
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      if (status === 409) toast.error('연결된 자산이 있어 삭제할 수 없습니다.');
      else toast.error('삭제 중 오류가 발생했습니다.');
    },
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
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    제품명 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
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
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
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
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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

// ─── 자산 편집 폼 스키마 ──────────────────────────────────────────
const editAssetSchema = z.object({
  serialNumber: z.string().optional(),
  supplierId: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(0).optional()),
  memo: z.string().optional(),
});
type EditAssetValues = z.infer<typeof editAssetSchema>;

// ─── 미터 리딩 폼 스키마 ──────────────────────────────────────────
const meterSchema = z.object({
  readingDate: z.string().min(1, '검침일을 입력해주세요.'),
  blackCount: z.coerce.number().int().min(0, '0 이상의 값을 입력해주세요.'),
  colorCount: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(0).optional()),
  note: z.string().optional(),
});
type MeterFormValues = z.infer<typeof meterSchema>;

// ─── 자산 테이블 ─────────────────────────────────────────────────
function AssetTable({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: assets = [], isLoading } = useQuery<AssetListItem[]>({
    queryKey: ['assets', 'list', { productId }],
    queryFn: () => api.get<AssetListItem[]>('/assets', { params: { productId } }).then((r) => r.data),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['business-partners', 'list', { roleFilter: 'PURCHASE' }],
    queryFn: () => api.get<Supplier[]>('/business-partners', { params: { role: 'PURCHASE' } }).then((r) => r.data),
    enabled: addOpen,
  });

  const addForm = useForm<AddAssetFormValues>({
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
      void queryClient.invalidateQueries({ queryKey: ['assets', 'list', { productId }] });
      void queryClient.invalidateQueries({ queryKey: ['products', 'detail', productId] });
      void queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
      toast.success('자산이 등록되었습니다.');
      setAddOpen(false);
      addForm.reset({ initialStatus: 'AVAILABLE' });
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      if (status === 409) toast.error('이미 등록된 시리얼 번호입니다.');
      else toast.error('자산 등록 중 오류가 발생했습니다.');
    },
  });

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">자산 목록 ({assets.length})</h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
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
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit((d) => void addMutation.mutate(d))} className="space-y-3">
                {/* 초기 상태 */}
                <FormField
                  control={addForm.control}
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
                  control={addForm.control}
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
                  control={addForm.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>매입처</FormLabel>
                      <FormControl>
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
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  {/* 매입일 */}
                  <FormField
                    control={addForm.control}
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
                    control={addForm.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>매입가 (원)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} placeholder="0" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 메모 */}
                <FormField
                  control={addForm.control}
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

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
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
      </div>

      <Separator />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>시리얼번호</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>매입일</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                불러오는 중...
              </TableCell>
            </TableRow>
          ) : assets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                등록된 자산이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            assets.map((asset) => (
              <Fragment key={asset.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedId(expandedId === asset.id ? null : asset.id)}
                >
                  <TableCell>
                    {asset.serialNumber ?? <span className="text-muted-foreground">S/N 미등록</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ASSET_STATUS_VARIANT[asset.status]}>{ASSET_STATUS_LABEL[asset.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('ko-KR') : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{expandedId === asset.id ? '▲' : '▼'}</TableCell>
                </TableRow>
                {expandedId === asset.id && (
                  <TableRow>
                    <TableCell colSpan={4} className="p-0 bg-muted/30">
                      <AssetPanel
                        assetId={asset.id}
                        productId={productId}
                        currentStatus={asset.status}
                        onChanged={() => {
                          void queryClient.invalidateQueries({ queryKey: ['assets', 'list', { productId }] });
                          void queryClient.invalidateQueries({ queryKey: ['products', 'detail', productId] });
                          void queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
                        }}
                        onDeleted={() => {
                          setExpandedId(null);
                          void queryClient.invalidateQueries({ queryKey: ['assets', 'list', { productId }] });
                          void queryClient.invalidateQueries({ queryKey: ['products', 'detail', productId] });
                          void queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
                        }}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── 상태 레이블 매핑 ─────────────────────────────────────────────
const SOURCE_LABEL: Record<string, string> = {
  RENTAL_CONTRACT: '렌탈 계약',
  RENTAL_CONTRACT_ITEM: '계약 장비',
  SALE_ORDER: '판매',
  SERVICE_REQUEST: 'AS 접수',
  SERVICE_VISIT: 'AS 방문',
  MANUAL: '수동',
};

const METHOD_LABEL: Record<string, string> = {
  MANUAL: '수동',
  PHOTO: '사진',
  REMOTE: '원격',
};

// ─── 자산 인라인 확장 패널 ────────────────────────────────────────
function AssetPanel({
  assetId,
  productId,
  currentStatus,
  onChanged,
  onDeleted,
}: {
  assetId: string;
  productId: string;
  currentStatus: AssetStatus;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<StatusTransition | null>(null);
  const [statusNote, setStatusNote] = useState('');

  const { data: asset } = useQuery<AssetDetail>({
    queryKey: ['assets', 'detail', assetId],
    queryFn: () => api.get<AssetDetail>(`/assets/${assetId}`).then((r) => r.data),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['business-partners', 'list', { roleFilter: 'PURCHASE' }],
    queryFn: () => api.get<Supplier[]>('/business-partners', { params: { role: 'PURCHASE' } }).then((r) => r.data),
    enabled: isEditing,
  });

  const editForm = useForm<EditAssetValues>({
    resolver: zodResolver(editAssetSchema) as Resolver<EditAssetValues>,
    values: asset
      ? {
          serialNumber: asset.serialNumber ?? '',
          supplierId: asset.supplier?.id ?? '',
          purchaseDate: asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : '',
          purchasePrice: asset.purchasePrice ?? undefined,
          memo: asset.memo ?? '',
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: EditAssetValues) =>
      api.patch(`/assets/${assetId}`, {
        serialNumber: data.serialNumber || undefined,
        supplierId: data.supplierId || undefined,
        purchaseDate: data.purchaseDate || undefined,
        purchasePrice: data.purchasePrice,
        memo: data.memo || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets', 'detail', assetId] });
      void queryClient.invalidateQueries({ queryKey: ['assets', 'list', { productId }] });
      toast.success('자산 정보가 수정되었습니다.');
      setIsEditing(false);
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      if (status === 409) toast.error('이미 등록된 시리얼 번호입니다.');
      else toast.error('수정 중 오류가 발생했습니다.');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ toStatus, note }: { toStatus: AssetStatus; note: string }) =>
      api.patch(`/assets/${assetId}/status`, { status: toStatus, note: note || undefined }),
    onSuccess: () => {
      toast.success('상태가 변경되었습니다.');
      void queryClient.invalidateQueries({ queryKey: ['assets', 'detail', assetId] });
      void queryClient.invalidateQueries({ queryKey: ['assets', 'events', assetId] });
      setStatusOpen(false);
      setPendingTransition(null);
      setStatusNote('');
      onChanged();
    },
    onError: () => toast.error('상태 변경 중 오류가 발생했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/assets/${assetId}`),
    onSuccess: () => {
      toast.success('자산이 삭제되었습니다.');
      onDeleted();
    },
    onError: () => toast.error('삭제 중 오류가 발생했습니다.'),
  });

  const transitions = MANUAL_STATUS_TRANSITIONS[currentStatus] ?? [];

  if (!asset) return <div className="p-4 text-sm text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 space-y-4">
      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => (
          <Button
            key={t.toStatus}
            size="sm"
            variant={t.variant}
            onClick={() => {
              setPendingTransition(t);
              setStatusOpen(true);
            }}
          >
            {t.label}
          </Button>
        ))}
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
              <DialogTitle>자산 삭제</DialogTitle>
              <DialogDescription>이 자산을 삭제하시겠습니까? 되돌릴 수 없습니다.</DialogDescription>
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

      {/* 상태 변경 메모 Dialog */}
      <Dialog
        open={statusOpen}
        onOpenChange={(open) => {
          setStatusOpen(open);
          if (!open) {
            setPendingTransition(null);
            setStatusNote('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingTransition?.label}</DialogTitle>
            <DialogDescription>메모를 입력하면 이벤트 이력에 기록됩니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">메모 (선택)</label>
            <Input placeholder="사유 또는 메모" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>
              취소
            </Button>
            <Button
              disabled={statusMutation.isPending}
              onClick={() => {
                if (pendingTransition) {
                  void statusMutation.mutate({ toStatus: pendingTransition.toStatus, note: statusNote });
                }
              }}
            >
              {statusMutation.isPending ? '변경 중...' : '확인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 자산 기본 정보 */}
      {isEditing ? (
        <Form {...editForm}>
          <form onSubmit={editForm.handleSubmit((d) => void updateMutation.mutate(d))} className="space-y-3">
            <FormField
              control={editForm.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>시리얼번호</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={editForm.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>매입처</FormLabel>
                  <FormControl>
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={editForm.control}
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
              <FormField
                control={editForm.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>매입가 (원)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={editForm.control}
              name="memo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>메모</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
            <dt className="text-muted-foreground">매입처</dt>
            <dd>{asset.supplier?.businessProfile.name ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">매입일</dt>
            <dd>{asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('ko-KR') : '-'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">매입가</dt>
            <dd>{asset.purchasePrice != null ? `${asset.purchasePrice.toLocaleString()}원` : '-'}</dd>
          </div>
          {asset.memo && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">메모</dt>
              <dd>{asset.memo}</dd>
            </div>
          )}
        </dl>
      )}

      <Separator />
      <EventSection assetId={assetId} />
      <Separator />
      <MeterReadingSection assetId={assetId} />
    </div>
  );
}

// ─── 이벤트 이력 섹션 ─────────────────────────────────────────────
function EventSection({ assetId }: { assetId: string }) {
  const { data: events = [], isLoading } = useQuery<AssetEvent[]>({
    queryKey: ['assets', 'events', assetId],
    queryFn: () => api.get<AssetEvent[]>(`/assets/${assetId}/events`).then((r) => r.data),
  });

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">이벤트 이력</h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">이벤트 이력이 없습니다.</p>
      ) : (
        <ol className="space-y-1">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground text-xs">
                {new Date(ev.createdAt).toLocaleDateString('ko-KR')}
              </span>
              <span className="flex items-center gap-1">
                {ev.fromStatus && (
                  <>
                    <Badge variant={ASSET_STATUS_VARIANT[ev.fromStatus]} className="text-xs">
                      {ASSET_STATUS_LABEL[ev.fromStatus]}
                    </Badge>
                    <span className="text-muted-foreground">→</span>
                  </>
                )}
                <Badge variant={ASSET_STATUS_VARIANT[ev.toStatus]} className="text-xs">
                  {ASSET_STATUS_LABEL[ev.toStatus]}
                </Badge>
              </span>
              <Badge variant="outline" className="text-xs">
                {SOURCE_LABEL[ev.sourceType] ?? ev.sourceType}
              </Badge>
              {ev.note && <span className="text-xs text-muted-foreground">{ev.note}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── 미터 리딩 섹션 ───────────────────────────────────────────────
function MeterReadingSection({ assetId }: { assetId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: readings = [], isLoading } = useQuery<MeterReading[]>({
    queryKey: ['assets', 'meter-readings', assetId],
    queryFn: () => api.get<MeterReading[]>(`/assets/${assetId}/meter-readings`).then((r) => r.data),
  });

  const form = useForm<MeterFormValues>({
    resolver: zodResolver(meterSchema) as Resolver<MeterFormValues>,
    defaultValues: { readingDate: '', blackCount: 0, note: '' },
  });

  const addMutation = useMutation({
    mutationFn: (data: MeterFormValues) =>
      api.post(`/assets/${assetId}/meter-readings`, {
        readingDate: data.readingDate,
        blackCount: Number(data.blackCount),
        colorCount: data.colorCount,
        note: data.note || undefined,
      }),
    onSuccess: () => {
      toast.success('검침이 등록되었습니다.');
      void queryClient.invalidateQueries({ queryKey: ['assets', 'meter-readings', assetId] });
      setShowForm(false);
      form.reset({ readingDate: '', blackCount: 0, note: '' });
    },
    onError: (err) => {
      const msg = (err as AxiosError<{ message?: string }>).response?.data?.message;
      toast.error(msg ?? '검침 등록 중 오류가 발생했습니다.');
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">미터 리딩</h3>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            + 검침 추가
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : readings.length > 0 ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-1 text-left font-medium">검침일</th>
              <th className="pb-1 text-right font-medium">흑백 누적</th>
              <th className="pb-1 text-right font-medium">컬러 누적</th>
              <th className="pb-1 text-right font-medium">흑백 사용</th>
              <th className="pb-1 text-right font-medium">컬러 사용</th>
              <th className="pb-1 text-left font-medium">방법</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-1">{new Date(r.readingDate).toLocaleDateString('ko-KR')}</td>
                <td className="py-1 text-right">{r.blackCount.toLocaleString()}</td>
                <td className="py-1 text-right">{r.colorCount?.toLocaleString() ?? '-'}</td>
                <td className="py-1 text-right">{r.blackUsage.toLocaleString()}</td>
                <td className="py-1 text-right">{r.colorUsage?.toLocaleString() ?? '-'}</td>
                <td className="py-1">{METHOD_LABEL[r.readingMethod] ?? r.readingMethod}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !showForm ? (
        <p className="text-sm text-muted-foreground">검침 기록이 없습니다.</p>
      ) : null}

      {showForm && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => void addMutation.mutate(d))}
            className="rounded-md border p-3 space-y-3 bg-muted/30"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="readingDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      검침일 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="blackCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      흑백 누적값 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="colorCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>컬러 누적값</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="없으면 비워두세요"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>메모</FormLabel>
                    <FormControl>
                      <Input placeholder="특이사항" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  form.reset();
                }}
              >
                취소
              </Button>
              <Button type="submit" size="sm" disabled={addMutation.isPending}>
                {addMutation.isPending ? '등록 중...' : '등록'}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
