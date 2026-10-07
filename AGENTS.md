# AGENTS.md

Open Planner Studio: a Tauri 2 desktop app (Rust shell + React 19) for construction scheduling,
OpenAEC Foundation, LGPL-3.0. The browser build is a real production deploy (`live.yml`), not a dev target.

This file is the **single source of agent instructions** for this repo, for every agent. `CLAUDE.md` only
imports it (`@AGENTS.md`) so Claude Code loads it automatically — never put content there. Area-specific
depth lives in `.claude/rules/` (see *Where the depth lives*); Claude Code loads those per path, other agents
should read the matching rule file before touching that area.

## Commands

```bash
npm run dev          # browser dev; fixed port per worktree (3007–3106), refuses a double start
npm run tauri:dev    # desktop app, same port assignment
npm run build        # tsc && vite build → dist/
npm run verify       # THE gate — the same steps as CI (split in parallel), release and deploy gate
npm run typecheck    # tsc over src/ AND scripts/+tests/ — use this, not just build (incremental)
npm run lint         # deliberately minimal ESLint (promises, control-regex, React hooks)
npm run lint:fast    # same lint with a cache, for iterating; `lint` stays the gate
npm test             # all five suites
npm run tauri:build  # installers
npm run bump X.Y.Z   # CalVer version sync (Cargo.toml deliberately stays 0.1.0)
```

Single suites: `npm run test:planning`, `npm run test:library`, `npm run test:mcp`, `npm run test:dev-server`,
`npm run test:browser` (one-time: `npx playwright install --with-deps --only-shell chromium`).
`npm run test:browser:x11` runs headed locally and needs `OPS_XER_CORPUS` + a desktop display; it does not
replace the corpus-free CI gate.
One battery: `bash tests/planning/run.sh cases-<x>.json` or `bash tests/planning/run.sh check-<x>.ts`.
A new `check-*.ts` runs automatically (also in the timezone matrix); add your own `if bundle_check` line in
`tests/planning/run.sh` only for an environment variable, a fixed order or no matrix (grep a neighbouring check).
New `cases-*.json`: extend `EXPECTED_BATTERIES` — do not read run.sh (~1.7k lines) in full.

**`npm run verify` is one definition, in `package.json`** — the release and deploy gates run that line; ci.yml
runs the same steps in parallel jobs via `scripts/verify-parts.mjs`, which reads them from that definition. The
steps, in order: `typecheck` → `lint` → `test` (all five suites) → `verify:examples` → `verify:docs` →
`verify:i18n` → `verify:release-highlights-json` → `verify:store-boundaries` → `verify:conventions` →
`verify:gantt-boundaries` → `verify:cycles` → `verify:text-roles`.

Separate gates (most are in `verify`): `npm run verify:examples` (examples load/compute),
`npm run verify:docs` (in-app guides + the mechanical claims in this file), `npm run verify:i18n` (keys + CLDR
plural forms + no cast on a key + fixed formatting), `npm run verify:store-boundaries` and
`npm run verify:gantt-boundaries` (AST gates: store, renderer, viewport, pointer and table boundaries),
`npm run verify:conventions` (AST gate: `src/engine/` reads no source format, options keys only from the
convention registry, provenance data gates pinned), `npm run verify:cycles` (circular imports after type erasure),
`npm run verify:text-roles` (only the six text roles), `npm run verify:release-highlights-json` (in the chain)
and `npm run verify:release-highlights` (separate: local update highlights and stats before a tagged release).
`npm run verify:audit` is deliberately NOT in `verify` (Dependabot is the notification channel; an advisory gets
its own commit). `npm run measure:profiles` (separate) measures the cell baseline per scheduling profile (rule A:
no exact cell may become inexact); the P6 part needs `OPS_XER_CORPUS`.

Translations: `npm run i18n:add` puts one string in all 14 locales at once (recipe `docs/recepten/i18n-sleutel.md`),
`npm run i18n:fmt` puts the locale files in the fixed format (one key per line, `nl` order),
`npm run i18n:resolve` merges them per key after a `git merge` — run it even when git reports no conflict.

Generators/helpers: `npm run gen:examples` (regenerates `public/examples`), `npm run gen:tutorial-project`
(tutorial project nl/en to `build/tutorial-project/`, see `scripts/README.md`), `npm run gen:docs-screenshots -- --out <dir>`
(tutorial screenshots as WebP from the step scripts in `tests/browser/tutorials/`, which `test:browser` runs without
capturing), `npm run gen:release-highlights-json`,
`npm run publish:wiki` (dry run; `-- --push` publishes), `npm run stats:downloads` (downloads per OS from the
GitHub Releases API; the workflow publishes the JSON weekly to the `stats` data branch).

