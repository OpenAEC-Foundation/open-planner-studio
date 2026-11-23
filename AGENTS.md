# AGENTS.md

Open Planner Studio: a Tauri 2 desktop app (Rust shell + React 19) for construction scheduling,
OpenAEC Foundation, LGPL-3.0. The browser build is a real production deploy (`live.yml`), not a dev target.

This file is the **single source of agent instructions** for this repo, for every agent. `CLAUDE.md` only
imports it (`@AGENTS.md`) so Claude Code loads it automatically — never put content there. Area-specific
depth lives in `.claude/rules/` (see *Where the depth lives*); Claude Code loads those per path, other agents
should read the matching rule file before touching that area.

**Server load on aia09-mp50, for all agents including subagents:** light Node work may run on this
server: a dev server, `lint`/`lint:fast`, a `typecheck`, or a targeted test of a few files or one browser
spec, one at a time (`flock /tmp/ops-zwaar.lock <command>`). Heavy work runs in GitHub CI and you inspect
the result with `gh`: the full `npm test` or `npm run verify`, `measure:profiles` and corpus scans,
Playwright runs over many specs, production, Rust or Tauri builds, and several dev servers at once.
If heavy local work is truly needed, ask the owner first. Owner decision 2026-10-24; it replaces the
stricter rule of 2026-10-22.

Exception: the scheduled weekly release job on aia09-mp50 may run only the listed light Node
steps in its own release worktrees (the release script and `release-werk`), including package checks by its
Haiku translation stations (website generators in a temporary copy); see
[`.claude/skills/release/SKILL.md`](.claude/skills/release/SKILL.md) and its exact list in `referentie.md`.
Owner decision 9, clarified by the orchestrator on 2026-10-23. This does not cover agents outside
that job or maintenance of the skill. Within that job, tests, app builds, the full `npm run verify` and
dev servers stay CI-only. The scheduled nightly translation job (Monday to Saturday 01:00,
[`.claude/skills/nachtvertalingen/SKILL.md`](.claude/skills/nachtvertalingen/SKILL.md)) has the same kind of
exception for its own list in `referentie.md` (owner decision 2026-11-16).

## Commands

```bash
npm run dev          # browser dev; fixed port per worktree (3007–3106), refuses a double start
npm run tauri:dev    # desktop app, same port assignment
npm run build        # tsc && vite build → dist/
npm run build:platform -- --base /pad/   # platform build for the OpenAEC app on Frappe → dist-platform/
npm run build:core   # headless core package @openaec/open-planner-core → dist-core/ (not published)
npm run build:mcp-server   # headless MCP server (planner_* tools without the app) → dist-mcp-server/server.mjs (not published)
npm run build:mcpb   # Claude Desktop extension (MCP Bundle) → dist-mcpb/open-planner-studio-<version>.mcpb
npm run verify       # THE gate; CI runs the same steps in parallel, the browser suite only on occasion (see Testing pitfalls)
npm run typecheck    # tsc over src/ AND scripts/+tests/ — use this, not just build (incremental)
npm run lint         # deliberately minimal ESLint (promises, control-regex, React hooks)
npm run lint:fast    # same lint with a cache, for iterating; `lint` stays the gate
npm test             # all five suites
npm run tauri:build  # installers
npm run bump         # JJJJ.W.N: ISO week-year/week + next sequence from current version and live origin tags; sync all package versions
# Optional explicit version: npm run bump 2026.44.1 (never lower than the current version)
```

Single suites: `npm run test:planning`, `npm run test:library`, `npm run test:mcp`, `npm run test:dev-server`,
`npm run test:browser` (one-time: `npx playwright install --with-deps --only-shell chromium`).
`npm run test:browser:x11` runs headed locally and needs `OPS_XER_CORPUS` + a desktop display; it does not
replace the corpus-free CI gate.
One battery: `bash tests/planning/run.sh cases-<x>.json` or `bash tests/planning/run.sh check-<x>.ts`.
A new `check-*.ts` runs automatically (also in the timezone matrix); add your own `if bundle_check` line in
`tests/planning/run.sh` only for an environment variable, a fixed order or no matrix (grep a neighbouring check).
Every check must also be listed in `tests/planning/expected-checks.txt`, otherwise the full run is red:
`bash tests/planning/run.sh --list-checks > tests/planning/expected-checks.txt` (bundles and runs nothing).
The full run goes through `scripts/planning-pool.mjs`, at most 4 processes at once (`OPS_PLANNING_JOBS`), and CI
splits it over five jobs (`--shard=k/5`); the job `test` checks that every run happened exactly once.
On a PR, CI builds the Tauri app on Ubuntu always, and on Windows and macOS only when `scripts/ci-changes.mjs` sees a
change in `src-tauri/`, `package.json`, `package-lock.json` or a root `Cargo.toml`/`Cargo.lock` (owner decision 2026-11-02); a push to `main`
builds all three. The skipped builds show as "skipped", and the job `test` fails if a build skipped that should have run.
New `cases-*.json`: extend `EXPECTED_BATTERIES` — do not read run.sh (~2k lines) in full.

**`npm run verify` is one definition, in `package.json`** — ci.yml runs its steps in parallel jobs via
`scripts/verify-parts.mjs`, which reads them from that definition, but not the browser suite on an ordinary PR or
push (see *Testing pitfalls*). The release gate runs no verify of its own: `scripts/release-ci-check.mjs` checks that
the CI push run on the tagged commit and the last browser run on `main` since Friday 22:00 Dutch time (in practice Saturday 22:00) are green (owner
decision 2026-10-31; what reaches `main` after that gets no browser test). The deploy (live.yml)
runs no verify of its own: it starts after a green ci.yml run on `main` (`workflow_run`) and only for the commit CI
tested (a serial verify there took 31–45 min and hit the 45-minute job limit on 2026-10-13). The
steps, in order: `typecheck` → `lint` → `test` (all five suites) → `verify:examples` → `verify:docs` →
`verify:i18n` → `verify:release-highlights-json` → `verify:store-boundaries` → `verify:conventions` →
`verify:gantt-boundaries` → `verify:cycles` → `verify:text-roles` → `verify:icons` → `verify:core-package` →
`verify:comments`.

Separate gates (most are in `verify`): `npm run verify:examples` (examples load/compute),
`npm run verify:docs` (in-app guides + the mechanical claims in this file), `npm run verify:i18n` (keys + CLDR
plural forms + no cast on a key + fixed formatting), `npm run verify:store-boundaries` and
`npm run verify:gantt-boundaries` (AST gates: store, renderer, viewport, pointer and table boundaries),
`npm run verify:conventions` (AST gate: `src/engine/` reads no source format, options keys only from the
convention registry, provenance data gates pinned), `npm run verify:cycles` (circular imports after type erasure),
`npm run verify:core-package` (builds the headless core package, `npm pack`, installs it in a temporary copy of
`headless/consumer-example/`, runs and type-checks that consumer),
`npm run verify:comments` (no new code comments: every comment line in a changed file must already exist on the base
commit, the merge base with `origin/main` locally and the first parent of the merge commit in CI; it fails on a PR and
locally, and only reports on a push to `main`; see *Conventions*),
`npm run verify:text-roles` (only the six text roles), `npm run verify:icons` (app icons match the approved logo in `docs/branding/`: source hash, sizes, web icons), `npm run verify:release-highlights-json` (in the chain)
and `npm run verify:release-highlights` (separate: local update highlights and stats before a tagged release).
`npm run verify:translations` (release gate, deliberately NOT in `verify`: every UI key in every locale translated
and current per `i18n/ui-sources/`, plus a complete valid termbase for every target locale except nl/en
and the key/language-specific fixed UI text contracts in `scripts/translate/ui.ts`;
`release.yml` and the release skill run it). `npm run verify:audit` is
deliberately NOT in `verify` (Dependabot is the notification channel; an advisory gets
its own commit). `npm run measure:profiles` (separate) measures the cell baseline per scheduling profile (rule A:
no exact cell may become inexact); the P6 part needs `OPS_XER_CORPUS`. `npm run measure:large-plans` (separate, not in CI)
measures open, F5, levelling, save, auto-save/recovery and Gantt scroll/zoom at 1k/5k/10k tasks in a production
build in headless Chromium and writes a JSON result; the baseline is in `docs/superpowers/evidence/`.

