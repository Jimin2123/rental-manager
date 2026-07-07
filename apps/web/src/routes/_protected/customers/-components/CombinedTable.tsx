import type { CustomerListItem } from '../-types';
import type { BusinessPartnerListItem } from '../../business-partners/-types';
import { ROLE_LABEL } from '../../business-partners/-types';
import { StatusBadge } from './StatusBadge';

export type CombinedItem =
  | { kind: 'customer'; data: CustomerListItem }
  | { kind: 'partner'; data: BusinessPartnerListItem };

type Props = {
  items: CombinedItem[];
  isLoading: boolean;
  selectedKey: string | null; // 'customer:id' | 'partner:id'
  onSelect: (kind: 'customer' | 'partner', id: string) => void;
};

const GRID = 'grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_.7fr_.9fr_.7fr] lg:grid-cols-[1.4fr_.7fr_.9fr_.7fr_.7fr]';

function nameOf(item: CombinedItem): string {
  if (item.kind === 'customer') {
    return item.data.individualProfile?.name ?? item.data.businessPartner?.businessProfile.name ?? '-';
  }
  return item.data.businessProfile.name;
}

function phoneOf(item: CombinedItem): string {
  if (item.kind === 'customer') return item.data.individualProfile?.phone ?? '—';
  return '—';
}

function KindBadge({ item }: { item: CombinedItem }) {
  if (item.kind === 'partner') {
    return (
      <span className="text-[11.5px] font-semibold text-[#5b6472] dark:text-muted-foreground bg-[#eef0f4] dark:bg-muted/50 px-2 py-0.5 rounded-md">
        매입처
      </span>
    );
  }
  if (item.data.type === 'INDIVIDUAL') {
    return (
      <span className="text-[11.5px] font-semibold text-[#6d28d9] dark:text-violet-400 bg-[#ede9ff] dark:bg-violet-900/30 px-2 py-0.5 rounded-md">
        고객(개인)
      </span>
    );
  }
  return (
    <span className="text-[11.5px] font-semibold text-[#2456e0] dark:text-primary bg-[#eef1f9] dark:bg-primary/10 px-2 py-0.5 rounded-md">
      고객(사업자)
    </span>
  );
}

export function CombinedTable({ items, isLoading, selectedKey, onSelect }: Props) {
  return (
    <div className="bg-white dark:bg-card border border-[#e5e8ee] dark:border-border rounded-xl overflow-hidden">
      <div className={`grid ${GRID} px-3 sm:px-[18px] py-[11px] text-[12px] font-semibold text-[#98a0ad] dark:text-muted-foreground border-b border-[#eef0f4] dark:border-border bg-[#fafbfc] dark:bg-muted/30`}>
        <div>이름/상호명</div>
        <div className="hidden sm:block">구분</div>
        <div className="hidden sm:block">연락처</div>
        <div>상태</div>
        <div className="hidden lg:block">등록일</div>
      </div>
      {isLoading ? (
        <div className="px-3 sm:px-[18px] py-8 text-center text-[13px] text-[#98a0ad] dark:text-muted-foreground">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="px-3 sm:px-[18px] py-8 text-center text-[13px] text-[#98a0ad] dark:text-muted-foreground">등록된 항목이 없습니다.</div>
      ) : (
        items.map((item) => {
          const key = `${item.kind}:${item.data.id}`;
          return (
            <div
              key={key}
              onClick={() => onSelect(item.kind, item.data.id)}
              className={[
                `grid ${GRID} px-3 sm:px-[18px] py-3 sm:py-[13px]`,
                'text-[13.5px] text-[#2a2f3a] dark:text-foreground border-b border-[#f2f4f7] dark:border-border last:border-0',
                'cursor-pointer items-center',
                selectedKey === key ? 'bg-[#f7f9ff] dark:bg-primary/10' : 'hover:bg-[#fafbfd] dark:hover:bg-muted/20',
              ].join(' ')}
            >
              <div className="font-semibold truncate">{nameOf(item)}</div>
              <div className="hidden sm:block"><KindBadge item={item} /></div>
              <div className="hidden sm:block text-[#5b6472] dark:text-muted-foreground">{phoneOf(item)}</div>
              <div><StatusBadge isActive={item.data.isActive} /></div>
              <div className="hidden lg:block text-[#98a0ad] dark:text-muted-foreground">
                {new Date(item.data.createdAt).toLocaleDateString('ko-KR')}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
