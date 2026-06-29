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

// 백엔드(NestJS, :3000)로 프록시할 API 최상위 경로.
// dev 프록시는 catch-all이 불가하므로(vite 내부 자산까지 가로챔) 경로 prefix를 열거한다.
// **새 백엔드 도메인 추가 시 이 배열에 한 줄 추가** — 누락 시 dev에서 해당 API 호출이 SPA로 빠져 깨진다.
const API_PROXY_PATHS = [
  '/auth',
  '/organizations',
  '/invitations',
  '/assets',
  '/business-partners',
  '/products',
  '/customers',
  '/orders',
  '/quotations',
  '/rental-contracts',
  '/invoices',
  '/payments',
  '/refunds',
  '/tax-invoices',
  '/service-requests',
  '/service-visits',
  '/maintenance-schedules',
  '/audit-logs',
];

export default defineConfig({
  plugins: [TanStackRouterVite({ routesDirectory: './src/routes' }), react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: Object.fromEntries(API_PROXY_PATHS.map((p) => [p, apiProxy()])),
  },
});
