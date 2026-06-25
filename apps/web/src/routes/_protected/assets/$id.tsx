import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { AssetDetail, AssetEvent, AssetStatus, MeterReading } from './-types';
import { ASSET_STATUS_LABEL, ASSET_STATUS_VARIANT } from './-types';

export const Route = createFileRoute('/_protected/assets/$id')({
  component: AssetDetailPage,
});

type Supplier = { id: string; businessProfile: { name: string } };

// ─── 편집 폼 스키마 ───────────────────────────────────────────────
const editSchema = z.object({
  serialNumber: z.string().optional(),
  supplierId: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(0).optional()),
  memo: z.string().optional(),
});
type EditFormValues = z.infer<typeof editSchema>;

// ─── 상태 변경 폼 스키마 ──────────────────────────────────────────
const statusSchema = z.object({
  status: z.enum([
    'INCOMING', 'AVAILABLE', 'RENTED', 'SOLD',
    'REPAIR', 'DISPOSED', 'LOST', 'UNAVAILABLE',
  ] as const),
  note: z.string().optional(),
});
type StatusFormValues = z.infer<typeof statusSchema>;

// ─── 미터 리딩 폼 스키마 ─────────────────────────────────────────
const meterSchema = z.object({
  readingDate: z.string().min(1, '검침일을 입력해주세요.'),
  blackCount: z.coerce.number().int().min(0, '0 이상의 값을 입력해주세요.'),
  colorCount: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(0).optional()),
  note: z.string().optional(),
});
type MeterFormValues = z.infer<typeof meterSchema>;

// ─── 메인 페이지 ─────────────────────────────────────────────────
function AssetDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: asset, isLoading } = useQuery<AssetDetail>({
    queryKey: ['assets', 'detail', id],
    queryFn: () => api.get<AssetDetail>(`/assets/${id}`).then((r) => r.data),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['assets', 'detail', id] });
    void queryClient.invalidateQueries({ queryKey: ['assets', 'list'] });
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중...</div>;
  if (!asset) return <div className="p-6 text-muted-foreground">자산을 찾을 수 없습니다.</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/assets' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">
          {asset.product.name}{' '}
          <span className="text-base font-normal text-muted-foreground">
            {asset.serialNumber ?? 'S/N 미등록'}
          </span>
        </h1>
        <Badge variant={ASSET_STATUS_VARIANT[asset.status]} className="ml-auto">
          {ASSET_STATUS_LABEL[asset.status]}
        </Badge>
      </div>

      <div className="space-y-4">
        <InfoCard
          asset={asset}
          isEditing={isEditing}
          onEdit={() => setIsEditing(true)}
          onCancel={() => setIsEditing(false)}
          onSaved={() => { setIsEditing(false); invalidate(); }}
          onStatusChanged={invalidate}
          onDeleted={() => void navigate({ to: '/assets' })}
        />
        <EventSection assetId={id} />
        <MeterReadingSection assetId={id} />
      </div>
    </div>
  );
}

