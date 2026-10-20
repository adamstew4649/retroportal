import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base keeps the same build working at a domain root, in a GitHub
// Pages repository subdirectory, and inside the browser extension.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    assetsInlineLimit: 2048,
  },
  server: {
    port: 5173,
  },
});
