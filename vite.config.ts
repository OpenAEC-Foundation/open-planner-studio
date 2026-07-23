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
    watch: {
      // Sibling git worktrees under .claude/worktrees/ each carry a full src
      // tree (14 locales × 4 namespaces + all components). Watching them
      // recursively multiplies inotify usage ~10× and blows past
      // fs.inotify.max_user_watches (ENOSPC) once a second dev server starts —
      // the main dev server has no business watching other worktrees. Appended
      // to Vite's defaults (node_modules/.git stay ignored).
      //
      // BELANGRIJK: anker deze paden aan __dirname (de ACTIEVE root) i.p.v. een
      // vrije glob. Een glob als '**/.claude/worktrees/**' matcht namelijk óók de
      // eigen bestanden zodra je de dev-server ván binnen een worktree draait
      // (het root-pad bevat dan zelf '.claude/worktrees/') — dan negeert Vite de
      // hele src-boom en valt HMR volledig stil: je krijgt stilzwijgend verouderde
      // modules geserveerd. Absoluut ankeren negeert alleen worktrees ONDER deze
      // root, dus de ENOSPC-bescherming blijft intact vanuit de hoofdmap.
      ignored: [
        path.resolve(__dirname, '.claude/worktrees') + '/**',
        path.resolve(__dirname, 'dist') + '/**',
      ],
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Split large, stable code out of the main entry chunk into separate
        // vendor/data chunks. This is pure output partitioning — no module is
        // made async, so runtime load order/timing is unchanged. The benefit is
        // a smaller main chunk and better browser caching: a vendor bump (or an
        // app-code edit) only invalidates the chunk it touches, not everything.
        manualChunks(id) {
          // Translation JSON: één chunk per taal. Alleen 'en' is statisch
          // geïmporteerd (blijft dus eager); de overige 13 talen worden enkel
          // dynamisch via loadLocale() geïmporteerd en worden daardoor async
          // chunks die pas bij een taalwissel/-detectie geladen worden.
          if (id.includes('/src/i18n/locales/')) {
            const m = id.match(/\/locales\/([^/]+)\//);
            return m ? `locale-${m[1]}` : 'locales';
          }
          if (id.includes('/node_modules/')) {
            // React runtime (react, react-dom, its scheduler dep).
            if (
              /\/node_modules\/(react|react-dom|scheduler)\//.test(id) ||
              /\/node_modules\/react@/.test(id)
            ) {
              return 'react-vendor';
            }
            // i18n stack (i18next + react-i18next).
            if (/\/node_modules\/(i18next|react-i18next)\//.test(id)) {
              return 'i18n-vendor';
            }
            // Icon set (lucide-react) — large and tree-shaken but worth isolating.
            if (/\/node_modules\/lucide-react\//.test(id)) {
              return 'icons-vendor';
            }
            // State management (zustand + immer).
            if (/\/node_modules\/(zustand|immer)\//.test(id)) {
              return 'state-vendor';
            }
          }
          return undefined;
        },
      },
    },
  },
});
