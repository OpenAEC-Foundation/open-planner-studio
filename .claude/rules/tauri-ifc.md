---
paths:
  - "src-tauri/**"
  - "src/services/**"
  - "src/App.tsx"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

# Tauri-schil, bestands-I/O en IFC

This is a Tauri 2 desktop app (Rust shell + React 19 frontend) for construction planning, part of the OpenAEC-Foundation desktop-app family (LGPL-3.0; extension system and styling follow Open Calc Studio). The browser build is production-deployed (`live.yml`) and functionally near-complete: since v2026.7.11 it does its own file I/O (File System Access API on Chromium, download-fallback elsewhere) and auto-save recovery (IndexedDB). **The in-app updater and MCP bridge are Tauri-only.** The split is still gated behind a runtime check:

```ts
const isTauri = () => '__TAURI_INTERNALS__' in window;
```

Any code that touches `@tauri-apps/*` must be either dynamically imported inside an `isTauri()` branch (see `App.tsx` auto-save) or otherwise guarded — top-level imports of Tauri plugins will break the web build.

## The Rust backend is thin — file I/O uses JS plugins, not `invoke`

De `invoke_handler` in `src-tauri/src/main.rs` telt precies drie commands: `install_kind` (uit `src-tauri/src/commands/mod.rs`) plus `mcp_bridge_start`/`mcp_bridge_stop` (uit `src-tauri/src/mcp_bridge.rs`, zie `.claude/rules/mcp.md`). `install_kind` wordt aangeroepen vanuit `src/services/updater/updaterService.ts` om het installatietype (appimage/snap/deb/native) te detecteren en de updater te poorten. (The unused `read_file`/`write_file` commands were removed for finding K6a: everything in the `invoke_handler` is reachable via `window.__TAURI_INTERNALS__.invoke(...)`, extension code included, and those two did no path validation and bypassed the `plugin-fs` scope. Houd die lat aan: elk nieuw command is publiek oppervlak.) All real file I/O funnels through `src/services/fileAccess/` — a runtime-dispatched abstraction (`index.ts` kiest Tauri↔web met een `FileRef`-model) met een Tauri-backend (`plugin-fs` + `plugin-dialog`) en een web-backend (File System Access API + download-fallback): `fileSlice` (open/save/export), `src/services/recovery/recoveryStore.ts` (auto-save) en `ReportPanel.tsx` (rapport-export) draaien er allemaal op; handle-backed recente-bestanden via `fileAccess/recentFiles.ts`. Follow that pattern — breid `fileAccess` uit, geen nieuwe Rust-command — when adding file operations. All IFC parsing/serialization, scheduling, and rendering are TypeScript; Rust is just the shell. Enabled plugins: `fs`, `dialog`, `shell`, `store`, `os`, `updater`, `process`, `clipboard-manager`; app id `org.openaec.planner`.

## IFC is the native file format, not a sidecar

The application's persistence model is IFC 4.3 (buildingSMART). Loading a project = parsing IFC via `src/services/ifc/ifcReader`; saving = serializing the entire app state via `ifcWriter`. There is no separate JSON project format. When adding new domain data (tasks, sequences, resources, assignments, calendar), it must round-trip through the IFC layer or it will be lost on save/reload. CSV/MS Project/P6 services in `src/services/` are import/export adapters, not the source of truth. The other `src/services/` areas — `fileAccess/` (Tauri↔web bestands-I/O + handle-backed recents), `recovery/` (auto-save/restore, Tauri fs + web IndexedDB), `actualAutosave/` (opt-in, promptvrije writes to an existing project file), `benchmark/` (ingebouwde benchmark-tool via Instellingen), `print/` (printvoorbeeld), `pdf/` (vector-PDF-export via `pdf-lib`; Arabic and Persian stay vector, while CJK rasterizes only without an optional `pdf-fonts` extension), `updater/`, `feedback/` (feedbackdialoog + screenshot-annotator), `mcp/` (AI-assistent, zie `.claude/rules/mcp.md`) and `debug/appLog` (log-bus achter de DebugTerminal) — are app plumbing with no IFC impact. `library/` is de uitzondering: bibliotheekdata is app-globaal, maar herkomststempels round-trippen wél door het project-IFC (zie *Resourcebibliotheken*).
