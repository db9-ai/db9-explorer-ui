import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    proxy: {
      // In production, `db9 explore` runs the proxy.
      // In development, Vite proxies /api → api.db9.ai with
      // DB9_TOKEN injected as Authorization header.
      '/api': {
        target: process.env.DB9_API_URL || 'https://api.db9.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: true,
        configure: (proxy) => {
          const token = process.env.DB9_TOKEN;
          if (token) {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${token}`);
            });
          }
        },
      },
    },
  },
})
