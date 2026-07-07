import { Search } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type SearchItem = { group: string; label: string; sub: string };
type SearchGroup = { group: string; items: SearchItem[] };

const SEARCH_INDEX: SearchItem[] = [
  { group: '고객', label: '대성물산', sub: '거래처 · 미수금 ₩1,240,000' },
  { group: '고객', label: '그린텍 주식회사', sub: '거래처' },
  { group: '고객', label: '로움법률사무소', sub: '거래처 · 연체' },
  { group: '고객', label: '김민준', sub: '개인' },
  { group: '고객', label: '서울메디케어의원', sub: '거래처 · 미수' },
  { group: '고객', label: '하늘물류', sub: '거래처' },
  { group: '자산', label: 'AST-1042', sub: '캐논 iR-ADV C3830 · 대성물산' },
  { group: '자산', label: 'AST-0977', sub: '신도리코 D712 · 그린텍 주식회사' },
  { group: '자산', label: 'AST-0851', sub: '캐논 iR-2635i · 로움법률사무소' },
  { group: '계약', label: 'RC-20241201-001', sub: '대성물산 · METER' },
  { group: '계약', label: 'RC-20230801-002', sub: '로움법률사무소 · METER' },
  { group: '청구서', label: 'INV-20260625-004', sub: '대성물산 · 완납' },
  { group: '청구서', label: 'INV-20260625-003', sub: '로움법률사무소 · 미납' },
];

const RECENT_LABELS = ['대성물산', 'AST-1042', 'INV-20260625-003'];
const GROUPS_ORDER = ['고객', '자산', '계약', '청구서'] as const;

export function HeaderSearch({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  const recentItems = RECENT_LABELS.map(
    (label) => SEARCH_INDEX.find((it) => it.label === label) ?? { group: '', label, sub: '' },
  );

  const resultGroups: SearchGroup[] = q
    ? GROUPS_ORDER.map((g) => ({
        group: g,
        items: SEARCH_INDEX.filter(
          (it) => it.group === g && (it.label.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q)),
        ).slice(0, 4),
      })).filter((g) => g.items.length > 0)
    : [];

  const showRecent = open && !q;
  const showResults = open && !!q && resultGroups.length > 0;
  const showEmpty = open && !!q && resultGroups.length === 0;

  const handleBlur = () => {
    setOpen(false);
    setQuery('');
  };

  const handleSelect = (label: string) => {
    setQuery(label);
    setOpen(false);
  };

  return (
    <div className={cn('relative hidden sm:block', className)}>
      {/* 닫힌 상태: 아이콘 + placeholder */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Search className="h-4 w-4 flex-none" />
          <span>고객, 자산, 계약, 청구서 검색</span>
        </button>
      ) : (
        /* 열린 상태: 아이콘 + 밑줄 입력창 */
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 flex-none text-primary" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={handleBlur}
            placeholder="고객, 자산, 계약, 청구서 검색"
            className="w-64 border-0 border-b-2 border-primary bg-transparent pb-1 pt-0.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      )}

      {/* 드롭다운 — 항상 마운트, opacity/transform 전환 */}
      <div
        onMouseDown={(e) => e.preventDefault()}
        className={cn(
          'absolute left-0 top-10 z-50 w-[340px] overflow-hidden rounded-xl border bg-popover shadow-xl transition-all duration-150',
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1.5 scale-[0.98] opacity-0',
        )}
      >
        <div className="max-h-80 overflow-auto p-2.5">
          {showRecent && (
            <div>
              <div className="px-2 pb-2 pt-1 text-[11px] font-bold text-muted-foreground">최근 검색</div>
              {recentItems.map((item) => (
                <button
                  key={item.label}
                  onMouseDown={() => handleSelect(item.label)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 hover:bg-accent"
                >
                  <span className="text-[13.5px] font-semibold">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.sub}</span>
                </button>
              ))}
            </div>
          )}

          {showResults &&
            resultGroups.map((grp) => (
              <div key={grp.group}>
                <div className="px-2 pb-1 pt-2 text-[11px] font-bold text-muted-foreground">{grp.group}</div>
                {grp.items.map((item) => (
                  <button
                    key={item.label}
                    onMouseDown={() => handleSelect(item.label)}
                    className="flex w-full flex-col rounded-lg px-2 py-2 text-left hover:bg-accent"
                  >
                    <span className="text-[13.5px] font-semibold">{item.label}</span>
                    <span className="mt-0.5 text-xs text-muted-foreground">{item.sub}</span>
                  </button>
                ))}
              </div>
            ))}

          {showEmpty && (
            <div className="px-4 py-5 text-center text-sm text-muted-foreground">
              &ldquo;<span className="font-bold text-foreground">{query}</span>&rdquo;에 대한 검색 결과가 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
