import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ServiceRequestStatus, ServiceRequestType } from './-types';
import { REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, customerNameOf } from './-types';
import type { ServiceRequestFilters } from './-api';
import { serviceRequestKeys, fetchServiceRequests } from './-api';
import { FilterRow } from '@/components/ui/filter-row';
import { Pagination } from '@/components/ui/pagination';
import { PAGE_SIZE } from '@/lib/pagination';

export const Route = createFileRoute('/_protected/service-requests/')({
  component: ServiceRequestsPage,
});

type StatusFilter = 'ALL' | ServiceRequestStatus;
type TypeFilter = 'ALL' | ServiceRequestType;

function ServiceRequestsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [page, setPage] = useState(1);

  const filters: ServiceRequestFilters = {
    ...(status !== 'ALL' && { status }),
    ...(type !== 'ALL' && { type }),
  };

  const { data, isLoading } = useQuery({
    queryKey: serviceRequestKeys.list(filters, page),
    queryFn: () => fetchServiceRequests(filters, page),
    placeholderData: keepPreviousData,
  });
  const requests = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">AS 접수</h1>
        <Button size="sm" onClick={() => void navigate({ to: '/service-requests/new' })}>
          접수 등록
        </Button>
      </div>

      <div className="mb-4 space-y-2">
        <FilterRow<StatusFilter>
          label="상태"
          options={['ALL', 'RECEIVED', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'CANCELED']}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          labelOf={(v) => (v === 'ALL' ? '전체' : REQUEST_STATUS_LABEL[v])}
        />
        <FilterRow<TypeFilter>
          label="유형"
          options={['ALL', 'REPAIR', 'MAINTENANCE', 'INSTALLATION', 'REMOVAL', 'INSPECTION', 'ETC']}
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          labelOf={(v) => (v === 'ALL' ? '전체' : REQUEST_TYPE_LABEL[v])}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>접수번호</TableHead>
              <TableHead>고객</TableHead>
              <TableHead>자산</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>보증</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  AS 접수가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/service-requests/$id', params: { id: r.id } })}
                >
                  <TableCell className="font-medium">{r.requestNo}</TableCell>
                  <TableCell>{customerNameOf(r.customer)}</TableCell>
                  <TableCell>
                    {r.asset.product.name} ({r.asset.serialNumber})
                  </TableCell>
                  <TableCell>{REQUEST_TYPE_LABEL[r.type]}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'COMPLETED' ? 'default' : 'secondary'}>
                      {REQUEST_STATUS_LABEL[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.isWarranty ? '보증' : '유상'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && <Pagination page={page} limit={PAGE_SIZE} total={total} onPage={setPage} />}
    </div>
  );
}
