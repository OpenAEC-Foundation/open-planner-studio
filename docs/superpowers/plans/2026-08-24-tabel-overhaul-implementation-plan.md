# Tabel-overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Regelnummers zijn alleen wegwijzers. Zoek vóór iedere wijziging op de genoemde symbolen; de inhoud en de actuele diff zijn leidend.

**Goal:** Vervang de twee huidige taaktabelimplementaties door één modulaire, virtuele taakgrid die in de volledige Tabel-weergave en links van de Gantt exact hetzelfde gedrag en dezelfde kolommen biedt, inclusief P6-achtige celbediening, persoonlijke kolomvoorkeuren, atomaire paste/undo, volledige velddekking en relatiepariteit.

**Architecture:** Een store-onafhankelijke `DataGridCore` beheert rijen, cellen, virtualisatie, selectie, toetsenbord, klembord en ARIA. Een headless `TaskGridAdapter` vertaalt `ViewRow`-voorkomens en het exhaustieve `taskColumnRegistry` naar de gridkern. `FullTaskGrid` en `GanttTaskGrid` zijn dunne oppervlakken met ieder eigen gebruikersvoorkeuren. Datamutaties lopen via pure planners en één synchrone prepare/commit-grens; undo/redo wordt één sessiebrede eventhistorie. De Gantt-canvas houdt alleen tijdlijn-, balk- en afhankelijkheidsgedrag en krijgt lokale x-coördinaten met oorsprong nul.

**Tech Stack:** React 19, TypeScript strict, Zustand 5 met Immer, Vite 7, i18next, Canvas 2D, bestaande headless esbuild/Node-tests onder `tests/planning/`.

**Spec:** `docs/superpowers/specs/2026-08-24-tabel-overhaul-design.md`

## Global Constraints

- Werk alleen op branch `codex/tabel-overhaul` in de worktree `milestone-subtask-relations-f2fa88`.
- Push niets naar `main` en publiceer niets zonder nieuw, concreet akkoord van de eigenaar.
- Raak `src/components/panels/ResourcePanel.tsx`, `src/components/panels/ResourcePanelCompact.tsx` en hun geavanceerde resourcetabelgedrag niet aan. De taakgrid mag alleen bestaande resource-/assignmentacties en de nieuwe pure assignmentplanner gebruiken.
- Voeg geen kolomkop-sortering toe. De bestaande expliciete sortering via Weergave blijft bestaan.
- Voeg geen knop in een taakcel en geen permanent nieuw eigenschappenpaneel toe.
- Behoud vaste rijhoogte: één taakgridrij is exact even hoog als één Gantt-rij. Tekst blijft één regel met ellipsis en dezelfde hoverinhoud als bij een taakbalk.
- Alle gridvoorkeuren zijn op gebruikersniveau. `gantt-task-grid` en `full-task-grid` hebben dezelfde beschikbare kolommen, maar afzonderlijke volgorde, breedte, pinning en horizontale scroll.
- Berekende kolommen zijn zichtbaar en kopieerbaar, maar niet bewerkbaar. Verouderde berekende waarden blijven staan met een niet-kleurafhankelijk stale-signaal tot **Berekenen**.
- `computeViewRows` blijft de enige filter-/groep-/sorteer-/flattenroute. Componenten mogen geen tweede rijpijplijn bouwen.
- Iedere gebruikershandeling is alles-of-niets en levert hoogstens één history-event op. Tussen prepare en commit staat geen `await`, callback, notificatie of andere kans om de live store te wijzigen.
- Verwijder de Relaties-tab pas nadat de pariteitsmatrix aantoonbaar groen is. Tot dat moment blijft de oude tab beschikbaar als referentie.
- Alle nieuwe gebruikerslabels komen in alle veertien locales. Nederlands en Engels worden inhoudelijk geschreven; de overige locales krijgen echte vertalingen en nooit kale Engelse fallbackkeys.
- Iedere taak volgt rood → minimale implementatie → groen → relevante regressies → eigen commit. De exitcode is leidend.
- Gebruik gerichte checks tijdens een taak. Draai `npm run verify` bij iedere etappepoort en opnieuw als eindpoort.

## 1. Bestandsverantwoordelijkheden

### Nieuwe headless grid- en taakmodules

- `src/types/taskGrid.ts` — stabiele grid-, surface-, selectie-, preference-, kolom- en mutatietypes.
- `src/engine/taskGrid/fieldIds.ts` — canonieke vaste en projectgebonden `TaskColumnId`-encoding/decoding.
- `src/engine/taskGrid/fieldCoverage.ts` — compile-time exhaustieve bronveldclassificatie.
- `src/engine/taskGrid/taskColumnRegistry.ts` — enige catalogus van kolommen, categorieën, readers, formatters, parsers en editability.
- `src/engine/taskGrid/preferences.ts` — defaults, normalisatie, projectveilige migratie, MRU en layoutconversie.
- `src/engine/taskGrid/selection.ts` — actieve cel, anker, rechthoek, duplicate occurrences en verdwijnende rijen/kolommen.
- `src/engine/taskGrid/navigation.ts` — P6-toetsenbordcommando’s en scroll-doelberekening.
- `src/engine/taskGrid/virtualization.ts` — absolute rij-/kolomindices en overscanvensters.
- `src/engine/taskGrid/clipboard.ts` — RFC-achtige TSV quoting/parsing en rechthoekmapping, zonder taakdomein.
- `src/engine/taskGrid/editors.ts` — gemeenschappelijke datum-, duur-, percentage-, boolean- en enumparsers.
- `src/engine/taskGrid/assignmentPlan.ts` — pure assignmentsetplanner en invalidatiematrix.
- `src/engine/taskGrid/relationFormat.ts` — interne en externe relatietokens, `OPS-EXT/1` en padnormalisatie.
- `src/engine/taskGrid/relationPlan.ts` — complete gewenste relatietoestand, id-behoud, eindgraaf en cycluscontrole.
- `src/engine/taskGrid/relationIndex.ts` — vanaf de registryfundering de enige O(n)-index voor predecessor/successor-display; later uitgebreid met driving, waarschuwingen en trace.
- `src/engine/taskGrid/taskGridAdapter.ts` — storevrije adapter van `ViewRow` + registry + callbacks naar `DataGridCore`.
- `src/state/sessionHistory.ts` — eventselectie, scope-invalidation, pruning en pure history-targetmaterialisatie.
- `src/state/gridTransaction.ts` — synchrone prepare/commit-grens voor cel-, paste-, relation- en assignmentintents.
- `src/state/documentActivation.ts` — pure payload/library-boundarymaterialisatie vóór één storepublicatie.
- `src/state/slices/taskGridSlice.ts` — app-globale live state en acties voor beide gebruikerssurfaces plus gedeelde MRU; nooit onderdeel van documentdata.

### Nieuwe React-modules

- `src/components/task-grid/DataGridCore.tsx` — DOM-grid, virtualisatie, roving focus en eventdispatch.
- `src/components/task-grid/DataGridHeader.tsx` — koppen, pinning, resize, auto-fit, drag en minactie.
- `src/components/task-grid/ColumnChooser.tsx` — pluspop-over met MRU, zoeken en categorie-accordions.
- `src/components/task-grid/GridCell.tsx` — presentatielaag voor normale, stale, read-only en geselecteerde cellen.
- `src/components/task-grid/GridEditorHost.tsx` — editor-/popoverlevenscyclus, validatie en focusherstel.
- `src/components/task-grid/TaskCellEditor.tsx` — taakdomeineditors die uitsluitend adaptercallbacks aanroepen.
- `src/components/task-grid/RelationCellEditor.tsx` — relatietokens, autocomplete, hover en contextmenu.
- `src/components/task-grid/TaskGrid.tsx` — gedeelde samenstelling van registry, adapter en `DataGridCore`.
- `src/components/task-grid/FullTaskGrid.tsx` — volledige Tabel-surface.
- `src/components/task-grid/GanttTaskGrid.tsx` — linker Gantt-surface.
- `src/components/canvas/GanttWorkspace.tsx` — DOM-eigenaar van grid, splitter, timelinecanvas, gedeelde verticale scroll en histogram.

### Bestaande modules die doelgericht veranderen

- `src/types/view.ts`, `src/engine/view/visibleRows.ts`, `src/state/slices/viewSlice.ts` — `rowKey`, kolommigratie en occurrence-expliciete helpers.
- `src/state/documentContract.ts`, `src/state/snapshot.ts`, `src/state/transaction.ts`, `src/state/batchTransaction.ts`, `src/state/mcpTransaction.ts`, `src/state/slices/historySlice.ts`, `src/state/slices/documentSlice.ts`, `src/state/slices/fileSlice.ts`, `src/state/slices/librarySlice.ts` — session history en atomaire activatie.
- `src/utils/settingsStore.ts`, `src/utils/settingsRegistry.ts`, `src/hooks/useSettingsBootstrap.ts` — persoonlijke gridvoorkeuren en migratie.
- `src/components/panels/TableEditor.tsx`, `src/components/dialogs/ColumnsDialog.tsx`, `src/components/dialogs/LayoutsDialog.tsx`, `src/components/viewControls/layoutSnapshot.ts` — vervangen of reduceren tot de nieuwe grid-/layoutcontracten.
- `src/components/canvas/GanttCanvas.tsx`, `src/engine/renderer/GanttRenderer.ts`, `src/engine/renderer/HistogramRenderer.ts`, `src/components/canvas/ganttRenderOptions.ts`, `src/utils/ganttViewport.ts`, `src/hooks/useGanttZoom.ts`, `src/hooks/useZoomShortcuts.ts`, `src/components/canvas/MiniMap.tsx` en de gesture-hooks — canvasknip en drie expliciete x-contracten.
- `src/state/relationActions.ts`, `src/state/relationRules.ts`, `src/state/slices/sequenceSlice.ts`, `src/state/slices/taskSlice.ts`, `src/engine/externalLinks.ts`, `src/components/dialogs/ExternalLinkDialog.tsx`, `src/components/panels/RelationsPanel.tsx` — relation planner, externe edit en uiteindelijke verwijdering.
- `src/components/layout/Ribbon/ribbonConfig.tsx`, `src/components/layout/Ribbon/ribbonWidgets.tsx`, `src/state/slices/uiSlice.ts`, `src/App.tsx` — relatiedropdown, traceknoppen en pas als laatste de tab verwijderen.
- `src/i18n/locales/*/{task,menu,common}.json`, `src/styles/globals.css` — tekst, RTL, high-contrast en gridstijl.
- `tests/planning/run.sh` — iedere nieuwe headless check expliciet registreren; inventarisverlies moet rood zijn.

## 2. Verificatieconventie

Iedere nieuwe check is een zelfstandig `tests/planning/check-*.ts`-bestand, wordt met `bundle_check` in `tests/planning/run.sh` geregistreerd en eindigt met exitcode 1 bij een verschil. Voor gerichte uitvoering mag de implementer het ene bestand met dezelfde esbuildflags als `run.sh` bundelen; de taakpoort blijft de volledige planningssuite wanneer store- of schedulergedrag verandert.

Vaste commando’s:

```bash
npm run typecheck
bash tests/planning/run.sh
npm run lint
npm run verify
```

Browserbewijs gebruikt de echte ontwikkelapp en de bestaande voorbeeldplanning plus een gegenereerd groot project. Bewaar relevante screenshots onder `artifacts/tabel-overhaul/`; commit alleen beelden die een blijvende regressiemeetlat vormen en geen privédata bevatten.

### Specdekkingsmatrix

| Specdeel | Implementatietaak | Primair bewijs |
|---|---:|---|
| §2–§3 productbesluiten/scope | alle, bewaakt door Global Constraints | bronstructuurchecks + einddiff |
| §4.1 lagen | 2, 7–11 | `check-task-grid-adapter`, ARIA- en registrychecks |
| §4.2 stabiele rijvoorkomens | 1, 7 | `check-view-row-key`, selectiecheck |
| §4.3 Gantt-oppervlak en drie x-contracten | 0, 15–16 | ownership-, workspace- en coordinatechecks + screenshots |
| §4.4 volledige Tabel | 14 | `check-full-task-grid-surface` |
| §4.5 virtualisatie/uitlijning | 7, 9, 15–16, 22 | virtualisatie-/DOM-budgetchecks + pixelbewijs |
| §5 volledige velddekking | 2, 12–13, 17–19 | compile-time coverage + registry/editorchecks |
| §6 kolomkiezer, verwijderen, pinnen, resize | 3, 9–10 | columns/preferences/ARIA-checks |
| §7 selectie en P6-keyboard | 7, 9, 14 | selection/navigation/ARIA-checks |
| §8 editors, stale, clipboard, atomiciteit | 6, 8, 12–13, 17–19 | transaction-, clipboard- en editorchecks |
| §9 relatiekolommen | 17–19 | external-format, relation-plan en relation-cellchecks |
| §10 dropdown, trace, tabverwijdering | 20–21 | ribbon/tracecheck + pariteitsmatrix |
| §11 rijacties/structuur | 1, 7, 14–15 | contextmenu-, move-task- en tree-modechecks |
| §12 usersettings/layouts/migratie | 3, 10, 14 | preference-, documentcontract- en historychecks |
| §13 sessiehistorie/activatie | 4–6 | session-history, activation en transactionchecks |
| §14 toegankelijkheid/i18n/thema | 9–10, 22 | ARIA/i18nchecks + RTL/high-contrastbewijs |
| §15 prestaties | 7, 9, 18, 22 | DOM-budget + deterministische benchmark |
| §16 randgevallen | 1, 3–10, 13, 17–19, 22 | per-module hostile cases + eindroute |
| §17 test-/bewijsstrategie | 0–22 | geregistreerde planningchecks + appbewijs |
| §18 bouwvolgorde/poorten | etappepoorten onder §3 | commits, exitcodes en geen vroege tabverwijdering |

---

## Task 0: Leg de uitgangstoestand en canvaseigenaars vast

