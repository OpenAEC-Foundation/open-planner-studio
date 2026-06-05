import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import pkg from './package.json';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Per-worktree instance slug (set by scripts/tauri-dev.mjs); '' in a plain
    // build. Used to isolate the auto-save recovery file across worktrees.
    __OPS_DEV_INSTANCE__: JSON.stringify(process.env.OPS_DEV_INSTANCE ?? ''),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Port comes from scripts/tauri-dev.mjs (OPS_DEV_PORT) so the desktop
    // window's devUrl always matches. strictPort makes a clash fail loudly
    // instead of silently drifting to another port — see scripts/tauri-dev.mjs.
    port: Number(process.env.OPS_DEV_PORT) || 3007,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
