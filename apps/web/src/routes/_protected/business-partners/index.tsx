import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { BusinessPartnerListItem, RoleType } from './-types';
import { ROLE_LABEL } from './-types';

export const Route = createFileRoute('/_protected/business-partners/')({
  component: BusinessPartnersPage,
});

type RoleFilter = 'ALL' | RoleType;

function BusinessPartnersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');

  const { data = [], isLoading } = useQuery<BusinessPartnerListItem[]>({
    queryKey: ['business-partners', search, roleFilter],
    queryFn: () =>
      api
        .get<BusinessPartnerListItem[]>('/business-partners', {
          params: {
            ...(search && { q: search }),
            ...(roleFilter !== 'ALL' && { role: roleFilter }),
          },
        })
        .then((r) => r.data),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">거래처</h1>
        <Button onClick={() => void navigate({ to: '/business-partners/new' })}>거래처 등록</Button>
      </div>

      <div className="mb-4 flex gap-3">
        <Input
          placeholder="상호명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {(['ALL', 'SALES', 'PURCHASE'] as const).map((r) => (
            <Button
              key={r}
              variant={roleFilter === r ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter(r)}
            >
              {r === 'ALL' ? '전체' : ROLE_LABEL[r]}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>상호명</TableHead>
              <TableHead>사업자번호</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>담당자</TableHead>
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
                  등록된 거래처가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              data.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/business-partners/$id', params: { id: p.id } })}
                >
                  <TableCell className="font-medium">{p.businessProfile.name}</TableCell>
                  <TableCell>{p.businessProfile.businessRegistrationNo}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {p.roles.map((r) => (
                        <Badge key={r.type} variant={r.type === 'SALES' ? 'default' : 'secondary'}>
                          {ROLE_LABEL[r.type]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{p._count.contacts}명</TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? 'default' : 'outline'}>{p.isActive ? '활성' : '거래정지'}</Badge>
                  </TableCell>
                  <TableCell>{new Date(p.createdAt).toLocaleDateString('ko-KR')}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
