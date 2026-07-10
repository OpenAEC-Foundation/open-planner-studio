# Modulariteits-audit — Open Planner Studio

*Datum: 2026-07-10 · Basis: v2026.7.10 (commit 312651e) · Scope: volledige `src/` (172 bestanden, ~39.800 regels, 719 interne import-edges)*

## Aanpak

Zes parallelle deel-audits (state-laag, engine, UI-shell, services/adapters, cross-cutting plumbing, import-graaf-meting), elk met file:regel-bewijs. De vier belangrijkste bug-claims zijn daarna onafhankelijk hergeverifieerd. Prioritering volgens **Prioriteit = (Impact + Risico) × (6 − Effort)**, elk 1–5.

---

## Hoofdconclusie

**De laag-architectuur is gezond; de modulariteitsschuld zit in ontbrekende contract-afdwinging en een handvol god-bestanden.** De import-graaf-meting bevestigt objectief: `state→components`, `engine→components`, `services→components` en `utils→components` staan alle vier op **0 edges**; de scheduler-subtree is puur (importeert alléén `@/types` en `@/utils`); services zijn puur (data-in→data-uit, I/O bij de aanroeper). Er is welgeteld **één echte runtime-cyclus** in de hele codebase (`types/calendar.ts` ↔ `engine/calendar/holidays.ts`).

Het échte probleem is het **"één veld erbij"-probleem**: een nieuw per-document domeinveld toevoegen raakt vandaag **~13 plekken in de state-laag** (document-swap, undo/redo, zes reset-blokken, recovery) **plus ~9 plekken in de persistentie/adapters** (IFC write/extract-paar, drie load-blokken, `writeIFC`-callsites, evt. MSPDI/P6/CSV) — waarvan de meerderheid **niet compiler-afgedwongen** is. Eén vergeten plek = stil dataverlies bij opslaan, of state die van het vorige document/project lekt. Dit is de duurste en foutgevoeligste routineklus in de codebase en de kern van waarom features nu "telkens tijd en geld" kosten.

Tweede rode draad: **de goede patronen bestaan al in het project, ze zijn alleen niet doorgetrokken.** `shortcutRegistry` is een voorbeeldige declaratieve registry — maar settings hebben er geen (~4 handmatig gesynchroniseerde plekken per instelling). `ExtensionRibbonGroups` rendert knoppen declaratief uit data — maar de eigen ribbon-tabs zijn 1.591 regels hardcoded JSX. `subdayIo.ts`/`importNormalize.ts` bewijzen gedeelde adapter-primitieven — maar datum-parsers, uur-modus-orkestratie en WBS-rebuild zijn per reader gekopieerd. `P6_DAY_NAMES` wordt gedeeld tussen reader en writer — maar de ~13 IFC-pset-paren koppelen via gedupliceerde string-literals.

### Onderweg gevonden concrete bugs (alle vier hergeverifieerd)

| # | Bug | Bewijs |
|---|-----|--------|
| B1 | `CPMSolver.solve()` is niet idempotent: `truncatedLeadIds`/`hardPinViolatedIds`/`hammockNoFinishDriverIds` worden alleen bij field-init geleegd; een tweede `solve()` op dezelfde instance stapelt duplicaten. Latent (runCPM maakt nu telkens een nieuwe instance). | `CPMSolver.ts:114,118,121` + geen reset in `solve()` (277+) |
| B2 | Weekend-arcering in het Gantt-grid is hardcoded op za/zo i.p.v. `CalendarEngine.isWorkDay` — fout bij afwijkende werkweken. | `GanttRenderer.ts:317` |
| B3 | Undo van `setWbsAutoNumber` herstelt `tasks` maar niet `project.wbsAutoNumber` (snapshot bevat geen `project`) — vlag blijft omgeklapt staan. | `projectSlice.ts:106-113` + `snapshot.ts:38-53` |
| B4 | `IFCPanel` roept `writeIFC` met 9 argumenten aan (zonder `baselines`/`activeBaselineId`) waar `fileSlice` er 11 meegeeft — het IFC-paneel-pad schrijft stil onvolledige IFC. | `IFCPanel.tsx:23,30` vs `fileSlice.ts:167,200,259` |

---

## Wat WEL netjes modulair is (niet verbouwen — als referentiepatroon gebruiken)