Translations: `npm run i18n:add` puts one string in `nl` + `en` (required) and any other locale you give
(recipe `docs/recepten/i18n-sleutel.md`); missing locales fall back to `en` until the pipeline fills them,
`npm run i18n:fmt` puts the locale files in the fixed format (one key per line, `nl` order),
`npm run i18n:resolve` merges them per key after a `git merge` — run it even when git reports no conflict.
`npm run translate -- <command>` is the translation pipeline (termbase `i18n/termbase/`, UI work packages in
`build/translate/`, `apply ui`, `status`; the UI texts that are done every night via the `nachtvertalingen` skill
(48 hours unchanged on `main`, not of a feature flag), the rest for all locales before every release via the `update-ui-lang` skill; design
`docs/superpowers/specs/2026-10-09-vertaalstraat-design.md`,
overview `scripts/README.md`). `i18n:add` also updates the source hashes in `i18n/ui-sources/` (and drops them
for locales it did not write, so `prepare ui <locale> --missing`/`--stale` picks them up).

Generators/helpers: `npm run gen:examples` (regenerates `public/examples`), `npm run gen:tutorial-project`
(tutorial project nl/en to `build/tutorial-project/`, see `scripts/README.md`), `npm run gen:readme-screenshots` (README images and demo to `docs/images/readme/`, `-- --demo` adds `demo.gif`/`demo.mp4`; `-- --url URL` uses an existing Vite service; otherwise starts Vite itself; light theme, 1600x900), `npm run gen:docs-screenshots -- --out <dir>`
(tutorial screenshots as WebP from the step scripts in `tests/browser/tutorials/`, which `test:browser` runs without
capturing), `npm run gen:release-highlights-json`,
`npm run publish:wiki` (dry run; `-- --push` publishes), `npm run stats:downloads` (downloads per OS from the
GitHub Releases API; the workflow publishes the JSON every 2 hours to the `stats` data branch).

Node 22 (see CI). Rust stable only for the `tauri:*` commands.

Workflows outside `verify` (depth: `ci-release` and `mcp` rules): `headless-api.yml` (HTTP API, container, `cfn-lint`),
`release-verify.yml` (checks a published release on clean runners: updater `.sig`s, digests, install, signatures),
`mcpb.yml` (builds the Claude Desktop bundle and checks its manifest with the pinned official `mcpb validate`),
`windows-sign-check.yml` / `macos-sign-check.yml` (prove signing on a PR, without a tag), `appimage-im-check.yml`
(builds only the AppImage and checks it ships the IBus/Fcitx input-method modules, issue #764; `release.yml` runs the
same `scripts/check-appimage-im-modules.sh` before publishing), `mcp-real-app.yml` (MCP
bridge tests against the real Rust bridge), `rust-tests.yml` (`cargo test place_file` on Ubuntu 22.04, macOS and
Windows for `place_file_exclusive`; runs when `src-tauri/` changes, or by hand). Docs: `docs/release-verificatie.md`, `docs/mcp-verificatie.md`.

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
- Run the planning suite after every change to scheduling code. Run scoped tests and targeted checks
  freely while you work (table below). Do not run the full `npm run verify` locally before you push:
  CI runs the gate on every PR, without the browser suite. Open a draft PR early and watch it with
  `gh pr checks --watch`; if a check is red, fix it and push again. A red suite blocks both deploy and release;
  a red browser suite blocks the release, not the deploy.
- **The browser suite does not run on an ordinary PR or a push to `main`** (owner decision 2026-10-30: CI minutes;
  one run cost 74 minutes, 46 of them browser tests). `ci.yml` runs the full set every Friday at 22:00 Dutch time on
  `main` (`timezone: Europe/Amsterdam`, owner decision 2026-10-31); a scheduled job on aia09-mp50 repairs whatever turns
  red (`browsertests-repareren` skill), and the release gate and the release skill check that this run is green.
  A green PR therefore says nothing about the browser suite.
  Turn it on for your own PR only when you think that is very important, for example for work on dragging, focus,
  dialogs or saving. There are two ways, and both run in CI, never locally; a local run of the whole set is
  no replacement (one targeted spec stays allowed, see the table below):
  - the label `browsertests`: `gh api repos/OpenAEC-Foundation/open-planner-studio/issues/<nr>/labels -f 'labels[]=browsertests'`. It starts at once with a full
    CI run and runs again on every push until you take the label off. `gh pr edit --add-label` fails in this
    repo on a Projects deprecation error.
  - a manual start: `gh workflow run ci.yml --ref <branch>`. It runs only the browser jobs, once, on any branch,
    for the current tip of that branch. Find the result with
    `gh run list --workflow ci.yml --event workflow_dispatch --branch <branch>`.
- Browser tests use real browser events. The dev-only `window.__OPS__` bridge may set fixtures and read state,
  but never replace the user action under test.
- **A new browser test extends an existing scenario first.** Every `test()` block starts the app again
  (`tests/browser/fixtures/ops.ts`), so a new block in an existing file costs as much as a new file. A user
  route is fixed by its start state and the user's goal: find the `test()` block with the same start state
  and goal and add your action and assertion as a step in it. A new block only when no block has the same
  start state and goal, or for a step that would break the rest of the route; a new spec file only for a
  route no existing file fits. A large file or a long route is no reason for a new block.
  Browser-only behaviour (keys, focus, clicks, drags, animation frames, UI↔store wiring) stays in the
  browser, edge cases included; scheduling logic and long input matrices belong in `tests/planning/`.
  Detail: `.claude/rules/tests.md`.
- Never assume port 3007: read it from the dev-server output or `.claude/launch.json`.

### Which check after which change

| change | run |
|---|---|
| planning/scheduler code | `bash tests/planning/run.sh` in full before the PR (every `cases-*.json`, every `check-*.ts`, the timezone matrix) |
| one CPM/calendar case battery | `bash tests/planning/run.sh cases-<x>.json` — skips all `check-*.ts` batteries and the matrix |
| one targeted check | `bash tests/planning/run.sh check-<x>.ts` — skips all `cases-*.json` batteries and the matrix |
| document field / IFC round-trip | `npm run typecheck` + `check-document-contract.ts` / `check-ifc-roundtrip.ts`; full planning suite before the PR |
| headless core (`src/core/`, `scripts/build-core.mjs`) | `bash tests/planning/run.sh check-headless-core.ts` + `npm run verify:core-package` |
| i18n key | `npm run verify:i18n` |
| UI change | `node scripts/run-browser-tests.mjs tests/browser/smoke.spec.ts` (or a targeted spec), plus `window.__OPS__` |
| MCP tool | `bash tests/mcp/run.sh cases-<x>.ts` |
| Claude Desktop bundle (`integrations/claude-desktop/`) | `bash tests/mcp/run.sh cases-mcpb.ts` (builds the bundle, runs it over stdio against `bridgeMirror` and without the app) |
| library code | `bash tests/library/run.sh [check-<x>.ts]` |
| in-app docs/guides | `npm run verify:docs` |
| any code change | `npm run verify:comments` (no new comments) |
| before push | the targeted checks above; CI runs the rest of `npm run verify` on the PR, without the browser suite |

