import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// The studio (editor, admin) is a small Preact SPA served by Fastify from dist/studio.
export default defineConfig({
  root: 'studio',
  base: '/',
  plugins: [preact()],
  build: {
    outDir: '../dist/studio',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 400,
  },
});
