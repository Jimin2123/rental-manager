import { useQuery } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
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
import type { BusinessPartnerDetail } from '../-types';
import { ROLE_LABEL } from '../-types';
import { assignmentKeys, fetchAssignments } from '../../customers/-api';
import { ROLE_LABEL as MEMBER_ROLE_LABEL } from '../../settings/members/-types';

type Props = {
  partner: BusinessPartnerDetail;
  customerId?: string;
  onEdit: () => void;
  onToggleStatus: () => void;
  isTogglingStatus: boolean;
  onDelete: () => void;
  isDeleting: boolean;
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR');

function AssignmentColumn({ customerId }: { customerId: string }) {
  const { data: assignments = [] } = useQuery({
    queryKey: assignmentKeys.list(customerId),
    queryFn: () => fetchAssignments(customerId),
  });
  const current = assignments.filter((a) => !a.endedAt);
  const ended = assignments.filter((a) => a.endedAt);

  return (
    <div className="border-l border-border pl-8 flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">담당 직원</p>
      {current.length === 0 ? (
        <p className="text-sm text-muted-foreground">배정 없음</p>
      ) : (
        current.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {a.organizationMember.name}
                <span className="text-muted-foreground font-normal text-xs ml-1">
                  ({MEMBER_ROLE_LABEL[a.organizationMember.role]})
                </span>
              </span>
              {a.role && <span className="text-xs text-muted-foreground">{a.role}</span>}
            </div>
            {a.isPrimary && (
              <span className="text-[10.5px] font-semibold text-muted-foreground border border-border rounded-full px-2 py-0.5 shrink-0">
                주담당
              </span>
            )}
          </div>
        ))
      )}
      {ended.length > 0 && (
        <>
          <Separator className="my-1" />
          <p className="text-xs font-medium text-muted-foreground">이전 담당자</p>
          {ended.map((a) => (
            <div key={a.id} className="flex items-start justify-between gap-2 opacity-50">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {a.organizationMember.name}
                  <span className="text-muted-foreground font-normal text-xs ml-1">
                    ({MEMBER_ROLE_LABEL[a.organizationMember.role]})
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(a.startedAt)} ~ {formatDate(a.endedAt!)}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-all">{value}</span>
    </div>
  );
}

export function PartnerProfileCard({ partner, customerId, onEdit, onToggleStatus, isTogglingStatus, onDelete, isDeleting }: Props) {
  const bp = partner.businessProfile;

  return (
    <div className="rounded-xl border bg-card p-6 flex flex-col gap-5">
      {/* 헤더: 이름 + 배지 + 액션 */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-foreground">{bp.name}</h1>
          <span className="text-xs font-semibold text-muted-foreground border border-border rounded-full px-2.5 py-1">
            거래처
          </span>
          <span
            className={[
              'text-xs font-semibold rounded-full px-2.5 py-1',
              partner.isActive
                ? 'border border-green-600/40 text-green-700 bg-green-50'
                : 'border border-red-300 text-red-600 bg-red-50',
            ].join(' ')}
          >
            {partner.isActive ? '활성' : '거래정지'}
          </span>
          {partner.roles.map((r) => (
            <span
              key={r.id}
              className="text-xs font-semibold text-muted-foreground border border-border rounded-full px-2.5 py-1"
            >
              {ROLE_LABEL[r.type]}
            </span>
          ))}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onEdit}>
            수정
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleStatus}
            disabled={isTogglingStatus}
            className={partner.isActive ? 'text-destructive hover:text-destructive' : ''}
          >
            {partner.isActive ? '거래 정지' : '거래 재개'}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
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
                <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
                  {isDeleting ? '삭제 중...' : '삭제'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      {/* 정보 그리드: 사업자정보 | 거래처담당자 | 담당직원 */}
      <div className={`grid gap-x-8 ${customerId ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {/* 사업자 정보 */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">사업자 정보</p>
          <InfoRow label="사업자번호" value={bp.businessRegistrationNo} />
          <InfoRow label="대표자" value={bp.representativeName} />
          {(bp.businessType ?? bp.businessItem) && (
            <InfoRow
              label="업태/종목"
              value={[bp.businessType, bp.businessItem].filter(Boolean).join(' / ')}
            />
          )}
          {bp.phone && <InfoRow label="연락처" value={bp.phone} />}
          {bp.email && <InfoRow label="이메일" value={bp.email} />}
          {bp.address && <InfoRow label="주소" value={bp.address.address} />}
          {partner.memo && <InfoRow label="메모" value={partner.memo} />}
        </div>

        {/* 거래처 담당자 */}
        <div className="border-l border-border pl-8 flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">거래처 담당자</p>
          {partner.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">담당자 없음</p>
          ) : (
            partner.contacts.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{c.name}</span>
                  {(c.department ?? c.position) && (
                    <span className="text-xs text-muted-foreground">
                      {[c.department, c.position].filter(Boolean).join(' · ')}
                    </span>
                  )}
                  {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                </div>
                {c.isPrimary && (
                  <span className="text-[10.5px] font-semibold text-muted-foreground border border-border rounded-full px-2 py-0.5 shrink-0">
                    대표
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* 담당 직원 */}
        {customerId && <AssignmentColumn customerId={customerId} />}
      </div>
    </div>
  );
}
