import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { Organization } from '@/store/auth.store';

export const Route = createRootRoute({
  beforeLoad: async () => {
    if (useAuthStore.getState().isInitialized) return;
    try {
      const { data } = await api.get<Organization[]>('/organizations/me');
      if (data[0]) {
        await api.post('/auth/switch-org', { organizationId: data[0].id });
      }
      useAuthStore.getState().setAuth(data);
    } catch {
      useAuthStore.getState().clearAuth();
    }
  },
  component: () => (
    <>
      <Outlet />
      <Toaster richColors position="top-right" />
    </>
  ),
});