Node 22 (see CI). Rust stable only for the `tauri:*` commands.

## Testing pitfalls

- **Judge every suite by its exit code.** Intermediate lines such as "alles groen" only cover their own part;
  `tests/planning/` ends with `EINDOORDEEL planningssuite: GROEN/ROOD`, equal to the exit code.
  `grep '^XX'` only works there; `tests/library/` prints failure lines indented.
- The five suites behind `npm test`: `tests/planning/` (data-driven CPM/calendar cases + `check-*.ts` contract
  batteries + a timezone matrix, headless on Node via esbuild), `tests/library/`, `tests/mcp/`,
  `tests/dev-server/` (`node:test` + an integration script) and `tests/browser/` (real Chromium via Playwright).
- There is no vitest/jest. `tsc --strict` (`noUnusedLocals`/`noUnusedParameters`) is the main static check.
  ESLint only enforces `@typescript-eslint/no-floating-promises`, `@typescript-eslint/no-misused-promises`,
  `no-control-regex`, `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps` and unused `eslint-disable`
  suppressions — no formatter, no style rules; `import/no-cycle` is deliberately absent (`verify:cycles` covers it).
- Run the planning suite after every change to scheduling code; run `npm run verify` before you push —
  a red suite blocks both deploy and release.
- Browser tests use real browser events. The dev-only `window.__OPS__` bridge may set fixtures and read state,
  but never replace the user action under test.
- Never assume port 3007: read it from the dev-server output or `.claude/launch.json`.

### Which check after which change

| change | run |
|---|---|
| planning/scheduler code | `bash tests/planning/run.sh` in full before the PR (every `cases-*.json`, every `check-*.ts`, the timezone matrix) |
| one CPM/calendar case battery | `bash tests/planning/run.sh cases-<x>.json` — skips all `check-*.ts` batteries and the matrix |
| one targeted check | `bash tests/planning/run.sh check-<x>.ts` — skips all `cases-*.json` batteries and the matrix |
| document field / IFC round-trip | `npm run typecheck` + `check-document-contract.ts` / `check-ifc-roundtrip.ts`; full planning suite before the PR |
| i18n key | `npm run verify:i18n` |
| UI change | `node scripts/run-browser-tests.mjs tests/browser/smoke.spec.ts` (or a targeted spec), plus `window.__OPS__` |
| MCP tool | `bash tests/mcp/run.sh cases-<x>.ts` |
| library code | `bash tests/library/run.sh [check-<x>.ts]` |
| in-app docs/guides | `npm run verify:docs` |
| always, once, before push | `npm run verify` |

## Invariants that bite

- **Tauri guard.** `const isTauri = () => '__TAURI_INTERNALS__' in window;` — anything touching `@tauri-apps/*`
  is imported dynamically inside an `isTauri()` branch. A top-level import breaks the web build.
  Updater and MCP bridge are Tauri-only; the browser does its own file I/O and recovery.
- **Rust is thin.** Exactly three commands (`install_kind`, `mcp_bridge_start`, `mcp_bridge_stop`); every new
  command is public surface. File I/O: extend `src/services/fileAccess/`, not a Rust command.
- **IFC 4.3 is the native format**; there is no JSON project format. New domain data must round-trip through
  `ifcWriter`/`ifcReader`, or it is gone after saving. CSV/MSPDI/P6/`.mpp`/`.xer` are adapters. Route:
  `docs/ifc-round-trip.md`.
- **Document contract.** New project data belongs in `DOCUMENT_FIELDS` (`src/state/documentContract.ts`),
  otherwise it does not survive a document switch, undo, crash recovery or save. A `DocumentPayload` field
  missing from that list is a compile error.
- **One Zustand+Immer store built from slices** (`src/state/appStore.ts`); slices are typed against the full
  `AppState`. Core runtime factories and store-bound MCP tools never import `useAppStore`/`appStoreContext`.
  UI/dialog flags: type in `UIState` (`slices/types.ts`), action in `uiSlice.ts`; persistent settings in
  `src/utils/settingsRegistry.ts`. Undo/redo is snapshot-based (`beginUndoable` → mutation → `finishUndoable`).
