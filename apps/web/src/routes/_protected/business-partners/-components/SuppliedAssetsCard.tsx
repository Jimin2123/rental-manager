import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { won, date } from '@/lib/format';

type AssetStatus =
  | 'INCOMING' | 'AVAILABLE' | 'RENTED' | 'SOLD'
  | 'REPAIR' | 'DISPOSED' | 'LOST' | 'UNAVAILABLE';

const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  INCOMING: '입고예정',
  AVAILABLE: '가용',
  RENTED: '렌탈중',
  SOLD: '판매',
  REPAIR: '수리중',
  DISPOSED: '폐기',
  LOST: '분실',
  UNAVAILABLE: '사용불가',
};

type SuppliedAsset = {
  id: string;
  serialNumber: string | null;
  status: AssetStatus;
  purchaseDate: string | null;
  purchasePrice: number | null;
  product: { id: string; name: string; manufacturer: string; modelName: string };
};

export function SuppliedAssetsCard({ partnerId }: { partnerId: string }) {
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['business-partners', partnerId, 'assets'],
    queryFn: () =>
      api.get<SuppliedAsset[]>('/assets', { params: { supplierId: partnerId } }).then((r) => r.data),
  });

  return (
    <div className="rounded-xl border bg-card p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">공급 자산</h2>
        <span className="text-xs text-muted-foreground">{assets.length}건</span>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">불러오는 중...</div>
      ) : assets.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          이 거래처에서 매입한 자산이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_1.6fr_.8fr_.9fr_1fr] gap-3 px-1 text-xs font-semibold text-muted-foreground">
            <span>시리얼</span>
            <span>제품명</span>
            <span>상태</span>
            <span>매입일</span>
            <span>매입가</span>
          </div>
          {assets.map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-[1fr_1.6fr_.8fr_.9fr_1fr] gap-3 items-center rounded-lg border px-3 h-9 text-sm"
            >
              <span className="font-medium truncate">{a.serialNumber ?? '—'}</span>
              <span className="text-muted-foreground truncate">
                {a.product.manufacturer} {a.product.modelName}
              </span>
              <span className="text-muted-foreground">{ASSET_STATUS_LABEL[a.status]}</span>
              <span className="text-muted-foreground">{date(a.purchaseDate)}</span>
              <span className="text-muted-foreground">{won(a.purchasePrice)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
