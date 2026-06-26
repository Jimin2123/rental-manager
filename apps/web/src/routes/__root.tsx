import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';
import { api } from '@/lib/api';
import { consumePendingInvite } from '@/lib/pending-invite';
import { hasSessionMarker, useAuthStore } from '@/store/auth.store';
import type { Organization } from '@/store/auth.store';

export const Route = createRootRoute({
  beforeLoad: async () => {
    if (useAuthStore.getState().isInitialized) return;
    // 한 번도 로그인한 적 없으면(세션 마커 부재) /organizations/me·refresh 호출을 건너뛴다.
    // → 미인증 부트스트랩의 401 콘솔 노이즈와 무의미한 refresh 왕복 제거.
    if (!hasSessionMarker()) {
      useAuthStore.getState().clearAuth();
      return;
    }
    try {
      // 소셜 OAuth 복귀 시 보관된 초대 토큰을 /organizations/me 조회 전에 수락해
      // 이후 응답에 신규 가입 조직이 포함되도록 한다.
      const pending = consumePendingInvite();
      if (pending) {
        try {
          await api.post(`/invitations/${pending}/accept`);
        } catch {
          // 만료·이미 처리됨 등 — 무시하고 정상 로드 계속
        }
      }
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