**Files:**
- Create: `docs/superpowers/evidence/tabel-overhaul-baseline.md`
- Create: `tests/planning/check-gantt-event-ownership.ts`
- Modify: `tests/planning/run.sh`
- Test: `tests/planning/check-gantt-render-options.ts`
- Test: `tests/planning/check-axis-consolidation.ts`
- Test: `tests/planning/check-focus-task.ts`

- [ ] Noteer `git rev-parse HEAD`, branch, Node/npm-versies en de exitcodes van `npm run typecheck` en `bash tests/planning/run.sh` in het bewijsdocument; verander geen verwachting om een bestaande fout te maskeren.
- [ ] Start de app en reproduceer in het huidige Gantt-linkerpaneel: rijselectie, Ctrl-/Shift-selectie, disclosure, nieuwe taak, dubbelklik, contextmenu, rijdrag, splitterdrag, verticale scroll, horizontale tijdscroll, fit-to-project en focus-on-task.
- [ ] Leg per handeling de huidige eigenaar en beoogde eigenaar vast in een tabel. De beoogde eigenaar is DOM-grid/workspace voor linkerpaneelhandelingen en timelinecanvas voor balk-/tijdhandelingen.
- [ ] Schrijf `check-gantt-event-ownership.ts` eerst rood. De check leest de afgesproken ownershipmanifest-export en vereist voor elke actie exact één eigenaar; de export bestaat nog niet, dus bundelen moet falen.
- [ ] Voeg in `src/components/canvas/ganttEventOwnership.ts` een tijdelijk maar blijvend getypeerd manifest toe met de huidige eigenaars. Gebruik unions `GanttAction` en `GanttOwner`, geen vrije strings.
- [ ] Laat de check groen worden en registreer hem in `run.sh`.
- [ ] Bewaar schermafbeeldingen van de uitgangsuitlijning in licht en donker, inclusief histogram en split view.
- [ ] Draai `npm run typecheck` en de drie bestaande Gantt-checks; leg de exitcodes vast.
- [ ] Commit: `test: pin eigenaars en uitgangstoestand van Gantt-events`.

## Task 1: Maak `ViewRow.rowKey` verplicht en occurrence-veilig

**Files:**
- Modify: `src/engine/view/visibleRows.ts`
- Modify: `src/state/slices/viewSlice.ts`
- Modify: `src/state/slices/selectionSlice.ts`
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: alle hits uit `rg -n "viewRows.*findIndex|findIndex.*viewRows|row\.task\.id" src tests/planning`
- Create: `tests/planning/check-view-row-key.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode cases voor boomrijen (`rowKey === task.id`), groepsrijen (`rowKey === group.key`) en dezelfde taak in twee resourcebanden met twee verschillende `rowKey`s.
- [ ] Voeg `rowKey` toe aan het echte unioncontract:

```ts
export type ViewRow =
  | { kind: 'task'; rowKey: string; task: Task; depth: number; dimmed: boolean }
  | { kind: 'group'; rowKey: string; key: string; label: string; count: number; depth: number; levelIndex: number; collapsed: boolean };
```

- [ ] Encodeer een gegroepeerd taakvoorkomen als `JSON.stringify({ kind: 'task', groupPath: rawGroupPath, taskId: task.id })`; gebruik niet een label, array-index of vertaald stuk tekst. Groepsrijen houden hun bestaande array-gecodeerde `group.key`, zodat een task-id die toevallig gelijk is aan een groepsrawkey nooit met een groepsrowKey kan botsen.
- [ ] Voeg een hostile case toe waarin een task-id exact gelijk is aan de raw key van een geneste groepsband; alle task- en group-rowKeys blijven uniek.
- [ ] Vervang iedere occurrence-lookup die nu impliciet “eerste taskId” kiest. Visueel focus-/scrolgedrag neemt `rowKey`; datamutaties, balken en taakselectie dedupliceren op `task.id`.
- [ ] Pas `focusOnTask` aan zodat het gewenste domeindoel `taskId` blijft, maar de Gantt bij meerdere voorkomens deterministisch het eerste zichtbare voorkomen kiest en die keuze lokaal als `rowKey` benoemt.
- [ ] Laat selectie over een bereik met twee voorkomens van dezelfde taak alle zichtbare cellen omvatten, maar `selectedTaskIds` slechts één keer die taak-id bevatten.
- [ ] Voeg cases toe voor filter/collapse waardoor het actieve voorkomen verdwijnt: kies de dichtstbijzijnde geldige cel in absolute rijvolgorde; bestaat geen taakcel meer, zet de gridcursor leeg.
- [ ] Draai `npm run typecheck`, `check-view-row-key`, `check-view-index`, `check-active-during-filter` en `check-focus-task`.
- [ ] Commit: `refactor: geef ieder zichtbaar taakvoorkomen een stabiele rowKey`.

## Task 2: Bouw stabiele kolom-id’s, volledige velddekking en de headless registry

**Files:**
- Create: `src/types/taskGrid.ts`
- Create: `src/engine/taskGrid/fieldIds.ts`
- Create: `src/engine/taskGrid/fieldCoverage.ts`
- Create: `src/engine/taskGrid/taskColumnRegistry.ts`
- Create: `src/engine/taskGrid/relationIndex.ts`
- Modify: `src/types/task.ts` — exporteer de drie bestaande inline itemtypes als aliases zonder de datavorm te wijzigen
- Create: `tests/planning/check-task-column-registry.ts`
- Create: `tests/planning/check-task-field-coverage.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode encodingtests voor vaste ids en deze projectgebonden ids: `activity-code:<projectId>:<typeId>`, `custom-field:<projectId>:<defId>`, `baseline:<projectId>:<baselineId>:start`, `baseline:<projectId>:<baselineId>:varianceFinish`.
- [ ] Gebruik percent-encoding per segment en een strikte decoder. Een project-id of veld-id met `:`, `%`, slash, quotes of Unicode moet exact roundtrippen en mag niet met een ander id botsen.
- [ ] Definieer de kerncontracten:

```ts
export type TaskGridSurfaceId = 'gantt-task-grid' | 'full-task-grid';
export type TaskColumnId = string & { readonly __taskColumnId: unique symbol };
export type GridResult<T, E> = { ok: true; value: T } | { ok: false; errors: E };
export interface TaskGridColumnPreference { id: TaskColumnId; width: number; pinned: boolean }
export interface TaskGridSurfacePreferences {
  columns: TaskGridColumnPreference[];
  scrollX: number;
}
export type TaskColumnCategory = 'task' | 'planning' | 'constraints' | 'relations' | 'resources' | 'progress' | 'computed' | 'baseline' | 'custom' | 'technical';
export interface TaskColumnContext {
  projectId: string;
  tasksById: ReadonlyMap<string, Task>;
  relationIndex: TaskRelationIndex;
  assignmentsByTaskId: ReadonlyMap<string, readonly ResourceAssignment[]>;
  resourcesById: ReadonlyMap<string, Resource>;
  baselinesById: ReadonlyMap<string, Baseline>;
  scheduleStale: boolean;
}
export interface TaskColumnDescriptor {
  id: TaskColumnId;
  labelKey: string;
  category: TaskColumnCategory;
  valueKind: 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'duration' | 'enum' | 'tokens' | 'technical';
  editorKind: 'text' | 'number' | 'percentage' | 'date' | 'datetime' | 'duration' | 'boolean' | 'enum' | 'color' | 'autocomplete' | 'relations' | 'custom' | 'none';
  defaultWidth: number;
  available(ctx: TaskColumnContext): boolean;
  readOnly: boolean | ((task: Task, ctx: TaskColumnContext) => boolean);
  read(task: Task, ctx: TaskColumnContext): unknown;
  format(value: unknown, task: Task, ctx: TaskColumnContext): string;
  copy(task: Task, ctx: TaskColumnContext): string;
  parse?: (text: string, task: Task, ctx: TaskColumnContext) => GridResult<unknown, readonly CellValidationError[]>;
  validate?: (value: unknown, task: Task, ctx: TaskColumnContext) => GridResult<unknown, readonly CellValidationError[]>;
  planWrite?: (value: unknown, task: Task, ctx: TaskColumnContext) => GridResult<readonly GridIntent[], readonly CellValidationError[]>;
  autoFitText(task: Task, ctx: TaskColumnContext): string;
}
```

- [ ] Exporteer `TaskNote`, `TimephasedDurationWalk` en `ExternalSourceRef` vanuit `src/types/task.ts`; verander de velden zelf niet.
- [ ] Schrijf de dertien `satisfies Record<keyof …, FieldCoverage>`-tabellen uit §5.2 volledig uit. Iedere sleutel verwijst naar een concrete directe, samengestelde, afgeleide of technische `TaskColumnId`.
- [ ] Voeg een mutatiebewijs toe: een fixturetype met een extra bronveld moet de compile-assert laten falen. Documenteer in de check hoe dit handmatig met één regel wordt geverifieerd; de gewone suite blijft compileerbaar.
- [ ] Bouw vaste descriptors voor alle tabellen uit §5.4–§5.7. Complexe arrays gebruiken een menselijke samenvatting én een canonieke JSON-kopieerwaarde met stabiele sleutelfolgorde; zij krijgen geen verliesgevende tekstschrijver.
- [ ] Bouw dynamische descriptorgeneratoren per activity-code, custom field en baseline. Baselines indexeren `Baseline.tasks` één keer per baseline op `taskId`, nooit per cel.
- [ ] Bouw relation- en assignmentdescriptors tegen aangeleverde indices; geen descriptor importeert de Zustand-store of filtert per cel de volledige bronarray.
- [ ] Bouw `relationIndex.ts` nu al als het enige readmodel voor interne/externe predecessor- en successorlijsten. Task 18 breidt dezelfde module uit met planneranalyse; er komt geen tijdelijke `sequencesByTaskId`-index of per-cel fallback.
- [ ] Geef iedere schrijfbare descriptor nu al `parse`, `validate` en `planWrite` naar één of meer `GridIntent`s; latere taken vullen de bijbehorende pure domeinplanners in zonder het descriptorcontract te veranderen. Read-only descriptors hebben `editorKind:'none'` en geen parse-/writerfuncties.
- [ ] Assert de vaste categorievolgorde en unieke ids. Een dubbele registry-id of ontbrekende coverage-id maakt de headless check rood.
- [ ] Draai `npm run typecheck`, beide nieuwe checks en `check-ifc-roundtrip`.
- [ ] Commit: `feat: voeg exhaustieve headless taakcolumnregistry toe`.

## Task 3: Verplaats kolomvoorkeuren en layouts veilig naar gebruikersniveau

**Files:**
- Create: `src/engine/taskGrid/preferences.ts`
- Modify: `src/utils/settingsStore.ts`
- Modify: `src/utils/settingsRegistry.ts`
- Modify: `src/hooks/useSettingsBootstrap.ts`
- Create: `src/state/slices/taskGridSlice.ts`
- Modify: `src/state/appStore.ts`
- Modify: `src/state/slices/types.ts`
- Modify: `src/state/documentContract.ts`
- Modify: `src/types/view.ts`
- Modify: `src/state/slices/viewSlice.ts`
- Modify: `src/components/viewControls/layoutSnapshot.ts`
- Modify: `src/components/dialogs/LayoutsDialog.tsx`
- Create: `tests/planning/check-task-grid-preferences.ts`
- Modify: `tests/planning/check-document-contract.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode tests voor afzonderlijke surfacevoorkeuren, één gedeelde MRU van maximaal tien ids, onbekende ids behouden, dubbele ids normaliseren, breedtes klemmen en projectwisseling met niet-beschikbare dynamische velden.
- [ ] Definieer versie 1 van de opgeslagen vorm:

```ts
export interface PersistedTaskGridPreferencesV1 {
  version: 1;
  surfaces: Record<TaskGridSurfaceId, TaskGridSurfacePreferences>;
  recent: TaskColumnId[];
}
```

- [ ] Sla dit onder één bestaande `ops-*`-stijl localStoragekey op; gebruik geen projectbestand, recoverypayload of documentveld.
- [ ] Houd de genormaliseerde live voorkeuren in de app-globale `TaskGridSlice`. `setTaskGridColumns`, `setTaskGridScrollX` en `recordRecentTaskColumn` schrijven eerst één statewijziging en persisteren daarna dezelfde gevalideerde payload; zij zetten nooit document-`isDirty`.
- [ ] Voeg iedere nieuwe TaskGridSlice-statekey aan de compile-afgedwongen `AppGlobalKey`-classificatie in `documentContract.ts` toe. Geen key komt in `DocumentPayload` of de derived-set; de compile-assert moet een opzettelijk ongeclassificeerde fixturekey weigeren.
- [ ] Verwijder `ViewState.columns` pas nadat de migratie klaarstaat. Als de nieuwe key nog niet bestaat, neemt de eenmalige migratie alleen de zichtbare oude `ColumnConfig`s van het actieve document over als start voor `full-task-grid`; `gantt-task-grid` krijgt altijd WBS, Naam en Duur. De migratie bewaart onbekende globale layoutrefs opaque en markeert het project niet dirty.
- [ ] Laat oude dynamische `FieldRef`s uit een globale Layout niet raden naar het actieve project. Zij blijven opaque totdat de gebruiker de layout expliciet opnieuw opslaat; dan encodeert het huidige project-id.
- [ ] Pas `Layout` aan zodat iedere layout per surface een `TaskGridColumnPreference[]` kan dragen naast filter/group/sort/timeScale. Layout toepassen maakt later één compound history-event; in deze taak is de pure before/afterconversie klaar.
- [ ] Zorg dat dezelfde beschikbare registrykolommen op beide surfaces verschijnen, maar wijzigingen in `gantt-task-grid` geen volgorde, breedte, pinning of scroll van `full-task-grid` wijzigen.
- [ ] Defaults zijn exact: Gantt begint met WBS, Naam en Duur; volledige Tabel met WBS, Naam, Duur, Start, Einde, Type, Kritiek, Totale speling, Gereed en de huidige dynamische activity-code-/customfielddefaults. Beide gebruiken dezelfde registry-ids.
- [ ] Voeg load/save/normalisatie aan settingsbootstrap toe. Een corrupte JSON, onbekende versie of ongeldige breedte valt terug zonder crash en zonder de ruwe waarde opnieuw als geldig weg te schrijven.
- [ ] Bewijs dat `DocumentPayload`, snapshots, IFC en recovery geen gridvoorkeur bevatten.
- [ ] Draai `npm run typecheck`, de nieuwe voorkeurcheck en `check-document-contract`.
- [ ] Commit: `feat: bewaar taakgridvoorkeuren per gebruiker en surface`.

## Task 4A: Leg het pure session-history-eventmodel en de scope-algoritmen vast

**Files:**
- Create: `src/state/sessionHistory.ts`
- Create: `tests/planning/check-session-history-model.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode pure tests voor A1, B1, globale G1, toepasbaarheid met A/B actief, werkelijke undo-/redovolgorde, scopegerichte redo-invalidatie en atomair compoundgedrag.
- [ ] Definieer events en deltas exact, nog zonder de bestaande storehistorie te vervangen:

```ts
export type HistoryScopeKey = `document:${string}` | `grid:${TaskGridSurfaceId}`;
export type SessionHistoryDelta =
  | { kind: 'document-data'; documentId: string; before: Snapshot; after: Snapshot }
  | { kind: 'document-view'; documentId: string; before: ViewLayoutHistoryState; after: ViewLayoutHistoryState }
  | { kind: 'grid-preference'; surface: TaskGridSurfaceId; before: TaskGridSurfacePreferences; after: TaskGridSurfacePreferences };
export type ViewLayoutHistoryState = Pick<ViewState, 'filter' | 'group' | 'sort' | 'zoom' | 'scrollX' | 'timeScale' | 'collapsedGroupKeys'>;
export interface SessionHistoryEvent {
  id: string;
  sequence: number;
  label: string;
  state: 'applied' | 'undone';
  deltas: readonly [SessionHistoryDelta, ...SessionHistoryDelta[]];
}
```
- [ ] Implementeer pure selectie: undo = hoogste sequence toegepast en toepasbaar; redo = laagste sequence undone en toepasbaar. Een event met documentdelta is alleen toepasbaar bij dat actieve document.
- [ ] Leid scopekeys met één pure `scopeKeysOf(event)` uit de deltas af; sla geen tweede, handmatig synchroon te houden `scopes`-array op.
- [ ] Implementeer scopegerichte invalidatie: een nieuwe event verwijdert undone events met overlappende scope; een compound event verdwijnt altijd geheel.
- [ ] Implementeer pruning: een event verdwijnt pas wanneer het buiten de nieuwste honderd events van al zijn scopes valt.
- [ ] Test een compound event met twee verschillende document-id’s als ongeldige input; maximaal één document-id per event.
- [ ] Draai `npm run typecheck` en `check-session-history-model`.
- [ ] Commit: `feat: leg sessiebreed history-eventmodel vast`.

## Task 4B: Corrigeer de afgeleide snapshotgrens en materialiseer history-targets puur

**Files:**
- Modify: `src/state/snapshot.ts`
- Modify: `src/state/documentContract.ts`
- Modify: `src/state/slices/historySlice.ts`
- Modify: `src/state/sessionHistory.ts`
- Create: `tests/planning/check-history-materialization.ts`
- Modify: `tests/planning/check-document-contract.ts`
- Modify: `tests/planning/check-undo-bound.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rood bewijs dat `cpmResult` en `scheduleStale` exact uit Snapshot herstellen, terwijl `resourceLoadResult` en `viewRows` uit het herstelde target opnieuw worden afgeleid.
- [ ] Verwijder `resourceLoadResult` uit `Snapshot`, geef het in `DOCUMENT_FIELDS` `snapshot:'none'` en pas de compile-assert tussen snapshotrollen en documentvelden aan.
- [ ] Implementeer pure `materializeHistoryTarget`: restore brondata op een geïsoleerde targetstaat, `syncProjectCalendar`, compute `viewRows`, compute `resourceLoadResult`, geen CPM en geen live storecall.
- [ ] Laat de nog bestaande per-document undo/redo tijdelijk deze materializer gebruiken, zodat deze commit zelfstandig groen is vóór de historyopslag wisselt.
- [ ] Bewijs dat data-undo dirty maakt en view/preference-targetmaterialisatie niet; deze laatste twee worden in Task 4C aan de store gekoppeld.
- [ ] Draai `npm run typecheck`, history-materialization, document-contract, undo-bound en resource-loadchecks.
- [ ] Commit: `refactor: leid history-afgeleiden buiten snapshots opnieuw af`.

## Task 4C: Schakel de store en compatibiliteitsgrens over op session history

**Files:**
- Modify: `src/state/slices/historySlice.ts`
- Modify: `src/state/transaction.ts`
- Modify: `src/state/appStore.ts`
- Modify: `src/state/slices/types.ts`
- Modify: `src/state/sessionHistory.ts`
- Modify: `src/state/documentContract.ts`
- Modify: `src/state/slices/documentSlice.ts`
- Modify: `src/state/commands.ts`
- Modify: `src/components/layout/TitleBar/TitleBar.tsx`
- Modify: `src/services/mcp/tools/taskTools.ts`
- Create: `tests/planning/check-session-history-store.ts`
- Modify: `tests/planning/check-undo-bound.ts`
- Modify: `tests/planning/check-mutation-cost.ts`
- Modify: alle echte property-/objectkeyconsumenten uit `rg -l "\\.undoStack|\\.redoStack|undoStack[[:space:]]*:|redoStack[[:space:]]*:" src tests/planning`; sluit `ResourcePanel.tsx` en `ResourcePanelCompact.tsx` expliciet uit omdat hun enige hit commentaar is en hun tabelgedrag buiten scope blijft
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode storecases voor A1/B1/G1, documentdata-, document-view- en grid-preferencedeltas, coalescing en één event per gewone mutatie.
- [ ] Maak `SessionHistoryEvent[]` en `nextHistorySequence` app-globaal en niet-gepersisteerd. `HistorySlice` leest/schrijft vanaf deze commit uitsluitend dit eventmodel; actieve documentpayloads dragen vanaf deze commit geen legacy stacks meer.
- [ ] Verwijder in dezelfde omschakelcommit `undoStack`/`redoStack` uit `DocumentPayload`, `DOCUMENT_FIELDS` en actieve fresh/clone/switchpaden. Anders zou `switchDocument` de nieuwe globale session history met een slapende documentstack overschrijven. Task 4E hardent daarna alleen legacy readers/recovery en bewijst de cleanup.
- [ ] Exporteer pure projecties `canUndo(state)`, `canRedo(state)` en `historyDepthsForActiveScope(state)`. Zij tellen alleen events die volgens Task 4A bij het actieve document toepasbaar zijn; globale preference-events tellen dus mee, events van een ander document niet.
- [ ] Migreer TitleBar en `state/commands.ts` in deze commit van stacklengte naar `canUndo`/`canRedo`. Migreer MCP undo/redo-resultaten naar de toepasbare active-scope-dieptes en documenteer die sessiebrede semantiek in hun responsevelden.
- [ ] Pas iedere planningcheck die stackarrays inspecteert in dezelfde commit aan naar eventstate, projecties of publieke undo/redo-uitkomst. Legacy serialized fixturekeys blijven alleen waar Task 4E hun eenmalige migratie test. Verander geen code of commentaar in `ResourcePanel`/`ResourcePanelCompact`.
- [ ] Maak `beginUndoable`/`finishMutation` de compatibiliteitsgrens: outermost begin bewaart before/document/label; finish vergelijkt en registreert één event; keyed coalescing vervangt alleen `after` van het compatibele laatste event.
- [ ] Publiceer undo/redo targets via Task 4B’s materializer in één producer. Preference-undo schrijft de normale setting opnieuw; view-undo publiceert exact `ViewLayoutHistoryState`.
- [ ] Bewijs dat grid-preference- en document-view-undo niet dirty maken; documentdata-undo wel en alle afgeleiden tegelijk kloppen.
- [ ] Eis vóór de poort met `rg -n "\.undoStack|\.redoStack|s => s\.undoStack|s => s\.redoStack" src tests/planning` nul hits. Draai daarna `npm run typecheck`, session-history-store, model, materialization, commands, MCP-relevante checks, undo-bound en mutation-costchecks.
- [ ] Commit: `refactor: schakel undo en redo over op session events`.

## Task 4D: Maak batch, MCP, libraryrefresh en documentsluiten scopebewust

**Files:**
- Modify: `src/state/batchTransaction.ts`
- Modify: `src/state/mcpTransaction.ts`
- Modify: `src/state/transaction.ts`
- Modify: `src/state/slices/librarySlice.ts`
- Modify: `src/state/slices/documentSlice.ts`
- Modify: `src/state/sessionHistory.ts`
- Create: `tests/planning/check-session-history-boundaries.ts`
- Modify: `tests/planning/check-mutation-cost.ts`
- Modify: `tests/planning/check-notifications.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode cases voor geneste `withTransaction`, throw zonder rollback maar één werkelijk event, MCP-rollback zonder event, libraryrefresh op A zonder redoverlies op B en sluiten van A met compoundevent.
- [ ] Behoud `withTransaction` als “geen rollback”, maar registreer één werkelijk before/after-event. Laat `runInMcpTransaction` bij een throw zowel data als pending historyregistratie herstellen.
- [ ] Vervang iedere rechtstreekse `redoStack=[]` in `librarySlice` door scoped invalidatie voor het werkelijk geraakte document. Raak nooit redo van een ander document of de andere grid-surface.
- [ ] Sluiten van een document verwijdert ieder event met dat document, inclusief een compound griddeel. Pas daarna prune volgens Task 4A.
- [ ] Draai `npm run typecheck`, session-history-boundaries, mutation-cost, notifications en MCP-/libraryrelevante planningchecks.
- [ ] Commit: `refactor: maak historygrenzen scopebewust`.

## Task 4E: Migreer legacy stacks in oude bestanden/recovery en bewijs volledige cleanup

**Files:**
- Modify: `src/state/documentContract.ts`
- Modify: `src/state/slices/documentSlice.ts`
- Modify: recovery-/loadreaders die legacy payloads accepteren
- Modify: uitsluitend legacy bestand-/recoveryreaders en de tests die oude serialized keys als inputfixture bewaren
- Create: `tests/planning/check-session-history-migration.ts`
- Modify: `tests/planning/check-document-contract.ts`
- Modify: `tests/planning/check-recovery-isolation.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode fixtures voor een oude payload met beide stacks, een nieuwe payload en crash-recovery; alle starten na load met lege sessiehistorie en identieke projectdata.
- [ ] Controleer dat Task 4C `undoStack`/`redoStack` al uit `DocumentPayload`, `DOCUMENT_FIELDS`, publieke selectors en alle actieve fresh/clone/switchpaden heeft verwijderd; productcode mag de oude keys alleen nog lexicaal in één legacy-readerguard noemen.
- [ ] Laat legacy payloadvelden bij alle bestand-/recoveryreaders negeren en nooit opnieuw wegschrijven. De migratie zet niet dirty en maakt zelf geen event.
- [ ] Eis met `rg` dat geen productieroute de oude velden meer leest of schrijft en dat er geen tweede historysysteem resteert.
- [ ] Draai `npm run typecheck`, migration, document-contract, recovery en de volledige planningssuite.
- [ ] Commit: `refactor: verwijder legacy historystacks uit documentpayloads`.

## Task 5: Materialiseer iedere documentactivatie vóór één publicatie

**Files:**
- Create: `src/state/documentActivation.ts`
- Modify: `src/state/documentContract.ts`
- Modify: `src/state/slices/documentSlice.ts`
- Modify: `src/state/slices/fileSlice.ts`
- Modify: `src/state/slices/librarySlice.ts`
- Modify: `src/state/sessionHistory.ts`
- Modify: `src/state/syncProjectCalendar.ts` indien een pure payloadvariant nodig is
- Modify: `src/hooks/useRecoveryRestore.ts`
- Modify: `src/components/dialogs/PoolImportDialog.tsx`
- Modify: `src/state/slices/projectSlice.ts`
- Modify: `src/components/panels/IFCPanel.tsx`
- Modify: `src/components/backstage/Backstage.tsx`
- Modify: `src/extensions/extensionApi.ts`
- Modify: iedere aanvullende hit uit `rg -n "runOpenBoundary|refreshBehindItems|switchDocument|restoreDocuments|applyLoadedProject|loadState|runCPM" src`
- Create: `tests/planning/check-document-activation.ts`
- Modify: `tests/planning/check-recovery-isolation.ts`
- Modify: `tests/planning/check-recovery-integrity.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode tests voor `switchDocument`, buuractivatie na `closeDocument`, nieuw document, dupliceren, open/import, `loadState` en recovery met bewust stale `viewRows`/`resourceLoadResult` in de slapende payload.
- [ ] Implementeer deze pure contracten uit de spec:

```ts
export interface DocumentActivationMaterialization {
  payload: DocumentPayload;
  viewRows: readonly ViewRow[];
  resourceLoadResult: ResourceLoadResult | null;
  signals: LibraryBoundarySignals;
  invalidateRedoScope: boolean;
}
export interface LibraryBoundarySignals {
  refreshed: number;
  deviated: number;
  removed: number;
  showLibraryLinkDialog: boolean;
  libraryRefreshNotice: number | null;
}
export function materializeBehindOnlyRefresh(input: {
  payload: Readonly<DocumentPayload>;
  companies: readonly Company[];
  pools: Readonly<Record<string, CompanyPool>>;
}): BehindRefreshMaterialization;
export function materializeLibraryBoundary(input: {
  payload: Readonly<DocumentPayload>;
  companies: readonly Company[];
  pools: Readonly<Record<string, CompanyPool>>;
  mode: 'silent-switch' | 'open-boundary';
}): DocumentActivationMaterialization;
```