// ─── 기본 정보 카드 ───────────────────────────────────────────────
function InfoCard({
  asset, isEditing, onEdit, onCancel, onSaved, onStatusChanged, onDeleted,
}: {
  asset: AssetDetail;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onStatusChanged: () => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['business-partners', 'list', { roleFilter: 'PURCHASE' }],
    queryFn: () =>
      api.get<Supplier[]>('/business-partners', { params: { role: 'PURCHASE' } }).then((r) => r.data),
    enabled: isEditing,
  });

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema) as Resolver<EditFormValues>,
    defaultValues: {
      serialNumber: asset.serialNumber ?? '',
      supplierId: asset.supplier?.id ?? '',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : '',
      purchasePrice: asset.purchasePrice ?? undefined,
      memo: asset.memo ?? '',
    },
  });

  const statusForm = useForm<StatusFormValues>({
    resolver: zodResolver(statusSchema),
    defaultValues: { note: '' },
  });

  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    form.reset({
      serialNumber: asset.serialNumber ?? '',
      supplierId: asset.supplier?.id ?? '',
      purchaseDate: asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : '',
      purchasePrice: asset.purchasePrice ?? undefined,
      memo: asset.memo ?? '',
    });
  }, [asset, form]);

  const updateMutation = useMutation({
    mutationFn: (data: EditFormValues) =>
      api.patch(`/assets/${asset.id}`, {
        serialNumber: data.serialNumber || undefined,
        supplierId: data.supplierId || undefined,
        purchaseDate: data.purchaseDate || undefined,
        purchasePrice: data.purchasePrice,
        memo: data.memo || undefined,
      }),
    onSuccess: () => { toast.success('자산 정보가 수정되었습니다.'); onSaved(); },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      if (status === 409) toast.error('이미 등록된 시리얼 번호입니다.');
      else toast.error('수정 중 오류가 발생했습니다.');
    },
  });

  const statusMutation = useMutation({
    mutationFn: (data: StatusFormValues) =>
      api.patch(`/assets/${asset.id}/status`, { status: data.status, note: data.note || undefined }),
    onSuccess: () => {
      toast.success('상태가 변경되었습니다.');
      setStatusOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['assets', 'events', asset.id] });
      onStatusChanged();
    },
    onError: () => toast.error('상태 변경 중 오류가 발생했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/assets/${asset.id}`),
    onSuccess: () => { toast.success('자산이 삭제되었습니다.'); onDeleted(); },
    onError: () => toast.error('삭제 중 오류가 발생했습니다.'),
  });

  const otherStatuses = (
    ['INCOMING', 'AVAILABLE', 'RENTED', 'SOLD', 'REPAIR', 'DISPOSED', 'LOST', 'UNAVAILABLE'] as AssetStatus[]
  ).filter((s) => s !== asset.status);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* 액션 버튼 */}
      <div className="flex justify-end gap-2">
        {/* 상태 변경 Dialog */}
        <Dialog open={statusOpen} onOpenChange={(open) => { setStatusOpen(open); if (!open) statusForm.reset({ note: '' }); }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => setStatusOpen(true)}>상태 변경</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>상태 변경</DialogTitle>
              <DialogDescription>
                현재 상태: {ASSET_STATUS_LABEL[asset.status]}
              </DialogDescription>
            </DialogHeader>
            <Form {...statusForm}>
              <form
                onSubmit={statusForm.handleSubmit((d) => void statusMutation.mutate(d))}
                className="space-y-4"
              >
                <FormField
                  control={statusForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>변경할 상태 <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="상태 선택..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {otherStatuses.map((s) => (
                            <SelectItem key={s} value={s}>{ASSET_STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={statusForm.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>메모</FormLabel>
                      <FormControl><Input placeholder="변경 사유" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={statusMutation.isPending}>
                    {statusMutation.isPending ? '변경 중...' : '변경'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {!isEditing && (
          <Button size="sm" onClick={onEdit}>수정</Button>
        )}

        {/* 삭제 확인 Dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">삭제</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>자산 삭제</DialogTitle>
              <DialogDescription>
                이 자산을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogTrigger asChild>
                <Button variant="outline">취소</Button>
              </DialogTrigger>
              <Button
                variant="destructive"
                onClick={() => void deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 제품 정보 (읽기 전용) */}
      <div>
        <h2 className="text-sm font-semibold mb-2">제품 정보</h2>
        <Separator className="mb-3" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><dt className="text-muted-foreground">제품명</dt><dd>{asset.product.name}</dd></div>
          <div><dt className="text-muted-foreground">카테고리</dt><dd>{asset.product.category ?? '-'}</dd></div>
          <div><dt className="text-muted-foreground">제조사</dt><dd>{asset.product.manufacturer ?? '-'}</dd></div>
          <div><dt className="text-muted-foreground">모델명</dt><dd>{asset.product.modelName ?? '-'}</dd></div>
        </dl>
      </div>

      <Separator />

      {/* 자산 정보 (편집 가능) */}
      {isEditing ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => void updateMutation.mutate(d))} className="space-y-3">
            <h2 className="text-sm font-semibold">자산 정보</h2>
            <FormField
              control={form.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>시리얼번호</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      <option key={s.id} value={s.id}>{s.businessProfile.name}</option>
                    ))}
                  </select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>매입일</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>매입가 (원)</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="memo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>메모</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>취소</Button>
              <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        <div>
          <h2 className="text-sm font-semibold mb-2">자산 정보</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">시리얼번호</dt>
              <dd>{asset.serialNumber ?? '-'}</dd>
            </div>
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
        </div>
      )}
    </div>
  );
}