## Invariants that bite

- **Tauri guard.** `const isTauri = () => '__TAURI_INTERNALS__' in window;` — anything touching `@tauri-apps/*`
  is imported dynamically inside an `isTauri()` branch. A top-level import breaks the web build.
  Updater and MCP bridge are Tauri-only; the browser does its own file I/O and recovery.
- **Hidden start window (#895).** The desktop window starts with `visible: false` (also in
  `tauri.macos.conf.json`, which replaces the whole `windows` list). `src/startup/appWindow.ts` shows it once the
  first render has committed and fonts are loaded, or with the error screen (`src/startup/fatalError.ts`) when
  start-up fails; `main.rs` shows it after 10 s as a safety net. Saved settings reach the store before the first
  render (`src/startup/initialSettings.ts`), so anything you add to start-up before `render` delays the window.
- **Platform build.** `npm run build:platform -- --base /pad/` builds the bundle the OpenAEC app on Frappe serves
  under a sub-path (Vite mode `platform`, `.env.platform`, `build.manifest`, `dist-platform/`); `npm run build` gets
  none of the platform switches. Differences go only through the constants in `src/utils/buildFlags.ts` (extensions, demo start,
  AI mode and download stats are off there) — never read `VITE_OPS_PLATFORM` directly. Own assets always via `import.meta.env.BASE_URL`.
  Detail: `docs/platformbouw.md`.