- **Scheduler-subtree** (`engine/scheduler/**`): puur, headless, nul state/component/react-imports; volledig gedekt door de `tests/planning/`-suite → refactoren is hier bewijsbaar veilig.
- **`CalendarEngine`**: één verantwoordelijkheid, nette API, WeakMap-memoisatie. **`ResourceLeveler`** gebruikt de solver als black box. **`ResourceLoad`**, `duration`, `graphWalk`, `resolveCalendar`, `lagCalendar`, `constraintValidation`, `visibleRows`+`filterEval`: puur en enkelvoudig.
- **Renderer-grens**: componenten praten met `GanttRenderer` uitsluitend via de expliciete hit-test-API; teken- en hit-test-geometrie delen één bron (`barGeometry`, `getRowIndex`).
- **`task-sections/*` + veld-primitives** (`DateTextInput`, `UnitsInput`, `Select`, …): `TaskPropertiesPanel` en `TaskDialog` componeren exact dezelfde secties — nul formulier-duplicatie.
- **`shortcutRegistry`**: echte declaratieve registry (toets toevoegen = 1 entry + 1 i18n-key).
- **Services-I/O-grens**: readers/writers puur; alle Tauri-I/O bij de aanroeper. **`subdayIo`**, **`importNormalize`**, **`paginate`↔`miniPdf`**: voorbeeldige extracties.
- **`platform.ts`** (`isTauri`), **extensie-SDK/cleanup-tracking**, **`appLog`**, **updater/feedback-services**: geïsoleerde plumbing.
- **Slices als compositie**: `appStore.ts` declaratief; `extensionSlice`/`baselineSlice`/`sequenceSlice` voorbeeldig; `syncProjectCalendar` toont het juiste minimale-interface-patroon.
- **Import-graaf**: 20 van de 21 cycli zijn bewuste, gedocumenteerde type-only-cycli (compile-time weggegumd); domeintypes vrij van IFC-lekkage.

---

## Bevindingen per thema

### Thema A — Het "één veld erbij"-probleem (contract-afdwinging) — **ZWAARTEPUNT**

| ID | Bevinding | Bewijs (kern) | Effort |
|----|-----------|---------------|--------|
| A1 | **Per-document state-shape is een impliciet contract, 5× uitgeschreven, ~13 bewerkplekken.** Dezelfde ~20 velden onafhankelijk opgesomd in `DocumentPayload`, `capturePayload`, `hydratePayload`, `freshPayload`, `payloadFromInput`, `Snapshot`+`createSnapshot`, undo/redo-restore, 6 load/reset-blokken, recovery-mapping. Enforcement asymmetrisch: object-literals zijn compiler-gecheckt, maar `hydratePayload`, `undo`/`redo` en de reset-blokken zijn imperatieve mutaties die een veld **stil** overslaan → veld lekt van vorig document bij tabwissel, of van vorig project bij "nieuw". `collapsedTaskIds` woont in `ui` maar wordt per-document geswapt. | `documentSlice.ts:34-61,116-140,167-194,197-249`; `snapshot.ts:14-53`; `historySlice.ts:16-68`; `fileSlice.ts:121-145,357-381,403-428`; `projectSlice.ts:157-271` | L |
| A2 | **IFC-round-trip-contract impliciet in ~13 write/extract-paren**, gekoppeld via gedupliceerde string-literals (`'OPS_Constraints'` etc.) en hardcoded argument-indices (IFCTASK-layout dubbel; IFCTASKTIME-slots op 3 plekken). Geen round-trip-test die een niet-gedekt veld laat falen. Divergentie faalt stil: reader matcht simpelweg niet → **dataverlies bij save/reload**. | `ifcWriter.ts:397-664,765-778` ↔ `ifcReader.ts:351-361,414-435,620-1403` | L |
| A3 | **Geen getypeerd `ImportResult`**: vier readers retourneren vier verschillende ad-hoc-vormen (11 vs 9 vs 7 vs 6 velden); de store verzoent met `as`-casts die precies de compiler-check onderdrukken. | `ifcReader.ts:40-52`; `mspdiReader.ts:119-129`; `p6xmlReader.ts:178-186`; `csvReader.ts:179-186`; `fileSlice.ts:128,135-136,364,371-372,410,417` | S–M |
| A4 | **`writeIFC` met 11 positionele argumenten op 9 callsites**; IFCPanel gebruikt al een afwijkende 9-arg-vorm (bug B4). Nieuw serialiseerbaar veld = 9 edits. | `fileSlice.ts:167,200,259`; `App.tsx:305`; `MenuBar.tsx:47`; `IFCPanel.tsx:23,30`; `devBridge.ts:47,67` | S |
| A5 | **Twee divergente "laad project"-paden**: `openFile`-familie (multi-doc-bewust, runCPM+fit) vs `loadState` (in-place, géén tab/runCPM/fit) met 6 externe callers (App-recovery, MenuBar, Backstage, extensionApi, IFCPanel, devBridge). Drie bijna-identieke ~40-regel-load-blokken in fileSlice. | `projectSlice.ts:246-271`; `fileSlice.ts:121-155,357-381,403-428` | M |
| A6 | **Snapshot/dirty/stale/recompute-boilerplate ~50× herhaald**: 50× `undoStack.push(createSnapshot(s))`, 55× `redoStack = []`, 27× `scheduleStale`, 53× `recomputeViewRows()` — handmatig per actie, divergentie op auteursgeheugen. | telling over `src/state/**`; bv. `taskSlice.ts:117-118`, `structureSlice.ts` (10×) | M |
| A7 | **`TaskTime` mengt invoer, CPM-output, tracking én analyse** in één plat type — consument kan niet zien wat schrijfbaar is en wat `runCPM` overschrijft; en dit type is meteen ook het extensie- én IFC-contract. | `types/task.ts:67-165` | L |

