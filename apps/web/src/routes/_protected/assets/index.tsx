import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { AssetListItem, AssetStatus, Product } from './-types';
import { ASSET_STATUS_LABEL, ASSET_STATUS_VARIANT } from './-types';

export const Route = createFileRoute('/_protected/assets/')({
  component: AssetsPage,
});

const STATUS_FILTERS: Array<{ value: AssetStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'INCOMING', label: '입고예정' },
  { value: 'AVAILABLE', label: '사용가능' },
  { value: 'RENTED', label: '렌탈중' },
  { value: 'REPAIR', label: '수리중' },
  { value: 'DISPOSED', label: '폐기' },
  { value: 'LOST', label: '분실' },
  { value: 'UNAVAILABLE', label: '사용불가' },
];

function AssetsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'ALL'>('ALL');
  const [productId, setProductId] = useState<string>('');

  const {
    data: assets = [],
    isLoading,
    isError,
  } = useQuery<AssetListItem[]>({
    queryKey: ['assets', 'list', { search, statusFilter, productId }],
    queryFn: () =>
      api
        .get<AssetListItem[]>('/assets', {
          params: {
            ...(search && { search }),
            ...(statusFilter !== 'ALL' && { status: statusFilter }),
            ...(productId && { productId }),
          },
        })
        .then((r) => r.data),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products', 'list', ''],
    queryFn: () => api.get<Product[]>('/products').then((r) => r.data),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">자산</h1>
        <Button onClick={() => void navigate({ to: '/assets/new' })}>자산 등록</Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="시리얼번호 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={productId || 'all'} onValueChange={(v) => setProductId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="제품 전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">제품 전체</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {STATUS_FILTERS.map(({ value, label }) => (
          <Button
            key={value}
            variant={statusFilter === value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>제품명</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>시리얼번호</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>매입일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  자산 목록을 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            ) : assets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  등록된 자산이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              assets.map((asset) => (
                <TableRow
                  key={asset.id}
                  className="cursor-pointer"
                  onClick={() => void navigate({ to: '/assets/$id', params: { id: asset.id } })}
                >
                  <TableCell className="font-medium">{asset.product.name}</TableCell>
                  <TableCell>{asset.product.category ?? '-'}</TableCell>
                  <TableCell>{asset.serialNumber ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={ASSET_STATUS_VARIANT[asset.status]}>{ASSET_STATUS_LABEL[asset.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('ko-KR') : '-'}
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