- [ ] Laat helpers uitsluitend geïsoleerde payloaddata lezen/schrijven. Zij importeren geen appstore, roepen geen `set/get`, notificatie, UI-actie, `runCPM` of live recompute aan.
- [ ] Voeg vóór de activatiematerializer één `prepareLoadedPayload`-grens toe. Een open-/importpad met de bestaande optie `recompute:true` draait de bestaande solver op de geïsoleerde payload en plaatst `cpmResult` plus de bijbehorende `scheduleStale`-stand vóór activatie; recovery of een pad met al beschikbare `cpmResult` behoudt die waarde exact. `materializeLibraryBoundary` zelf start nooit een CPM en een gewone documentwissel rekent nooit stil opnieuw.
- [ ] Synchroniseer kalendercache na behind-refresh en leid `viewRows`/`resourceLoadResult` uit de gematerialiseerde payload af. `datesAsRecorded` bepaalt of `scheduleStale` mag worden gezet.
- [ ] `silent-switch` wist stale dialoogstate, toont alleen een positieve refreshnotice en retourneert `deviated:0`/`removed:0`. `open-boundary` telt deviated/removed vóór behind-refresh. Beide modi retourneren altijd alle vijf signalen, ook expliciete nul/false/null-waarden, en publiceren ze samen.
- [ ] Vervang in ieder activatiepad de reeks hydrate → recompute → libraryrefresh → UI-set door één producer die outgoing payload parkeert en target payload, afgeleiden, activeDocumentId en signalen samen publiceert.
- [ ] Verwijder de losse post-activatiecalls in `useRecoveryRestore.ts`, `PoolImportDialog.tsx` en beide open/loadroutes in `fileSlice.ts`. Recovery en poolimport leveren hun boundarymode/input aan dezelfde materializer vóór publicatie; zij roepen daarna nooit live `runOpenBoundary()` aan.
- [ ] Routeer `IFCPanel`, Backstage en `extensionApi` niet langer via `loadState()` gevolgd door live `runCPM()`. Geef hun bestaande recompute-intentie door aan `prepareLoadedPayload`/de gedeelde apply-loadgrens, zodat solverresultaat, payload, afgeleiden en boundarysignalen vóór de ene publicatie klaarstaan. `projectSlice.loadState` blijft alleen een compatibele ingang naar diezelfde grens en forceert niet langer stil een post-publicatiepatroon.
- [ ] Maak de publieke `runOpenBoundary` tijdens de migratie hoogstens een dunne compat-wrapper die voor het reeds actieve document de pure materializer plus één commit gebruikt. Verwijder hem zodra `rg -n "runOpenBoundary\(" src` alleen de definitie toont; geen activatiecaller mag op de wrapper blijven leunen.
- [ ] Als behind-refresh data wijzigt, invalideer undone history-events met `document:<targetId>` vóór publicatie; compound events verdwijnen volledig.
- [ ] Bewijs: de activatiematerializer en gewone switch/new/duplicate starten geen CPM; alleen een upstream open-/importpad dat nu al expliciet `recompute:true` draagt mag vóór de materializer rekenen. Activatie maakt geen undo-event, zet niet dirty, lekt geen notices en toont nooit tijdelijk afgeleiden van een ander document.
- [ ] Bewijs afzonderlijk dat open/import met `recompute:true` een reeds gevuld `cpmResult` publiceert, recovery zijn opgeslagen berekenstand exact behoudt, switch/new/duplicate geen solver aanroepen en iedere signalenteller de juiste nul of positieve waarde draagt.
- [ ] Laat de publieke `refreshBehindItems`-wrapper dezelfde pure helper gebruiken en brondata plus afgeleiden in één commit publiceren.
- [ ] Voeg recovery- en poolimportcases toe die falen wanneer na de ene activatiepublicatie nog een tweede boundaryproducer of recompute wordt aangeroepen.
- [ ] Draai `npm run typecheck`, de nieuwe activationcheck, beide recoverychecks, `check-document-contract`, `check-session-history` en de planningssuite.
- [ ] Commit: `refactor: publiceer documentactivatie met afgeleiden atomair`.

## Task 6: Voeg de synchrone prepare/commit-grens voor gridmutaties toe

**Files:**
- Create: `src/state/gridTransaction.ts`
- Modify: `src/state/sessionHistory.ts`
- Modify: `src/state/appStore.ts`
- Modify: `src/state/slices/types.ts`
- Create: `tests/planning/check-grid-transaction.ts`
- Modify: `tests/planning/check-notifications.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode tests waarin de tweede cel van een paste faalt en bewijs dat data, dirty, scheduleStale, `viewRows`, `resourceLoadResult`, notificaties en history byte-identiek blijven.
- [ ] Definieer de grens:

```ts
export type GridIntent = CellEditIntent | PasteIntent | RelationSetIntent | AssignmentSetIntent;
export interface PreparedGridMutation {
  documentId: string;
  before: Snapshot;
  after: Snapshot;
  derivedAfter: { viewRows: readonly ViewRow[]; resourceLoadResult: ResourceLoadResult | null };
  notifications: readonly DeferredNotification[];
  label: string;
}
export function prepareGridMutation(state: Readonly<AppState>, intents: readonly GridIntent[]): GridResult<PreparedGridMutation, readonly CellValidationError[]>;
export function commitPreparedGridMutation(prepared: PreparedGridMutation): GridResult<void, readonly GridMutationError[]>;
export function runGridMutation(intents: readonly GridIntent[]): GridResult<void, readonly CellValidationError[]>;
```

- [ ] Laat prepare op een geïsoleerde snapshot/projectdraft werken. Iedere celplanner schrijft alleen in dat concept en verzamelt notificaties zonder ze te tonen.
- [ ] Roep prepare en commit uitsluitend achter de synchrone, niet-herintreedbare `runGridMutation(intents)` aan. Een celcommit gebruikt een één-element-array; paste, relation- en assignmentacties leveren hun volledige intentlijst in één call.
- [ ] Valideer vóór commit defensief alleen dat `activeDocumentId === prepared.documentId`. Door de synchrone niet-herintreedbare wrapper kan de store niet tussentijds wijzigen; voeg geen diepe snapshotvergelijking of half ontworpen revisioncounter aan het hotpath toe.
- [ ] Publiceer `after`, `viewRows`, `resourceLoadResult`, dirty/stale en precies één history-event in één synchrone storeproducer. Flush notificaties pas na de producer.
- [ ] Sta tussen laatste live-statecheck en producer geen `await`, Promise, usercallback of extensiehook toe. Leg dit vast met een bronstructuurcheck die verboden tokens in die kritieke functie detecteert.
- [ ] Gebruik niet `withTransaction`; diens gedocumenteerde gedeeltelijke commit bij een throw voldoet niet aan gridatomiciteit.
- [ ] Voeg cases toe voor lege intentlijst, één-element-celcommit, multi-intent paste, read-only intent, defensieve document-id mismatch via een rechtstreekse testcall, dubbele mutatie op hetzelfde bronveld en een notificatie die pas na succesvolle commit verschijnt.
- [ ] Draai `npm run typecheck`, `check-grid-transaction`, `check-notifications`, `check-session-history` en `check-mutation-cost`.
- [ ] Commit: `feat: bereid gridwijzigingen volledig voor en commit ze atomair`.

---

## Task 7: Bouw selectie, P6-navigatie en virtualisatie als pure gridkern

**Files:**
- Create: `src/engine/taskGrid/selection.ts`
- Create: `src/engine/taskGrid/navigation.ts`
- Create: `src/engine/taskGrid/virtualization.ts`
- Modify: `src/utils/gridNavigation.ts` — behoud bestaande resourcetabel-API; deel alleen bewezen algemene primitieven
- Create: `tests/planning/check-task-grid-selection.ts`
- Create: `tests/planning/check-task-grid-virtualization.ts`
- Modify: `tests/planning/check-grid-nav.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode selectiecases voor één cel, Shift-rechthoek, Ctrl/Cmd-additieve taakselectie, bereik over een groepskop, duplicate row occurrences en alle cellen van twintig taken.
- [ ] Definieer een gridcursor met `rowKey` en `TaskColumnId`, niet met task-id of kolomindex:

```ts
export interface GridCellAddress { rowKey: string; columnId: TaskColumnId }
export interface GridSelectionState {
  active: GridCellAddress | null;
  anchor: GridCellAddress | null;
  range: { start: GridCellAddress; end: GridCellAddress } | null;
  selectedTaskIds: readonly string[];
  activeTaskId: string | null;
}
```

- [ ] Laat een celbereik alle unieke taak-id’s uit de betrokken taakrijen selecteren. Een bereik kan over groepskoppen heen lopen, maar groepskoppen zijn geen taakcellen, leveren geen taak-id en worden bij klembordcoördinaten overgeslagen.
- [ ] Gewone klik zet cel, activeTaskId en de geordende taakselectie op die ene taak. Shift-klik/-pijl breidt het rechthoekige bereik uit. Ctrl/Cmd-klik togglet alleen de taak in de geordende taakselectie, maakt de aangeklikte cel active en laat het kopieerbereik één aaneengesloten rechthoek.
- [ ] Implementeer reconciliatie na filter/collapse/delete/column remove: behoud active als hij bestaat; anders dichtstbijzijnde taakcel in absolute index; bij nul datakolommen of nul taakrijen `active:null`.
- [ ] Schrijf rode commandocases voor pijltoetsen, Home/End, Ctrl/Cmd+Home/End, PageUp/PageDown, Tab/Shift+Tab, Enter/Shift+Enter, F2, Escape, Delete/Backspace en typen-om-te-bewerken.
- [ ] Leg Enter vast zoals besloten: vanuit selectie start Enter bewerken; vanuit editor commit Enter en ga één rij omlaag in dezelfde kolom, Shift+Enter één rij omhoog. Op de laatste rij blijft de cel actief na commit.
- [ ] Laat Insert via de bestaande bewaakte invoegroute een taak in de actuele rowscope maken en daarna de nieuwe naamcel actief in editmodus zetten.
- [ ] Voeg geen Ctrl+pijl-links/-rechts inspringactie toe. De bestaande structuurshortcut blijft eigenaar; de gridcommandotabel retourneert daarvoor `unhandled`.
- [ ] Pijltoetsen passeren read-only kolommen normaal. Editstart op read-only retourneert een expliciete `readonly`-uitkomst zonder mutatie.
- [ ] Laat `computeVirtualWindow` absolute `aria-rowindex`, top spacer, mounted range en bottom spacer berekenen uit vaste `rowHeight`, viewport en overscan 8. Kolomvirtualisatie mag pinned kolommen nooit verwijderen.
- [ ] Bewijs bij 50.000 rijen en 900 px viewport dat hoogstens `ceil(900 / rowHeight) + 16` rijen worden gemount en dat navigatie naar rij 49.999 een minimale scrolloffset oplevert.
- [ ] Behoud de bestaande `gridNavigation`-tests voor de resourcetabel ongewijzigd; nieuwe taakgridlogica mag `select` en `input[type=number]` daar niet kapen.
- [ ] Draai `npm run typecheck`, de drie gridchecks en `check-active-during-filter`.
- [ ] Commit: `feat: voeg occurrence-veilige selectie navigatie en virtualisatie toe`.

## Task 8: Bouw verliesloze TSV-kopieer- en pasteplanning

