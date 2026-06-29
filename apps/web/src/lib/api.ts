import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

// dev: 모든 API 호출을 '/api' 네임스페이스로 보내 vite 프록시 1개가 백엔드로 전달(신규 도메인 자동 커버).
// prod: 기존대로 VITE_API_URL(없으면 same-origin) 직접 호출 — DEV 가드로 prod 동작 불변.
const baseURL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL ?? '');

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

// interceptor를 타지 않는 별도 인스턴스 — refresh 전용
const refreshApi = axios.create({
  baseURL,
  withCredentials: true,
});

let isRefreshing = false;
let queue: Array<(ok: boolean) => void> = [];

// refresh 시도가 불필요한 엔드포인트 (로그인/리프레시 자체가 401이면 retry 없이 거부)
const NO_RETRY_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const axiosError = error as import('axios').AxiosError & { config: { _retry?: boolean } };
    const original = axiosError.config;

    if (!original || axiosError.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    const url = original.url ?? '';
    if (NO_RETRY_PATHS.some((path) => url.endsWith(path))) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => queue.push((ok) => (ok ? resolve(api(original)) : reject(error))));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      await refreshApi.post('/auth/refresh');
      queue.forEach((cb) => cb(true));
      return api(original);
    } catch {
      queue.forEach((cb) => cb(false));
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
      queue = [];
    }
  },
);
