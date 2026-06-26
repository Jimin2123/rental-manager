import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import type { AssetEvent } from '../-types';
import { ASSET_STATUS_LABEL, ASSET_STATUS_VARIANT } from '../-types';
import { assetKeys, fetchAssetEvents } from '../-api';

const SOURCE_LABEL: Record<string, string> = {
  RENTAL_CONTRACT: '렌탈 계약',
  RENTAL_CONTRACT_ITEM: '계약 장비',
  SALE_ORDER: '판매',
  SERVICE_REQUEST: 'AS 접수',
  SERVICE_VISIT: 'AS 방문',
  MANUAL: '수동',
};

export function EventSection({ assetId }: { assetId: string }) {
  const { data: events = [], isLoading } = useQuery<AssetEvent[]>({
    queryKey: assetKeys.events(assetId),
    queryFn: () => fetchAssetEvents(assetId),
  });

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">이벤트 이력</h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">이벤트 이력이 없습니다.</p>
      ) : (
        <ol className="space-y-1">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground text-xs">
                {new Date(ev.createdAt).toLocaleDateString('ko-KR')}
              </span>
              <span className="flex items-center gap-1">
                {ev.fromStatus && (
                  <>
                    <Badge variant={ASSET_STATUS_VARIANT[ev.fromStatus]} className="text-xs">
                      {ASSET_STATUS_LABEL[ev.fromStatus]}
                    </Badge>
                    <span className="text-muted-foreground">→</span>
                  </>
                )}
                <Badge variant={ASSET_STATUS_VARIANT[ev.toStatus]} className="text-xs">
                  {ASSET_STATUS_LABEL[ev.toStatus]}
                </Badge>
              </span>
              <Badge variant="outline" className="text-xs">
                {SOURCE_LABEL[ev.sourceType] ?? ev.sourceType}
              </Badge>
              {ev.note && <span className="text-xs text-muted-foreground">{ev.note}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
