import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Must match server PORT (default 5001). Override with VITE_API_PROXY if needed.
const apiProxy = process.env.VITE_API_PROXY || 'http://localhost:5001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxy,
        changeOrigin: true,
      },
    },
  },
});
