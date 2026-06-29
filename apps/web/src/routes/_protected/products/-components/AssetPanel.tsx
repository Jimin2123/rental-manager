import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toastApiError } from '@/lib/api-error';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Form } from '@/components/ui/form';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { api } from '@/lib/api';
import type { AssetDetail, AssetStatus, StatusTransition, Supplier } from '../-types';
import { MANUAL_STATUS_TRANSITIONS } from '../-types';
import { assetKeys, fetchAsset, fetchPurchaseSuppliers, invalidateAssetStats, supplierKeys } from '../-api';
import { editAssetSchema, type EditAssetValues } from '../-schemas';
import { TextField, SupplierField } from './fields';
import { EventSection } from './EventSection';
import { MeterReadingSection } from './MeterReadingSection';

export function AssetPanel({
  assetId,
  productId,
  currentStatus,
  onDeleted,
}: {
  assetId: string;
  productId: string;
  currentStatus: AssetStatus;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<StatusTransition | null>(null);
  const [statusNote, setStatusNote] = useState('');

  const { data: asset } = useQuery<AssetDetail>({
    queryKey: assetKeys.detail(assetId),
    queryFn: () => fetchAsset(assetId),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: supplierKeys.purchaseList(),
    queryFn: fetchPurchaseSuppliers,
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
        serialNumber: data.serialNumber || null,
        supplierId: data.supplierId || null,
        purchaseDate: data.purchaseDate || null,
        purchasePrice: data.purchasePrice ?? null,
        memo: data.memo || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assetKeys.detail(assetId) });
      void queryClient.invalidateQueries({ queryKey: assetKeys.list(productId) });
      toast.success('자산 정보가 수정되었습니다.');
      setIsEditing(false);
    },
    onError: (err) => toastApiError(err, '수정 중 오류가 발생했습니다.', { 409: '이미 등록된 시리얼 번호입니다.' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ toStatus, note }: { toStatus: AssetStatus; note: string }) =>
      api.patch(`/assets/${assetId}/status`, { status: toStatus, note: note || undefined }),
    onSuccess: () => {
      toast.success('상태가 변경되었습니다.');
      void queryClient.invalidateQueries({ queryKey: assetKeys.detail(assetId) });
      void queryClient.invalidateQueries({ queryKey: assetKeys.events(assetId) });
      invalidateAssetStats(queryClient, productId);
      setStatusOpen(false);
      setPendingTransition(null);
      setStatusNote('');
    },
    onError: () => toast.error('상태 변경 중 오류가 발생했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/assets/${assetId}`),
    onSuccess: () => {
      toast.success('자산이 삭제되었습니다.');
      invalidateAssetStats(queryClient, productId);
      onDeleted();
    },
    onError: () => toast.error('삭제 중 오류가 발생했습니다.'),
  });

  const transitions = MANUAL_STATUS_TRANSITIONS[currentStatus] ?? [];

  if (!asset) return <div className="p-4 text-sm text-muted-foreground">불러오는 중...</div>;

  return (
    <div className="p-4 space-y-4">
      {/* 액션 바 */}
      <div className="flex items-center gap-2">
        {transitions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                상태 변경 <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {transitions.map((t) => (
                <DropdownMenuItem
                  key={t.toStatus}
                  className={t.variant === 'destructive' ? 'text-destructive focus:text-destructive' : ''}
                  onSelect={() => {
                    setPendingTransition(t);
                    setStatusOpen(true);
                  }}
                >
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setIsEditing(true)}>수정</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 자산 삭제 Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
            <TextField control={editForm.control} name="serialNumber" label="시리얼번호" />
            <SupplierField control={editForm.control} name="supplierId" suppliers={suppliers} />
            <div className="grid grid-cols-2 gap-3">
              <TextField control={editForm.control} name="purchaseDate" label="매입일" type="date" />
              <TextField control={editForm.control} name="purchasePrice" label="매입가 (원)" type="number" min={0} />
            </div>
            <TextField control={editForm.control} name="memo" label="메모" />
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
