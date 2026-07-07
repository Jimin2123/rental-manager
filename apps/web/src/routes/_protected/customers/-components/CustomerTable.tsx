import type { CustomerListItem } from '../-types';
import { StatusBadge } from './StatusBadge';

type Props = {
  items: CustomerListItem[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

function nameOf(c: CustomerListItem): string {
  return c.individualProfile?.name ?? c.businessPartner?.businessProfile.name ?? '-';
}

const GRID = 'grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_.6fr_.9fr_.7fr] lg:grid-cols-[1.4fr_.6fr_.8fr_.8fr_.7fr_.7fr]';

export function CustomerTable({ items, isLoading, selectedId, onSelect }: Props) {
  return (
    <div className="bg-white dark:bg-card border border-[#e5e8ee] dark:border-border rounded-xl overflow-hidden">
      <div className={`grid ${GRID} px-3 sm:px-[18px] py-[11px] text-[12px] font-semibold text-[#98a0ad] dark:text-muted-foreground border-b border-[#eef0f4] dark:border-border bg-[#fafbfc] dark:bg-muted/30`}>
        <div>고객명</div>
        <div className="hidden sm:block">유형</div>
        <div className="hidden sm:block">연락처</div>
        <div className="hidden lg:block">이메일</div>
        <div>상태</div>
        <div className="hidden lg:block">등록일</div>
      </div>
      {isLoading ? (
        <div className="px-3 sm:px-[18px] py-8 text-center text-[13px] text-[#98a0ad] dark:text-muted-foreground">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="px-3 sm:px-[18px] py-8 text-center text-[13px] text-[#98a0ad] dark:text-muted-foreground">등록된 고객이 없습니다.</div>
      ) : (
        items.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={[
              `grid ${GRID} px-3 sm:px-[18px] py-3 sm:py-[13px]`,
              'text-[13.5px] text-[#2a2f3a] dark:text-foreground border-b border-[#f2f4f7] dark:border-border last:border-0',
              'cursor-pointer items-center',
              c.id === selectedId ? 'bg-[#f7f9ff] dark:bg-primary/10' : 'hover:bg-[#fafbfd] dark:hover:bg-muted/20',
            ].join(' ')}
          >
            <div className="font-semibold truncate">{nameOf(c)}</div>
            <div className="hidden sm:block text-[#5b6472] dark:text-muted-foreground">{c.type === 'INDIVIDUAL' ? '개인' : '법인'}</div>
            <div className="hidden sm:block text-[#5b6472] dark:text-muted-foreground">{c.individualProfile?.phone ?? '—'}</div>
            <div className="hidden lg:block text-[#5b6472] dark:text-muted-foreground truncate">{c.individualProfile?.email ?? '—'}</div>
            <div>
              <StatusBadge isActive={c.isActive} />
            </div>
            <div className="hidden lg:block text-[#98a0ad] dark:text-muted-foreground">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</div>
          </div>
        ))
      )}
    </div>
  );
}
