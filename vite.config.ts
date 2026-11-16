import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const SERVER_URL = 'http://localhost:3001';

export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  server: {
    port: 5173,
    // In development the Express + Socket.IO server runs separately; proxy the socket so
    // the browser talks to a single origin, exactly like in production.
    proxy: {
      '/socket.io': { target: SERVER_URL, ws: true },
      '/api': { target: SERVER_URL },
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
});
