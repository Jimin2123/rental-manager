import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import type { Product } from './-types';

export const Route = createFileRoute('/_protected/products/')({
  component: ProductsPage,
});

function ProductsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: products = [], isLoading, isError } = useQuery<Product[]>({
    queryKey: ['products', 'list', { search }],
    queryFn: () =>
      api
        .get<Product[]>('/products', { params: { ...(search && { search }) } })
        .then((r) => r.data),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">제품</h1>
        <Button onClick={() => void navigate({ to: '/products/new' })}>제품 등록</Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="제품명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>제품명</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>제조사</TableHead>
              <TableHead className="text-right">사용가능</TableHead>
              <TableHead className="text-right">렌탈중</TableHead>
              <TableHead className="text-right">기타</TableHead>
              <TableHead className="text-right">합계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  제품 목록을 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  등록된 제품이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const { byStatus, total } = product.assetStats;
                const available = byStatus.AVAILABLE ?? 0;
                const rented = byStatus.RENTED ?? 0;
                const other = total - available - rented;
                return (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer"
                    onClick={() => void navigate({ to: '/products/$id', params: { id: product.id } })}
                  >
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.category ?? '-'}</TableCell>
                    <TableCell>{product.manufacturer ?? '-'}</TableCell>
                    <TableCell className="text-right">{available}</TableCell>
                    <TableCell className="text-right">{rented}</TableCell>
                    <TableCell className="text-right">{other > 0 ? other : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{total}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
