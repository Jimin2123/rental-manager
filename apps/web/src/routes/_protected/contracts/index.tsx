import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ContractListItem, ContractStatus } from './-types';
import { CONTRACT_STATUS_LABEL, customerNameOf, contractMonthlyTotal } from './-types';
import { contractKeys, fetchContracts } from './-api';

export const Route = createFileRoute('/_protected/contracts/')({
  component: ContractsPage,
});

type StatusFilter = 'ALL' | ContractStatus;

function ContractsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>('ALL');

  const { data = [], isLoading } = useQuery<ContractListItem[]>({
    queryKey: contractKeys.list(),
    queryFn: fetchContracts,
  });
  const rows = status === 'ALL' ? data : data.filter((c) => c.status === status);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">계약</h1>
      </div>

      <div className="mb-4 flex gap-1">
        {(['ALL', 'DRAFT', 'ACTIVE', 'ENDED', 'CANCELED'] as const).map((s) => (
          <Button key={s} variant={status === s ? 'default' : 'outline'} size="sm" onClick={() => setStatus(s)}>
            {s === 'ALL' ? '전체' : CONTRACT_STATUS_LABEL[s]}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>계약번호</TableHead>
              <TableHead>고객</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>기간</TableHead>
              <TableHead className="text-right">항목</TableHead>
              <TableHead className="text-right">월 렌탈료</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  계약이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/contracts/$id', params: { id: c.id } })}
                >
                  <TableCell className="font-medium">{c.contractNo}</TableCell>
                  <TableCell>{customerNameOf(c.rentalOrder.order.customer)}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {CONTRACT_STATUS_LABEL[c.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(c.startDate).toLocaleDateString('ko-KR')} ~{' '}
                    {new Date(c.endDate).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell className="text-right">{c.items.length}</TableCell>
                  <TableCell className="text-right">
                    {contractMonthlyTotal(c.items).toLocaleString('ko-KR')}원
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
