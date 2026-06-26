import { create } from 'zustand';

export type OrganizationMemberRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';

export type Organization = {
  id: string;
  name: string;
  businessRegistrationNo: string;
  role: OrganizationMemberRole;
};

type AuthState = {
  organizations: Organization[];
  currentOrganization: Organization | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (organizations: Organization[]) => void;
  clearAuth: () => void;
};

// 세션이 있을 수 있다는 클라이언트 힌트(httpOnly 쿠키는 JS가 못 읽으므로 별도 마커 사용).
// 부트스트랩 시 이 마커가 없으면 /organizations/me 호출을 건너뛰어 미인증 401 노이즈를 막는다.
export const SESSION_MARKER_KEY = 'rm_has_session';

export function hasSessionMarker(): boolean {
  try {
    return localStorage.getItem(SESSION_MARKER_KEY) === '1';
  } catch {
    return false;
  }
}

function setSessionMarker(on: boolean): void {
  try {
    if (on) localStorage.setItem(SESSION_MARKER_KEY, '1');
    else localStorage.removeItem(SESSION_MARKER_KEY);
  } catch {
    // localStorage 접근 불가 환경 — 무시
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  organizations: [],
  currentOrganization: null,
  isAuthenticated: false,
  isInitialized: false,
  setAuth: (organizations) => {
    setSessionMarker(true);
    set({
      organizations,
      currentOrganization: organizations[0] ?? null,
      isAuthenticated: true,
      isInitialized: true,
    });
  },
  clearAuth: () => {
    setSessionMarker(false);
    set({
      organizations: [],
      currentOrganization: null,
      isAuthenticated: false,
      isInitialized: true,
    });
  },
}));