**Files:**
- Create: `src/engine/taskGrid/clipboard.ts`
- Create: `src/engine/taskGrid/editors.ts`
- Modify: `src/state/gridTransaction.ts`
- Create: `tests/planning/check-task-grid-clipboard.ts`
- Modify: `tests/planning/check-date-format.ts`
- Modify: `tests/planning/check-datetime.ts`
- Modify: `tests/planning/check-lag-format.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode roundtripcases voor lege cellen, tabs, CRLF, LF, dubbele quotes, trailing lege rijen en een 2×3 rechthoek.
- [ ] Implementeer TSV quoting: quote een cel die tab, CR of LF bevat; verdubbel interne quotes; parser accepteert CRLF en LF als rijgrens buiten quotes en behoudt regeleinden binnen quotes.
- [ ] Kopieer exact de geselecteerde taakcelrechthoek in visuele rij- en kolomvolgorde. Groepskoppen die tussen begin- en eindtaak liggen worden volledig overgeslagen en leveren geen lege TSV-rij.
- [ ] Definieer mappingregels exact: alleen een bronmatrix van 1×1 mag een grotere geselecteerde rechthoek vullen. Iedere grotere bronmatrix moet bij een doelbereik groter dan één cel exact dezelfde afmetingen hebben; zonder zo’n bereik plakt hij eenmaal vanaf active en moet hij volledig binnen beschikbare taakcellen passen. Matrixherhaling/tiling is verboden.
- [ ] Parse en valideer iedere doelcel tegen zijn registrydescriptor vóór één `PasteIntent` ontstaat. Een read-only, onbeschikbaar of ongeldig doel weigert de volledige paste met eerste foutadres en bronwaarde.
- [ ] Zorg dat twee zichtbare voorkomens van dezelfde taak en hetzelfde bronveld niet twee tegenstrijdige writes maken. Gelijke writes dedupliceren; verschillende waarden voor hetzelfde veld maken de hele paste ongeldig.
- [ ] Schrijf concrete parsercases voor tekst, percentage, boolean, enum, persoonlijke datumweergave, datumtijd, dag-/uurduur en lege waarde. Interne opslag blijft ISO/minuten/0..1.
- [ ] Laat Delete/Backspace een `PasteIntent` met lege waarden maken voor schrijfbare cellen; als één geselecteerde cel niet leegbaar is, muteert niets.
- [ ] Bewijs dat calculated/stale cellen wel canoniek kopiëren maar paste weigeren.
- [ ] Draai `npm run typecheck`, clipboard/date/datetime/lagchecks en `check-grid-transaction`.
- [ ] Commit: `feat: voeg atomaire verliesloze TSV-bewerking toe`.

## Task 9: Bouw de toegankelijke virtuele `DataGridCore`

**Files:**
- Create: `src/components/task-grid/DataGridCore.tsx`
- Create: `src/components/task-grid/GridCell.tsx`
- Create: `src/components/task-grid/GridEditorHost.tsx`
- Create: `src/components/task-grid/DataGridHeader.tsx`
- Create: `src/components/task-grid/taskGridContext.ts`
- Modify: `src/styles/globals.css`
- Create: `tests/planning/check-task-grid-aria.ts`
- Create: `tests/planning/check-task-grid-dom-budget.ts`
- Modify: `tests/planning/run.sh`

- [ ] Gebruik geen impliciete jsdom/testing-library: die dependencies bestaan niet. Schrijf eerst een rode statische rendercheck met `react-dom/server` voor `role=grid`, headerrow, absolute `aria-rowcount`, `aria-colcount`, `aria-rowindex`, `aria-colindex`, `aria-selected`, `aria-readonly` en exact één `tabIndex=0`.
- [ ] Render één logische DOM-volgorde. Pinning gebruikt CSS `position: sticky` en berekende fysieke left-offsets; maak nooit een tweede pinned cell tree.
- [ ] Render alleen het virtualisatierange plus top-/bottomspacer. De outer grid rapporteert totaalrijen inclusief groepen; de plus is geen ARIA-kolom.
- [ ] Groepsrijen krijgen één `gridcell`, `aria-colspan` gelijk aan zichtbare datakolommen en een echte knop met `aria-expanded` voor collapse.
- [ ] Maak containerfocus de tijdelijke fallback als active virtueel niet gemount is: scroll, wacht één renderframe, focus daarna dezelfde gridcell. Er mag nooit een tweede roving tabstop bestaan.
- [ ] `GridEditorHost` bewaart de cursor terwijl input/popover focus heeft. Escape annuleert en keert naar dezelfde cel terug; geldige commit navigeert volgens Task 7; ongeldige invoer blijft open.
- [ ] Koppel fouttekst via `aria-invalid` en `aria-describedby` en kondig hem via één `aria-live=polite` regio aan.
- [ ] Voeg pointer- en keyboardresize toe. Pointerdown opent één pending preference-event, moves veranderen preview, pointerup commit één eindevent; Escape herstelt before. Keyboard gebruikt 8 px per stap en Shift 32 px.
- [ ] Bij pinned breedte groter dan viewport: schakel sticky voor het hele pinned blok uit en laat het in normale logische volgorde scrollen. Geen overlap of DOM-duplicatie.
- [ ] Laat de DOM-budgetcheck de pure virtualisatieresultaten en server-render van het gemounte venster voor 50.000×24 data gebruiken; hij bewijst dat maximaal het virtuele rijbudget maal 24 datacellen wordt gerenderd zonder een browser-DOM te veinzen.
- [ ] Beperk headless bewijs tot pure state/markup. Focusoverdracht, pointerresize, popoverfocus en echte roving-tabstopinteractie worden in Task 22C in de draaiende app uitgevoerd en vastgelegd.
- [ ] Draai `npm run typecheck`, beide nieuwe checks, lint en een handmatige toetsenbordronde op een tijdelijke headless fixturepagina.
- [ ] Commit: `feat: bouw toegankelijke virtuele DataGridCore`.

## Task 10: Bouw kolombeheer, pluskiezer en persoonlijke MRU

**Files:**
- Create: `src/components/task-grid/ColumnChooser.tsx`
- Modify: `src/components/task-grid/DataGridHeader.tsx`
- Modify: `src/components/task-grid/DataGridCore.tsx`
- Modify: `src/components/task-grid/TaskGrid.tsx`
- Modify: `src/engine/taskGrid/preferences.ts`
- Modify: `src/state/sessionHistory.ts`
- Modify: `src/styles/globals.css`
- Create: `tests/planning/check-task-grid-columns.ts`
- Modify: `tests/planning/check-task-grid-preferences.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode cases voor add/remove, dragorder, pin/unpin, resize, auto-fit, nul kolommen, onbekende dynamische kolom en MRU-volgorde.
- [ ] Plaats een sticky plus aan de rechterrand van het zichtbare grid. Klik opent een popover; plus is een focusbare knop met naam en Escape/focusreturn.
- [ ] Toon bovenaan maximaal tien recent gebruikte beschikbare kolommen uit de ene gedeelde MRU, daarna zoeken en de vaste tien categorieën als accordions. Meerdere categorieën mogen tegelijk openstaan. Een keuze voegt de kolom uiterst rechts in het vrije blok toe, werkt dezelfde MRU voor beide surfaces bij en sluit de popover.
- [ ] Toon een reeds zichtbare kolom aangevinkt en disabled in MRU/zoeken/categorieën; duplicaten zijn via de UI en preference-normalisatie onmogelijk.
- [ ] Gebruik exact dezelfde choosercomponent op beide surfaces. De aangeleverde `surfaceId` bepaalt uitsluitend welke preference wordt gelezen en geschreven.
- [ ] Iedere kolom toont bij hover of toetsenbordfocus een min en wordt daarmee direct zonder bevestiging verwijderd; hetzelfde kan via het kopcontextmenu. Geen kolom is “verplicht”; bij nul kolommen blijven plus, korte uitleg, lege gridstatus en taakrijhoogtes bruikbaar.
- [ ] Headerdrag verandert uitsluitend kolomvolgorde en start geen sortering. Een gewone klik op een kop selecteert of focust geen data en wijzigt nooit `view.sort`.
- [ ] Pin/unpin is fysiek links en gebeurt uitsluitend expliciet via het contextmenu. Headerdrag ordent alleen binnen het pinned of vrije blok en mag nooit impliciet pinning wijzigen.
- [ ] Het kopcontextmenu bevat uitsluitend **Links vastzetten/losmaken**, **Breedte automatisch** en **Kolom verwijderen**; geen sorteer-, filter- of andere acties.
- [ ] Auto-fit meet header en alle geformatteerde waarden, onafhankelijk van het virtuele venster, en klemt op 40..480 px. Gebruik de descriptor-`autoFitText`, een per-`rowKey`/kolom/valueversion meetcache en chunks via `requestIdleCallback` met `setTimeout`-fallback; publiceer pas na de volledige scan één eindbreedte-event.
- [ ] Start auto-fit zowel via dubbelklik op de kolomscheiding als via het ene contextmenu-item; beide gebruiken exact dezelfde volledige meetroute.
- [ ] Voeg een regressiecase toe waarin de breedste waarde op rij 20.000 staat en nooit in de eerste of zichtbare 200 rijen komt; auto-fit moet hem toch meten en op maximaal 480 px klemmen.
- [ ] Een geldige open edit commit vóór een door de gebruiker gestarte kolomactie; een ongeldige edit blokkeert chooser/remove/reorder met dezelfde zichtbare fout. Een externe taakverwijdering annuleert zonder write.
- [ ] Registreer iedere add/remove/pin/reorder/autofit als één `grid:<surface>` history-event; resize blijft één event per drag.
- [ ] Draai `npm run typecheck`, columns/preferences/history/ARIA-checks en lint.
- [ ] Commit: `feat: voeg volledig persoonlijk kolombeheer en MRU-kiezer toe`.

## Task 11: Verbind de registry via één storevrije `TaskGridAdapter`

**Files:**
- Create: `src/engine/taskGrid/taskGridAdapter.ts`
- Create: `src/components/task-grid/TaskGrid.tsx`
- Create: `src/components/task-grid/TaskCellEditor.tsx`
- Modify: `src/engine/taskGrid/taskColumnRegistry.ts`
- Modify: `src/state/gridTransaction.ts`
- Create: `tests/planning/check-task-grid-adapter.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode adaptertests met dezelfde `ViewRow[]` voor beide surface-id’s en bewijs identieke waarden, editability, taakselectie en intentoutput.
- [ ] Bouw indices één keer per adapterrefresh: `tasksById`, Task 2’s ene `relationIndex`, assignments per task, resources by id en baseline task maps.
- [ ] Laat de adapter uitsluitend callbacks ontvangen voor selection, collapse, editprepare/commit, contextmenu en hover. Importeer de appstore niet in `taskGridAdapter.ts` of `DataGridCore.tsx`.
- [ ] Koppel descriptor `read/copy/readOnly` naar cellen en descriptorparser/schrijver naar `GridIntent`. React-editors kennen geen Zustand-actienamen.
- [ ] Maak row-meta expliciet: `rowKey`, optionele `taskId`, row kind, depth, dimmed, selected, traceclass en tooltipdata.
- [ ] Zorg dat één taakedit alle occurrences direct dezelfde waarde laat lezen na de ene storecommit.
- [ ] Deel taaktooltipdata met `TaskTooltipContent`; kopieer de inhoud of formatter niet naar een tweede component.
- [ ] Voeg een bronstructuurcheck toe: geen import van `@/state/appStore` onder `src/engine/taskGrid/` en geen import van `ResourcePanel` of `ResourcePanelCompact` onder `src/components/task-grid/`.
- [ ] Draai `npm run typecheck`, adapter/registry/transactionchecks en lint.
- [ ] Commit: `feat: verbind taakdomein en grid via één headless adapter`.

## Task 12: Implementeer bewaakte taak-, planning-, constraint- en voortgangsedits

**Files:**
- Modify: `src/engine/taskGrid/taskColumnRegistry.ts`
- Modify: `src/components/task-grid/TaskCellEditor.tsx`
- Modify: `src/state/gridTransaction.ts`
- Modify: `src/state/slices/taskSlice.ts` alleen voor ontbrekende centrale guarded actions
- Modify: `src/state/slices/scheduleSlice.ts` alleen voor hergebruik van voortgangsregels
- Modify: `src/state/relationRules.ts` alleen voor bestaande constraintcombinaties indien die daar al leven
- Create: `src/engine/taskGrid/taskEditPlan.ts`
- Create: `tests/planning/check-task-grid-editors.ts`
- Modify: `tests/planning/check-task-slice.ts`
- Modify: `tests/planning/check-recorded-dates.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf per editortype eerst rode cases voor geldige waarde, lege waarde, grenswaarde en ongeldige invoer. Gebruik de veldtabel uit spec §5.4/§5.5 als expliciete checklist in de test.
- [ ] Tekst: naam, beschrijving, WBS indien autonummering uitstaat en notitiesamenvatting. WBS bij autonummering is read-only.
- [ ] Enum/boolean: taaktype, status, mijlpaal, mijlpaalsoort, mandatory, duurtype, calendar, hammock en kleur. Gebruik bestaande bewaakte acties of voeg één centrale action toe; schrijf geen solvergerelateerde velden kaal.
- [ ] Getal/duur: prioriteit 0..1000; scheduleDuration via bestaande dag-/uurparser; completion via `setTaskProgress`; remaining/actual duration via één voortgangsplanner die actual/statusdatum-invarianten bewaakt.
- [ ] Datum/tijd: scheduleStart/scheduleFinish schrijven invoervelden; early/late blijven read-only. Dagkalender gebruikt date-only, uurkalender datetime; gemengde kalenderweergave gebruikt het bestaande waarschuwingcontract.
- [ ] Constraintplanner valideert primair type/date/hard en secundair type/date samen. Secundair hard is onmogelijk; verboden start-on/finish-on-combinaties weigeren de hele cel-/pastehandeling.
- [ ] Activity code en custom fields gebruiken de bestaande `setTaskActivityCode`/`setTaskCustomField`-regels via de geïsoleerde gridplanner, inclusief typevalidatie en projectscoping.
- [ ] Laat technische importvelden, arrays, ids, computed en ontbrekende bewaakte resume/stop-schrijvers expliciet read-only. Toon geen editor die een effect suggereert dat de engine niet ondersteunt.
- [ ] Stale calculated cellen houden hun waarde; kopie geeft de canonieke waarde. De visuele status bevat icoon/patroon en toegankelijke tekst, niet alleen kleur.
- [ ] Bewijs dat elke succesvolle celcommit één event maakt, no-op nul events en een invalid edit geen enkel stateveld wijzigt.
- [ ] Draai `npm run typecheck`, editor/task/recorded-date/constraint/progresscases en de planningssuite.
- [ ] Commit: `feat: voeg bewaakte taakplanning en voortgangsedits toe`.

## Task 13: Implementeer assignmentkolommen zonder de resourcetabel te wijzigen

