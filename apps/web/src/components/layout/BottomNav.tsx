import { Link } from '@tanstack/react-router';
import { LayoutDashboard, MoreHorizontal, Package, Receipt, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const BOTTOM_TABS = [
  { to: '/', label: '대시보드', icon: LayoutDashboard, exact: true },
  { to: '/customers', label: '고객', icon: Users, exact: false },
  { to: '/products', label: '자산', icon: Package, exact: false },
  { to: '/invoices', label: '청구', icon: Receipt, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav className="flex h-[58px] flex-none items-stretch border-t bg-card sm:hidden">
      {BOTTOM_TABS.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          activeOptions={tab.exact ? { exact: true } : undefined}
          className={cn(
            'flex flex-1 flex-col items-center justify-center gap-1',
            'text-muted-foreground hover:text-foreground [&.active]:text-foreground',
          )}
        >
          <tab.icon className="h-5 w-5" />
          <span className="text-[10.5px]">{tab.label}</span>
        </Link>
      ))}

      {/* 더보기 — skeleton */}
      <button className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground">
        <MoreHorizontal className="h-5 w-5" />
        <span className="text-[10.5px]">더보기</span>
      </button>
    </nav>
  );
}
