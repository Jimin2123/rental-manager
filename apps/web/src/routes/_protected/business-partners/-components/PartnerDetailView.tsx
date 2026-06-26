import { toast } from 'sonner';
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
import type { BusinessPartnerDetail } from '../-types';
import { ROLE_LABEL } from '../-types';
import { ContactSection } from './ContactSection';

export function PartnerDetailView({
  partner,
  onEdit,
  onChanged,
  onDeleted,
}: {
  partner: BusinessPartnerDetail;
  onEdit: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const toggleActive = useMutation({
    mutationFn: () => api.patch(`/business-partners/${partner.id}`, { isActive: !partner.isActive }),
    onSuccess: () => {
      toast.success(partner.isActive ? '거래 정지 처리되었습니다.' : '거래 재개 처리되었습니다.');
      onChanged();
    },
    onError: () => toast.error('상태 변경 중 오류가 발생했습니다.'),
  });

  const softDelete = useMutation({
    mutationFn: () => api.delete(`/business-partners/${partner.id}`),
    onSuccess: () => {
      toast.success('거래처가 삭제되었습니다.');
      onDeleted();
    },
    onError: () => toast.error('삭제 중 오류가 발생했습니다.'),
  });

  const bp = partner.businessProfile;

  return (
    <div className="space-y-4">
      {/* 액션 버튼 */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void toggleActive.mutate()}
          disabled={toggleActive.isPending}
        >
          {partner.isActive ? '거래 정지' : '거래 재개'}
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
              <DialogTitle>거래처 삭제</DialogTitle>
              <DialogDescription>
                &ldquo;{bp.name}&rdquo;을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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

      {/* 사업자 정보 */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">사업자 정보</h2>
        <Separator />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">상호명</dt>
            <dd className="font-medium">{bp.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">사업자번호</dt>
            <dd>{bp.businessRegistrationNo}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">대표자명</dt>
            <dd>{bp.representativeName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">상태</dt>
            <dd>
              <Badge variant={partner.isActive ? 'default' : 'outline'}>{partner.isActive ? '활성' : '거래정지'}</Badge>
            </dd>
          </div>
          {bp.businessType && (
            <div>
              <dt className="text-muted-foreground">업태</dt>
              <dd>{bp.businessType}</dd>
            </div>
          )}
          {bp.businessItem && (
            <div>
              <dt className="text-muted-foreground">종목</dt>
              <dd>{bp.businessItem}</dd>
            </div>
          )}
          {bp.phone && (
            <div>
              <dt className="text-muted-foreground">대표전화</dt>
              <dd>{bp.phone}</dd>
            </div>
          )}
          {bp.email && (
            <div>
              <dt className="text-muted-foreground">대표이메일</dt>
              <dd>{bp.email}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-muted-foreground">주소</dt>
            <dd>
              {bp.address.address}
              {bp.address.addressDetail ? ` ${bp.address.addressDetail}` : ''} ({bp.address.zonecode})
            </dd>
          </div>
        </dl>
        <div>
          <span className="text-xs text-muted-foreground mr-2">역할</span>
          {partner.roles.map((r) => (
            <Badge key={r.id} variant={r.type === 'SALES' ? 'default' : 'secondary'} className="mr-1">
              {ROLE_LABEL[r.type]}
            </Badge>
          ))}
        </div>
        {partner.memo && <p className="text-sm text-muted-foreground">메모: {partner.memo}</p>}
      </div>

      {/* 담당자 */}
      <ContactSection partnerId={partner.id} contacts={partner.contacts} onChanged={onChanged} />
    </div>
  );
}
