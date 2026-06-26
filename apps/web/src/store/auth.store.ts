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

// 세션이 있을 수 있다는 클라이언트 힌트(httpOnly 인증 쿠키는 JS가 못 읽으므로 별도 마커).
// 부트스트랩 시 이 마커가 없으면 /organizations/me 호출을 건너뛰어 미인증 401 노이즈를 막는다.
// 두 출처를 OR로 본다:
//  - localStorage: 클라이언트 setAuth 경로(이메일 로그인/가입, 테스트 모킹)
//  - 쿠키(rm_has_session): 서버가 setAuthCookies에서 설정 — 소셜 OAuth처럼 서버 쿠키로만
//    세션을 확립하고 리다이렉트하는 경로를 커버한다.
export const SESSION_MARKER_KEY = 'rm_has_session';

function hasMarkerCookie(): boolean {
  try {
    return document.cookie.split('; ').some((c) => c === `${SESSION_MARKER_KEY}=1`);
  } catch {
    return false;
  }
}

export function hasSessionMarker(): boolean {
  try {
    if (localStorage.getItem(SESSION_MARKER_KEY) === '1') return true;
  } catch {
    // localStorage 접근 불가 — 쿠키로 폴백
  }
  return hasMarkerCookie();
}

function setSessionMarker(on: boolean): void {
  try {
    if (on) localStorage.setItem(SESSION_MARKER_KEY, '1');
    else localStorage.removeItem(SESSION_MARKER_KEY);
  } catch {
    // localStorage 접근 불가 환경 — 무시
  }
  // refresh 실패 등 서버 호출 없이 클라이언트가 로그아웃할 때 마커 쿠키도 즉시 만료시킨다.
  if (!on) {
    try {
      document.cookie = `${SESSION_MARKER_KEY}=; path=/; max-age=0`;
    } catch {
      // document 접근 불가 — 무시
    }
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