**Doel na sanering: nieuw per-document veld = 1 plek (het type) + 1 bewuste keuze (wel/niet in undo-subset) + 1 IFC-registry-entry — met een round-trip-test die faalt bij een gat.**

### Thema B — God-bestanden in de UI

| ID | Bevinding | Bewijs (kern) | Effort |
|----|-----------|---------------|--------|
| B1 | **`GanttCanvas.tsx` (1.791 r., grootste bestand)**: bar-drag (dag+uur), pan, box-select, dependency-drag, 2 splitters, 3 complete render-loops (dpr/resize-boilerplate 3× identiek), context-menu-bedrading (~30 callbacks), tooltip/toast — allemaal in één component; de mouse-move-guard moet elke nieuwe drag-modus kennen. Hit-testing zelf zit al netjes in de renderer → interactie is scheidbaar, alleen niet gescheiden. | `GanttCanvas.tsx:188-209` (15 useState), `354-601` (3 render-fns), `1002-1362` (drags), `1369` (guard), `1651-1768` (ContextMenu) | L |
| B2 | **`Ribbon.tsx` (1.591 r.)**: 9 tabs hardcoded als inline JSX; ~45 store-selectors in één functie; Calculate-knop 5× gekopieerd — terwijl `ExtensionRibbonGroups` (r. 593-627) knoppen wél declaratief uit data rendert en de primitives (`RibbonButton` etc.) al bestaan. | `Ribbon.tsx:1249-1568,1059-1105` | M–L |
| B3 | **Geen Dialog/Popover-primitive**: 15 dialogs kopiëren letterlijk dezelfde overlay-JSX; 11 dialogs rollen eigen Escape-`useEffect` terwijl `useDialogKeys` bestaat (6 gebruikers); 8 Ribbon-dropdowns + 2 menu's herimplementeren elk click-outside (12× `contains(...)`); geen `useClickOutside`. | grep-tellingen; `ColumnsDialog.tsx:114` e.v.; `Ribbon.tsx:53-60` e.v. | S–M |
| B4 | **`App.tsx` (731 r., fan-out 47)**: settings-bootstrap (~20 losse loads), auto-save (68 r.), recovery-restore (122 r.), auto-CPM, update-check, fullscreen, document-title én een paneel-splitter die het GanttCanvas-splitterpatroon dupliceert — allemaal inline in het layout-component. | `App.tsx:130-148,156-217,225-242,282-350,354-476,503-517` | M |

### Thema C — Engine-duplicatie (suite-gedekt = veilig refactoren)