**Files:**
- Create: `src/engine/taskGrid/assignmentPlan.ts`
- Modify: `src/engine/taskGrid/taskColumnRegistry.ts`
- Modify: `src/components/task-grid/TaskCellEditor.tsx`
- Modify: `src/state/gridTransaction.ts`
- Reuse without structural modification: `src/state/slices/resourceSlice.ts`
- Create: `tests/planning/check-task-grid-assignments.ts`
- Modify: `tests/planning/check-assign-resource-guard.ts`
- Modify: `tests/planning/check-move-assignment.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode plannercases voor onbekende taak/resource, summary, mijlpaal, duplicate resource, units nul/NaN/Infinity, multi-token rollback en behoud van assignment-id bij dezelfde resource.
- [ ] `planTaskAssignmentSet` ontvangt volledige gewenste tokens en retourneert add/update/remove-operaties plus geraakte taak-id’s; het muteert niets.
- [ ] Een token bevat `resourceId`, bestaande optionele `assignmentId`, `unitsPerDay` en `curve`. Labels zijn presentatie; identiteit komt nooit uit de resource-naam.
- [ ] Pas de invalidatiematrix exact toe: membership add/remove/move wist `clearTimephasedWindow` én frozen `timephasedDurationWalks` op oude en nieuwe taak; units/curve behouden beide; resource load herberekent exact één keer na succesvolle commit.
- [ ] `workWindowStart` en `workWindowFinish` blijven volledig zichtbaar en kopieerbaar maar read-only. Assignment-id, task-id en resource-id zijn technische read-only kolommen.
- [ ] Inline autocomplete laat meerdere resources toevoegen/verwijderen en units/curve per token bewerken; geen celknop en geen permanent paneel.
- [ ] Gebruik de planner alleen vanuit de taakgrid. Verander `ResourcePanel`/`ResourcePanelCompact` niet en migreer de resourcetabel niet naar deze planner.
- [ ] Bewijs dat een fout in de laatste van vijf tokens niets toevoegt, verwijdert, invalideert, herberekent, notifiet of registreert.
- [ ] Draai `npm run typecheck`, de drie assignmentchecks, `check-grid-transaction` en resource-loadcases.
- [ ] Commit: `feat: ontsluit taakassignments atomair in de taakgrid`.

## Task 14: Vervang de volledige Tabel-weergave door `FullTaskGrid`

**Files:**
- Create: `src/components/task-grid/FullTaskGrid.tsx`
- Modify: `src/components/panels/TableEditor.tsx` — tijdelijk re-exporteren of na pariteitsbewijs verwijderen
- Modify: `src/App.tsx`
- Modify: `src/components/dialogs/ColumnsDialog.tsx`
- Modify: `src/components/dialogs/LayoutsDialog.tsx`
- Modify: `src/components/layout/Ribbon/ribbonConfig.tsx`
- Modify: `src/components/layout/Ribbon/ribbonWidgets.tsx`
- Create: `tests/planning/check-full-task-grid-surface.ts`
- Modify: `tests/planning/check-context-menu-scope.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf een rode surfacecheck die eist dat `activeTab === 'table'` `FullTaskGrid` met surface-id `full-task-grid` rendert en niet de oude interne celrenderer.
- [ ] Verbind viewRows, taakselectie, collapse, groep, filter, bestaande expliciete sortering, row drag en eigenschappenpaneelselectie via `TaskGrid`.
- [ ] Klik op een cel selecteert de cel én de taak. Een rechthoek selecteert alle unieke betrokken taken; bulk indent/outdent/delete gebruikt de bestaande geselecteerde ids en vereist geen extra bevestiging.
- [ ] Dubbelklik opent het bestaande eigenschappenpaneel voor alleen de actieve taak; het start geen celedit. Enter, F2 of direct typen blijven de enige editstarters.
- [ ] Rijdrag blijft alleen beschikbaar in zuivere boommodus. Buiten boommodus gebruikt de bestaande structure-locked melding; sorteren via Weergave blijft onaangetast.
- [ ] Gebruik `full-task-grid` preferences en eigen horizontal scroll. Een layoutapply maakt één compound event voor document-view plus deze surfacevoorkeur.
- [ ] Laat ribbon **Kolommen…** dezelfde `ColumnChooser` openen; houd de plus als primaire snelle route. Verwijder de oude parallelle kolomdefinitielogica uit `ColumnsDialog`.
- [ ] Reproduceer contextmenuacties en rij-invoegscope. Geen enkele handeling mag per ongeluk een groepsoccurrence als afzonderlijke taak behandelen.
- [ ] Verifieer handmatig nul taken, nul kolommen, lange tekst, 200% zoom, keyboard-only en 20-taakselectie.
- [ ] Draai `npm run typecheck`, surface/contextmenu/adapter/historychecks en lint.
- [ ] Commit: `feat: gebruik de gedeelde taakgrid in de volledige Tabel-weergave`.

## Task 15: Maak `GanttWorkspace` eigenaar van DOM-grid, splitter en verticale scroll

**Files:**
- Create: `src/components/canvas/GanttWorkspace.tsx`
- Create: `src/components/task-grid/GanttTaskGrid.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/components/canvas/ganttEventOwnership.ts`
- Modify: `src/hooks/useSplitter.ts`
- Modify: `src/utils/settingsStore.ts` — behoud `leftPanelWidth`
- Create: `tests/planning/check-gantt-workspace.ts`
- Modify: `tests/planning/check-gantt-event-ownership.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf de ownershipcheck rood door de beoogde manifestwaarden te eisen: disclosure, add, rowselect, row-dubbelklik, rowcontextmenu, rowdrag, tooltip en splitter horen bij DOM-grid/workspace; bars, dependencies, pan en boxselect bij timelinecanvas.
- [ ] Bouw `GanttWorkspace` als `display:grid` met links `GanttTaskGrid`, één DOM-splitter en rechts de timeline-regio. `ui.leftPanelWidth` blijft de buitenbreedte en wordt op pointerup via de bestaande setting opgeslagen.
- [ ] Zet de bestaande primaire `GanttCanvas` in dezezelfde commit in zijn al bestaande timeline-only compatibiliteit met effectieve tabelbreedte 0. Daardoor tekent de oude `drawTaskTable`-guard niets en zijn oude linker hit-tests onbereikbaar; er verschijnt nooit één tussencommit met twee taaktabellen. Task 16B verwijdert die dode renderer-/handlercode definitief.
- [ ] Maak één verticale DOM-scrollcontainer eigenaar van `view.scrollY`. Grid gebruikt de scrollpositie rechtstreeks; canvas tekent dezelfde absolute rijindices en schrijft niet via een gekoppelde tweede scroller terug.
- [ ] Verplaats linkerpaneelclicks, disclosure, add, dubbelclick, contextmenu, hovertooltip en rowdrag uit canvas handlers naar `GanttTaskGrid`.
- [ ] Gebruik exact dezelfde rowHeight/headerHeight op grid en canvas, inclusief `uiFontScale`. Groepsrijen nemen één rijhoogte en hebben geen taakbalk.
- [ ] `TaskTooltipContent` voedt zowel taskbarhover als ellipsiscellhover. De celtooltip verschijnt bij dezelfde vertraging en bevat hetzelfde taakpaneeltje; geen aparte vereenvoudigde teksttooltip.
- [ ] Gebruik `gantt-task-grid` preferences en onafhankelijk grid-scrollX. Timeline-scrollX verandert niet bij horizontaal kolomscrollen.
- [ ] Update het ownershipmanifest en laat iedere actie exact één eigenaar houden. Verwijder de oude canvaslistener pas nadat de nieuwe DOM-handler getest is.
- [ ] Verifieer met pointer, touchpad, keyboardscroll en programmatic focus dat geen feedbackloop of één-frame verticale mismatch optreedt.
- [ ] Draai `npm run typecheck`, workspace/ownership/view-row/gridchecks en lint.
- [ ] Commit: `refactor: geef Gantt grid en scroll aan een DOM-workspace`.

## Task 16A: Hernoem de gedeelde tijdasoorsprong zonder gedrag te wijzigen

**Files:**
- Modify: `src/components/canvas/ganttRenderOptions.ts`
- Modify: `src/engine/renderer/timeAxis.ts`
- Modify: `src/engine/renderer/workdayAxis.ts`
- Modify: alle huidige axis-aanroepers
- Create: `tests/planning/check-gantt-coordinate-contracts.ts`
- Modify: `tests/planning/check-axis-consolidation.ts`
- Modify: `tests/planning/check-workday-axis.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode type-/roundtripcases die de naam `chartOriginX` eisen en huidige datum↔x-uitkomsten byte-identiek pinnen.
- [ ] Hernoem `SharedAxisInput.taskTableWidth` naar `chartOriginX` en dezelfde semantiek in `dateToX`, `xToDate`, `CalendarAxisOptions` en `WorkdayAxisOptions`.
- [ ] Houd de wiskunde in deze commit exact `chartOriginX + axisDistance - scrollX`; primaire huidige callers geven voorlopig hun bestaande oorsprong door.
- [ ] Voeg cases toe voor calendar- en workday-axis bij oorsprong 0 en 317, negatieve/hoge scrollX en inverse roundtrip.
- [ ] Draai `npm run typecheck`, coordinate-contracts, axis-consolidation en workday-axischecks.
- [ ] Commit: `refactor: benoem chartOriginX in de gedeelde tijdas`.

## Task 16B: Verwijder de canvas-taaktabel en maak timeline-hit-tests origin-zero

**Files:**
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/engine/renderer/GanttRenderer.ts`
- Modify: `src/components/canvas/hooks/useCanvasLayer.ts`
- Modify: `src/components/canvas/hooks/useBarDrag.ts`
- Modify: `src/components/canvas/hooks/usePan.ts`
- Modify: `src/components/canvas/hooks/useBoxSelect.ts`
- Modify: `src/components/canvas/hooks/useRowDrag.ts`
- Modify: `src/components/canvas/hooks/useDependencyDraw.ts`
- Modify: `src/components/canvas/ganttEventOwnership.ts`
- Modify: `tests/planning/check-gantt-coordinate-contracts.ts`
- Modify: `tests/planning/check-gantt-event-ownership.ts`

- [ ] Schrijf de renderer-/ownershipchecks rood: timeline `chartOriginX=0`, geen table draw/hit-methodes en geen linkerpaneel-events meer in de canvas.
- [ ] Verwijder `drawTaskTable`, `isInTaskTable`, `isCollapseToggle`, `isAddButton`, tabelheaderlabels en tabelclipgebieden volledig.
- [ ] Verwijder tabeloffsets uit bar-/relationhit-tests, float-culling en gesturehooks. Alle timeline input-x is lokaal vanaf 0.
- [ ] Bewijs met randpunten x=0 en x=width-1 dat bar, resize, dependency, pan en boxselect hun oude chartgedrag behouden.
- [ ] Draai typecheck, coordinate/ownership, gantt-float-cull, arrow-routing en split-bar-renderchecks.
- [ ] Commit: `refactor: verwijder canvas-taaktabel en lokale tabelhit-tests`.

## Task 16C: Migreer timelinebreedte, scroll, zoom, fit, focus en split view

**Files:**
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/utils/ganttViewport.ts`
- Modify: `src/hooks/useGanttZoom.ts`
- Modify: `src/hooks/useZoomShortcuts.ts`
- Modify: `src/components/canvas/MiniMap.tsx`
- Modify: `tests/planning/check-gantt-coordinate-contracts.ts`
- Modify: `tests/planning/check-gantt-render-options.ts`
- Modify: `tests/planning/check-focus-task.ts`
- Modify: `tests/planning/check-zoom-steps.ts`

- [ ] Schrijf rode cases waarin primaire/secundaire canvas hun werkelijke DOM-breedte gebruiken en `leftPanelWidth` nergens nog een tweede keer aftrekken.
- [ ] Laat splitratio alleen de timeline-regio verdelen. Primaire en secundaire canvas houden oorsprong 0 en secundaire behoudt eigen zoom/scroll.
- [ ] Pas fit-to-project, Ctrl+0, focus-on-task, minimap en scrollrange aan op de werkelijke timelinebreedte.
- [ ] Laat de primaire horizontale scrollbar op x=0 binnen de timeline-regio beginnen; spacerbreedte en `setScroll`-clamp gebruiken exact dezelfde helper. Secundaire scrollbar blijft onafhankelijk.
- [ ] Voeg cases toe voor width-1, smalle timeline, split 20/80 en 80/20, hoge scrollX en focus op eerste/laatste taakoccurrence.
- [ ] Draai typecheck, coordinate/render-options/focus/zoom/view-indexchecks.
- [ ] Commit: `refactor: baseer Gantt-navigatie op werkelijke timelinebreedte`.

## Task 16D: Behoud de full-width histogrampicker op de primaire as

**Files:**
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/engine/renderer/HistogramRenderer.ts`
- Modify: `src/components/canvas/ganttRenderOptions.ts`
- Modify: `tests/planning/check-gantt-coordinate-contracts.ts`
- Modify: `tests/planning/check-axis-consolidation.ts`
- Modify: `tests/planning/check-gantt-render-options.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode cases: histogram is full-width, `pickerWidth=leftPanelWidth`, `chartOriginX=pickerWidth`, pickerhit links en datumhit rechts.
- [ ] Hernoem histogramoptie naar `pickerWidth` en leid `chartOriginX` daar exact één keer van af. De resourcepickerlogica en -data blijven inhoudelijk ongewijzigd.
- [ ] Laat histogram primaire zoom/scroll/viewStart delen en expliciet niet met de secundaire split-as uitlijnen.
- [ ] Voeg de structuurpoort toe die `taskTableWidth` verbiedt in timeline-, axis-, zoom-, minimap-, gesture- en histogramcode; alleen `pickerWidth` blijft als semantische linkerkolombreedte.
- [ ] Draai alle coordinate/axis/renderchecks en de volledige planningssuite.
- [ ] Start de app en vergelijk Task 0: rijlijnen/balkmiddens, histogramdatum, pickerhit, minimap, split view, fit en focus.
- [ ] Commit: `refactor: lijn full-width histogram uit met origin-zero Gantt`.

---

## Task 17: Bouw canonieke externe relatietokens en één padidentiteit

