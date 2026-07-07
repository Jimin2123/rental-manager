import { useNavigate } from '@tanstack/react-router';
import { Menu, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { HeaderSearch } from './HeaderSearch';
import { InvitationBell } from './InvitationBell';
import { SelenteLogo } from './SelenteLogo';

function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((v) => !v) };
}

type HeaderProps = {
  onMenuClick: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const currentOrganization = useAuthStore((s) => s.currentOrganization);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { isDark, toggle } = useTheme();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // 쿠키 만료 등 — 무시하고 로그아웃 처리
    }
    clearAuth();
    await navigate({ to: '/login', search: { error: undefined } });
    toast.success('로그아웃되었습니다.');
  };

  const initials = currentOrganization?.name?.slice(0, 2).toUpperCase() ?? '셀렌';

  return (
    <header className="flex h-14 flex-none items-center gap-3 border-b bg-card px-2 sm:h-[62px] sm:gap-4 sm:px-4">
      {/* 햄버거 버튼 — 모바일 전용 */}
      <Button variant="ghost" size="icon" className="sm:hidden" onClick={onMenuClick} aria-label="메뉴 열기">
        <Menu className="h-5 w-5" />
      </Button>

      {/* 로고 */}
      <SelenteLogo />

      {/* 구분선 — 태블릿·데스크톱 */}
      <div className="hidden h-5 w-px bg-border sm:block" />

      {/* 검색 */}
      <HeaderSearch />

      <div className="flex-1" />

      {/* 테마 토글 */}
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="테마 전환">
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {/* 알림벨 */}
      <InvitationBell />

      {/* 구분선 — 태블릿·데스크톱 */}
      <div className="hidden h-5 w-px bg-border sm:block" />

      {/* 프로필 드롭다운 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 rounded-lg p-1 hover:bg-accent">
            <Avatar className="h-[30px] w-[30px] flex-none">
              <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <div className="text-[13px] font-semibold leading-tight text-foreground">{currentOrganization?.name}</div>
              <div className="text-[11px] leading-tight text-muted-foreground">{currentOrganization?.role}</div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
            로그아웃
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
