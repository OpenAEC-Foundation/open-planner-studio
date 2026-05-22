# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (port 3007, falls back if taken)
npm run build        # tsc --noEmit + vite build → dist/
npm run preview      # Serve the built bundle
npm run tauri:dev    # Run the desktop app (Tauri 2)
npm run tauri:build  # Produce desktop installers
```

There is no test runner and no lint script. `tsc` (invoked via `npm run build`) is the only static check; TypeScript is in `strict` mode with `noUnusedLocals`/`noUnusedParameters`, so build failures often surface dead code. CI (`.github/workflows/ci.yml`) only runs `tauri build --no-bundle` on Ubuntu/Windows/macOS.

Path alias: `@/` → `src/` (configured in both `vite.config.ts` and `tsconfig.json`). Use it consistently in imports.

## Architecture

This is a Tauri 2 desktop app (Rust shell + React 19 frontend) for construction planning. The browser dev build is fully functional except for file I/O and auto-save, which are gated behind a Tauri runtime check:

```ts
const isTauri = () => '__TAURI_INTERNALS__' in window;
```

Any code that touches `@tauri-apps/*` must be either dynamically imported inside an `isTauri()` branch (see `App.tsx` auto-save) or otherwise guarded — top-level imports of Tauri plugins will break the web build.

### IFC is the native file format, not a sidecar

The application's persistence model is IFC 4.3 (buildingSMART). Loading a project = parsing IFC via `src/services/ifc/ifcReader`; saving = serializing the entire app state via `ifcWriter`. There is no separate JSON project format. When adding new domain data (tasks, sequences, resources, assignments, calendar), it must round-trip through the IFC layer or it will be lost on save/reload. CSV/MS Project/P6 services in `src/services/` are import/export adapters, not the source of truth.

### Rendering: Canvas 2D, not DOM

The Gantt chart is drawn imperatively to a `<canvas>` via `src/engine/renderer/` (`GanttRenderer`). Bars, dependencies, the timescale, and hit-testing all live in renderer code — not React components. When changing visual behavior of the Gantt, edit the renderer; React only owns the surrounding chrome (ribbon, panels, dialogs, status bar). The table view (`TableEditor`) is a separate DOM-based editor over the same store.

### State: Zustand + Immer with sliced store

`src/state/appStore.ts` is the single store; it composes slices from `src/state/slices/`. State is mutated through Immer producers. Domain types live in `src/types/`. The scheduler (`src/engine/scheduler/CPMSolver`, `CalendarEngine`) reads from the store and writes computed fields (early/late dates, total float, critical-path flag) back via slice actions; the renderer reads only.

### Ribbon-driven UI

The shell is a Microsoft Office-style ribbon (`src/components/layout/Ribbon`) with tabs Start / Planning / Beeld / Instellingen / Tabel / IFC / Rapport, plus a Backstage view (`src/components/backstage/`) for File. The active tab is in `ui.activeRibbonTab`. Right-hand panels (`TaskPropertiesPanel`, `TableEditor`, `IFCPanel`, `ReportPanel`, `DebugTerminal`) are mounted conditionally based on UI state and the collapse state in `ui.rightPanelCollapsed` / `ui.rightPanelWidth`.

### i18n

Six locales (`nl`, `en`, `fr`, `de`, `es`, `zh`) via `react-i18next` configured in `src/i18n/config.ts`. Default language is Dutch — user-facing strings throughout the codebase and docs are in Dutch. Always go through `t(...)`; never hard-code visible text.

### Settings persistence

`src/utils/settingsStore.ts` wraps `@tauri-apps/plugin-store` and falls back to `localStorage` in the browser. Theme, zoom defaults, and the debug-terminal toggle are loaded on mount in `App.tsx`. Auto-save (60s interval) is Tauri-only and writes to `appDataDir`.

## Docs

- [PLAN.md](PLAN.md) — large project plan, source of truth for roadmap.
- [docs/archive/superpowers/](docs/archive/superpowers/) — historical design docs and implementation plans for shipped features (zoom, debug terminal, stylebook). Archived; useful for context on *why* something was built, not *what* exists now — verify against current code.
