import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, SETTINGS_ITEM } from './nav-items';

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
};

export function Sidebar({ collapsed, onToggle, className }: SidebarProps) {
  return (
    <aside
      className={cn(
        'relative flex flex-none flex-col border-r bg-card transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-[216px]',
        className,
      )}
    >
      {/* 토글 버튼 — aside 우측 상단에 원형으로 돌출 */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-3.5 z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-foreground"
        aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* 네비게이션 */}
      <nav className={cn('flex-1 space-y-1 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-3')}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={item.to === '/' ? { exact: true } : undefined}
            className={cn(
              'flex items-center rounded-md py-2.5 text-sm font-medium transition-colors',
              'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              '[&.active]:bg-accent [&.active]:text-accent-foreground',
              collapsed ? 'justify-center px-2' : 'gap-3 px-3',
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 flex-none" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* 하단 설정 링크 */}
      <div className={cn('py-3', collapsed ? 'px-2' : 'px-3')}>
        <Link
          to={SETTINGS_ITEM.to}
          className={cn(
            'flex items-center rounded-md py-2.5 text-sm font-medium transition-colors',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            '[&.active]:bg-accent [&.active]:text-accent-foreground',
            collapsed ? 'justify-center px-2' : 'gap-3 px-3',
          )}
          title={collapsed ? SETTINGS_ITEM.label : undefined}
        >
          <SETTINGS_ITEM.icon className="h-4 w-4 flex-none" />
          {!collapsed && <span>{SETTINGS_ITEM.label}</span>}
        </Link>
      </div>
    </aside>
  );
}
