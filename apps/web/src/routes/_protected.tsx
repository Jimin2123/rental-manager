import { createFileRoute, redirect, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { useSidebarState } from '@/hooks/useSidebarState';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { BottomNav } from '@/components/layout/BottomNav';

export const Route = createFileRoute('/_protected')({
  beforeLoad: () => {
    const { isAuthenticated, currentOrganization } = useAuthStore.getState();
    if (!isAuthenticated) throw redirect({ to: '/login', search: { error: undefined } });
    if (!currentOrganization) throw redirect({ to: '/setup' });
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  const navigate = useNavigate();
  const currentOrganization = useAuthStore((s) => s.currentOrganization);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const [collapsed, setCollapsed] = useSidebarState();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 세션 만료 시 로그인 페이지로 이동
  useEffect(() => {
    if (isInitialized && !currentOrganization) {
      void navigate({ to: '/login', search: { error: undefined } });
    }
  }, [isInitialized, currentOrganization, navigate]);

  return (
    <div className="flex h-screen justify-center bg-background">
      <div className="flex h-full w-full max-w-[1360px] flex-col overflow-hidden border-x">
        <Header onMenuClick={() => setDrawerOpen(true)} />

        <div className="relative flex flex-1 overflow-hidden">
          {/* 데스크톱·태블릿 사이드바 */}
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} className="hidden sm:flex" />

          {/* 모바일 드로어 (내부적으로 sm:hidden) */}
          <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>

        {/* 데스크톱·태블릿 푸터 */}
        <Footer className="hidden sm:flex" />

        {/* 모바일 하단 탭바 (내부적으로 sm:hidden) */}
        <BottomNav />
      </div>
    </div>
  );
}
