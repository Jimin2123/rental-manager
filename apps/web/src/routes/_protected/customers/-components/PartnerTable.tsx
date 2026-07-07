import type { BusinessPartnerListItem } from '../../business-partners/-types';
import { ROLE_LABEL } from '../../business-partners/-types';
import { StatusBadge } from './StatusBadge';

type Props = {
  items: BusinessPartnerListItem[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function PartnerTable({ items, isLoading, selectedId, onSelect }: Props) {
  return (
    <div className="bg-white dark:bg-card border border-[#e5e8ee] dark:border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1.4fr_1fr_.8fr_.6fr_.6fr_.7fr] px-[18px] py-[11px] text-[12px] font-semibold text-[#98a0ad] dark:text-muted-foreground border-b border-[#eef0f4] dark:border-border bg-[#fafbfc] dark:bg-muted/30">
        <div>상호명</div>
        <div>사업자번호</div>
        <div>역할</div>
        <div>담당자 수</div>
        <div>상태</div>
        <div>등록일</div>
      </div>
      {isLoading ? (
        <div className="px-[18px] py-8 text-center text-[13px] text-[#98a0ad] dark:text-muted-foreground">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="px-[18px] py-8 text-center text-[13px] text-[#98a0ad] dark:text-muted-foreground">등록된 거래처가 없습니다.</div>
      ) : (
        items.map((p) => (
          <div
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={[
              'grid grid-cols-[1.4fr_1fr_.8fr_.6fr_.6fr_.7fr] px-[18px] py-[13px]',
              'text-[13.5px] text-[#2a2f3a] dark:text-foreground border-b border-[#f2f4f7] dark:border-border last:border-0',
              'cursor-pointer items-center',
              p.id === selectedId ? 'bg-[#f7f9ff] dark:bg-primary/10' : 'hover:bg-[#fafbfd] dark:hover:bg-muted/20',
            ].join(' ')}
          >
            <div className="font-semibold">{p.businessProfile.name}</div>
            <div className="text-[#5b6472] dark:text-muted-foreground">{p.businessProfile.businessRegistrationNo}</div>
            <div className="flex gap-1 flex-wrap">
              {p.roles.map((r) => (
                <span
                  key={r.type}
                  className="text-[11.5px] font-semibold text-[#5b6472] dark:text-muted-foreground bg-[#eef0f4] dark:bg-muted/50 px-2 py-0.5 rounded-md"
                >
                  {ROLE_LABEL[r.type]}
                </span>
              ))}
            </div>
            <div className="text-[#5b6472] dark:text-muted-foreground">{p._count.contacts}명</div>
            <div>
              <StatusBadge isActive={p.isActive} />
            </div>
            <div className="text-[#98a0ad] dark:text-muted-foreground">{new Date(p.createdAt).toLocaleDateString('ko-KR')}</div>
          </div>
        ))
      )}
    </div>
  );
}
