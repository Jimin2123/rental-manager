export type TabValue = 'all' | 'business' | 'individual' | 'partners';

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
    <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onTabChange(t.value)}
          className={
            t.value === activeTab
              ? 'flex-shrink-0 text-[#2456e0] dark:text-primary bg-[#eef1f9] dark:bg-primary/10 font-bold text-[13px] px-[13px] py-[7px] rounded-lg border-0 cursor-pointer'
              : 'flex-shrink-0 text-[#5b6472] dark:text-muted-foreground bg-white dark:bg-card border border-[#e5e8ee] dark:border-border font-medium text-[13px] px-[13px] py-[7px] rounded-lg cursor-pointer hover:bg-[#f6f7f9] dark:hover:bg-muted/30'
          }
        >
          {t.label} {t.count}
        </button>
      ))}
    </div>
  );
}
