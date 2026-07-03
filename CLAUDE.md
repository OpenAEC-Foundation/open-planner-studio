# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (port 3007, strictPort — fails if taken; override with OPS_DEV_PORT)
npm run build        # tsc && vite build → dist/ (noEmit staat in tsconfig)
npm run preview      # Serve the built bundle
npm run tauri:dev    # Run the desktop app (Tauri 2) via scripts/tauri-dev.mjs
npm run tauri:build  # Produce desktop installers
npm run bump X.Y.Z   # CalVer-versie syncen (package.json + tauri.conf.json + lock; Cargo.toml blijft bewust 0.1.0)
bash tests/planning/run.sh   # CPM/kalender-regressiesuite (data-driven cases, headless op Node via esbuild)
```

`tauri:dev` goes through `scripts/tauri-dev.mjs`, which picks the first free port ≥3007, derives a per-worktree instance slug from the directory name, and starts `tauri dev` with a matching `--config` `devUrl` plus `OPS_DEV_PORT`/`OPS_DEV_INSTANCE` in the env. This lets **multiple worktrees run their desktop builds at once** — each gets its own port (so the window never loads another worktree's Vite) and its own `recovery.<slug>.*`-auto-save-bestanden (so concurrent instances don't clobber each other in the shared `appDataDir`). `vite.config.ts` reads `OPS_DEV_PORT` with `strictPort`; `App.tsx` reads the slug via the `__OPS_DEV_INSTANCE__` define.

There is no unit-test runner (vitest/jest) and no lint script. `tsc` (invoked via `npm run build`) is the main static check; TypeScript is in `strict` mode with `noUnusedLocals`/`noUnusedParameters`, so build failures often surface dead code. The one behavioral suite is `tests/planning/` — data-driven CPM/kalender-cases (231 stuks op dit moment) die de echte store + `CPMSolver`/`CalendarEngine` headless op Node draaien (`bash tests/planning/run.sh`, exit 0/1; zie `tests/planning/README.md`). Run it after touching scheduling code.

CI (`.github/workflows/`): `ci.yml` runs `tauri build --no-bundle` on Ubuntu/Windows/macOS; `live.yml` deploys the browser build (`dist/`) to `open-planner-studio.open-aec.com` on every push to `main` — the web build is a real production deployment, not just a dev target; `release.yml` + `snap.yml` build installers on `v*` tags (see *Auto-update & releases* below).

Path alias: `@/` → `src/` (configured in both `vite.config.ts` and `tsconfig.json`). Use it consistently in imports.

## Architecture

This is a Tauri 2 desktop app (Rust shell + React 19 frontend) for construction planning, part of the OpenAEC-Foundation desktop-app family (LGPL-3.0; extension system and styling follow Open Calc Studio). The browser dev build is fully functional except for file I/O, auto-save and the updater, which are gated behind a Tauri runtime check:

```ts
const isTauri = () => '__TAURI_INTERNALS__' in window;
```

Any code that touches `@tauri-apps/*` must be either dynamically imported inside an `isTauri()` branch (see `App.tsx` auto-save) or otherwise guarded — top-level imports of Tauri plugins will break the web build.

### The Rust backend is thin — file I/O uses JS plugins, not `invoke`

`src-tauri/src/commands/mod.rs` exposes three commands: `read_file` and `write_file` (both **unused** by the frontend) plus `install_kind` — the single `invoke()` call in `src/` sits in `src/services/updater/updaterService.ts` and uses it to detect the install type (appimage/snap/deb/native) and gate the updater. All real file I/O goes through `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog`, dynamically imported inside `isTauri()` branches: open/save project and export in `src/state/appStore.ts`, recovery auto-save in `App.tsx`, report export in `ReportPanel.tsx`. Follow that pattern — a plugin import, not a new Rust command — when adding file operations. All IFC parsing/serialization, scheduling, and rendering are TypeScript; Rust is just the shell. Enabled plugins: `fs`, `dialog`, `shell`, `store`, `os`, `updater`, `process`, `clipboard-manager`; app id `org.openaec.planner`.

### IFC is the native file format, not a sidecar

The application's persistence model is IFC 4.3 (buildingSMART). Loading a project = parsing IFC via `src/services/ifc/ifcReader`; saving = serializing the entire app state via `ifcWriter`. There is no separate JSON project format. When adding new domain data (tasks, sequences, resources, assignments, calendar), it must round-trip through the IFC layer or it will be lost on save/reload. CSV/MS Project/P6 services in `src/services/` are import/export adapters, not the source of truth. The other `src/services/` areas — `print/` (printvoorbeeld), `updater/`, `feedback/` (feedbackdialoog + screenshot-annotator) and `debug/appLog` (log-bus achter de DebugTerminal) — are app plumbing with no IFC impact.

### Rendering: Canvas 2D, not DOM

The Gantt chart is drawn imperatively to a `<canvas>` via `src/engine/renderer/` (`GanttRenderer`). Bars, dependencies, the timescale, and hit-testing all live in renderer code — not React components. When changing visual behavior of the Gantt, edit the renderer; React only owns the surrounding chrome (ribbon, panels, dialogs, status bar). The table view (`TableEditor`) is a separate DOM-based editor over the same store.

### State: één Zustand + Immer store, samengesteld uit slices

`src/state/appStore.ts` is een compositie-root: `create<AppState>()(immer(...))` spreidt twaalf slice-creators uit `src/state/slices/` (project, task, sequence, resource, schedule, history, view, ui, file, extension, document, structure). Elke slice is getypeerd als `AppSlice<XSlice>` (zie `slices/types.ts`) tegen de **volledige** `AppState`, zodat cross-slice acties (runCPM, undo/redo, newProject, file-I/O) gewoon de hele Immer-draft muteren. Nieuwe state/acties horen in de passende slice; `slices/types.ts` bevat daarnaast gedeelde type/enum-definities (`ViewState`, `UIState`, …). Domain-types staan in `src/types/`. De renderer leest alleen uit de store.

Multi-document is **single-active**: het actieve document leeft op top-level (project/tasks/sequences/… zoals altijd), zodat alle slices, componenten en de renderer single-document blijven. `documentSlice` bewaart de overige geopende documenten als losse `DocumentPayload`-snapshots en swapt top-level ↔ payload bij `switchDocument`/`newDocument`/`closeDocument`. Per-document: project, kalender, taken/relaties/resources/toewijzingen, selectie, `cpmResult`, `view`, `collapsedTaskIds`, undo/redo-stacks, `filePath`, `isDirty`. App-globaal (niet geswapt): de rest van `ui` en `taskClipboard` (zo werkt kopiëren/plakken tussen documenten). Er is altijd minstens één document; het laatste sluiten reset naar een leeg document. De document-chrome-UI staat in `src/components/layout/DocumentChrome/`: `DocumentTabBar`, `ProjectRail` en `SwitcherPill` zijn drie instelbare stijlen (`ui.documentChromeStyle` ∈ `'tabs' | 'rail' | 'switcher'`, persistent), plus een `ProjectOverview`-overlay en `CloseDocumentDialog` met 3-weg sluitbevestiging (opslaan/niet opslaan/annuleren); Ctrl/⌘ 1–9 springt naar het n-de document. `openFile`/`openRecentFile` openen in een **nieuw** document tenzij het actieve tabblad nog leeg en ongewijzigd is (`isActivePristine` in `fileSlice`); "Nieuw" opent de projectwizard (`ProjectInfoDialog` met kalender-presets en faseringssjablonen, via `ui.showNewProjectDialog`) in plaats van een kaal `newProject()`.

Scheduling is **manual, not reactive**: the `runCPM` action instantiates `CalendarEngine` + `CPMSolver` (`src/engine/scheduler/`) inline and writes computed fields (early/late dates, total float, critical-path flag) straight back via Immer — it does not re-run on every edit. It is triggered explicitly by F5, the ribbon **Calculate** button, the menu, and after an IFC load. Editing tasks without calling `runCPM` leaves the schedule stale, so call it after mutating tasks/sequences/calendar. Undo/redo is snapshot-based: mutating actions push a full `Snapshot` onto `undoStack` before mutating.

### Ribbon-driven UI

The shell is a Microsoft Office-style ribbon (`src/components/layout/Ribbon`) with tabs Start / Planning / Resources / Beeld / Instellingen / Tabel / IFC / Rapport, plus a Backstage view (`src/components/backstage/`) for File — sections: recent, export, import, print, project-info, settings, extensions (`BackstageSection` in `slices/types.ts`). The active tab is in `ui.activeRibbonTab`. Right-hand panels (`TaskPropertiesPanel`, `TableEditor`, `IFCPanel`, `ReportPanel`, `DebugTerminal`) are mounted conditionally based on UI state and the collapse state in `ui.rightPanelCollapsed` / `ui.rightPanelWidth`. Global dialogs (`UpdateDialog`, `FeedbackDialog` + `ScreenshotAnnotator`, `ProjectInfoDialog`) mount from `App.tsx` behind `ui.show*` flags.

### i18n

Fourteen locales (`nl, en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa`) via `react-i18next`, configured in `src/i18n/config.ts`; each locale has four namespaces (`common`, `task`, `report`, `menu`). `ar` and `fa` are RTL — `RTL_LOCALES` drives `document.documentElement.dir`. i18n initializes and falls back to **English** (`lng`/`fallbackLng: 'en'`); on startup `initLocale()` picks the saved preference, otherwise the OS/browser locale — it is not hard-defaulted to one language. The project's *working* language is Dutch, though: code comments, commit messages, and the canonical source translations are Dutch. Always go through `t(...)`; never hard-code visible text.

### Settings persistence

`src/utils/settingsStore.ts` persists settings to `localStorage` only, under `ops-`-prefixed keys — it does **not** use `@tauri-apps/plugin-store` (that package is a dependency but unused here). Theme, locale, zoom defaults, and the debug-terminal toggle load on mount in `App.tsx`; `initTheme()` migrates legacy theme names (7 → 3). Settings-UI-conventie: elke instelling moet op alle drie de plekken verschijnen — tandwiel-popup (⚙), Instellingen-ribbontab en Backstage → Instellingen — door één gedeeld component te gebruiken (`src/components/settings/SettingsPanelContent`).

Separately, project **auto-save** is Tauri-only: a debounced (800 ms) store subscription in `App.tsx` writes one IFC snapshot per open document to `appDataDir` — `recovery[.<slug>].<docId>.ifc` plus a `recovery[.<slug>].documents.json` manifest, with stale snapshots pruned — restored on next launch. The old single `recovery[.<slug>].ifc` is only read as a legacy fallback.

### Auto-update & releases

Versies zijn CalVer (`YYYY.M.patch`), gelijkgehouden tussen `package.json` en `src-tauri/tauri.conf.json` via `npm run bump` (`Cargo.toml` blijft bewust `0.1.0`). Release-flow: `npm run bump <versie>` → commit → tag `v*` → push; `release.yml` bouwt en signeert installers (Windows via Azure Trusted Signing; macOS universal, met `app`-target voor de updater) en publiceert `latest.json`; `snap.yml` verpakt daarna de release-`.deb` tot Snap (`snap/snapcraft.yaml`). De in-app updater checkt stil bij het opstarten (`App.tsx` → `updaterService`, `UpdateDialog`): endpoint is de GitHub-release-`latest.json`, geverifieerd met de minisign-pubkey in `tauri.conf.json`; Snap/AppImage-installs slaan de updater over (detectie via het `install_kind`-command).

### Extensiesysteem

Naar het model van Open Calc Studio (`OpenAEC-Foundation/open-calc-studio`): een extensie is een ZIP (of los `.js`) met `manifest.json` + `main.js` (CommonJS, exporteert `onLoad(api)`/`onUnload()`). Volledig frontend — geen Rust. Code in `src/extensions/` (types, api, loader, service), state in `extensionSlice`. Opslag: IndexedDB `ops-extensions`; uitvoering: `new Function(...)`-sandbox waarvan `require()` alleen `'open-planner-studio'` teruggeeft; permissies (`ribbon`, `events`, …) worden per API-call afgedwongen. UI: Backstage → Extensies (beheer/installeren/catalogus) en Backstage → Importeren (extensie-importers); extensie-ribbon-knoppen renderen via `ExtensionRibbonGroups`. Catalogus: `open-planner-studio-extensions/catalog.json` op GitHub raw (30 min cache). Extensies zijn app-niveau data (geen projectdata) — geen IFC-round-trip-impact; importer-resultaten (`ImportResult`) zijn gewone store-data. Zelftest-haken: `window.__OPS__.extensions.*` (dev-only). Auteurshandleiding: `docs/extensions.md`.

## Docs

- [PLAN.md](PLAN.md) — large project plan, source of truth for roadmap.
- [docs/TODO.md](docs/TODO.md) — lopende to-do-lijst met dingen die nog gedaan moeten worden.
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — changelog met alle noemenswaardige wijzigingen.
- [docs/self-test-harness.md](docs/self-test-harness.md) — how Claude drives the app to self-test changes. Tier 1 (default): Playwright MCP (`.mcp.json`) + the dev-only `window.__OPS__` hook (installed by `src/utils/devBridge.ts`: store, log-bus, `extensions.*`) against the **browser** dev build (`npm run dev`, port 3007) — assert via store state, not canvas pixels. Tier 2 (opt-in): `tauri-driver` for the real desktop window.
- [docs/superpowers/](docs/superpowers/) — actieve ontwerp- en implementatiedocs (auto-update, snap-packaging, multi-worktree-dev-isolatie, UI-overhaul, planning-correctheid-testplan).
- [docs/planning-test-bevindingen.md](docs/planning-test-bevindingen.md) — bevindingen van het CPM-correctheidsonderzoek dat de `tests/planning/`-suite opleverde.
- [docs/archive/superpowers/](docs/archive/superpowers/) — historical design docs and implementation plans for shipped features (zoom, debug terminal, stylebook). Archived; useful for context on *why* something was built, not *what* exists now — verify against current code.
- [docs/extensions.md](docs/extensions.md) — handleiding voor extensie-auteurs (manifest, API, installeren).
- [tests/planning/README.md](tests/planning/README.md) — hoe de CPM/kalender-regressiesuite werkt en hoe je cases toevoegt.
