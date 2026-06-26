import { useNavigate } from '@tanstack/react-router';
import { Moon, Sun } from 'lucide-react';
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
import { InvitationBell } from './InvitationBell';

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

export function Header() {
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

  const initials = currentOrganization?.name?.slice(0, 2).toUpperCase() ?? 'RM';

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <span className="text-sm font-medium text-foreground">{currentOrganization?.name ?? ''}</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="테마 전환">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <InvitationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5 text-xs text-muted-foreground">{currentOrganization?.role}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
