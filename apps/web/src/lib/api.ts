import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  withCredentials: true,
});

let isRefreshing = false;
let queue: Array<(ok: boolean) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    const axiosError = error as import('axios').AxiosError & { config: { _retry?: boolean } };
    const original = axiosError.config;

    if (!original || axiosError.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => queue.push((ok) => (ok ? resolve(api(original)) : reject(error))));
    }

    original._retry = true;
    isRefreshing = true;

    try {
      await api.post('/auth/refresh');
      queue.forEach((cb) => cb(true));
      return api(original);
    } catch {
      queue.forEach((cb) => cb(false));
      useAuthStore.getState().clearAuth();
      window.location.replace('/login');
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
      queue = [];
    }
  },
);
