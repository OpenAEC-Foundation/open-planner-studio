import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import pkg from './package.json';

/**
 * Mappen die de dev-server mag serveren.
 *
 * In een git worktree is `node_modules` een symlink naar de hoofdcheckout, die buiten de Vite-root
 * ligt. Vite weigert dan alles wat erdoorheen wordt opgevraagd ("outside of Vite serving allow
 * list") — in de praktijk de @fontsource-woff2-bestanden, waardoor elke worktree-dev met
 * systeemfonts draait in plaats van met Inter. Het ECHTE pad van node_modules toestaan lost dat op;
 * in een gewone checkout valt dat samen met de root en verandert er niets.
 *
 * De realpath staat bewust in een try/catch: deze config wordt óók door `vite build` in CI geladen,
 * en `fs.realpathSync` gooit hard (ENOENT) als node_modules er op dat moment niet is. Zonder vangnet
 * zou dat een onbegrijpelijke configfout geven in plaats van een nette melding. Faalt hij, dan
 * blijft alleen de root over — exact het gedrag van vóór deze toevoeging.
 */
function allowedFsRoots(): string[] {
  const root = path.resolve(__dirname);
  try {
    return [root, fs.realpathSync(path.resolve(root, 'node_modules'))];
  } catch {
    return [root];
  }
}
// @ts-expect-error — dev-port.mjs is plain JS zonder types
import { worktreeRoot, readRecordedPort } from './scripts/dev-port.mjs';

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
    // Poort: launcher zet OPS_DEV_PORT; anders de vastgelegde opsDevPort van dit
    // worktree; anders 3007. readRecordedPort/worktreeRoot gooien nooit (CI: vite
    // build in een .claude-loze checkout). strictPort maakt een clash luid.
    port: Number(process.env.OPS_DEV_PORT) || readRecordedPort(worktreeRoot()) || 3007,
    strictPort: true,
    // Zie allowedFsRoots(): laat de dev-server door de node_modules-symlink van een worktree heen.
    fs: { allow: allowedFsRoots() },
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
          // MPP-lezer (CFB-container + fieldmaps, fase 3.8 e1, T8): alleen dynamisch geïmporteerd
          // via de mpp-entry in formatRegistry.ts, dus een eigen chunk houdt hem uit de main graf.
          if (id.includes('/src/services/mpp/')) return 'mpp-reader';
          // XER-lezer: byteparser, kalenderdecoder en semantische reader worden alleen via de
          // registry geladen en blijven samen in een eigen lazy chunk.
          if (id.includes('/src/services/xer/')) return 'xer-reader';
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
