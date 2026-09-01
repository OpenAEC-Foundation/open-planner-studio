# AGENTS.md

Compact guide for AI agents working in this repo. The canonical deep-dive is
[`CLAUDE.md`](CLAUDE.md) — read it before non-trivial work. This file captures
only what an agent would otherwise get wrong.

## Commands

```bash
npm run dev          # Dev launcher (scripts/dev-server.mjs) — per-worktree fixed port, refuses double start
npm run build        # tsc --noEmit && vite build → dist/  ← main static check
npm run tauri:dev    # desktop app via scripts/tauri-dev.mjs (picks first free port ≥3007)
npm run tauri:build  # desktop installers
npm run bump X.Y.Z   # CalVer sync (package.json + tauri.conf.json; Cargo.toml stays 0.1.0)
npm run verify       # THE gate — literally what CI, the release gate and the deploy gate run
npm run typecheck    # tsc --noEmit over src/ AND scripts/+tests/ (tsconfig.tests.json)
npm test             # all four behavioral suites
bash tests/planning/run.sh cases-<x>.json  # one battery
```

- **No lint script and no formatter.** `tsc` is the static gate; `tsconfig.json`
  is `strict` with `noUnusedLocals` + `noUnusedParameters`, so dead code and
  unused params fail the build.
- **`npm run verify` is one definition, in `package.json`** — ci.yml, the
  release gate and the deploy gate all run that single line, so what passes
  locally is exactly what passes in CI. It covers typecheck + `npm test` +
  `verify:examples` + `verify:docs` + `verify:i18n`.
- Four behavioral suites behind `npm test`: `tests/planning/` (data-driven
  CPM/calendar cases + `check-*.ts` contract tests, headless on Node via
  esbuild), `tests/library/`, `tests/mcp/`, and `tests/dev-server/` (`node:test`
  + an integration script). Run the planning suite after touching anything in
  `src/engine/scheduler/`, `src/engine/calendar/`, or the `runCPM` action.
- Node 22 (see CI). Rust stable required only for `tauri:*` commands.
- New user-visible strings go through `t(...)` in all fourteen locales;
  `npm run verify:i18n` checks that, CLDR plural categories included.

## Architectural facts that bite

- **IFC 4.3 is the native file format, not a sidecar.** Load = parse via
  `src/services/ifc/ifcReader`; save = serialize whole state via `ifcWriter`.
  There is no JSON project format. Any new domain data (tasks, sequences,
  resources, assignments, calendar) must round-trip through the IFC layer or
  it is lost on save/reload. CSV/MS Project/P6 services are import/export
  adapters, not the source of truth.
- **The Gantt is Canvas 2D, not DOM.** Bars, dependencies, timescale and
  hit-testing live imperatively in `src/engine/renderer/` (`GanttRenderer`).
  React only owns surrounding chrome (ribbon, panels, dialogs, status bar).
  Change visual Gantt behavior in the renderer, not in components.
- **One Zustand+Immer store, composed of slices.** `src/state/appStore.ts`
  spreads slice-creators from `src/state/slices/`; each slice is typed
  (`AppSlice<XSlice>`) against the **full** `AppState`, so cross-slice
  actions (runCPM, undo/redo, file I/O) mutate the whole draft. Add new
  state/actions to the matching slice.
- **New project data goes in `DOCUMENT_FIELDS`** (`src/state/documentContract.ts`)
  — one descriptor list stating, per field, where it lives in the live state, its
  fresh default, and its role in the undo snapshot. `capturePayload`/
  `hydratePayload`/`freshPayload` walk that single list, so capture and hydrate
  cannot diverge, and a `DocumentPayload` field missing from the list is a
  **compile error**. `snapshot.ts` derives the undo snapshot from it,
  `transaction.ts` wraps the mutate ritual, `ifcSaveInput.ts` picks the
  round-trip fields for an IFC save. Skip this and your field silently dies on
  document switch, undo, crash recovery and save.
- **Scheduling is manual, not reactive.** `runCPM` instantiates
  `CalendarEngine` + `CPMSolver` inline and writes computed fields back via
  Immer. It does **not** re-run on edit — trigger it explicitly (F5, ribbon
  Calculate, menu, after IFC load). Editing tasks without `runCPM` leaves the
  schedule stale.
- **Undo/redo is snapshot-based.** Mutating actions push a full `Snapshot`
  before mutating.
- **Multi-document is single-active.** Top-level state is one document;
  `documentSlice` keeps the rest as `DocumentPayload` snapshots and swaps on
  switch/new/close. App-global state (most of `ui`, `taskClipboard`) is not
  swapped — that's how copy/paste works across documents.

## Tauri / web-build guard

```ts
const isTauri = () => '__TAURI_INTERNALS__' in window;
```

- Anything importing `@tauri-apps/*` must be **dynamically imported inside an
  `isTauri()` branch** (or otherwise guarded). Top-level Tauri plugin imports
  break the web build (`dist/` is a real production deploy, not just dev).
  Since v2026.7.11 the browser build does its own file I/O (File System
  Access API on Chromium, download-fallback elsewhere) and auto-save
  recovery (IndexedDB) — only the in-app updater is Tauri-only.
