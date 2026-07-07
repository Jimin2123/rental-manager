import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, SETTINGS_ITEM } from './nav-items';

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  return (
    <>
      {/* 스크림 */}
      <div
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-black/35 transition-opacity duration-200 sm:hidden',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* 드로어 패널 */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r bg-card px-3.5 py-4 transition-transform duration-200 sm:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="mb-2 flex h-8 w-8 items-center justify-center self-end rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="메뉴 닫기"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 전체 메뉴 */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {[...NAV_ITEMS, SETTINGS_ITEM].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              activeOptions={item.to === '/' ? { exact: true } : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                '[&.active]:bg-accent [&.active]:text-accent-foreground',
              )}
            >
              <item.icon className="h-4 w-4 flex-none" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