- **Scheduling is manual, not reactive.** `runCPM` → `solveProject()`; call it after mutating tasks,
  relations or the calendar (store actions do not do it themselves; only the opt-in setting Automatisch berekenen,
  `ui.autoCalcCPM`, runs it via `useAutoCalcCPM`). Always set `scheduleStale` via `markScheduleStale`
  (`state/transaction.ts`), never directly. `CPMSolver.ts` (~4k lines): grep the method, do not read it whole.
  Write-back: `applyCpmResult.ts`; relations/lag: `relationMath.ts`.
- **Scheduling profiles, not a format flag.** P6/MSP/OPS behaviour runs through named conventions in
  `src/engine/scheduler/conventions/registry.ts`; the solver only gets `EffectiveSchedulingOptions` via
  `solveOptionsFor`/`solveInputFor`. Never an `if` on the source format in the engine (`verify:conventions`);
  engine work lands only if no exact cell becomes inexact (`measure:profiles`). Depth: `rekenprofielen` rule.
- **Work rules (task types).** A change to a task's duration, units, work or calendar goes through the
  work-rule bridge (`src/engine/work/workRuleApply.ts`: `captureTriangle` → mutation → `settle…`), never
  around it. Depth: `taaktypes` rule.
- **Gantt timeline = Canvas 2D** (`src/engine/renderer/`), the task grid = DOM (`FullTaskGrid`).
  Geometry: row↔y `GanttRenderer.getRowAtY/getTaskAtY`, date↔x `dateToX` in `timeAxis.ts` (workday axis:
  `workdayAxis.ts`); interaction in `src/components/canvas/hooks/`. Change visual Gantt behaviour in the
  renderer, not in components.
- **Notifications go through one channel** from the store — no `alert()` or ad-hoc toasts.
- **Text:** always via `t(...)`, never hard-coded, in all fourteen locales. Text sizes only via the six roles
  (`text-caption`…`text-title`); `text-xs`/`text-sm` no longer exist and silently do nothing.
- **Settings:** `localStorage` under `ops-` keys (no store plugin: the npm dependency `@tauri-apps/plugin-store`
  is gone; the Rust side still registers `tauri-plugin-store`, unused), declared in `settingsRegistry.ts`.
  A setting in `SettingsPanelContent` automatically appears in all three places (⚙, Settings tab, Backstage);
  a remembered view choice via a ribbon button or dragging does not belong there.
- **Auto-save** (crash recovery) is throttled to 10 s — deliberately a throttle, not a debounce. Runs in both
  Tauri (`appDataDir`) and browser (IndexedDB), keyed by worktree instance slug.
- **`immer` is pinned exactly to `11.1.4` (no `^`) — do not put the caret back.** Immer sits directly under
  undo/redo, snapshot sharing and auto-freeze; from 11.1.8 the build breaks too (typing of `current`/`original`,
  see `src/state/immerDraft.ts`). Bumping is a deliberate, separately reviewed change.
- Path alias `@/` → `src/`; use it consistently.

## Facts that `verify:docs` guards here

- Ribbon tabs (`RibbonTab`): `file`, `start`, `planning`, `resources`, `beeld`, `instellingen`, `table`,
  `ifc`, `report`, `ai` (only with `ui.aiMode`). Source: `slices/types.ts`.
- Backstage sections (`BackstageSection`): `recent`, `examples`, `export`, `import`, `print`, `project-info`,
  `settings`, `extensions`, `library`, `help`.
- Fourteen locales (`nl, en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa`), each with four namespaces;
  `ar`/`fa` are RTL. A missing plural form falls back to English, not to `_other`.
- MCP: The 41 `planner_*` tools live in `src/services/mcp/tools/`. New tool: `docs/recepten/mcp-tool.md`.

## Worktrees and self-testing

- Worktrees live under `.claude/worktrees/`; `vite.config.ts` ignores that path. `dev` and `tauri:dev` share a
  fixed per-worktree port (`scripts/dev-port.mjs`, stamped in `.claude/launch.json`) and a slug, so several
  worktrees can run at once.
- Call a UI change "working in the app" only after verifying that the active localhost server serves the
  worktree and commit containing that change; otherwise state the exact localhost URL.
- `.mcp.json` wires up a Playwright MCP server (headless Chromium) to drive the browser dev build.
  `window.__OPS__` (`src/utils/devBridge.ts`) exposes store, log bus, `extensions.*` and observer-only geometry;
  prefer asserting on store state over canvas pixels. The app's own MCP bridge (`planner_*`) is the AI-assistant
  surface, not a test hook. Detail: `docs/self-test-harness.md`.

## Conventions

- **Working language is Dutch**: code comments, commit messages and the canonical source translations.
  This file is English on purpose; the `.claude/rules/` files are Dutch.
