# CLAUDE.md

Open Planner Studio: Tauri 2-desktopapp (Rust-schil + React 19) voor bouwplanning, OpenAEC-Foundation, LGPL-3.0.
De browserbuild is een echte productie-deploy (`live.yml`), geen dev-target.

<!-- Onderhoud: dit bestand laadt in ELKE sessie — houd het onder ~150 regels (advies Anthropic: < 200).
Diepgang per onderdeel staat in `.claude/rules/*.md`; die laden pas als Claude een bestand leest dat op
hun `paths` past. Nieuw detail over één onderdeel hoort daar, niet hier. `scripts/verify-docs.ts`
(Poort 7) eist hier: alle npm-scripts, alle `RibbonTab`/`BackstageSection`-waarden, de locale-lijst,
de auto-save-interval en "De N `planner_*`-tools". -->

## Commands

```bash
npm run dev          # browser-dev; vaste poort per worktree (3007–3106), weigert dubbelstart
npm run tauri:dev    # desktopapp, zelfde poorttoewijzing
npm run build        # tsc && vite build → dist/
npm run verify       # DE poort — letterlijk wat CI, release-gate en deploy-gate draaien
npm run typecheck    # tsc over src/ én scripts/+tests/ — gebruik dit, niet alleen build
npm run lint         # bewust minimale ESLint (promises, control-regex, React-hooks)
npm test             # alle vijf de suites
npm run tauri:build  # installers
npm run bump X.Y.Z   # CalVer-versie syncen (Cargo.toml blijft bewust 0.1.0)
```

Losse suites: `npm run test:planning`, `npm run test:library`, `npm run test:mcp`, `npm run test:dev-server`,
`npm run test:browser` (eenmalig: `npx playwright install --with-deps --only-shell chromium`).
Één batterij: `bash tests/planning/run.sh cases-<x>.json` of `bash tests/planning/run.sh check-<x>.ts`.

Losse poorten (de meeste zitten in `verify`): `npm run verify:examples` (voorbeelden laden/rekenen),
`npm run verify:docs` (in-app gidsen), `npm run verify:i18n` (sleutels + CLDR-pluralvormen),
`npm run verify:store-boundaries` en `npm run verify:gantt-boundaries` (AST-poorten: store-, renderer-,
viewport-, pointer- en tabelgrenzen), `npm run verify:cycles` (circulaire imports ná type-erasure),
`npm run verify:text-roles` (alleen de zes tekstrollen), `npm run verify:release-highlights-json` (in de keten)
en `npm run verify:release-highlights` (los: lokale updatehoogtepunten en statistieken vóór een getagde release). `npm run verify:audit` zit bewust NIET in `verify`
(Dependabot is het meldkanaal; een advisory krijgt een eigen commit).

Generatoren/hulpjes: `npm run gen:examples` (`public/examples` opnieuw), `npm run gen:release-highlights-json`,
`npm run publish:wiki` (dry-run; `-- --push` publiceert), `npm run stats:downloads` (downloads per OS uit de
GitHub Releases-API; de workflow publiceert de JSON wekelijks naar de `stats`-databranch).

## Valkuilen bij testen

- **Beoordeel elke suite op de exitcode, nooit op de tail.** `tests/planning/` print "alles groen" ook bij exit 1
  (bundelen faalt). `grep '^XX'` werkt alleen daar; `tests/library/` print faalregels ingesprongen.
- Er is geen vitest/jest. `tsc --strict` (`noUnusedLocals`/`noUnusedParameters`) is de statische hoofdcheck.
- Draai de planningssuite na elke wijziging aan planningscode; draai `npm run verify` vóór je pusht —
  een rode suite blokkeert zowel deploy als release.
- Browsertests lopen via echte browser-events. De dev-only `window.__OPS__`-brug mag fixtures zetten en state
  lezen, maar nooit de geteste gebruikershandeling vervangen.
- Neem nooit poort 3007 aan: lees hem uit de dev-server-uitvoer of `.claude/launch.json`.

## Invarianten die bijten

- **Tauri-guard.** `const isTauri = () => '__TAURI_INTERNALS__' in window;` — alles wat `@tauri-apps/*` raakt,
  dynamisch importeren binnen een `isTauri()`-tak. Een top-level import breekt de webbuild.
  Updater en MCP-bridge zijn Tauri-only.
- **Rust is dun.** Precies drie commands (`install_kind`, `mcp_bridge_start`, `mcp_bridge_stop`); elk nieuw
  command is publiek oppervlak. Bestands-I/O: breid `src/services/fileAccess/` uit, geen Rust-command.
- **IFC 4.3 is het native formaat**, er is geen JSON-projectformaat. Nieuwe domeindata moet round-trippen via
  `ifcWriter`/`ifcReader`, anders is hij weg na opslaan. CSV/MSPDI/P6/`.mpp` zijn adapters. Route:
  `docs/ifc-round-trip.md`.
