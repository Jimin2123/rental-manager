import { createFileRoute, redirect, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

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

  // 세션 만료(인터셉터가 clearAuth 호출)시 로그인 페이지로 이동
  useEffect(() => {
    if (isInitialized && !currentOrganization) {
      void navigate({ to: '/login', search: { error: undefined } });
    }
  }, [isInitialized, currentOrganization, navigate]);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