**Files:**
- Create: `src/engine/taskGrid/relationFormat.ts`
- Modify: `src/engine/externalLinks.ts`
- Modify: `src/state/slices/fileSlice.ts` waar external anchors worden vernieuwd
- Modify: `src/types/task.ts` alleen voor de geëxporteerde `ExternalSourceRef`-alias uit Task 2
- Create: `tests/planning/check-external-relation-format.ts`
- Modify: `tests/planning/check-advanced-cpm.ts`
- Modify: `tests/planning/check-lag-format.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf de acht verplichte rode padvectoren letterlijk: Windows drivepair, UNC-pair, twee case-gevoelige POSIX-paden, root escape en relatief pad.
- [ ] Implementeer `normalizeExternalSourcePath` lexicaal en zonder filesystem-I/O. Windows/UNC lowercaset alle ASCII-letters en normaliseert backslashes; POSIX behoudt case en behandelt backslash als naamteken; `..` boven root, NUL, leeg en relatief zijn ongeldig.
- [ ] Hash exact de UTF-8 bytes van het genormaliseerde pad met SHA-256. De Windows- en UNC-paren moeten byte-identieke `path-sha256:`-keys geven.
- [ ] Laat `refreshExternalAnchors` en `linkMatchesSource` dezelfde helper gebruiken. Behoud de legacy filePath-fallback óók wanneer een oud record een verkeerd projectId draagt; normaliseer de paden voor de vergelijking.
- [ ] Definieer en strikt valideer `ExternalRelationClipboardV1` met vaste JSON-sleutelvolgorde en base64url zonder padding. Weiger onbekende versie, extra keys, te lange strings, ongeldige ISO-datum, ongeldige lag en onjuiste `sourceProjectKey`.
- [ ] Formatteer als `<zichtbaar label> ⟦OPS-EXT/1:<payload>⟧`. De payload draagt origin owner/direction/linkId, volledige sourceRef, bronkey, type, lag, anchor en sourceMissing; nooit credentials of bestandsinhoud.
- [ ] Bouw zichtbaar extern label canoniek uit `projectName || projectId` en `taskName || taskId`, met de relation tokenizer-quoting voor komma, slash, quotes en escapes.
- [ ] Bouw `sourceProjectKey` met strikte prioriteit: een niet-lege `projectId` geeft altijd `project:<projectId>`, ook als daarnaast een filePath bestaat; alleen zonder project-id geeft een geldig normaliseerbaar absoluut `filePath` `path-sha256:<sha256>`. Pas wanneer beide identiteiten ontbreken/ongeldig zijn is `id-only:<ownerTaskId>:<linkId>` toegestaan, uitsluitend same-cell. De genormaliseerde filePath-fallback voor legacy refresh blijft daarnaast bestaan en mag bij een verkeerde project-id nog matchen; hij verandert de clipboardkeyprioriteit niet.
- [ ] Implementeer `parseExternalLagInput`/`formatExternalLagShort`: toegestaan kaal getal/`d` en `u`/`h`; geweigerd `%`, `e%`, `ed`, `eu`, `eh`; exact één van `lagDays`/`lagMinutes` blijft aanwezig.
- [ ] Implementeer `externalSourceSide(direction, relType)` en cases waarin direction/type wel of niet dezelfde bronzijde houden.
- [ ] Bewijs Excel-roundtrip, zichtbaar gewijzigde lag/type, veranderd bronlabel, verwijderde suffix en onbekende versie. Een fout muteert niets via `check-grid-transaction`.
- [ ] Draai `npm run typecheck`, external-format/advanced-CPM/lag/grid-transactionchecks en de planningssuite.
- [ ] Commit: `feat: maak externe relatietokens verliesloos en padstabiel`.

## Task 18: Bouw één pure planner voor de volledige gewenste relatieset

**Files:**
- Create: `src/engine/taskGrid/relationPlan.ts`
- Modify: `src/engine/taskGrid/relationIndex.ts`
- Modify: `src/state/relationRules.ts`
- Modify: `src/state/relationActions.ts`
- Modify: `src/state/mcpValidation.ts`
- Modify: `src/engine/scheduler/expandSummaryRelations.ts`
- Modify: `src/engine/scheduler/graphWalk.ts`
- Modify: `src/state/gridTransaction.ts`
- Create: `tests/planning/check-relation-set-plan.ts`
- Modify: `tests/planning/check-relation-rules.ts`
- Modify: `tests/planning/check-summary-relation-expansion.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode cases voor add/update/remove in één cel, id-behoud, eenduidige typewijziging, meerdere types op hetzelfde paar, ambiguous fallback, duplicate, self, onbekende WBS, gelijke WBS, ancestorregel en cyclus die alleen in de finale set zichtbaar wordt.
- [ ] Verplaats de pure cyclusdetectie uit MCP naar een neutrale enginehelper en laat MCP en gridplanner die importeren. Solverdetectie blijft vangnet.
- [ ] Implementeer het publieke contract:

```ts
export function planRelationSet(input: {
  tasks: readonly Task[];
  sequences: readonly Sequence[];
  ownerTaskId: string;
  direction: 'predecessor' | 'successor';
  tokens: readonly ParsedRelationToken[];
}): GridResult<RelationMutationPlan, readonly RelationTokenError[]>;
```

- [ ] Parse alle tokens met bronposities voordat diffing begint. Los interne WBS exact op; onbekend of meer dan één match geeft een fout op het token.
- [ ] Interne exacte key is `(predecessorId, successorId, type)`; externe exacte key is `(ownerTaskId,direction,sourceProjectKey,sourceRef.taskId,relType)`. Lag, labels en `sourceMissing` zijn geen identiteit.
- [ ] Metadata-id wint. Daarna behoudt exacte key het id. Typewijziging behoudt id alleen bij exact één unmatched oud en nieuw record voor hetzelfde endpoint; veel-op-veel wordt remove+add zonder willekeurige eerste match.
- [ ] Normaliseer de vier interne lagvelden samen via de bestaande `parseLagInput`; laat nooit stale `lagMinutes`, `lagPercent` of `lagUnit` naast een nieuwe vorm staan.
- [ ] Combineer desired set met onaangeraakte relaties, expand summaryrelaties met de bestaande solversemantiek en valideer de uiteindelijke leaf-graaf één keer. Toevoeg-/verwijdervolgorde mag geen tijdelijke cyclusfout veroorzaken.
- [ ] Voeg externe clipboardregels toe: same-owner exact id behouden; cross-task nieuw id en targetkolom bepaalt direction; source/anchor/sourceMissing behouden; bronzijdewisseling zonder nieuw anker weigeren.
- [ ] Breid Task 2’s ene `relationIndex` in één pass uit met driving, vrije speling, waarschuwingen en trace-input. Cellreaders mogen geen volledige sequence/externalLinks arrays filteren en er ontstaat geen tweede indexmodule.
- [ ] Laat `gridTransaction` het mutationplan op de geïsoleerde snapshot toepassen en één event committen. Bestaande losse relation actions mogen de pure planner hergebruiken, maar krijgen geen tussentoestanden.
- [ ] Draai `npm run typecheck`, relation-set/rules/summary/graphchecks en relationcasebatterijen.
- [ ] Commit: `feat: plan relationele celsets tegen de volledige eindgraaf`.

## Task 19: Maak relatiecellen, hover, springen en externe edit compleet

**Files:**
- Create: `src/components/task-grid/RelationCellEditor.tsx`
- Modify: `src/engine/taskGrid/taskColumnRegistry.ts`
- Modify: `src/engine/taskGrid/taskGridAdapter.ts`
- Modify: `src/components/task-grid/TaskGrid.tsx`
- Modify: `src/components/dialogs/ExternalLinkDialog.tsx`
- Modify: `src/state/slices/taskSlice.ts`
- Modify: `src/components/canvas/HoverTooltip.tsx`
- Modify: `src/components/canvas/TaskTooltipContent.tsx`
- Create: `tests/planning/check-relation-cell-editor.ts`
- Modify: `tests/planning/check-focus-task.ts`
- Modify: `tests/planning/check-context-menu-scope.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode render-/plannerfixtures voor predecessor- en successorcel, interne en externe tokens samen, drivingaccent, stale vrije speling, waarschuwing en sourceMissing.
- [ ] Toon relatievoorbeelden in de bestaande lagvormen: intern `1.2 FS+2d`, `1.4 SS+50%`, `1.5 FF+3ed`; extern `Project West / Fundering FS+2d`.
- [ ] Maak de hele cel de gewenste eindtoestand. Interactieve tokenedit bewaart relation-idmetadata buiten de tekst; volledige tekstvervanging verliest metadata en volgt de strikte fallbackregels.
- [ ] Autocomplete kiest interne taken op WBS plus naam; exact getypte dubbele WBS weigert. Een onbekend extern vrijeteksttoken toont de route **Relatie → Externe relatie toevoegen…**.
- [ ] Alleen WBS-/externe taakreferentie is interactief. Hover op lokale taak gebruikt exact `HoverTooltip` + `TaskTooltipContent`; klik gebruikt bestaande `focusOnTask`. Relatietype/lag is gewone tekst.
- [ ] Externe hover zonder lokaal taakobject toont bevroren broninformatie en heeft geen lokale springactie. Rechtsklik op die token biedt **Bron vernieuwen** en **Relatie verwijderen**, niet als knop in de cel.
- [ ] Breid `ExternalLinkDialog` uit met add- en editmodus. Edit ontvangt `taskId` + `linkId`, vult richting/type/lag/bron/anker en behoudt id.
- [ ] Gebruik datuminput in dagmodus en datetimeinput in uurmodus. Gelezen bron kiest start- of finishanker via `externalSourceSide`; handmatige bronzijdewisseling vereist expliciet nieuw anker.
- [ ] Voeg `updateExternalLink` als bewaakte route toe. Alleen een typewijziging met dezelfde bronzijde mag het bestaande anker behouden; iedere zijdewisseling loopt via de dialoog en commit id/richting/type/lag/anker samen.
- [ ] Annuleren, bronleesfout en invalid lag laten taak, externalLinks, dirty, afgeleiden en history byte-identiek.
- [ ] Laat predecessor/successor, relationele vrije speling, waarschuwingen en technische externe gegevens uit dezelfde relationIndex komen.
- [ ] Draai `npm run typecheck`, editor/focus/contextmenu/external-format/relation-planchecks en de planningssuite.
- [ ] Reproduceer issue #65 in Gantt én full Table: hoverpaneeltje en sprong moeten gelijk zijn.
- [ ] Commit: `feat: maak relaties volledig bewerkbaar en navigeerbaar in de taakgrid`.

## Task 20: Voeg relatiedropdown en traceknoppen aan Tabel toe

**Files:**
- Modify: `src/components/layout/Ribbon/ribbonWidgets.tsx`
- Modify: `src/components/layout/Ribbon/ribbonConfig.tsx`
- Create: `src/engine/taskGrid/trace.ts`
- Modify: `src/engine/taskGrid/taskGridAdapter.ts`
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/components/canvas/ganttRenderOptions.ts`
- Modify: `src/state/slices/uiSlice.ts`
- Create: `tests/planning/check-relation-ribbon-trace.ts`
- Modify: `tests/planning/check-dependency-style.ts`
- Modify: `tests/planning/check-gantt-render-options.ts`
- Modify: `tests/planning/run.sh`

- [ ] Schrijf rode tests voor de vier relatiedropdownacties en voor dezelfde traceclassificatie in grid en canvas.
- [ ] Bouw `RelationDropdown` volgens de bestaande `MilestoneDropdown`-popover, niet als selectieafhankelijke knop met wisselende betekenis.
- [ ] Voeg zichtbaar toe: **Relatie tekenen**, **Geselecteerde taken koppelen**, **Externe relatie toevoegen…**, **Alle externe relaties vernieuwen**.
- [ ] Laat onbeschikbare acties zichtbaar disabled met concrete reden. Twee taken koppelen vereist exact twee geselecteerde ids; eerste selectie is predecessor, standaard FS, lag 0, via `createRelationWithFeedback`/planner.
- [ ] Voeg de bestaande voorganger- en opvolgertraceknoppen aan het linttabblad Tabel toe. Zij mogen afzonderlijk of samen actief zijn en doen iets anders dan de relatiedropdown.
- [ ] Verplaats `buildTrace` naar de pure gedeelde selector. Focus, predecessors en successors blijven normaal; overige taakrijen vervagen; groepskoppen blijven leesbaar en geen rij verdwijnt.
- [ ] Verwijder de huidige `buildTrace`-implementatie en export uit `ganttRenderOptions.ts`; pas `check-gantt-render-options.ts` aan om de nieuwe selector te importeren. Een structuurtest eist exact één `buildTrace`-definitie onder `src/`.
- [ ] Laat Gantt-bars/relations en beide grids dezelfde trace-output consumeren. Voeg geen tweede BFS/graphwalk in een component toe.
- [ ] Trace verandert geen selectie, row order, filter, group of history en overleeft surfacewisseling binnen hetzelfde document volgens bestaande UI-scope.
- [ ] Gebruik naast opacity een toegankelijke status/klasse zodat high-contrast niet alleen kleur/alpha draagt.
- [ ] Draai `npm run typecheck`, trace/dependency/relation-planchecks en lint.
- [ ] Commit: `feat: voeg relatiedropdown en gedeelde voorgangertrace toe`.

## Task 21: Bewijs volledige pariteit en verwijder pas daarna de Relaties-tab