| ID | Bevinding | Bewijs (kern) | Effort |
|----|-----------|---------------|--------|
| C1 | **`CPMSolver` (1.692 r.) god-class met verborgen fase-volgorde**: ≥8 deelverantwoordelijkheden; vier mutabele side-channel-velden die `forwardPass` vult en `computeResults` consumeert; **niet-idempotente `solve()`** (bug B1); `computeResults` (r. 1383-1691) is als pure post-pass schoon af te knippen. | `CPMSolver.ts:93-125,277-359,449-602,1383-1691` | S (idempotentie+extractie) / L (volledige split) |
| C2 | **Relatie-wiskunde (FS/SS/FF/SF) 4× parallel gedupliceerd** (forward/backward × dag/uur); spiegel-invarianten leven alleen in commentaar; SS/FF/SF-uur-takken gemarkeerd UNVERIFIED; mijlpaal-grensvlaggen 4× identiek herberekend. | `CPMSolver.ts:998-1092,1100-1155,1219-1296,1306-1381` | L |
| C3 | **Lege-`CPMResult`-literal 3× gedupliceerd** (~17 velden, alleen `error` verschilt) — elk nieuw resultaatveld = 4 plekken. | `CPMSolver.ts:282-298,304-320,328-344` | S |
| C4 | **`dateToX`/tijd-as verbatim gedupliceerd** tussen `GanttRenderer` en `HistogramRenderer` (uitlijningsgarantie per commentaar i.p.v. gedeelde bron); MiniMapRenderer waarschijnlijk derde kopie (onbevestigd). | `GanttRenderer.ts:230-234` ↔ `HistogramRenderer.ts:75-86` | S–M |
| C5 | **Thema/kleuren half globale-DOM-read, half hardcoded hex-literalen** in beide renderers (histogram herhaalt Gantt-kleuren met "gelijk aan"-commentaar); renderer daardoor niet puur/headless-testbaar; `printPreview` heeft nóg een eigen kleurtabel. | `GanttRenderer.ts:99-139,203-205`; `HistogramRenderer.ts:42-59`; `printPreview.ts:8-30` | M |
| C6 | **Kalenderkennis lekt**: renderer heeft eigen `buildHolidaySet` (duplicaat van CalendarEngine) + hardcoded za/zo-weekend (bug B2); `ResourceLeveler`/`ResourceLoad` inlinen de `resolveCalendar`-logica i.p.v. de helper te gebruiken. | `GanttRenderer.ts:207-216,317,324`; `ResourceLeveler.ts:117-119`; `ResourceLoad.ts:156-158` | S (resources) / M (renderer) |
| C7 | `runCPM` bedraadt de engine inline in de Immer-`set` incl. ~40 r. summary-rollup-domeinlogica ín de store-mutator; solver niet injecteerbaar (relevant zodra worker/WASM of tweede strategie speelt). | `scheduleSlice.ts:55-175` | M |

### Thema D — Ontbrekende registries / facades

| ID | Bevinding | Bewijs (kern) | Effort |
|----|-----------|---------------|--------|
| D1 | **Settings zonder registry**: ~30 handgeschreven `loadX`/`saveX`-paren + parallel ~20 losse restore-blokken in `App.tsx` + verspreide save-callsites; per instelling ≥4 hand-gesynchroniseerde plekken. Klassieke stille bug: opgeslagen maar nooit teruggeladen. Het patroon (`SHORTCUTS`) is al bewezen in dit project. | `settingsStore.ts` (~30 paren); `App.tsx:156-217,493` | M |
| D2 | **Extensie-API lekt interne domeintypes**: `data.*` geeft rechtstreeks store-objecten (Immer-frozen!) terug; publiek contract = intern datamodel → interne `Task`-refactor breekt extensies. | `extensionApi.ts:56-72`; `extensions/types.ts:7-11,113-127` | L |
| D3 | **Permissies grotendeels decoratief**: `requirePermission` alleen bij `events.*` en `ui.addRibbonButton`; `importers.*`, `data.*`, `settings.*` ongecontroleerd; 4/6 gedeclareerde permissies nergens getoetst; `commands`-permissie heeft geen API-oppervlak. | `extensionApi.ts:30-34,42-119`; `extensions/types.ts:23-30`; `extensionService.ts:151` | M |
| D4 | **Platform-gedrag ~12× inline gedupliceerd**: detectie (`isTauri`) is netjes centraal, maar elke callsite kiest zelf de web-fallback — file-open/save zijn stille no-ops op web, `ReportPanel.writePdf` heeft wél een blob-fallback. Geen `platformFileService`. | `fileSlice.ts:90-340` (6×); `App.tsx`, `TitleBar`, `updaterService`, `feedbackService`, `ReportPanel` | M |
| D5 | Shortcut-registry gesloten (module-const; extensies/features kunnen niets registreren); NL-hardcoded strings in extensie-statusfouten/manifest-defaults; `printPreview` importeert `DateNotation` uit `@/state` (enige service→state-import). | `shortcutRegistry.ts:107`; `extensionService.ts:147-148`; `extensionLoader.ts:121-160`; `printPreview.ts:5` | S |

### Thema E — Kleine laag-fixes (import-graaf)

