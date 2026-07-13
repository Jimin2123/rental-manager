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
import { date } from '@/lib/format';
import { assignmentKeys, fetchAssignments } from '../-api';
import { fetchPartner, partnerKeys } from '../../business-partners/-api';
import { ROLE_LABEL as PARTNER_ROLE_LABEL } from '../../business-partners/-types';
import { ROLE_LABEL as MEMBER_ROLE_LABEL } from '../../settings/members/-types';
import type { CustomerDetail } from '../-types';

type Props = {
  customer: CustomerDetail;
  onEdit: () => void;
  onToggleStatus: () => void;
  isTogglingStatus: boolean;
  onDelete: () => void;
  isDeleting: boolean;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-all">{value}</span>
    </div>
  );
}

function AssignmentColumn({ customerId }: { customerId: string }) {
  const { data: assignments = [] } = useQuery({
    queryKey: assignmentKeys.list(customerId),
    queryFn: () => fetchAssignments(customerId),
  });

  const current = assignments.filter((a) => !a.endedAt);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">담당 직원</p>
      {current.length === 0 ? (
        <p className="text-sm text-muted-foreground">배정 없음</p>
      ) : (
        current.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {a.organizationMember.name}
                <span className="text-muted-foreground font-normal">
                  {' '}({MEMBER_ROLE_LABEL[a.organizationMember.role]})
                </span>
              </span>
              <span className="text-xs text-muted-foreground">배정일 {date(a.startedAt)} ~</span>
            </div>
            {a.isPrimary && (
              <span className="text-[10.5px] font-semibold text-muted-foreground border border-border rounded-full px-2 py-0.5 shrink-0">
                주 담당
              </span>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function ContactsColumn({ partnerId }: { partnerId: string }) {
  const { data: partner } = useQuery({
    queryKey: partnerKeys.detail(partnerId),
    queryFn: () => fetchPartner(partnerId),
  });

  const contacts = partner?.contacts ?? [];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">거래처 담당자</p>
      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">담당자 없음</p>
      ) : (
        contacts.map((c) => (
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
  );
}

export function CustomerProfileCard({ customer, onEdit, onToggleStatus, isTogglingStatus, onDelete, isDeleting }: Props) {
  const isIndividual = customer.type === 'INDIVIDUAL';
  const name =
    customer.individualProfile?.name ??
    customer.businessPartner?.businessProfile.name ??
    '고객';

  const roles = customer.businessPartner?.roles ?? [];
  const bp = customer.businessPartner?.businessProfile;
  const ip = customer.individualProfile;

  return (
    <div className="rounded-xl border bg-card p-6 flex flex-col gap-5">
      {/* 헤더: 이름 + 배지 + 액션 */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-foreground">{name}</h1>
          <span className="text-xs font-semibold text-muted-foreground border border-border rounded-full px-2.5 py-1">
            {isIndividual ? '개인' : '거래처'}
          </span>
          <span
            className={[
              'text-xs font-semibold rounded-full px-2.5 py-1',
              customer.isActive
                ? 'border border-green-600/40 text-green-700 bg-green-50'
                : 'border border-red-300 text-red-600 bg-red-50',
            ].join(' ')}
          >
            {customer.isActive ? '활성' : '거래정지'}
          </span>
          {roles.map((r) => (
            <span
              key={r.id}
              className="text-xs font-semibold text-muted-foreground border border-border rounded-full px-2.5 py-1"
            >
              {PARTNER_ROLE_LABEL[r.type]}
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
            className={customer.isActive ? 'text-destructive hover:text-destructive' : ''}
          >
            {customer.isActive ? '거래 정지' : '거래 재개'}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                삭제
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>고객 삭제</DialogTitle>
                <DialogDescription>
                  &ldquo;{name}&rdquo;을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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

      {/* 정보 그리드 */}
      <div
        className={[
          'grid gap-x-8',
          isIndividual ? 'grid-cols-2' : 'grid-cols-3',
        ].join(' ')}
      >
        {/* 기본정보 or 사업자정보 */}
        {isIndividual ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">기본 정보</p>
            {ip?.phone && <InfoRow label="연락처" value={ip.phone} />}
            {ip?.email && <InfoRow label="이메일" value={ip.email} />}
            {ip?.address && <InfoRow label="주소" value={ip.address.address} />}
            {customer.memo && <InfoRow label="메모" value={customer.memo} />}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">사업자 정보</p>
            {bp?.businessRegistrationNo && <InfoRow label="사업자번호" value={bp.businessRegistrationNo} />}
            {bp?.representativeName && <InfoRow label="대표자" value={bp.representativeName} />}
            {(bp?.businessType ?? bp?.businessItem) && (
              <InfoRow
                label="업태/종목"
                value={[bp?.businessType, bp?.businessItem].filter(Boolean).join(' / ')}
              />
            )}
            {bp?.phone && <InfoRow label="연락처" value={bp.phone} />}
            {bp?.address && <InfoRow label="주소" value={bp.address.address} />}
          </div>
        )}

        {/* 거래처 담당자 (사업자만) */}
        {!isIndividual && customer.businessPartner && (
          <div className="border-l border-border pl-8">
            <ContactsColumn partnerId={customer.businessPartner.id} />
          </div>
        )}

        {/* 담당 직원 */}
        <div className="border-l border-border pl-8">
          <AssignmentColumn customerId={customer.id} />
        </div>
      </div>
    </div>
  );
}
