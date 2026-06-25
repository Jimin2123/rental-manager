import { Link } from '@tanstack/react-router';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: '대시보드', icon: '⊞' },
  { to: '/contracts', label: '계약', icon: '📋' },
  { to: '/invoices', label: '청구서', icon: '🧾' },
  { to: '/payments', label: '수납', icon: '💳' },
  { to: '/refunds', label: '환불', icon: '↩' },
  { to: '/assets', label: '자산', icon: '📦' },
  { to: '/business-partners', label: '거래처', icon: '🏢' },
  { to: '/customers', label: '고객', icon: '👤' },
] as const;

export function Sidebar() {
  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-card">
      <div className="flex h-14 items-center px-4">
        <span className="text-base font-bold text-foreground">렌탈 매니저</span>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={item.to === '/' ? { exact: true } : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              '[&.active]:bg-accent [&.active]:text-accent-foreground',
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <Separator />
      <div className="p-3">
        <Link
          to="/settings/account"
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            '[&.active]:bg-accent [&.active]:text-accent-foreground',
          )}
        >
          <span className="text-base">⚙</span>
          계정 설정
        </Link>
      </div>
    </aside>
  );
}
