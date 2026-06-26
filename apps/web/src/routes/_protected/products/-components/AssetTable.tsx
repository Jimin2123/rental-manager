import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AssetListItem } from '../-types';
import { ASSET_STATUS_LABEL, ASSET_STATUS_VARIANT } from '../-types';
import { assetKeys, fetchAssets } from '../-api';
import { AddAssetDialog } from './AddAssetDialog';
import { AssetPanel } from './AssetPanel';

export function AssetTable({ productId }: { productId: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: assets = [], isLoading } = useQuery<AssetListItem[]>({
    queryKey: assetKeys.list(productId),
    queryFn: () => fetchAssets(productId),
  });

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">자산 목록 ({assets.length})</h2>
        <AddAssetDialog productId={productId} />
      </div>

      <Separator />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>시리얼번호</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>매입일</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                불러오는 중...
              </TableCell>
            </TableRow>
          ) : assets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                등록된 자산이 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            assets.map((asset) => (
              <Fragment key={asset.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedId(expandedId === asset.id ? null : asset.id)}
                >
                  <TableCell>
                    {asset.serialNumber ?? <span className="text-muted-foreground">S/N 미등록</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ASSET_STATUS_VARIANT[asset.status]}>{ASSET_STATUS_LABEL[asset.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString('ko-KR') : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{expandedId === asset.id ? '▲' : '▼'}</TableCell>
                </TableRow>
                {expandedId === asset.id && (
                  <TableRow>
                    <TableCell colSpan={4} className="p-0 bg-muted/30">
                      <AssetPanel
                        assetId={asset.id}
                        productId={productId}
                        currentStatus={asset.status}
                        onDeleted={() => setExpandedId(null)}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