- **Rust backend is thin.** File I/O funnels through `src/services/fileAccess/`
  (runtime-dispatched: Tauri `plugin-fs`/`plugin-dialog` vs web File System
  Access API, unified via a `FileRef` model), not `invoke`. The only
  `invoke()` in `src/` is `install_kind` in
  `src/services/updater/updaterService.ts`. When adding file operations,
  extend `fileAccess` — not a Rust command.
- Enabled plugins: fs, dialog, shell, store, os, updater, process,
  clipboard-manager. App id `org.openaec.planner`.

## Conventions

- Path alias **`@/` → `src/`** (in both `vite.config.ts` and `tsconfig.json`).
  Use it consistently.
- **Working language is Dutch** for code comments, commit messages, and the
  canonical source translations. User-facing strings must go through `t(...)`
  (never hard-code) — 14 locales in `src/i18n/`; `ar` and `fa` are RTL.
- **`immer` is pinned EXACTLY (`"11.1.4"`, no caret) — the only dependency of 37
  that is.** Do not "restore consistency" by putting the `^` back. Immer sits
  directly under undo/redo, snapshot sharing (`src/state/snapshot.ts` deliberately
  shares references instead of cloning) and auto-freeze, so a silent minor bump
  changes the semantics of the state layer. It also breaks the build: from
  **11.1.8** onward `current`/`original` are typed `<T>(value: Draft<T>): T`
  instead of `<T>(value: T)`, and `isDraft()` is not a type guard — see
  `src/state/immerDraft.ts`. `npm ci` was always safe (all four workflows use it),
  but `npm update` would move it: measured `change immer 11.1.4 => 11.1.18` with
  the caret, nothing without. Bumping it is a deliberate, separately reviewed
  change — read the changelog for draft/freeze/structural-sharing behaviour first.
- Settings persist to **`localStorage` under `ops-`-prefixed keys**
  (`src/utils/settingsStore.ts`). `@tauri-apps/plugin-store` is a dependency
  but **unused** — do not reach for it for settings.
- Project auto-save runs in **both** Tauri and browser: **throttled to 10 s** in
  `src/hooks/useAutoSave.ts` (a throttle, not a debounce — a debounce would only
  write 10 s after the *last* edit and so widen the data-loss window during a long
  editing session), one IFC snapshot per open document via
  `src/services/recovery/recoveryStore.ts` (Tauri: `appDataDir`; web:
  IndexedDB), keyed by worktree instance slug.
- **`public/docs/` is a documentation subsystem with its own CI gate** — 27
  articles × 14 languages plus a manifest, feeding the in-app help viewer
  (Backstage → Help) and the generated GitHub wiki (`npm run publish:wiki`;
  never hand-edit the wiki). Articles render through a *limited* Markdown subset
  (`src/utils/miniMarkdown.tsx`): no tables, no blockquotes, no h4, no raw HTML,
  and only `docs://`/`examples://` links. `npm run verify:docs` enforces all of
  that. A user-visible feature needs an article (at minimum `nl` + `en`) or it is
  undiscoverable.

## Worktrees (how concurrent dev instances coexist)

- Worktrees live under `.claude/worktrees/`. `vite.config.ts` explicitly
  ignores that path (anchored to `__dirname`) so a dev server here doesn't
  blow past `fs.inotify.max_user_watches` watching sibling worktrees.
- `scripts/tauri-dev.mjs` picks the first free port ≥3007 and derives a slug
  from the worktree directory name; the desktop window's `devUrl` and the
  auto-save recovery filename both follow it. Multiple worktrees can run
  `tauri:dev` at once without clobbering each other.
- Call a UI change “working in the app” only after you have verified that the
  active localhost server serves the worktree and commit containing that
  change. If the change lives only in an isolated worktree, state its exact
  localhost URL; never imply that another already-open localhost tab includes
  it.

## Self-test harness

- Dev-only hook `window.__OPS__` (installed by `src/utils/devBridge.ts`:
  store, log-bus, `extensions.*`) against the **browser** dev build.
  Prefer asserting via store state over canvas pixels. Details in
  [`docs/self-test-harness.md`](docs/self-test-harness.md).

## Key paths

| Concern | Location |
|---|---|
| Store composition root | `src/state/appStore.ts` |
| Slices | `src/state/slices/` |
| CPM solver / calendar engine | `src/engine/scheduler/`, `src/engine/calendar/` |
| Canvas renderer | `src/engine/renderer/` |
| IFC read/write | `src/services/ifc/ifcReader`, `ifcWriter` |
| File I/O (Tauri↔web) | `src/services/fileAccess/` (+ `recentFiles.ts`) |
| Auto-save / recovery | `src/services/recovery/recoveryStore.ts` |
| Rust commands (thin) | `src-tauri/src/commands/mod.rs` |
| Tauri config | `src-tauri/tauri.conf.json` |
