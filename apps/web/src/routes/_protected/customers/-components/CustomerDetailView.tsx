import { toast } from 'sonner';
import { Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import type { Address, CustomerDetail } from '../-types';
import { CUSTOMER_TYPE_LABEL } from '../-types';

function formatAddress(address: Address | null): string {
  if (!address) return '-';
  return `${address.address}${address.addressDetail ? ` ${address.addressDetail}` : ''} (${address.zonecode})`;
}

export function CustomerDetailView({
  customer,
  onEdit,
  onChanged,
  onDeleted,
}: {
  customer: CustomerDetail;
  onEdit: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const toggleActive = useMutation({
    mutationFn: () => api.patch(`/customers/${customer.id}`, { isActive: !customer.isActive }),
    onSuccess: () => {
      toast.success(customer.isActive ? '거래 정지 처리되었습니다.' : '거래 재개 처리되었습니다.');
      onChanged();
    },
    onError: () => toast.error('상태 변경 중 오류가 발생했습니다.'),
  });

  const softDelete = useMutation({
    mutationFn: () => api.delete(`/customers/${customer.id}`),
    onSuccess: () => {
      toast.success('고객이 삭제되었습니다.');
      onDeleted();
    },
    onError: () => toast.error('삭제 중 오류가 발생했습니다.'),
  });

  const isIndividual = customer.type === 'INDIVIDUAL';
  const profile = customer.individualProfile;
  const bp = customer.businessPartner;
  const displayName = isIndividual ? (profile?.name ?? '-') : (bp?.businessProfile.name ?? '-');

  return (
    <div className="space-y-4">
      {/* 액션 버튼 — 개인만 변경 가능, 법인은 읽기 전용 */}
      {isIndividual && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void toggleActive.mutate()}
            disabled={toggleActive.isPending}
          >
            {customer.isActive ? '거래 정지' : '거래 재개'}
          </Button>
          <Button size="sm" onClick={onEdit}>
            수정
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                삭제
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>고객 삭제</DialogTitle>
                <DialogDescription>
                  &ldquo;{displayName}&rdquo;을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">취소</Button>
                </DialogClose>
                <Button variant="destructive" onClick={() => void softDelete.mutate()} disabled={softDelete.isPending}>
                  {softDelete.isPending ? '삭제 중...' : '삭제'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">고객 정보</h2>
          <Badge variant="secondary">{CUSTOMER_TYPE_LABEL[customer.type]}</Badge>
        </div>
        <Separator />

        {isIndividual ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">이름</dt>
              <dd className="font-medium">{profile?.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">상태</dt>
              <dd>
                <Badge variant={customer.isActive ? 'default' : 'outline'}>
                  {customer.isActive ? '활성' : '거래정지'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">전화</dt>
              <dd>{profile?.phone ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">이메일</dt>
              <dd>{profile?.email ?? '-'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">주소</dt>
              <dd>{formatAddress(profile?.address ?? null)}</dd>
            </div>
          </dl>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">상호명</dt>
                <dd className="font-medium">{bp?.businessProfile.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">사업자번호</dt>
                <dd>{bp?.businessProfile.businessRegistrationNo}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">대표자명</dt>
                <dd>{bp?.businessProfile.representativeName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">상태</dt>
                <dd>
                  <Badge variant={customer.isActive ? 'default' : 'outline'}>
                    {customer.isActive ? '활성' : '거래정지'}
                  </Badge>
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">주소</dt>
                <dd>{formatAddress(bp?.businessProfile.address ?? null)}</dd>
              </div>
            </dl>
            {bp && (
              <Link
                to="/business-partners/$id"
                params={{ id: bp.id }}
                className="inline-block text-xs text-primary underline-offset-2 hover:underline"
              >
                거래처에서 관리 →
              </Link>
            )}
          </>
        )}

        {customer.memo && <p className="text-sm text-muted-foreground">메모: {customer.memo}</p>}
      </div>
    </div>
  );
}