// ─── 이벤트 이력 섹션 ─────────────────────────────────────────────
function EventSection({ assetId }: { assetId: string }) {
  const { data: events = [], isLoading } = useQuery<AssetEvent[]>({
    queryKey: ['assets', 'events', assetId],
    queryFn: () => api.get<AssetEvent[]>(`/assets/${assetId}/events`).then((r) => r.data),
  });

  const SOURCE_LABEL: Record<string, string> = {
    RENTAL_CONTRACT: '렌탈 계약',
    RENTAL_CONTRACT_ITEM: '계약 장비',
    SALE_ORDER: '판매',
    SERVICE_REQUEST: 'AS 접수',
    SERVICE_VISIT: 'AS 방문',
    MANUAL: '수동',
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold">이벤트 이력</h2>
      <Separator />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">이벤트 이력이 없습니다.</p>
      ) : (
        <ol className="space-y-2">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-start gap-3 text-sm">
              <span className="w-32 shrink-0 text-muted-foreground">
                {new Date(ev.createdAt).toLocaleDateString('ko-KR')}
              </span>
              <span>
                {ev.fromStatus ? (
                  <>
                    <Badge variant={ASSET_STATUS_VARIANT[ev.fromStatus]} className="text-xs">
                      {ASSET_STATUS_LABEL[ev.fromStatus]}
                    </Badge>
                    {' → '}
                  </>
                ) : null}
                <Badge variant={ASSET_STATUS_VARIANT[ev.toStatus]} className="text-xs">
                  {ASSET_STATUS_LABEL[ev.toStatus]}
                </Badge>
              </span>
              <Badge variant="outline" className="text-xs">
                {SOURCE_LABEL[ev.sourceType] ?? ev.sourceType}
              </Badge>
              {ev.note && <span className="text-muted-foreground">{ev.note}</span>}
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
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: readings = [], isLoading } = useQuery<MeterReading[]>({
    queryKey: ['assets', 'meter-readings', assetId],
    queryFn: () =>
      api.get<MeterReading[]>(`/assets/${assetId}/meter-readings`).then((r) => r.data),
  });

  const form = useForm<MeterFormValues>({
    resolver: zodResolver(meterSchema) as Resolver<MeterFormValues>,
    defaultValues: { readingDate: '', blackCount: 0, colorCount: undefined, note: '' },
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
      setShowAddForm(false);
      form.reset({ readingDate: '', blackCount: 0, colorCount: undefined, note: '' });
    },
    onError: (err) => {
      const msg = (err as AxiosError<{ message?: string }>).response?.data?.message;
      toast.error(msg ?? '검침 등록 중 오류가 발생했습니다.');
    },
  });

  const METHOD_LABEL: Record<string, string> = {
    MANUAL: '수동', PHOTO: '사진', REMOTE: '원격',
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">미터 리딩</h2>
        {!showAddForm && (
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
            + 검침 추가
          </Button>
        )}
      </div>
      <Separator />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : readings.length === 0 && !showAddForm ? (
        <p className="text-sm text-muted-foreground">검침 기록이 없습니다.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-2 text-left font-medium">검침일</th>
              <th className="pb-2 text-right font-medium">흑백 누적</th>
              <th className="pb-2 text-right font-medium">컬러 누적</th>
              <th className="pb-2 text-right font-medium">흑백 사용</th>
              <th className="pb-2 text-right font-medium">컬러 사용</th>
              <th className="pb-2 text-left font-medium">방법</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-1.5">{new Date(r.readingDate).toLocaleDateString('ko-KR')}</td>
                <td className="py-1.5 text-right">{r.blackCount.toLocaleString()}</td>
                <td className="py-1.5 text-right">{r.colorCount?.toLocaleString() ?? '-'}</td>
                <td className="py-1.5 text-right">{r.blackUsage.toLocaleString()}</td>
                <td className="py-1.5 text-right">{r.colorUsage?.toLocaleString() ?? '-'}</td>
                <td className="py-1.5">{METHOD_LABEL[r.readingMethod] ?? r.readingMethod}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAddForm && (
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
                    <FormControl><Input type="date" {...field} /></FormControl>
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
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
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
                    <FormControl><Input type="number" min={0} placeholder="없으면 비워두세요" {...field} /></FormControl>
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
                    <FormControl><Input placeholder="특이사항" {...field} /></FormControl>
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
                onClick={() => { setShowAddForm(false); form.reset(); }}
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
