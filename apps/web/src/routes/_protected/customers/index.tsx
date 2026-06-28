import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CustomerListItem } from './-types';
import { CUSTOMER_TYPE_LABEL } from './-types';
import { customerKeys, fetchCustomers } from './-api';

export const Route = createFileRoute('/_protected/customers/')({
  component: CustomersPage,
});

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const STATUS_LABEL: Record<StatusFilter, string> = {
  ALL: '전체',
  ACTIVE: '활성',
  INACTIVE: '거래정지',
};

// 이름은 개인=프로필명, 법인=상호명. 연락처/이메일은 개인 프로필에서만 노출된다.
function nameOf(c: CustomerListItem): string {
  return c.individualProfile?.name ?? c.businessPartner?.businessProfile.name ?? '-';
}

function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');

  const filters = {
    q: search || undefined,
    isActive: status === 'ALL' ? undefined : status === 'ACTIVE',
  };
  const { data = [], isLoading } = useQuery<CustomerListItem[]>({
    queryKey: customerKeys.list(filters),
    queryFn: () => fetchCustomers(filters),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">고객</h1>
        <Button onClick={() => void navigate({ to: '/customers/new' })}>고객 등록</Button>
      </div>

      <div className="mb-4 flex gap-3">
        <Input
          placeholder="이름·전화 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((s) => (
            <Button key={s} variant={status === s ? 'default' : 'outline'} size="sm" onClick={() => setStatus(s)}>
              {STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>연락처</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>등록일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  등록된 고객이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              data.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/customers/$id', params: { id: c.id } })}
                >
                  <TableCell className="font-medium">{nameOf(c)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{CUSTOMER_TYPE_LABEL[c.type]}</Badge>
                  </TableCell>
                  <TableCell>{c.individualProfile?.phone ?? '-'}</TableCell>
                  <TableCell>{c.individualProfile?.email ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? 'default' : 'outline'}>{c.isActive ? '활성' : '거래정지'}</Badge>
                  </TableCell>
                  <TableCell>{new Date(c.createdAt).toLocaleDateString('ko-KR')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