- **Claude Desktop bundle = a switch plus the headless server.** `integrations/claude-desktop/` is an MCP Bundle
  (`.mcpb`, #730) with two programs. `server/index.mjs` (the switch, `src/proxy.ts`) reads `runtime.json` for
  every request: the app runs with its bridge ⇒ forward to `127.0.0.1:<port>/mcp` (port and token from that file);
  otherwise ⇒ the unchanged headless MCP server (`server/headless.mjs`, from `build:mcp-server`) as a child
  process on the working folder from the install dialog. A switch during a session blocks changes until an
  explicit document choice, and never leaves the headless planner while it has work not written with
  `planner_export_ifc`. The switch contains no app code except `discoveryContract.ts`; `build:mcpb` fails
  otherwise. Keep `proxy.ts` free of manifest, transport, file and process code (that lives in `main.ts`,
  `config.ts`, `discovery.ts`, `headlessChild.ts`). Its manifest version is in the bump register;
  `release.yml` (job `build-mcpb`) attaches it to every release. Detail: `docs/mcp-verificatie.md`.
- **macOS shell.** `src-tauri/tauri.macos.conf.json` restores native window decorations; custom window buttons stay Windows/Linux-only. `useMacOSMenu` installs translated native menus and `nativeMenuActions` reuses shortcut actions/guards and pending-text commits. Native Quit goes through window close so the unsaved-document guard remains active. The ribbon stays available on every platform.
- **Rust is thin.** Exactly four commands (`install_kind`, `mcp_bridge_start`, `mcp_bridge_stop`,
  `place_file_exclusive`); every new command is public surface. File I/O: extend `src/services/fileAccess/`, not a
  Rust command. The one exception, `place_file_exclusive` (#804, knownbug 1131), moves one file to a new name in the
  same real folder and fails if that name exists (`renameat2`/`RENAME_NOREPLACE`, `renameatx_np`/`RENAME_EXCL` on
  the open folder; Windows `SetFileInformationByHandle` on the open source without replace); it refuses unless
  exactly one name is an own helper file, the opened source is a regular file with exactly one name (more is `hard-linked`,
  zero is `source-changed`, read once from the open handle; technical decision 2026-11-18), and plugin-fs `rename` allows both the caller's path texts (`SafeFilePath`,
  then the scope, as plugin-fs does) and the real open folder (its real scope via `Webview::resolve_command_scope`
  plus the runtime scope, the rule of plugin-fs 2.7.1: a deny on the path text or on the real path wins, the allow
  applies to the real path, and the real path resolves symlinks in the ancestors of a path that does not exist yet). A step error stays an error; after the step it checks that
  the opened source is at the target and otherwise returns `source-changed` without touching anything again (no
  restore). Its boundary, including the Unix window it leaves open (knownbug 1799) and mounts that hide hard links (knownbug 1823), is in the header of
  `place_file.rs` and design §4.10. No fallback inside the command. TS entry `fileAccess/placeFileExclusive.ts`; its
  one caller is the new-name route `writeNewUserBytes` in `atomicWrite.ts` (knownbug 1131 step 4). The command-less
  plugin, `ops-process-info`, injects the process id for the MCP discovery files (`docs/mcp-ontdekking.md`). Files passed on the command line, at the first start and by a second start (single-instance callback, its own cwd), go to the webview as the event `ops:open-files` once it emits `ops:open-files-ready` (`src-tauri/src/launch_files.rs`, `src/state/launchFiles.ts`, #1091); they open through the drop route, so like File → Open. No command, and the fs scope is unchanged: a path outside `$HOME` fails (knownbug 2030). The installer associates no file type. The command-less `persisted-scope` plugin, registered after `fs`, preserves picker-granted file access across restarts for Recent. Started from an AppImage, `src-tauri/src/desktop_integration.rs` writes a menu entry and the logo to the user's data folder at startup (no command; opt out with `OPS_NO_DESKTOP_INTEGRATION`).
  The webview's data is denied to every plugin-fs command and to `place_file_exclusive` from two sides: `fs:default`
  of plugin-fs 2.7.1 denies `folder/**` for the WebKitGTK folders in `$APPLOCALDATA` (on Linux the same folder as
  `$APPDATA`, plus the files `cookies` and `hsts-storage.sqlite`) and `$APPLOCALDATA/EBWebView/**` on Windows; the
  capabilities `webviewgegevens-linux.json` and `webviewgegevens-windows.json` (via `platforms`; macOS needs none) add
  what upstream does not cover: each protected folder itself in `fs:scope` (`folder/**` does not match the folder, and
  plugin-fs `rename`/`remove` only check the given paths), and `fs:allow-rename`/`fs:allow-remove` deny
  `$APPLOCALDATA` itself. Never repeat a rule `fs:default` already supplies (it would appear twice and
  `place_file_scope_volgt_plugin_fs` fails). `mkdir`, `read_dir`, reading and writing in `$APPLOCALDATA` stay allowed
  (crash recovery and the MCP files live there, so never deny all of `$APPLOCALDATA`). Out of bounds: renaming or removing a folder above it on Windows
  (knownbug 1775), and a dot-named file inside a protected folder that the user picks in a file dialog (the
  matcher's leading-dot rule keeps a deny from matching it; knownbug 1776). `tauri-plugin-fs` is 2.7.1 (lower bound in
  `Cargo.toml`, npm `@tauri-apps/plugin-fs` the same) and `tauri-plugin-persisted-scope` 2.4.3.
- **Voorbereid IFC-schrijfresultaat (#804, 1c).** `prepareIfcWrite` in `foreign/mergeWriter.ts`
  levert de uitvoer als één buffer (`bytes`, dezelfde als `source.bytes`), sha256, de nieuwe `IfcSource` met
  sessiekaart en bevroren schrijfinvoer, en `literalCalendarIds`; `writeIfcMerge` is de adapter voor alleen de bytes. Alleen een ongewijzigde
  vreemde planning geeft de oorspronkelijke bytes en bron terug, met dezelfde onafhankelijke
  uitvoercontrole. Zonder vreemd deel blijven de bytes van de gewone writer. De indexplek in
  `PreparedIfcWrite` is voor PR 6; deze stap bewaart/hergebruikt de index nog niet.
  `commitSavedDocument(ref, savedSource, destination?, prepared?)` legt na geslaagde I/O doel,
  bron, bronkenmerk en kalenderkeuzes in één publicatie vast, ook voor een slapend document en bij doorwerken.
  `markAutoSaveVersionSaved` gebruikt dezelfde commit. `IFC_DIRTY_KEYS` sluit `ifcSource` uit;
  verouderde AutoSave-kandidaten toetsen haar identiteit apart. Bronherstel hoort bij PR 9;
  PR 11a sluit de documentroutes aan; PR 11b deelt hun voorbereiding via `state/prepareIfcOutput.ts`
  met IFC-export en app-MCP. Exports schrijven volledige bytes naar een nieuw doel zonder documentcommit.
  Pool, planOnly, paneel en dev-bridge blijven bij vreemde inhoud geblokkeerd; bestands-AutoSave schrijft sinds #804
  stap 8 met de flag aan via de vervanging van Ctrl+S (zie *Auto-save with a building model*).
- **IFC-bytes naar een nieuw doel (#804, T1; 1131 stap 4).** De aparte ingang `saveNewBytesDialog`/`saveNewBytesToRef`
  accepteert één `Uint8Array`. Tauri (`writeNewUserBytes`, ook voor `planner_export_ifc`) schrijft die met `createNew`
  in één aanroep naar een eigen `save-<id>.ops-save.tmp` in dezelfde map en zet dat met `place_file_exclusive` op de
  naam; nooit `rename` van plugin-fs. Een bestaande naam weigert (`notifications.ifcForeignNewTargetOnly`);
  `source-changed` stopt zonder terugzetten of opruimen (`notifications.ifcForeignPlaceUnknown`). Alleen
  `unsupported`, een scopeweigering of een tijdelijk bestand buiten de scope (`forbidden path`) vallen terug op één
  directe `createNew` op de naam; die is niet crashvast. Web downloadt een Blob; een browserhandle
  weigert getypeerd omdat exclusieve aanmaak ontbreekt (1130); alleen Ctrl+S op het eigen bestand achter een
  handle vervangt, via `replaceHandleWithBytes` (1131 stap 2). `saveNewSiteFileBytes` en
  `saveSiteFileVersionBytes` schrijven een Blob; de laatste eist een basisversie en bewaart de
  eventuele conflictkopie in het antwoord. Tekst en bestaande binaire exports houden hun gedrag.
  `ifcSaveBlocked` houdt de overige routes dicht; exclusieve vervanging/bronhash en crashvaste publicatie
  zijn fase 2 (1131). Bewijs: `check-file-ifc-bytes.ts`.
- **Storage via the site.** `FileRef` has three kinds: `path` (Tauri), `handle` (Chromium web) and `site`. When the
  page that hosts the tool sets `window.openaecHost` (contract in `src/services/fileAccess/siteHost.ts`), Open, Save,
  Save As, Recent and crash recovery also work against the site (AutoSave deliberately not: every round would be a
  new site version); without a host nothing changes, and the
  desktop app never has one. A document carries `siteFileId` and `siteFileVersion` (the base for conflict detection) next to
  `filePath`/`fileHandle`; derive the save
  target only via `saveTargetRef`. With any host (or in the platform build) the tool runs embedded: no welcome dialog,
  so no language question or tour, and the language comes from the host (`taal`). Dev: `?fakeSite=1` installs a fake
  site. Detail: `docs/platformbouw.md`.
- **IFC building-model guard.** Opening files with `IfcProduct`/`IfcTypeProduct` objects is temporarily
  blocked before import (knownbug 110): the planning writer does not preserve them. The checked-in
  type inventory comes from official IFC2X3 TC1, IFC4 ADD2 TC1 and IFC4X3 ADD2 schemas; regenerate
  with `scripts/ifc-product-types.py`. Edit the separate planning file, then merge externally.
  `readIFC` and the save-target check read the whole file with the ISO 10303-21 grammar
  (`src/services/ifc/stepFileGrammar.ts`); without the flag below, a model type it sees refuses, also before the point
  where a file breaks (with the flag the bytes route runs it on the text the reader gets, without the
  model part V).
  Otherwise `readIFC` reads only the first data section: the first `DATA;` up to the first `ENDSEC;`. The save-target
  check runs only with the flag `ifcForeignContent`: model content refuses early, then the full C/A/V scan must
  prove that no foreign part remains. Unreadable existing targets refuse. Historical own headers share the exact
  recognition below; their DATA sections are still scanned strictly.
  Behind the feature flag `ifcForeignContent` (#804 phase 1a; off by default) every IFC open
  route reads bytes through `src/services/ifc/foreign/ifcBytesRoute.ts` (scanner and classification in a Worker, the
  reader follows `selectPlanning`; a scanner refusal stops document activation) and keeps the source in
  `ifcSource` (document contract, `snapshot: 'none'`: outside undo, recovery and MCP backup). A document with a foreign
  part can use a prepared merge in document Save As to a new desktop name, browser download and site versions
  with a mandatory base version (1c PR 11a). IFC export and app-MCP export use the same preparation
  for complete files to new targets (PR 11b), without changing the document source, target or literal calendars.
  `ifcFullWriteBlocked` guards these routes; `ifcSaveBlocked` keeps pool, pane and dev-bridge blocked, and file AutoSave with the flag off or the source missing. Local existing targets remain refused (1131), except Ctrl+S and Auto-save (#804 step 8) on the document's own browser handle (1131 step 2: content check before the merge and just before `close()`, inside `replaceWithRecoveryPending`) and on the document's own desktop path (1131 step 5b: `replaceOwnPathWithRecovery` inside the save's one `runProjectFileWrite`, never a fallback to the ordinary write; the close question closes only on the boolean of `commitSavedDocument`).
  A successful document write commits source, target mark and literal calendars together; a download keeps the
  opening source and target. Missing source bytes block IFC output (`src/state/ifcForeignGuard.ts`); only explicit Save As with the flag on may
  write planning alone after a cancel-by-default question. The original target stays protected by the same mark
  with `sourceMissing: false`, persisted in the existing recovery metadata (1c PR 9e). Before classification, only after a
  strict scan failure, `foreign/oldOwnHeader.ts` masks only the three free fields on an equally long independent
  copy. The exact LF/IFC4X3 header of the 17 raw tags v2026.2.0 through v2026.7.12 is recognized once in
  `src/services/ifc/oldOwnHeader.ts`, shared with the target stream and the reader's data-section start. DATA; or
  ENDSEC; inside those free fields is header text; semicolons are allowed, field syntax and controls are refused.
  The shared limit equals main: 64 KiB of UTF-8 from the file start through the LF after FILE_NAME. Entity starts,
  comment markers or quote/field separators (also spaced) retain the main route; they are never masked or skipped.
  Other inputs retain main's data-section rule (knownbug 1061); broken headers
  outside that exact template are unreadable as targets. Original bytes/positions and strict DATA scanning remain.
  Other foreign-content write routes stay blocked.
- **IFC 4.3 is the native format**; there is no JSON project format. New domain data must round-trip through
  `ifcWriter`/`ifcReader`, or it is gone after saving. CSV/MSPDI/P6/`.mpp`/`.xer` are adapters. The file schema is
  per project (`Project.ifcSchema`, default `IFC4X3_ADD2`); never write silently in another one. Route:
  `docs/ifc-round-trip.md`; depth in the `tauri-ifc` rule.
- **Document contract.** New project data belongs in `DOCUMENT_FIELDS` (`src/state/documentContract.ts`),
  otherwise it does not survive a document switch, undo, crash recovery or save. A `DocumentPayload` field
  missing from that list is a compile error.
- **One Zustand+Immer store built from slices** (`src/state/appStore.ts`; the factory `createAppStoreContext`
  lives in `src/state/appStoreFactory.ts`, `appStore.ts` adds the one mounted singleton); slices are typed against the full
  `AppState`. Core runtime factories and store-bound MCP tools never import `useAppStore`/`appStoreContext`.
  UI/dialog flags: type in `UIState` (`slices/types.ts`), action in `uiSlice.ts`; persistent settings in
  `src/utils/settingsRegistry.ts`. Undo/redo is snapshot-based (`beginUndoable` → mutation → `finishUndoable`).
- **Headless core.** `src/core/` (`index.ts` + `api.ts`) is the public API of the package
  `@openaec/open-planner-core` (`npm run build:core`, not published): open IFC text, `schedule()` like F5,
  JSON summary, `toIfc()`, one error type with a fixed `code`. It builds its own context per document from
  `appStoreFactory.ts` and imports no value from `appStore.ts` (`verify:store-boundaries`); the build fails if
  React, Tauri, the singleton or the i18n UI config end up in the bundle. `api.ts` imports nothing and is the
  contract: a change there is a contract change (`docs/headless-kern.md`). Guards: `check-headless-core.ts`
  (core = app for every example) and `verify:core-package`.
  The HTTP API on top of it (`headless/server/`, contract `openapi.yaml`, container `Dockerfile`, AWS ECS
  Fargate template `deploy/aws/ecs-fargate.yaml`) is tested by `.github/workflows/headless-api.yml`
  (local server + container + smoke test, `cfn-lint`), not by `verify`. Detail: `docs/headless-api.md`.
- **Headless MCP server.** `headless/mcp-server/` runs the same `planner_*` tools as the app bridge on Node
  (stdio default, streamable HTTP on loopback with the bridge's HTTP contract), on its own store context, with file
  tools confined to `--root` (lexical + exact `realpath` check, operations run synchronously relative to the checked folder
  object via `chdir` + native `realpath('.')`, `O_NOFOLLOW`;
  atomic save with no direct-write fallback), content checks of existing write targets independent of the app flag
  (`scanForeign` C/A/V; unreadable targets refused, historical own headers use the shared recognition), no replacing of an existing file while the desktop app runs (`appLock.ts`
  reads `open-files*.json` from the app's data folders or `--discovery-dir` on every write), its own XML parser as `DOMParser` (`xmlDom.ts`, for MSPDI/P6 XML) and
  MCP backups in its own data folder. It reuses the
  dispatcher, registry, `runtime.ts`, the tools and `requestHandler.ts` unchanged; host functions go through seams
  (`fileToolDeps`, `McpFileFs.confine`, `guideToolDeps`, `createAppBackupService` overrides). Code it bundles imports
  no value from `appStore.ts` (`verify:store-boundaries`); `npm run build:mcp-server` fails on React, Tauri, the
  singleton, `src/components/`, `src/hooks/` or the i18n UI config in the bundle. `tests/mcp/bridgeMirror.ts` uses its
  `http.ts`, so a change to `mcp_bridge.rs`'s HTTP layer means changing `headless/mcp-server/src/http.ts`.
  Detail: `docs/headless-mcp.md`.
- **Scheduling is manual, not reactive.** `runCPM` → `solveProject()`; call it after mutating tasks,
  relations or the calendar (store actions do not do it themselves; only the opt-in setting Automatisch berekenen,
  `ui.autoCalcCPM`, runs it via `useAutoCalcCPM`). Always set `scheduleStale` via `markScheduleStale`
  (`state/transaction.ts`), never directly. `CPMSolver.ts` (~4k lines): grep the method, do not read it whole.
  Write-back: `applyCpmResult.ts`; relations/lag: `relationMath.ts`.
- **Minute model.** Scheduling engines use effective work blocks for scalar and explicit calendars.
  Task dates normalize to instants at load and input; project dates keep their entered form (D1/D5/D2
  at calculation). `minuteModelPending` carries the undoable conversion of old documents; persistent
  calculations inside an editing event call `runCPM({ withinEvent: true })`. IFC writes `TimeModel`
  after conversion and chooses anchor dates or `LiteralTimes` per calendar and per document; a calendar
  that is literal in the file (when opened, or saved so in this session) stays literal (`ifcLiteralCalendarIds`,
  `src/state/savedLiteralCalendars.ts`, knownbug 1026).
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
- **Pending modal questions.** While the actual-start, phase-assignment or missing-model Save As question waits, or
  "Wordt nog opgeslagen…" shows (`ui.savingBeforeClose`), `isGlobalShortcutFrozen` blocks global app shortcuts and the
  surrounding shell controls are inert,
  including during the actual-start question's Help pause. Help navigation and the question's own controls stay active.
- **Closing waits for saves.** `runProjectFileWrite` (`src/services/fileAccess/writeCoordinator.ts`) is the one project
  write lock; `whenProjectFileWritesIdle` is the one place to wait for it (never inside a write). Every write to a file
  the app opens goes through it, every export format included: a launch file (#1091) reads again when a turn started
  since it was read (`projectFileWriteTurns`); what still writes outside it is listed in knownbug 2033. Quitting the app, closing
  a document (`requestCloseDocument`, `closeDocumentAfterSaves`) and the updater wait for it, with "Wordt nog
  opgeslagen…" (#804, owner decision 2026-11-17). An empty queue is not enough: their final phase starts with
  `closeProjectFileWrites`, after which `runProjectFileWrite` admits nothing new and returns the route's own `closed`
  outcome (nothing written, not marked saved, no notice) until `destroy`/`relaunch` is done or fails. Quitting and the
  updater have one owner of that phase (`claimShutdown`, `src/services/appQuit/shutdownPhase.ts`): during an install a
  window close is swallowed without a question, and the updater waits for a running quit. In quitting's final phase the
  whole app is inert (`ui.appClosing` on the app root, also open dialogs and their keys), and it never destroys the
  window with a dirty document: it reopens and asks the close question. A save belongs to the document it was asked for: its re-checks
  (`refuseChangedDocumentWrite`) and its commit use that document id, never the active document; at most one waiting
  Ctrl+S per document.
- **Tailwind sources.** `src/styles/globals.css` disables automatic detection with `source(none)` and
  registers only `src/` and `index.html` via `@source` (paths relative to that stylesheet). This includes
  extension UI and HTML strings in `src/`; imported component CSS and fonts still build normally.
  Add an explicit source there if runtime utility classes move outside these paths; scripts, tests and
  docs must not generate app utilities. The legacy `tailwind.config.js` is not loaded by the v4 build.
- **Text:** always via `t(...)`, never hard-coded; a PR needs `nl` + `en`, a release all 28 locales
  (translation pipeline, `verify:translations`). Text sizes only via the six roles
  (`text-caption`…`text-title`); `text-xs`/`text-sm` no longer exist and silently do nothing.
- **Settings:** `localStorage` under `ops-` keys (no store plugin: the npm dependency `@tauri-apps/plugin-store`
  is gone; the Rust side still registers `tauri-plugin-store`, unused), declared in `settingsRegistry.ts`.
  A setting in the panel is one entry in `src/components/settings/catalog/settingsCatalog.tsx` (plus its id in
  `src/utils/settingIds.ts`); it then appears in all three places (⚙, Settings tab, Backstage), in search, with
  the changed dot and reset, and `openSettingsAt(id)` / a Help `settings://<id>` link opens it.
  A remembered view choice via a ribbon button or dragging does not belong there.
- **Save worker (#804 steps 4 to 6).** `src/services/ifc/saveWorker/` computes what `prepareIfcOutput` computes (the
  plain writer, or the merge with a foreign part) in a Web Worker. The plain writer reuses it; after every answer to a
  merge (a result or a refusal) it stops and the next request starts a fresh one (knownbug 1936: a worker keeps the
  garbage of its source copy and indexes, about 2 GB on the desktop at 157 MB). The mounted app owns one client
  (`appStore.ts`) and hands its compute function to the save routes unconditionally, through
  `StoreRuntimeOptions.ifcSaveCompute`: the plain writer and the merge run in the worker for Ctrl+S (also *Save* in the
  close question), Save As, Export → IFC, the export with the resource library and Auto-save to the file
  (`fileAutoSave.ts`, `compute` from `useAutoSave`; it checks its target after the computation, in the same write turn,
  like Ctrl+S). Headless, scratch and test contexts, crash recovery and
  `planner_export_ifc` stay on the main thread. A plain writer answer carries the worker's bytes; they go straight to
  the write layer (`FileData`, `saveDataDialog`, `saveToRef`), never through text; the text only exists when the main
  thread computed (the worker did not start). The plain writer keeps its right to overwrite (`saveFileDialog` /
  `saveBytesDialog`, the atomic replace); `saveNewBytesDialog` stays the merge's exclusive route. `prepareIfcOutput`
  keeps the decision (mode, flag, guard, plan-only question). The source goes over as a copy (the main thread keeps the bytes),
  output buffers come back transferred, content errors arrive as the same error class, transport failures as
  `IfcSaveWorkerError` (`ifcSaveWorkerError.ts`). A worker that sends no `started` within the fixed start limit (10 s,
  the same for every worker) did not start. A plain request then computes on the main thread, as on main, and plain
  requests stay there for the rest of the session; with the flag off for the whole session this is the only kind of
  request and the behaviour is main's. One difference (knownbug 2025): after an earlier merge in the same session (flag
  on, a refusal too) that worker is gone, so after an answer of a merge worker the next plain request can start a fresh
  one, as long as the plain route is still available, where main reused the started one; if it does not start, plain requests compute on the main thread for the rest of the session, after waiting up to the
  10 s start limit when it stays silent. A merge falls
  back only while no worker has started yet in this session; after that its start failure is an error (`not-started`),
  never the main thread. A crash, timeout or unreadable answer after the start is an error, never a retry on the main
  thread; so is an answer that does not fit the request (`resultFits`). The save routes treat that error as a failed save
  before any I/O (one notice, `ifcSaveWorkerFailed`). The worker loads `appStoreFactory.ts`, never `appStore.ts`; worker
  bundles get the headless-core boundary (`vite.config.ts`: `zustand` without React, `STUBBED` modules as throwing
  stubs). Tests: `check-save-worker.ts` (bytes, errors, lifetime), `check-ifc-document-save.ts` (the routes with an
  injected worker), `save-worker-production.spec.ts` (the production config, its modules incl. dynamic chunks) and
  `settings-tabs.spec.ts` (the app starts the worker itself on a real Ctrl+S, for a model and a plain file).
- **Save status in the status bar** (#804 step 5, every document): "Saving…" from the request (Ctrl+S, Save As, *Save*
  in the close question) through the end of the whole save, then "Saved 14:32", and "Unsaved" once the document changes
  again. It lives on the document registry (`DocumentEntry.saveState`, `src/state/documentSaveState.ts`), not in
  `DOCUMENT_FIELDS`; `commitSavedDocument` stamps the time. A failure is a normal notice, never a status.
- **Document content identity** (#1020 fix round 1): a save belongs to the content it was requested for
  (`DocumentContentRef`: document id plus `DocumentEntry.content`), not to the tab. Only `replaceDocumentContent`
  changes it: another project in the same tab (`applyLoadedProject` without edit and with another project id, which
  includes `api.data.loadProject`, opening into the empty tab and examples), `newProject` and `createNewProject`; a
  read-modify-load of the same project keeps it. `refuseChangedDocumentWrite` checks it right before every write (also
  for the plain writer and in `stopBeforeWrite`) and again at the last safe point of the write layer
  (`RefuseBeforePlace`: before `close()` of an existing browser handle, directly next to `close()` for the merge
  handle, before setting an existing name aside, before the exclusive placement, before the atomic rename and the site
  write, also for both IFC exports; a refusal leaves the target unchanged and returns "not written"). A handle fresh
  from the browser's save picker gets no late check: Chromium already emptied an existing target when it was picked
  (knownbug 1899), so the save finishes the requested file and only the commit, Recent and an export's success and
  calendar choice are withheld, `commitSavedDocument` takes the ref and commits nothing to replaced content, and the waiting Ctrl+S,
  the save status and `markAutoSaveVersionSaved` follow the same ref. Session data,
  not in `DOCUMENT_FIELDS`.
- **Auto-save** (crash recovery) is throttled to 10 s — deliberately a throttle, not a debounce. Changed IFC snapshots
  serialize on one reusable Web Worker (same writer fallback without Worker); only writer input and XER archive
  references cross that boundary, never file handles or archive bytes. Stop is checked again before committing. Runs in both
  Tauri (`appDataDir`) and browser (IndexedDB), keyed by worktree instance slug. Recovery reads versions
  1–5 plus the historical unversioned web `docIds` form. A desktop replacement of the own file (knownbug 1131 step 5)
  keeps its own record `recovery[.<slug>].replace.<id>.json` outside the manifest (`replaceRecords.ts`). With `ifcForeignContent`, an optional per-document
  `ifcSource` reference (sha256, byteLength, foreign, optional browser handle and, while a replacement runs,
  `pendingSha256`) restores a foreign source through the ordinary bytes-open route after hash verification against
  either hash; the snapshot supplies the edited planning. Foreign documents
  keep no save target in the manifest, so older readers restore planning with `sourceMissing` and no target.
  Desktop paths and browser handles read the source again. Browser files without a handle and site files use
  best-effort source copies in a separate `ops-ifc-sources.<recoveryBase>` IndexedDB database (created only when needed
  with the flag on): one byte blob per sha256 plus small per-session/document references and site base versions.
  Copies commit before the manifest; cleanup follows it and keeps referenced bytes, other sessions and unknown sets.
  Copy failures keep planning recovery working without a dangling source reference, with one notice and no retries for that document in the session.
  The existing recovery database stays v3 and its stores/records remain unchanged. Unknown/invalid manifests also block later writes,
  clearing and session rotation for that recovery set; unknown foreign web generations and shared archive blobs
  are preserved during cleanup. A manifest has unique document IDs (also historical web `docIds`). Web recovery DB v3
  adds a non-unique `records.kind` index without rewriting record/blob content: every `kind: manifest` record
  plus every canonical manifest key is a candidate, regardless of key or candidate order. See `recoveryManifest.ts`
  and `recoveryStore.ts`; upgrade/blocking/error limits are in `docs/xer-recovery-guardrails.md`.
  A blocked web upgrade completes startup with a persistent storage warning; recovery refuses further DB
  access until reload, even after unblocking. There is no fallback to writing an older DB version.
- **Auto-save with a building model (#804 step 8).** With `ifcForeignContent` on and the source present, a document with
  a foreign part takes part in Auto-save through the same replacement as Ctrl+S on its own target
  (`replaceOwnHandleWithRecovery` / `replaceOwnPathWithRecovery` in `src/state/ownFileReplace.ts`, never
  `saveToRefWithoutPrompt`, never the site or a download), inside one `runYieldingProjectFileWrite`
  (`writeCoordinator.ts`): content check, target and source check, merge in the save worker, the check again, the
  replacement with its recovery record, and the commit. Its own rhythm per document (`modelAutoSaveRhythm.ts`, clock
  injectable): 30 s of rest, at most 5 min after the first unsaved change, and never sooner than ten times the measured
  duration of the previous round after its start; typing in open field input (`state/textEntryActivity.ts`) restarts the
  rest. The timers live in `fileAutoSaveTimers.ts`; only the model timer puts a model up for its turn (`flushModels`),
  the ordinary 10 s round knows no model, and the rhythm is checked again at the turn in the queue. Every
  other request for the write queue (`runProjectFileWrite`: Ctrl+S, Save As, exports, MCP), every wait on it
  (`whenProjectFileWritesIdle`: closing a tab, the last phase of quit or the updater) and an IFC export over its whole
  sequence (`withIfcExportPriority`: `claimProjectFileWrite` from the source choice on, also while the plan-only question
  is open) makes a round yield up to the boundary in the shared replacement (`stopBeforeWrite` with
  `YieldingTurn.pass()`, once recovery is recorded); an export pins its document at the call and waits for a round past
  that boundary (`whenProjectFilePlacementSettled`). An ordinary Auto-save tick (`runAutoSaveTickWrite`) never makes a
  round yield: it waits its turn and writes right after the model round, so a model round always gets its turn. The
  write coordinator is the one place that assigns these turns. On yielding, the worker stops that one job (`IfcOutputCompute`'s `stop` signal),
  nothing is written or left behind, no notice, the document stays dirty, and the round returns after the next rest.
  Past that boundary the round runs to its end. It never asks a question (no write permission, or a too-tight anchor of
  a dependent project by the same assessment as Ctrl+S, `tightAnchorsIfSaved`: it skips the document). A
  changed or missing own file, a target outside the scope (knownbug 1762), an unrecordable or leftover recovery record
  stop it for that document with one notice per session (`state/modelAutoSaveNotices.ts`) until the planner saves or
  picks another target. With the flag off a plain document keeps its 10 s throttle and its write route (for the save
  worker after a model merge see knownbug 2025).
  Tests: `check-actual-autosave.ts` (rhythm, yielding), `check-ifc-document-save.ts`, `check-ifc-own-file-replace.ts`.
- **`immer` is pinned exactly to `11.1.4` (no `^`) — do not put the caret back.** Immer sits directly under
  undo/redo, snapshot sharing and auto-freeze; from 11.1.8 the build breaks too (typing of `current`/`original`,
  see `src/state/immerDraft.ts`). Bumping is a deliberate, separately reviewed change.
- Path alias `@/` → `src/`; use it consistently.

## Facts that `verify:docs` guards here

- Ribbon tabs (`RibbonTab`): `file`, `start`, `planning`, `resources`, `beeld`, `instellingen`, `table`,
  `ifc`, `report`, `ai` (only with `ui.aiMode`). Source: `slices/types.ts`.
- Backstage sections (`BackstageSection`): `recent`, `examples`, `export`, `import`, `print`, `project-info`,
  `settings`, `extensions`, `library`, `help`.
- 28 locales (`nl, en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa, ru, uk, cs, sk, sr, hr, bg, hu, ro, sv, nb, da, fi, lo`), each with four namespaces;
  `ar`/`fa` are RTL; `sr` is Serbian in Cyrillic script; `no`/`nn` in the browser pick `nb`. A missing plural form falls back to English, not to `_other`.
- MCP: The 42 `planner_*` tools live in `src/services/mcp/tools/`. New tool: `docs/recepten/mcp-tool.md`.

## Worktrees and self-testing

- Worktrees live under `.claude/worktrees/`; `vite.config.ts` ignores that path. `dev` and `tauri:dev` share a
  fixed per-worktree port (`scripts/dev-port.mjs`, stamped in `.claude/launch.json`) and a slug, so several
  worktrees can run at once.
- Call a UI change "working in the app" only after verifying that the active localhost server serves the
  worktree and commit containing that change; otherwise state the exact localhost URL.
- `.mcp.json` wires up a Playwright MCP server (headless Chromium) to drive the browser dev build.
  `window.__OPS__` (`src/utils/devBridge.ts`) exposes store, log bus, `extensions.*` and observer-only geometry;
  prefer asserting on store state over canvas pixels.
- For a manual check, hand the owner a dev-server link that opens a file: `?open=examples/03-kantoorgebouw-zuidas.ifc&theme=dark`
  opens that repo file through the normal open route (browser dev server only, never in a build). Detail: `docs/dev-link.md`. The app's own MCP bridge (`planner_*`) is the AI-assistant
  surface, not a test hook. Detail: `docs/self-test-harness.md`.

## Conventions

- **`main` is always releasable.** The weekly release job ships whatever is on `main` (owner decision 1,
  conversation 2026-10-22). There is no next, nightly or dev branch and no update channel. Land big work in
  small PRs to `main`; keep unfinished user-visible work behind a feature flag until it is complete.
- **Feature flags:** add a temporary entry to `src/utils/featureFlags.ts` with an id, typed i18n
  name/description keys and `writesNewIfcData`; read it through `isFeatureEnabled(ui.featureFlags, id)`.
  Flags default to off; `writesNewIfcData` does not hide or disable the experimental switch. The hidden
  Experimental block in Settings → About is unlocked by activating its version number for
  5 seconds with at most 0.5 s between activations (clicks or held Enter). Visibility and choices
  persist per device; hiding keeps the choices. The PR that enables a feature by default also
  removes its flag and the corresponding checks. List the flag's own UI texts in `texts` (`ns:path` or
  `ns:path.*`): the nightly translation skips them until the flag is gone, the release translates them.
  Elke feature flag krijgt een schakelaar in het verborgen blok Experimenteel (klik 5 seconden snel achter elkaar op het versienummer).
- **Working language is Dutch**: commit messages, ADRs and the canonical source translations.
  This file is English on purpose; the `.claude/rules/` files are Dutch.
- **No comments in code** (`docs/adr/0001-geen-commentaar-in-code.md`). Do not write a comment in TypeScript or
  JavaScript: say it with a name, a type or a test; record a decision that would surprise a reader in `docs/adr/`;
  put a workaround or an unverified assumption in `knownbugs.md`. `verify:comments` fails on every comment line
  that was not on the base commit: you may delete or move an existing comment, never write or rewrite one. Directives the
  tools themselves recognise (`@ts-expect-error`, `eslint-disable`, `/// <reference`, `@vite-ignore`, `@jsxImportSource`,
  `text-roles:`), JSDoc in `.mjs`/`.js` that holds type tags only, a bare `/** @deprecated */` or `/** @internal */`, and a one-line licence or source notice are not
  comments. Existing comments stay until the `delete-comment` skill has judged them.
- **Side findings go to [`knownbugs.md`](knownbugs.md).** Anything you run into that is not part of your own
  task (bugs, odd behaviour, stale text or docs, wishes) gets an entry there, numbered and marked B (confirmed) or
  S (reported only); do not quietly fix it in an unrelated PR. A PR that fixes an entry removes it. Check the file
  before reporting a "new" bug.
  Each session gets its own block of 50 knownbug numbers; allocations are listed in the Trias wiki.
- **User-visible feature ⇒ guide** in `public/docs/{nl,en}/` plus a manifest entry (recipe
  `docs/recepten/in-app-gids.md`). You write `nl` + `en` (the sources, required), organised by Diátaxis (`kind`:
  `howto`, `uitleg`, `referentie`; the tutorials ship as an extension); the other locales come from the translation
  pipeline (`public/docs/<locale>/` + a generated `index.json`, structure hashes in `i18n/docs-sources/`), and an
  article missing in a locale reads English with a notice.
  Renaming an article needs an alias in the manifest; ids the app uses live in `src/state/helpArticles.ts`.
  Those guides use a limited Markdown subset (no tables/blockquotes/h4/HTML). The GitHub wiki is generated,
  never edited by hand (`wiki` skill).
- **Releases**: only via the `release` skill; a `v*` tag is irreversible and rolls out to all users
  (updater + Snap Store). The weekly job on aia09-mp50 runs that skill automatically,
  without human approval before the tag (owner, conversation 2026-10-22). It runs on Monday at 07:00
  (owner, 2026-11-07) and has no end time: it continues until done, and only a real blocker stops it
  (owner, 2026-11-09); the weekend stop (Saturday 23:00 to Monday 01:00) and Sunday still apply.
  When you tell a reporter in an issue comment when a fix ships, name the date of the next Monday release,
  checked against today's date (`date`). Green main CI, a green
  last browser run (since Friday 22:00) and the release gates are mandatory. Resume unfinished work for the latest tag before checking for new
  commits or bumping. Outstanding website work does not block the next app release; retry it the next
  Monday alongside that release.
  Also resume open release PRs and untagged versions on main without another bump,
  only when their candidate version is numerically newer than the previous release; otherwise stop.
  Record workflow IDs, wiki commit and website PR in the release PR. Every release includes the UI
  translations for all locales, wiki publication and the two website blocks (the highlights in
  `#whats-new` and the new entry under `#releases`); guide translations beyond nl/en run only on the
  owner's separate request. The job repairs a red CI itself (owner decision 8; route in the `ci-release` rule).
  The schedule lives in `.claude/skills/release/scheduled-job.md`. The fixed steps run in `scripts/release/run.mjs`
  (owner, 2026-11-16): the release thread starts it, passes every `RELEASE-STOP <code>` to the orchestrator and
  never tags itself; release texts come from one `claude -p` text agent inside the script.
  Release text in `docs/release-notes/v<version>.md`; `docs/CHANGELOG.md` only at release.
- The user term is "resourcebibliotheek"; code/IFC still say `companyId`/`companyName`.
- Screen evidence in a PR: `artifacts/<topic>/`, PNG ≤ ~150 KB, a handful; local QA screenshots in `qa/`.
- Changing the architecture, a command or a fact above? Update this file in the same PR.

## Agent skills

Configuration for the engineering skills (`mattpocock-skills`: `to-spec`, `to-tickets`, `triage`, `wayfinder`, …).

### Issue tracker

GitHub Issues in this repo, via `gh`; every issue an agent creates gets the label `agent-ticket`, and the
label `in-progress` (not the assignee) marks a claim. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles under their default names (`needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`), plus `bug`/`enhancement` as category; all labels live in `.github/labels.json`.
See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` (created lazily) and `docs/adr/` at the root. See `docs/agents/domain.md`.

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
| `import-export` | progress sheet (Excel), XLSX, ZIP services |
| `ui-shell` | layout, ribbon, backstage, panels, dialogs, first-start tour |
| `text-roles` | the six text roles (`*.tsx`, `*.css`) |
| `i18n` | `src/i18n/`, i18n scripts and tests |
| `settings-autosave` | settings, auto-save, recovery, clean quit, stats |
| `extensions` | extension system |
| `mcp` | MCP bridge and `planner_*` tools |
| `library` | resource library |
| `docs-help` | in-app guides, help viewer, wiki |
| `tests` | test suites, Playwright, ESLint/tsconfig |
| `dev-server` | dev launcher, ports, `vite.config.ts` |
| `ci-release` | `.github/`, release notes, bump |
| `docs-index` | `docs/`, `PLAN.md`, `artifacts/` |

Skills in `.claude/skills/`: `release`, `nachtvertalingen` (nightly UI translations of finished texts), `browsertests-repareren` (the repair of a red browser run), `wiki`, `docs-update`, `docs-audit`, `delete-comment` (judge and remove the comments of one part of the code, on request), `update-ui-lang` (translation pipeline for the
UI, a release step), `update-docs-lang` (pipeline for the guides, on request), `goed-plannen`, `progress-update` (source of the
last two: `public/skills/<name>/SKILL.md`, copied byte-identically; they are the agent skills that
`planner_get_planning_guide` hands out, next to the English agent guide `public/agent/planning-guide.md`).

Recipes: `docs/recepten/` (MCP tool, setting, translation key, ribbon tab, text size, in-app guide,
scheduling convention) and `docs/ifc-round-trip.md`. Self-test: `docs/self-test-harness.md`.
Open work: `docs/TODO.md`. `PLAN.md` is the design-phase plan, not the current state.
Design docs: start at `docs/superpowers/README.md` — read them as *why*, not as *what exists*.

## Key paths

| Concern | Location |
|---|---|
| Store composition root | `src/state/appStore.ts` (factory: `src/state/appStoreFactory.ts`) |
| Headless core (package API) | `src/core/`, build `scripts/build-core.mjs`, consumer `headless/consumer-example/` |
| Headless MCP server | `headless/mcp-server/src/`, build `scripts/build-mcp-server.mjs`, test `tests/mcp/cases-headless-server.ts` |
| Headless HTTP API, container, AWS | `headless/server/`, `deploy/aws/ecs-fargate.yaml`, `.github/workflows/headless-api.yml` |
| Claude Desktop bundle (`.mcpb`) | `integrations/claude-desktop/`, build `scripts/build-mcpb.mjs`, test `tests/mcp/cases-mcpb.ts`, `.github/workflows/mcpb.yml` |
| Slices | `src/state/slices/` |
| CPM solver / calendar engine | `src/engine/scheduler/`, `src/engine/calendar/` |
| Canvas renderer | `src/engine/renderer/` |
| IFC read/write | `src/services/ifc/ifcReader`, `ifcWriter` |
| File I/O (Tauri↔web↔site) | `src/services/fileAccess/` (+ `recentFiles.ts`; site contract `siteHost.ts`) |
| Auto-save / recovery | `src/hooks/useAutoSave.ts`, `src/services/recovery/recoveryStore.ts` |
| Rust commands (thin) | `src-tauri/src/commands/mod.rs` (`install_kind`), `src-tauri/src/commands/place_file.rs` (`place_file_exclusive`), `src-tauri/src/mcp_bridge.rs` (`mcp_bridge_start`/`mcp_bridge_stop`) |
| Tauri config | `src-tauri/tauri.conf.json` (app id `org.openaec.planner`) |
