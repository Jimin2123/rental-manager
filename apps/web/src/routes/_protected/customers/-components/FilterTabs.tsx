export type TabValue = 'all' | 'business' | 'individual' | 'partners' | 'overdue';

type TabDef = {
  value: TabValue;
  label: string;
  count: number;
};

type Props = {
  tabs: TabDef[];
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
};

export function FilterTabs({ tabs, activeTab, onTabChange }: Props) {
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onTabChange(t.value)}
          className={
            t.value === activeTab
              ? 'text-[#2456e0] bg-[#eef1f9] font-bold text-[13px] px-[13px] py-[7px] rounded-lg border-0 cursor-pointer'
              : 'text-[#5b6472] bg-white border border-[#e5e8ee] font-medium text-[13px] px-[13px] py-[7px] rounded-lg cursor-pointer hover:bg-[#f6f7f9]'
          }
        >
          {t.label} {t.count}
        </button>
      ))}
    </div>
  );
}