- **Side findings go to [`knownbugs.md`](knownbugs.md).** Anything you run into that is not part of your own
  task (bugs, odd behaviour, stale text or docs, wishes) gets an entry there, numbered and marked B (confirmed) or
  S (reported only); do not quietly fix it in an unrelated PR. A PR that fixes an entry removes it. Check the file
  before reporting a "new" bug.
- **User-visible feature ⇒ guide** in `public/docs/{nl,en}/` plus a manifest entry (recipe
  `docs/recepten/in-app-gids.md`). The docs exist in `nl` + `en` only, organised by Diátaxis (`kind`: how-to,
  explanation, reference; the tutorials ship as an extension); other UI languages read English with a notice.
  Renaming an article needs an alias in the manifest; ids the app uses live in `src/state/helpArticles.ts`.
  Those guides use a limited Markdown subset (no tables/blockquotes/h4/HTML). The GitHub wiki is generated,
  never edited by hand (`wiki` skill).
- **Releases**: only via the `release` skill; a `v*` tag is irreversible and rolls out to all users
  (updater + Snap Store). Release text in `docs/release-notes/v<version>.md`; `docs/CHANGELOG.md` only at release.
- The user term is "resourcebibliotheek"; code/IFC still say `companyId`/`companyName`.
- Screen evidence in a PR: `artifacts/<topic>/`, PNG ≤ ~150 KB, a handful; local QA screenshots in `qa/`.
- Changing the architecture, a command or a fact above? Update this file in the same PR.

## Where the depth lives

`.claude/rules/` (Dutch, loaded per path by Claude Code; other agents read the matching file before working there):

| rule | area |
|---|---|
| `state` | store, slices, document contract, `solveProject` |
| `tauri-ifc` | `src-tauri/`, `src/services/` (file access, IFC) |
| `mpp` / `xer` | MS Project `.mpp` and P6 `.xer` adapters |
| `rekenprofielen` | scheduling profiles / conventions, `CPMSolver.ts` |
| `contour` | resource contours, load, levelling |
| `taaktypes` | work rules / task types (`src/engine/work/`) |
| `gantt-splits` | renderer, canvas interaction, task grid, splits |
| `reports` | reports, PDF, print |
| `ui-shell` | layout, ribbon, backstage, panels, dialogs |
| `text-roles` | the six text roles (`*.tsx`, `*.css`) |
| `i18n` | `src/i18n/`, i18n scripts and tests |
| `settings-autosave` | settings, auto-save, recovery, stats |
| `extensions` | extension system |
| `mcp` | MCP bridge and `planner_*` tools |
| `library` | resource library |
| `docs-help` | in-app guides, help viewer, wiki |
| `tests` | test suites, Playwright, ESLint/tsconfig |
| `dev-server` | dev launcher, ports, `vite.config.ts` |
| `ci-release` | `.github/`, release notes, bump |
| `docs-index` | `docs/`, `PLAN.md`, `artifacts/` |

Skills in `.claude/skills/`: `release`, `wiki`, `docs-update`, `goed-plannen`, `progress-update` (source of the
last two: `public/skills/<name>/SKILL.md`, copied byte-identically; they are the agent skills that
`planner_get_planning_guide` hands out, next to the English agent guide `public/agent/planning-guide.md`).

Recipes: `docs/recepten/` (MCP tool, setting, translation key, ribbon tab, text size, in-app guide,
scheduling convention) and `docs/ifc-round-trip.md`. Self-test: `docs/self-test-harness.md`. Roadmap: `PLAN.md`
(§4 obsolete). Design docs: start at `docs/superpowers/README.md` — read them as *why*, not as *what exists*.

## Key paths

| Concern | Location |
|---|---|
| Store composition root | `src/state/appStore.ts` |
| Slices | `src/state/slices/` |
| CPM solver / calendar engine | `src/engine/scheduler/`, `src/engine/calendar/` |
| Canvas renderer | `src/engine/renderer/` |
| IFC read/write | `src/services/ifc/ifcReader`, `ifcWriter` |
| File I/O (Tauri↔web) | `src/services/fileAccess/` (+ `recentFiles.ts`) |
| Auto-save / recovery | `src/hooks/useAutoSave.ts`, `src/services/recovery/recoveryStore.ts` |
| Rust commands (thin) | `src-tauri/src/commands/mod.rs` (`install_kind`), `src-tauri/src/mcp_bridge.rs` (`mcp_bridge_start`/`mcp_bridge_stop`) |
| Tauri config | `src-tauri/tauri.conf.json` (app id `org.openaec.planner`) |
