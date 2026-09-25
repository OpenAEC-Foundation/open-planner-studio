---
paths:
  - "src/state/**"
  - "src/engine/scheduler/solveProject.ts"
  - "src/engine/scheduler/recordedDates.ts"
  - "src/components/layout/RecordedDatesNotice.tsx"
  - "src/hooks/useAutoCalcCPM*"
  - "tests/planning/check-document-contract.ts"
  - "tests/planning/check-recorded-dates.ts"
---

<!-- Verplaatst uit CLAUDE.md (2026-09): laadt alleen wanneer Claude een bestand leest dat op `paths` past. Inhoud overgenomen; kruisverwijzingen wijzen naar het betreffende rules-bestand. -->

### State: één Zustand + Immer store, samengesteld uit slices

`src/state/appStore.ts` is een compositie-root: `create<AppState>()(immer(...))` combineert de slice-creators uit `src/state/slices/` plus de gridtransactieslice. Elke slice is getypeerd als `AppSlice<XSlice>` (zie `slices/types.ts`) tegen de **volledige** `AppState`, zodat cross-slice acties (runCPM, undo/redo, newProject, file-I/O) gewoon de hele Immer-draft muteren. Nieuwe state/acties horen in de passende slice; `slices/types.ts` bevat daarnaast gedeelde type/enum-definities (`ViewState`, `UIState`, …). Domain-types staan in `src/types/`. De renderer leest alleen uit de store.

De gemounte productinterface gebruikt bewust exact één `appStoreContext`; React-componenten blijven
die app-singleton atomisch lezen via `useAppStore(selector)`. Dezelfde compositie-root kan voor
headless code en isolatietests wel onafhankelijke contexten maken met `createAppStoreContext()`.
Ownership is daarbij expliciet:

| oppervlak | eigenaar |
|---|---|
| React UI-selectors en de gemounte productinterface | `useAppStore` / `appStoreContext` |
| documentstate, undo/redo en niet-documentaire state binnen één context | `AppStoreContext.store` |
| undo-coalescing, batchdiepte, MCP-lease en timephased-verliestelling | `AppStoreContext.runtime` |
| batch-, MCP- en extensie-`data.*`-uitvoering | de expliciet meegegeven documentcontext |
| extensie-ribbon/importers/cleanup en notificaties | de expliciet geïnjecteerde app-hostbinding |
| app-lifecycleregistries zoals extensie-instanties, eventbus, PDF-fontproviders en SDK-windowbinding | app-globaal |
| `batchTransaction.ts` en `mcpTransaction.ts` | dunne compatibiliteitsadapters die alleen `appStoreContext` binden |

Core runtimefactories en storegebonden MCP-tools mogen daarom nooit zelf `useAppStore` of
`appStoreContext` importeren. `npm run verify:store-boundaries` bewaakt die grens mechanisch. Een
tweede context is een correct headless/testfundament, geen productbelofte voor multi-window of een
multi-store-Reactinterface.

Multi-document is **single-active**: het actieve document leeft op top-level (project/tasks/sequences/… zoals altijd), zodat alle slices, componenten en de renderer single-document blijven. `documentSlice` bewaart de overige geopende documenten als losse `DocumentPayload`-snapshots en swapt top-level ↔ payload bij `switchDocument`/`newDocument`/`closeDocument`. Per-document: project, kalender, taken/relaties/resources/toewijzingen, selectie, `cpmResult`, `view`, `collapsedTaskIds`, `filePath` en `isDirty`. De undo/redo-opslag is geen stapel in iedere payload maar één niet-gepersisteerde sessiechronologie binnen de appcontext (`historyEvents`/`nextHistorySequence`); undo en redo kiezen daaruit het toepasselijke event voor het actieve document of de betreffende gridsurface. Ook de rest van `ui`, `taskClipboard` en de taakgridvoorkeuren is appcontext-globaal en wordt niet met een document geswapt. Er is altijd minstens één document; het laatste sluiten reset naar een leeg document. De document-chrome-UI staat in `src/components/layout/DocumentChrome/`: `DocumentTabBar`, `ProjectRail` en `SwitcherPill` zijn drie instelbare stijlen (`ui.documentChromeStyle` ∈ `'tabs' | 'rail' | 'switcher'`, persistent), plus een `ProjectOverview`-overlay en `CloseDocumentDialog` met 3-weg sluitbevestiging (opslaan/niet opslaan/annuleren); Ctrl/⌘ 1–9 springt naar het n-de document. `openFile`/`openRecentFile` openen in een **nieuw** document tenzij het actieve tabblad nog leeg en ongewijzigd is (`isActivePristine` in `fileSlice`); "Nieuw" opent de projectwizard (`ProjectInfoDialog` met kalender-presets en faseringssjablonen, via `ui.showNewProjectDialog`) in plaats van een kaal `newProject()`.