- **Documentcontract.** Nieuwe projectdata hoort in `DOCUMENT_FIELDS` (`src/state/documentContract.ts`),
  anders overleeft hij geen documentwissel, undo, crashherstel of opslaan.
- **Eén Zustand+Immer-store uit slices** (`src/state/appStore.ts`); slices typen tegen de volledige `AppState`.
  Core-runtimefactories en storegebonden MCP-tools importeren nooit `useAppStore`/`appStoreContext`.
- **Plannen is handmatig, niet reactief.** `runCPM` → `solveProject()`; roep het aan na het muteren van taken,
  relaties of kalender. Zet `scheduleStale` altijd via `markScheduleStale` (`state/transaction.ts`), nooit direct.
- **Gantt-tijdlijn = Canvas 2D** (`src/engine/renderer/`), het taakraster = DOM (`FullTaskGrid`).
- **Meldingen lopen via één kanaal** uit de store — geen `alert()` of losse toasts.
- **Tekst:** altijd via `t(...)`, nooit hardgecodeerd. Tekstgroottes alleen via de zes rollen
  (`text-caption`…`text-title`); `text-xs`/`text-sm` bestaan niet meer en doen stil niets.
- **Instellingen:** `localStorage` onder `ops-`-sleutels (geen store-plugin: de npm-dependency `@tauri-apps/plugin-store` is weg, de Rust-kant registreert `tauri-plugin-store` nog ongebruikt); declaratief
  via `settingsRegistry.ts`; elke instelling op alle drie de plekken via `SettingsPanelContent`.
- **Auto-save** (crashherstel) is gethrottled op 10 s — bewust throttle, geen debounce.
- **`immer` staat exact vastgepind op `11.1.4` (geen `^`) — zet de caret niet terug.** Immer zit direct onder
  undo/redo, snapshot-sharing en auto-freeze; vanaf 11.1.8 breekt ook de build (typering van `current`/`original`,
  zie `src/state/immerDraft.ts`). Bumpen is een bewuste, apart gereviewde wijziging.
- Path alias `@/` → `src/`; gebruik hem consequent.

## Feiten die `verify:docs` hier bewaakt

- Ribbon-tabbladen (`RibbonTab`): `file`, `start`, `planning`, `resources`, `beeld`, `instellingen`, `table`,
  `ifc`, `report`, `ai` (alleen bij `ui.aiMode`). Bron: `slices/types.ts`.
- Backstage-secties (`BackstageSection`): `recent`, `examples`, `export`, `import`, `print`, `project-info`,
  `settings`, `extensions`, `library`, `help`.
- Veertien locales (`nl, en, fr, de, es, zh, it, pt, pl, tr, ar, ja, ko, fa`), elk met vier namespaces;
  `ar`/`fa` zijn RTL. Een ontbrekende pluralvorm valt terug op Engels, niet op `_other`.
- MCP: De 41 `planner_*`-tools staan in `src/services/mcp/tools/`. Nieuwe tool: `docs/recepten/mcp-tool.md`.

## Conventies

- **Werktaal is Nederlands**: codecommentaar, commitberichten en de canonieke bronvertalingen.
- **Gebruikerszichtbare functie ⇒ gids** in `public/docs/{nl,en}/` plus manifest-entry. Die gidsen gebruiken een
  beperkte Markdown-subset (geen tabellen/blockquotes/h4/HTML). De GitHub-wiki wordt gegenereerd, nooit met de hand
  bewerkt (`wiki`-skill).
- **Releases**: alleen via de `release`-skill; een `v*`-tag is onomkeerbaar en rolt uit naar alle gebruikers
  (updater + Snap Store). Releasetekst in `docs/release-notes/v<versie>.md`; `docs/CHANGELOG.md` alleen bij release.
- Gebruikersterm is "resourcebibliotheek"; code/IFC zeggen nog `companyId`/`companyName`.
- Schermbewijs bij een PR: `artifacts/<onderwerp>/`, PNG ≤ ~150 KB, een handvol; lokale QA-screenshots in `qa/`.

## Waar de diepgang staat

`.claude/rules/` (laadt per pad): `state`, `tauri-ifc`, `mpp`, `contour`, `gantt-splits`, `reports`, `ui-shell`,
`text-roles`, `i18n`, `settings-autosave`, `extensions`, `mcp`, `library`, `docs-help`, `tests`, `dev-server`,
`ci-release`, `docs-index`.

Recepten: `docs/recepten/` (MCP-tool, instelling, vertaalsleutel, ribbontabblad, tekstgrootte, in-app gids) en
`docs/ifc-round-trip.md`. Zelftest: `docs/self-test-harness.md`. Roadmap: `PLAN.md` (§4 vervallen).
Ontwerpdocs: begin bij `docs/superpowers/README.md` — lees ze als *waarom*, niet als *wat er is*.