| ID | Bevinding | Bewijs | Effort |
|----|-----------|--------|--------|
| E1 | **Enige echte runtime-cyclus**: `types/calendar.ts` importeert `generateHolidays`/`NL_SET` als waarde uit `engine/calendar/holidays.ts` (fabrieksfunctie in types-bestand); zelfde patroon `types/task.ts` → `utils/dateUtils.ts` (geen cyclus). | `types/calendar.ts:2,71` | S |
| E2 | `utils/displayDate.ts` bevat React-hooks die op `useAppStore` subscriben → hoort in `src/hooks/`. | `utils/displayDate.ts` | S |
| E3 | Renderer/view-contract-types (`ViewState`, `FilterNode`, `TimeScale`, `DateNotation`, …) leven in `state/slices/types.ts` (dat sowieso een 278-regel-verzamelbak is; `UIState` = 78-property-god-interface zonder persisted/session-grens) → verhuizen naar `src/types/`, `UIState` splitsen. | `state/slices/types.ts:26-274`; 6 type-imports vanuit engine/services | S–M |

### Overig

- **Cross-reader-duplicatie** (datum-parsers 4×, DOM-helpers 2×, uur-modus-orkestratie 3×, `synthBandsFromScalar` 3×, WBS-rebuild 2×, TaskType-array 2×) → optillen naar gedeelde modules naast `subdayIo`. Effort M. (`ifcReader.ts:188,256,272-333`; `mspdiReader.ts:30-47,403-416,626`; `p6xmlReader.ts:37-60,360-382,629`; `csvReader.ts:70,81,276-289`)
- **Reader↔writer-constanten dubbel** (DEFAULT_PRIORITY, measure-maps, resource-typemaps, tijd-anker, curve-inversen) → gedeelde consts per paar (het `P6_DAY_NAMES`-patroon). Effort S–M.
- **`printPreview.ts` (1.112 r.)**: layout-geometrie + tekening + eigen datumformat + eigen kleurtabel in één pass; `paginate`/`miniPdf` zijn al netjes apart. Effort M–L, risico laag.
- **STEP-tokenizer** (~85 r. puur) zit ín `ifcReader`; writer heeft eigen STEP-primitieven → `services/ifc/step/`-module. Effort M.
- **`state→extensions`**: 5 waarde-imports (eventBus) — verdedigbaar als pub/sub, maar wel tweerichtingskoppeling; meenemen bij D2.

---

## Prioritering — (Impact + Risico) × (6 − Effort)

| Werkpakket | Bevindingen | I | R | E | **Prio** |
|------------|------------|---|---|---|----------|
| P1 `ImportResult`-type + casts weg | A3 | 4 | 4 | 2 | **32** |
| P2 `writeIFC` options-object (fixt B4) | A4 | 3 | 4 | 1 | **35** |
| P3 CPMSolver: idempotentie-reset + `emptyResult()` + `computeResults`-extractie (fixt B1) | C1, C3 | 3 | 4 | 2 | **28** |
| P4 Renderer-kalender via CalendarEngine (fixt B2) + `resolveCalendar`-dedup | C6 | 3 | 4 | 2 | **28** |
| P5 Eén load-pad `applyLoadedProject` | A5 | 4 | 4 | 3 | **24** |
| P6 Dialog/Popover-primitives + `useClickOutside` + `useDialogKeys`-migratie | B3 | 4 | 2 | 2 | **24** |
| P7 `TimeAxis`-waardeobject gedeeld tussen renderers | C4 | 3 | 3 | 2 | **24** |
| P8 `mutate()`-transactiehelper (50× boilerplate) | A6 | 4 | 3 | 3 | **21** |
| P9 Settings-registry (à la `SHORTCUTS`) | D1 | 4 | 3 | 3 | **21** |
| P10 **DocumentState-contract**: key-gedreven capture/hydrate/reset; `Snapshot` als `Pick<>`; gedeelde `restoreSnapshot` (fixt B3) | A1, uitloper A7 | 5 | 5 | 4 | **20** |
| P11 **IFC-schema-registry + round-trip-property-test** | A2 + consts | 5 | 5 | 4 | **20** |
| P12 Kleine laagfixes: types-cyclus, displayDate→hooks, view-types→`src/types/`, UIState-split | E1–E3 | 2 | 2 | 1 | **20** |
| P13 `platformFileService` (web-fallback-strategie centraal) | D4 | 3 | 3 | 3 | **18** |
| P14 App.tsx → hooks (`useAutoSave`, `useRecovery`, `useSettingsBootstrap`, `useSplitter`, …) | B4 | 3 | 2 | 3 | **15** |
| P15 `RelationResolver` (4× relatiewiskunde → 1 beschrijving/type) | C2 | 4 | 4 | 4 | **16** |
| P16 Extensie-facade + permissie-centralisatie | D2, D3 | 3 | 4 | 4 | **14** |
| P17 ThemePalette-injectie renderers | C5 | 2 | 2 | 3 | **12** |
| P18 Ribbon-config-registry | B2 | 3 | 2 | 4 | **10** |
| P19 Cross-reader-dedup (datum/uur-modus/WBS/DOM-helpers) | overig | 3 | 3 | 3 | **18** |
| P20 GanttCanvas → interactie-hooks + `useCanvasLayer` | B1 | 4 | 3 | 5 | **7**\* |
| P21 printLayout/printRenderer-split; STEP-module | overig | 2 | 2 | 4 | **8** |

