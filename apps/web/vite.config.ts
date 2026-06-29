import path from 'path';
import type { IncomingMessage } from 'http';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

// 브라우저 전체 페이지 네비게이션(text/html)은 SPA에게 위임,
// AJAX(application/json 등)만 API로 프록시
const apiProxy = (target = 'http://localhost:3000') => ({
  target,
  changeOrigin: true,
  bypass: (req: IncomingMessage) => {
    const url = req.url ?? '';
    if (/\/auth\/social\/(link\/)?[^/]+\/(redirect|callback)/.test(url)) return undefined;
    const accept = (req.headers?.['accept'] as string) ?? '';
    if (accept.includes('text/html')) return '/index.html';
  },
});

const API_TARGET = 'http://localhost:3000';

export default defineConfig({
  plugins: [TanStackRouterVite({ routesDirectory: './src/routes' }), react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      // 모든 XHR API 호출 — dev에서 axios baseURL이 '/api'(lib/api.ts).
      // '/api' 한 줄이 전 도메인을 자동 커버하고, rewrite로 prefix를 떼어 백엔드에 전달한다.
      // 신규 백엔드 도메인 추가 시 프록시 수정 불필요.
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
      // 소셜 로그인 전체 페이지 리다이렉트/콜백(브라우저 네비게이션, axios 아님 → '/api' 미경유).
      '/auth/social': apiProxy(API_TARGET),
    },
  },
});
