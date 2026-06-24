import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { useAuthStore } from '@/store/auth.store';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export const Route = createFileRoute('/_protected')({
  beforeLoad: () => {
    const { currentOrganization } = useAuthStore.getState();
    if (!currentOrganization) throw redirect({ to: '/login' });
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
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