\* Formule straft het hoge effort af; strategisch blijft P20 belangrijk — plannen op een natuurlijk moment (zie fase 4), niet overslaan.

---

## Gefaseerd saneringsplan (naast feature-werk uitvoerbaar)

**Vangnetten per gebied** — scheduler: `tests/planning/` (231 cases, headless) = sterkste vangnet van de codebase; state/adapters: compiler (`tsc` strict) + voorbeeldbestanden + round-trip-test (nieuw, onderdeel P11); renderers/UI: géén suite — visuele verificatie via Playwright/`window.__OPS__` verplicht.

### Fase 1 — Quick wins + buglossers (dagen; alles S/S–M, suite- of compiler-gedekt)
P1, P2, P3, P4, P12, reader↔writer-consts. **Lost alle vier gevonden bugs op** en haalt de goedkoopste contract-gaten dicht. Elk pakket onafhankelijk committeerbaar.

### Fase 2 — Het document-contract (de kern; ~1 week geconcentreerd werk)
P5 → P10 → P8, in die volgorde (eerst één load-pad, dan het key-gedreven contract, dan de transactiehelper). Incrementeel binnen P10: eerst `hydratePayload` key-gedreven (grootste stille-lek-risico), dan reset-blokken, undo/redo als laatste. Resultaat: **nieuw per-document veld van ~13 → 1-2 plekken.**

### Fase 3 — Het persistentie-contract
P11: IFC-schema-registry (write/read-descriptors over één lijst) + round-trip-property-test die elk domeinveld door save/load haalt. Daarna P19 (cross-reader-dedup). Resultaat: **nieuw veld door IFC = 1 registry-entry; vergeten = falende test i.p.v. stil dataverlies.**

### Fase 4 — UI-fundament (parallel aan fase 2/3 mogelijk; ander deel van de codebase)
P6 → P14 → P9. Daarna, op natuurlijke momenten: P20 (bij eerstvolgende Gantt-interactie-feature; eerst `useSplitter` uit P14 hergebruiken), P18 (bij eerstvolgende ribbon-uitbreiding), P7+P17 (bij eerstvolgende renderer-werk, met visuele regressie-checks).

### Fase 5 — Strategisch, alleen mét aanleiding
- P15 (RelationResolver): grootste structurele engine-winst, maar veel werk; doen bij de eerstvolgende scheduling-golf, met de suite als poort — en eerst extra cases voor de UNVERIFIED SS/FF/SF-uur-takken toevoegen.
- P16 (extensie-facade/permissies): **vóór** het extensie-ecosysteem groeit — hoe later, hoe duurder het contract-breken wordt.
- P13 (platformFileService): zodra een echte web-file-flow gewenst is.
- C7 (runCPM-injectie/rollup-extractie): alleen bij worker/WASM- of tweede-scheduler-plannen.
- A7 (`TaskTime`-splitsing input/computed/tracking): invasief; alleen samen met ander solver/IFC-werk.

### Wat bewust NIET doen
- `GanttRenderer` volledig in pass-modules splitsen (C-thema, "groot maar net"): interne coherentie is goed, hit-test/teken-geometrie deelt al één bron — lage opbrengst, renderlaag ongetest.
- De 72%-store-koppeling van componenten "oplossen": dat is het normale Zustand-idioom (granulaire selectors i.p.v. prop-drilling), geen schuld.
- Lagen herschikken: de import-graaf bewijst dat de laag-architectuur al klopt.
