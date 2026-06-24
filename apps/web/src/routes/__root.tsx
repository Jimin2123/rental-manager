import { createRootRoute, Outlet } from '@tanstack/react-router';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { Organization } from '@/store/auth.store';

export const Route = createRootRoute({
  loader: async () => {
    try {
      const { data } = await api.get<Organization[]>('/organizations/me');
      useAuthStore.getState().setAuth(data);
    } catch {
      useAuthStore.getState().clearAuth();
    }
  },
  component: () => <Outlet />,
});