**Files:**
- Create: `tests/planning/check-relations-panel-parity.ts`
- Create: `docs/superpowers/evidence/tabel-overhaul-relations-parity.md`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Ribbon/ribbonConfig.tsx`
- Modify: `src/state/slices/uiSlice.ts`
- Delete after gate: `src/components/panels/RelationsPanel.tsx`
- Modify: alle imports/hits uit `rg -n "RelationsPanel|activeTab.*relations|'relations'" src tests`
- Modify: `tests/planning/run.sh`

- [ ] Zet de acht pariteitseisen uit spec §10.3 letterlijk in een machineleesbare matrix: intern bekijken/add/edit/delete, twee geselecteerde koppelen, driving/vrije speling, waarschuwingen, extern add/view/refresh/delete, lokale jump en pred/succ trace.
- [ ] Laat de test per rij verwijzen naar de concrete registrykolom, planneractie, ribbonactie en geautomatiseerde check. Een lege verwijzing of ontbrekende actie maakt de poort rood.
- [ ] Voer iedere route handmatig uit in de draaiende app, zowel vanuit Gantt-taskgrid als full Table waar van toepassing. Noteer datum, buildhash en bewijs in het pariteitsdocument.
- [ ] Houd `RelationsPanel` en het tabblad staan zolang één matrixrij rood of alleen theoretisch gedekt is. Fix de ontbrekende pariteit in de verantwoordelijke eerdere taakmodule, niet in een derde relatie-UI.
- [ ] Als de matrix volledig groen is, verwijder `RelationsPanel`, `relationsTab`, App-renderbranch en `RibbonTab`-lid. Migreer een herstelde oude UI-state met `activeRibbonTab:'relations'` naar `table` zonder projectdatawijziging.
- [ ] Verwijder alleen vertalingen die werkelijk exclusief bij het oude paneel horen. Behoud hergebruikte relatie-, trace- en foutteksten.
- [ ] Assert met `rg` dat geen import, tabconfig of dode route resteert. De resource-tab/-tabel blijft onaangeraakt.
- [ ] Draai `npm run typecheck`, parity/relation/ribbon/i18nchecks en daarna `npm run verify`.
- [ ] Commit: `refactor: verwijder Relaties-tab na bewezen gridpariteit`.

## Task 22A: Rond toegankelijkheid, i18n, RTL en thema’s af

**Files:**
- Modify: `src/i18n/locales/{ar,de,en,es,fa,fr,it,ja,ko,nl,pl,pt,tr,zh}/{task,menu,common}.json`
- Modify: `src/styles/globals.css`
- Modify: relevante `src/components/task-grid/*.tsx`
- Create: `tests/planning/check-task-grid-i18n.ts`
- Modify: `tests/planning/run.sh`

- [ ] Maak een broninventaris van alle nieuwe vertaalkeys en schrijf eerst een rode check die iedere key in alle veertien locales eist. Controleer interpolatievariabelen op exacte gelijkheid met Nederlands.
- [ ] Schrijf Nederlands en Engels handmatig en laat de andere twaalf vertalingen inhoudelijk controleren. Geen lege tekst, Engelse fallback, onverklaarde afkorting of verwijzing naar de verdwenen Relaties-tab.
- [ ] Test RTL apart: visuele pijl-links/rechts volgt aangrenzende cel, Tab volgt logische kolomvolgorde en pinnen blijft bewust fysiek links. Popovers blijven in viewport.
- [ ] Test licht, donker en high-contrast. Read-only, stale, selectie, active, driving en invalid moeten ieder naast kleur minimaal een icoon, patroon, tekst of ARIA-status hebben.
- [ ] Draai `npm run typecheck`, de volledige ARIA-/i18nchecks en lint.
- [ ] Commit: `feat: voltooi toegankelijkheid taal en thema van taakgrid`.

## Task 22B: Leg de performancegrenzen reproduceerbaar vast

**Files:**
- Create: `tests/planning/check-task-grid-performance.ts`
- Create: `scripts/bench-task-grid.mjs`
- Create: `docs/superpowers/evidence/tabel-overhaul-performance.md`
- Modify: `tests/planning/run.sh`

- [ ] Bouw de headless performancecheck met een deterministische generator van 50.000 zichtbare taakrijen, 24 kolommen en 100.000 relaties. Gebruik twee warmups en de mediaan van negen runs.
- [ ] Stel deze concrete poorten in: gemounte rijen `<= ceil(900/28)+16`; gemounte datacellen `<= gemounte rijen × 24`; relationIndex-build mediaan `<= 500 ms`; 1.000 navigatie-/selectiecommando’s mediaan `<= 100 ms`; virtual-windowberekening mediaan `<= 5 ms`. Laat `OPS_RELAX_PERF=1` alleen metingen printen en nooit de normale CI-poort stil uitschakelen.
- [ ] Laat `scripts/bench-task-grid.mjs` dezelfde generator gebruiken en JSON schrijven met Node/CPU/buildhash/aantallen/tijden. Vergelijk vóór/na op dezelfde machine en noteer waarden in het eindbewijs; een verslechtering >25% vereist onderzoek ook als de ruime absolute poort nog groen is.
- [ ] Draai de performancecheck driemaal in normale modus, leg alle medianen en exitcodes vast en onderzoek iedere instabiele/flaky poort vóór commit.
- [ ] Commit: `test: bewaak performancebudgetten van taakgrid`.

## Task 22C: Voer de echte gebruikersroutes en de volledige eindpoort uit

**Files:**
- Create: `docs/superpowers/evidence/tabel-overhaul-final.md`
- Create: `artifacts/tabel-overhaul/` alleen voor blijvend, privacyvrij beeldbewijs

- [ ] Verifieer echte app met nul taken, nul kolommen, 10.000+ taken, duplicate resourcegroepen, brede/smalle viewport, 200% zoom, filter/collapse, Gantt split view, histogram, minimap, keyboard-only, Excel roundtrip en external relation sourceMissing.
- [ ] Voer in de echte browser/app expliciet focusoverdracht na virtual scroll, één roving tabstop, pointer- en keyboardresize, popoverfocus/Escape-return en RTL-pijlnavigatie uit. Dit is het interactieve bewijs dat het headless harnas zonder jsdom bewust niet levert.
- [ ] Bewaar screenshots voor full Table en Gantt in licht/donker/high-contrast, Nederlands, één lange locale en RTL. Toon row/baralignment, chooser+MRU, invalid edit, pinned overflow, relation hover en tracefade.
- [ ] Draai `npm run typecheck`, `npm run lint`, `bash tests/planning/run.sh` en uiteindelijk `npm run verify`; noteer commando, exitcode en relevante testtotalen in het eindbewijs.
- [ ] Controleer `git diff --check`, `rg -n "TODO|FIXME|TBD|placeholder|similar to"` op alle nieuwe/gewijzigde bestanden en beoordeel iedere hit inhoudelijk.
- [ ] Controleer met `git status --short` dat `.agents/`, `.codex/` en andere userbestanden niet gestaged zijn.
- [ ] Commit: `test: bewijs toegankelijkheid prestaties en pariteit van taakgrid`.

---

## 3. Etappepoorten en volgorde

Voer de taken in deze volgorde uit; alleen de expliciet onafhankelijke tests binnen een taak mogen parallel worden voorbereid:

1. **Fundering:** Task 0–3, 4A–4E, 5–6. Poort: session history, documentactivatie en gridtransaction zijn groen; oude UI is nog intact.
2. **Gridkern:** Task 7–11. Poort: headless registry, voorkeuren, selectie, clipboard, ARIA en adapter zijn groen; nog geen canvasknip.
3. **Domein en oppervlakken:** Task 12–15 en 16A–16D. Poort: full Table en Gantt gebruiken dezelfde grid; canvas heeft origin 0; resource table onaangeraakt.
4. **Relaties:** Task 17–20. Poort: interne/externe relatiebewerkingen, hover/jump, dropdown en trace zijn groen; oude Relaties-tab bestaat nog.
5. **Verwijdering en bewijs:** Task 21 en 22A–22C. Poort: pariteitsmatrix groen vóór verwijdering; volledige verify en visueel bewijs erna.

Geen implementer mag Task 21 “voorbereidend” eerder doen. De oude tab is de levende referentie tot de volledige pariteit aantoonbaar bestaat.

## 4. Zelfreview vóór uitvoering

- [ ] Loop spec §2–§18 regel voor regel langs en noteer voor iedere normatieve eis minimaal één taaknummer en, waar testbaar, één checkbestand.
- [ ] Controleer dat alle bronvelden uit `Task`, `TaskTime`, `TaskConstraint`, `Sequence`, `ExternalLink`, `ExternalSourceRef`, `ResourceAssignment`, `BaselineTask`, `TaskSplitGap`, `TaskTimephasedContour`, `TimephasedContourPeriod`, `TaskNote` en `TimephasedDurationWalk` in Task 2 compile-time gedekt zijn.
- [ ] Controleer dat geen taak de resourcetabel verbouwt, header-sort toevoegt, een celknop toevoegt of gridvoorkeur in projectdata stopt.
- [ ] Controleer dat iedere atomaire route een fouttest heeft die live data, dirty, stale, afgeleiden, notificaties en history onveranderd bewijst.
- [ ] Controleer alle nieuwe typen/signatures tegen de brontypen en strict TypeScript; geen `any` als ontwerpuitweg.
- [ ] Zoek op `TBD`, `TODO`, `later invullen`, `vergelijkbaar met`, `similar to`, `enzovoort` en vervang ieder planplaceholder door concrete bestanden, gedrag en bewijs.
- [ ] Laat het volledige plan hyperkritisch reviewen, verwerk iedere materiële bevinding en herhaal onafhankelijke rondes tot een expliciete GO voordat uitvoering wordt aangeboden.

## 5. Verwerking eerste hyperkritische planreview

De eerste read-only review op `gpt-5.5`/`xhigh` gaf **NO-GO**. De tien bevindingen zijn als volgt verwerkt:

| Bevinding | Verwerking |
|---|---|
| Gridtransaction nam één intent aan | Task 6 gebruikt nu uitsluitend `readonly GridIntent[]` achter synchrone `runGridMutation`; één cel is een één-element-array. |
| Registrycontract miste formatter/parser/writer/validatie | Task 2 definieert nu beschikbaarheid, editor-kind, format, copy, parse, validate, `planWrite` en auto-fittekst. |
| Activatie miste boundarysignalen | Task 5 draagt altijd `refreshed`, `deviated`, `removed`, `showLibraryLinkDialog` en `libraryRefreshNotice`. |
| Plaatsing van `cpmResult` vóór publicatie was onduidelijk | Task 5 voegt upstream `prepareLoadedPayload` toe: bestaand expliciet open/import-rekenen gebeurt geïsoleerd vóór activatie; switch behoudt exact en rekent niet. |
| Auto-fit mat slechts 200 rijen en klemde op 600 px | Task 10 meet alle geformatteerde waarden gecachet/gechunked en klemt exact op 480 px, met brede waarde op rij 20.000 als regressie. |
| Trace-eigenaar/test ontbrak | Task 20 noemt `ganttRenderOptions.ts` en `check-gantt-render-options.ts` expliciet en eist één definitie. |
| Axishelpers ontbraken in canvasknip | Task 16A neemt `timeAxis.ts`, `workdayAxis.ts` en `check-workday-axis.ts` mee; 16D verbiedt de oude naam structureel. |
| Relationele indices hadden dubbel eigenaarschap | Task 2 maakt de enige `relationIndex`; Task 11 consumeert en Task 18 breidt dezelfde module uit. |
| Snapshot-equalitycheck was duur en niet gespecificeerd | Task 6 controleert alleen document-id binnen de synchrone niet-herintreedbare wrapper; geen deep compare/revisioncounter. |
| History, canvas en eindbewijs waren te groot voor één commit | Task 4 is gesplitst in 4A–4E, Task 16 in 16A–16D en Task 22 in 22A–22C, ieder met eigen rode check en commit. |

Deze herziene versie gaat opnieuw volledig door een onafhankelijke hyperkritische review. Uitvoering blijft geblokkeerd zolang die ronde geen GO geeft of nog materiële bevindingen openlaat.

## 6. Verwerking tweede hyperkritische planreview

De tweede onafhankelijke read-only review gaf opnieuw **NO-GO**, nu met vier bevestigde contractfouten en één hoog-waarschijnlijke bewijsleemte:

| Bevinding | Verwerking |
|---|---|
| `id-only`-voorwaarde stond omgekeerd | Task 17 gebruikt de volledige prioriteit: project-id wint; alleen zonder project-id wordt een geldig pad `path-sha256:`; alleen zonder beide volgt same-cell id-only. Legacy padrefresh blijft een aparte fallback. |
| Paste stond matrixherhaling toe | Task 8 staat alleen 1×1-fill toe; iedere grotere matrix moet exact passen of eenmaal volledig vanaf active passen. |
| Task 4C kon niet groen door latere stackconsumenten | Task 4C migreert nu in dezelfde commit TitleBar, commands, MCP-responses en alle product-/testpropertyhits naar `canUndo`, `canRedo` en active-scope-dieptes. Task 4E houdt alleen legacy serialized readers over. |
| Task 5 miste publieke boundarycallers | `useRecoveryRestore.ts`, `PoolImportDialog.tsx` en alle `runOpenBoundary`/activatiehits zijn expliciet onderdeel van Task 5, met een grep-poort tegen een tweede live boundarycall. |
| Headless DOM-bewijs impliceerde niet-bestaande jsdom | Task 9 gebruikt pure helpers plus `react-dom/server`; focus, pointer, popover en RTL-interactie worden expliciet in de echte app onder Task 22C bewezen. |

Omdat deze ronde materiële fouten vond, volgt na verwerking een derde finale hyperkritische review. Alleen een expliciete GO zonder open P0/P1-blokkades opent de uitvoeringshandoff.

## 7. Verwerking derde hyperkritische planreview

De derde review gaf opnieuw **NO-GO** met vier bevestigde ripplefouten:

| Bevinding | Verwerking |
|---|---|
| Pad-hash overschreef nog een aanwezige project-id | Task 17 encodeert nu exact `projectId` → geldig pad → same-cell id-only, in die volgorde; legacy refreshfallback blijft apart. |
| `loadState → runCPM`-callers stonden buiten Task 5 | `projectSlice`, IFCPanel, Backstage en extensionApi zijn toegevoegd en geven recompute vóór de ene activatiepublicatie door. |
| TaskGridSlice was niet als app-global geclassificeerd | Task 3 wijzigt `documentContract.ts`, voegt alle slice-statekeys aan `AppGlobalKey` toe en test de compile-classificatie. |
| Brede historygrep raakte een comment in de verboden resourcetabel | Task 4C zoekt alleen property-/objectkeyconsumenten en sluit beide ResourcePanel-bestanden expliciet uit; daar verandert niets. |

De vier reparaties gaan opnieuw door een finale poortreview. Handoff blijft dicht zolang die geen expliciete GO geeft.

## 8. Vierde hyperkritische planreview: GO

De vierde finale read-only review vond **geen materiële blokkade meer** en gaf expliciet **GO voor uitvoeringshandoff**:

- **[BEVESTIGD]** `sourceProjectKey` volgt exact project-id → geldig genormaliseerd pad → same-cell id-only en houdt de legacy padrefresh bij verkeerde project-id apart in stand.
- **[BEVESTIGD]** Task 5 omvat alle huidige load-/activatieroutes, waaronder `projectSlice`, IFCPanel, Backstage en extensionApi, en verplaatst hun recompute vóór de ene publicatie.
- **[BEVESTIGD]** TaskGridSlice-state wordt compile-afgedwongen app-global en kan niet in documentpayload, snapshot of recovery lekken.
- **[BEVESTIGD]** Task 4C migreert echte stackpropertyconsumenten en sluit ResourcePanel/ResourcePanelCompact uit; de resourcetabel blijft onaangeraakt.
- **[BEVESTIGD]** Task 8’s pasteafmetingen, Task 9/22C’s bewijsgrens zonder jsdom en Task 15/16’s tussenstand zonder dubbele taaktabel zijn coherent.

Runtime-, Excel- en browserbewijs konden nog niet bestaan omdat dit een implementatieplan is; zij zijn daarom harde uitvoeringstaken en worden niet als reeds groen gepresenteerd.

## 9. Uitvoeringshandoff na plan-goedkeuring

Na verwerking van alle reviewrondes, een expliciete finale review-GO en eigenaarakkoord zijn er twee veilige uitvoerroutes:

1. **Deze sessie, taak voor taak:** gebruik `superpowers:subagent-driven-development`, één geïsoleerde implementer per taak en een reviewcheckpoint na iedere commit.
2. **Nieuwe uitvoeringssessie:** gebruik `superpowers:executing-plans` in dezelfde worktree/branch met checkpoints op de vijf etappepoorten.

Geen route pusht naar `main`; integratiebesluit volgt pas na de eindpoort en expliciet akkoord.