Scheduling is **manual, not reactive**: the actual solve — leaf-filter → `CPMSolver` (which owns `CalendarEngine`) → write computed fields (early/late dates, total float, critical-path flag) back onto the tasks — lives in `solveProject()` (`src/engine/scheduler/solveProject.ts`), extracted from `runCPM` in A3/M3 so it has exactly one implementation. The `runCPM` action (`scheduleSlice.ts`) is a thin wrapper: it calls `solveProject` directly on the Immer draft (`s.tasks` mutated in place), then sets `cpmResult`/`resourceLoadResult` and clears `scheduleStale`. It does not re-run on every edit — triggered explicitly by F5, the ribbon **Calculate** button, the menu, and after an IFC load. Editing tasks without calling `runCPM` leaves the schedule stale, so call it after mutating tasks/sequences/calendar. The same `solveProject` also powers the resource-occupancy overview (see *Resourcebibliotheken* below): opening the overview runs it there on a **clone** (`cloneTasksForSolve`) of a stale, non-active document's tasks — ephemeral, no write-back. Is **Automatisch berekenen** aan, dan gebeurt dat efemere doorrekenen nog steeds, en draait `documentSlice`'s `recalculateStaleSleepingDocuments()` er **daarnaast** overheen: die rekent óók op een kloon van de payload-taken en schrijft juist díé kloon terug (no undo snapshot, mirroring `runCPM`'s semantics). Die kloon is geen detail maar de atomiciteitsgarantie — de payload blijft onaangeraakt tot de solve slaagt, zodat een cyclus niets halfs achterlaat. Het actieve document blijft buiten die actie en houdt zijn eigen pad via `useAutoCalcCPM`.

**Datums zoals opgeslagen (issue #63).** Het laden herberekent nog steeds onvoorwaardelijk — die solve ís de detectie — maar de uitkomst kan bewust worden teruggedraaid. Wijkt het rekenresultaat af van wat het bestand vastlegde, dan biedt `RecordedDatesNotice` aan de opgeslagen datums te tonen; `showRecordedDates()` zet ze terug en reconstrueert `cpmResult` uit het bestand via `src/engine/scheduler/recordedDates.ts`, zónder te solven. Drie gevolgen die je moet kennen voor je hier iets aanraakt: (1) `runCPM` pusht in déze ene situatie wél een undo-snapshot — buiten de modus geldt de oude invariant onverkort, waar `staleGuard`/`batchTool` op leunen; (2) `scheduleStale` mag nooit `true` zijn terwijl `datesAsRecorded` aanstaat, want in de modus staat het bestand op het scherm en niet een berekening — zet de vlag daarom via `markScheduleStale` (`state/transaction.ts`) en nooit rechtstreeks, wat een broncode-check in `check-recorded-dates.ts` afdwingt; (3) `parseDateFromIFC` maakt van een `$`-slot de datum van vandaag, dus "welke datums gaf het bestand écht" komt uit `ImportResult.recordedFields` en niet uit de gelezen taakvelden. Sinds 2026-09-09 (eigenaarsbesluit "elk formaat zoals XER") levert élke lezer een herkomst (`ImportResult.recordedTimesOrigin`): XER, P6 XML, MSPDI, `.mpp` en CSV leveren de bronuitvoer als `recordedTimes` (bak 4: weergave, nooit solverinvoer — `buildRecordedTime` in `recordedDates.ts`, ontbrekende assen ontbreken), `readIFC` onderscheidt een IFC uit een ander pakket (`'ifc'`) van een eigen bestand (`'ifc-own'`, via `IFCAPPLICATION 'OPS'` of een `OPS_`-pset). `applyRecordedDatesOnLoad` zet de modus automatisch aan bij een verse import mét afwijkingen, en bij een heropening van een eigen IFC (`'ifc-own'`/`'xer-archive'`) alleen zolang `importPristine` ("ongewijzigd sinds import", pset `OPS_ImportProvenance`, documentveld) nog `true` is — elke mutator wist die vlag via `markDocumentEdited` (`state/documentEdited.ts`, de enige plek met `isDirty = true`; broncodescan in `check-recorded-dates.ts` §16), F5 en opslaan niet. Regressie: `check-recorded-times-formats.ts` (lezers + IFC-herkomst), `check-recorded-dates.ts` §7/7B/16, `recorded-dates.spec.ts`.

**Het documentcontract — lees dit vóór je een veld aan de state toevoegt.** Naast de slices staan er in `src/state/` vier modules die samen bepalen wat een "document" ís. Ze bestaan omdat deze afspraken eerder ~50× met de hand herhaald werden en dan stilzwijgend uit elkaar liepen:

| module | rol |
|---|---|
| `documentContract.ts` | `DOCUMENT_FIELDS` — één descriptorlijst met per veld: waar het in de live state woont (`get`/`set`), de verse default (`fresh`), de rol in de undo-snapshot (`clone`/`ref`/`none`), en optioneel een leesmigratie. `capturePayload`/`hydratePayload`/`freshPayload` lopen key-gedreven over die ene lijst, dus capture en hydrate kúnnen niet divergeren. Een nieuw veld in `DocumentPayload` dat de lijst mist geeft een **compile-fout**. |
| `snapshot.ts` | de undo/redo-snapshot als expliciete `Pick<>`-subset van datzelfde contract, gestuurd door de `snapshot`-rol per veld. |
| `transaction.ts` | het muteer-ritueel (snapshot pushen, redo leegmaken, `isDirty`/`scheduleStale` zetten) op één plek in plaats van per actie. |
| `ifcSaveInput.ts` | welke velden een IFC-save meeschrijft — precies de round-trip-velden van het contract, zodat alle callsites (opslaan, auto-save, IFCPanel, devBridge) dezelfde bron doorgeven. |
| `defaults.ts` | de `fresh`-fabrieken (`createDefaultProject`/`createDefaultView`) als **bladmodule**: hij importeert niets uit `slices/`. Dat is geen stijlkeuze — stonden ze in hun slice, dan ontstaat de cyclus `projectSlice → transaction → snapshot → documentContract → projectSlice`, die alleen werkt zolang het function *declarations* zijn (hoisting). `npm run verify:cycles` bewaakt dat. |

Voeg je projectdata toe, dan hoort die dus in `DOCUMENT_FIELDS` — anders overleeft hij geen documentwissel, geen undo, geen crashherstel en geen opslaan. `tests/planning/check-document-contract.ts` bewaakt de keten.
