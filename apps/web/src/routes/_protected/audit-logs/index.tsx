import { createFileRoute } from '@tanstack/react-router';
import { Fragment, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AuditLogItem, AuditAction } from './-types';
import { AUDIT_ACTION_LABEL, targetTypeLabel } from './-types';
import type { AuditLogFilters } from './-api';
import { auditLogKeys, fetchAuditLogs } from './-api';
import { Pagination } from '@/components/ui/pagination';
import { PAGE_SIZE } from '@/lib/pagination';

export const Route = createFileRoute('/_protected/audit-logs/')({
  component: AuditLogsPage,
});

type ActionFilter = 'ALL' | AuditAction;

function AuditLogsPage() {
  const [action, setAction] = useState<ActionFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filters: AuditLogFilters = {
    ...(action !== 'ALL' && { action }),
  };

  const { data, isLoading } = useQuery({
    queryKey: auditLogKeys.list(filters, page),
    queryFn: () => fetchAuditLogs(filters, page),
    placeholderData: keepPreviousData,
  });
  const logs = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">감사로그</h1>
      </div>

      <div className="mb-4 flex items-center gap-1">
        {(['ALL', 'CREATE', 'UPDATE', 'STATUS_CHANGE', 'CANCEL'] as const).map((a) => (
          <Button
            key={a}
            variant={action === a ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setAction(a);
              setPage(1);
            }}
          >
            {a === 'ALL' ? '전체' : AUDIT_ACTION_LABEL[a]}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>시각</TableHead>
              <TableHead>행위</TableHead>
              <TableHead>대상</TableHead>
              <TableHead>대상 ID</TableHead>
              <TableHead>행위자</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  감사로그가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <Fragment key={log.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <TableCell>{new Date(log.createdAt).toLocaleString('ko-KR')}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{AUDIT_ACTION_LABEL[log.action]}</Badge>
                    </TableCell>
                    <TableCell>{targetTypeLabel(log.targetType)}</TableCell>
                    <TableCell className="font-mono text-xs">{log.targetId}</TableCell>
                    <TableCell>{log.actor?.name ?? '시스템'}</TableCell>
                  </TableRow>
                  {expandedId === log.id && (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-muted/30">
                        <LogDetail log={log} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && <Pagination page={page} limit={PAGE_SIZE} total={total} onPage={setPage} />}
    </div>
  );
}

function LogDetail({ log }: { log: AuditLogItem }) {
  const hasBefore = log.before != null;
  const hasAfter = log.after != null;
  return (
    <div className="space-y-3 p-2 text-xs">
      {log.reason && (
        <p>
          <span className="font-medium text-muted-foreground">사유: </span>
          {log.reason}
        </p>
      )}
      {!hasBefore && !hasAfter ? (
        <p className="text-muted-foreground">변경 데이터 없음</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 font-medium text-muted-foreground">변경 전</p>
            <pre className="overflow-auto rounded bg-background p-2">
              {hasBefore ? JSON.stringify(log.before, null, 2) : '-'}
            </pre>
          </div>
          <div>
            <p className="mb-1 font-medium text-muted-foreground">변경 후</p>
            <pre className="overflow-auto rounded bg-background p-2">
              {hasAfter ? JSON.stringify(log.after, null, 2) : '-'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
