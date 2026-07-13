import { useQuery } from '@tanstack/react-query';
import { Separator } from '@/components/ui/separator';
import { date } from '@/lib/format';
import { assignmentKeys, fetchAssignments } from '../-api';
import { ROLE_LABEL as MEMBER_ROLE_LABEL } from '../../settings/members/-types';

export function AssignmentColumn({ customerId, showEnded = false }: { customerId: string; showEnded?: boolean }) {
  const { data: assignments = [] } = useQuery({
    queryKey: assignmentKeys.list(customerId),
    queryFn: () => fetchAssignments(customerId),
  });
  const current = assignments.filter((a) => !a.endedAt);
  const ended = assignments.filter((a) => a.endedAt);

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
                <span className="text-muted-foreground font-normal text-xs ml-1">
                  ({MEMBER_ROLE_LABEL[a.organizationMember.role]})
                </span>
              </span>
              {a.role && <span className="text-xs text-muted-foreground">{a.role}</span>}
              <span className="text-xs text-muted-foreground">배정일 {date(a.startedAt)} ~</span>
            </div>
            {a.isPrimary && (
              <span className="text-[10.5px] font-semibold text-muted-foreground border border-border rounded-full px-2 py-0.5 shrink-0">
                주담당
              </span>
            )}
          </div>
        ))
      )}
      {showEnded && ended.length > 0 && (
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
                  {date(a.startedAt)} ~ {date(a.endedAt!)}
                </span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
