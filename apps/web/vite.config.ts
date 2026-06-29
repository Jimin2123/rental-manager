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

export default defineConfig({
  plugins: [TanStackRouterVite({ routesDirectory: './src/routes' }), react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/auth': apiProxy(),
      '/organizations': apiProxy(),
      '/invitations': apiProxy(),
      '/assets': apiProxy(),
      '/business-partners': apiProxy(),
      '/products': apiProxy(),
      '/customers': apiProxy(),
      '/orders': apiProxy(),
      '/quotations': apiProxy(),
      '/rental-contracts': apiProxy(),
      '/invoices': apiProxy(),
      '/payments': apiProxy(),
      '/refunds': apiProxy(),
      '/tax-invoices': apiProxy(),
      '/service-requests': apiProxy(),
      '/service-visits': apiProxy(),
      '/maintenance-schedules': apiProxy(),
    },
  },
});
