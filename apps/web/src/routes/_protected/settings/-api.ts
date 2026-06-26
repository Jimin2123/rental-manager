import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { LinkedIdentity, OAuthProvider } from './-types';

// ─── 쿼리 키 ──────────────────────────────────────────────────────
export const identityKeys = {
  all: ['auth', 'social', 'identities'] as const,
};

// ─── 조회 함수 ────────────────────────────────────────────────────
export const fetchIdentities = () => api.get<LinkedIdentity[]>('/auth/social/identities').then((r) => r.data);

// ─── 소셜 연동/해제/병합 ──────────────────────────────────────────
export const unlinkSocial = (provider: OAuthProvider) => api.delete(`/auth/social/link/${provider.toLowerCase()}`);

export const mergeAccount = (token: string) => api.post('/auth/social/merge', { token });

// OAuth 연동은 백엔드 리다이렉트 엔드포인트로 전체 페이지 이동한다.
export const socialLinkRedirectUrl = (provider: OAuthProvider) =>
  `/auth/social/link/${provider.toLowerCase()}/redirect`;

// ─── 무효화 헬퍼 ──────────────────────────────────────────────────
export function invalidateIdentities(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: identityKeys.all });
}
