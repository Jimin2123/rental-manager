import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
import { useAuthStore } from '@/store/auth.store';

export const Route = createFileRoute('/_protected')({
  beforeLoad: () => {
    const { currentOrganization } = useAuthStore.getState();
    if (!currentOrganization) throw redirect({ to: '/login' });
  },
  component: () => <Outlet />,
});
