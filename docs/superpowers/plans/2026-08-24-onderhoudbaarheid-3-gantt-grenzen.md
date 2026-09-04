# Onderhoudbaarheidsprogramma 3 — Gantt-grenzen langs bewezen naden

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maak `GanttCanvas` onderhoudbaar door renderer-lifecycle, viewportcoördinatie en pointerarbitrage ieder één eigenaar te geven, zonder teken-/hit-testgeometrie, productgedrag of opgeslagen state te veranderen.

**Architecture:** `GanttCanvas` blijft een React-shell met atomische Zustand-selectors. `useGanttViewportCoordinator` bezit alle bounds/scroll/zoom/focus/fit-logica, `useGanttRendererHost` bezit alle rendererinstanties en canvaslifecycle, en `useGanttPointerCoordinator` bezit de ene gestureprioriteit plus de bestaande gesturehooks. `GanttRenderer` blijft eigenaar van tekenen én hit-tests.

**Tech Stack:** React 19, TypeScript strict, Canvas 2D, bestaande `GanttRenderer`/`HistogramRenderer`, Playwrightbrowserpoort uit Plan 0, headless renderer-/viewportchecks.

**Spec:** [`docs/superpowers/specs/2026-08-24-onderhoudbaarheidsprogramma-design.md`](../specs/2026-08-24-onderhoudbaarheidsprogramma-design.md)

## Global Constraints

- Plan 0, Plan 1 en Plan 2 zijn volledig groen.
- Geen wijziging aan domeindata, IFC, scheduler, kalenderengine, handmatige CPM of undo-semantiek.
- Geen geometrie uit `GanttRenderer` naar React verplaatsen.
- `buildGanttRenderOptions` blijft de enige renderoptie-afleiding.
- Pointerprioriteit blijft op één plek; maak geen losse concurrerende `onMouseDown`-beslissers.
- Atomische storeselectors blijven staan tenzij een concrete renderbenchmark een betere selector bewijst.
- `TableEditor` is bevroren voor structurele uitbreiding: alleen regressiefix of kleine lokale extractie.
- Iedere extractie krijgt vooraf een browsercase op haar eigen naad en één afzonderlijk terugdraaibare commit.
- `tests/planning/run.sh` bevat bij de start een niet-gerelateerde
  `check-dependency-presentation.ts`-hunk. Stage nieuwe Gantt-checkregistraties hunkgewijs en
  controleer de cached diff; neem die bestaande hunk en test niet mee. Vallen beide regels in één
  patchhunk, splits met `s` of bewerk met `e` tot alleen de eigen regel.
- Draai vóór de eerste edit `git status --short`. Draai vóór iedere commit
  `git diff --cached --name-only` en `git diff --cached --check`; inspecteer ieder overlappend bestand
  hunk voor hunk en breek af bij werk buiten de actieve task.
- Raak `docs/CHANGELOG.md` niet aan.

---

## Task 1: Maak de Gantt-karakteriseringsmatrix compleet

**Files:**
- Modify: `tests/browser/gantt-drag-undo.spec.ts`
- Modify: `tests/browser/gantt-split-scroll.spec.ts`
- Modify: `tests/browser/document-switch.spec.ts`
- Modify: `tests/browser/table-editor.spec.ts`
- Create: `tests/browser/gantt-pointer-priority.spec.ts`
- Create: `tests/browser/gantt-viewport.spec.ts`
- Create: `tests/browser/gantt-histogram.spec.ts`
- Create: `tests/browser/gantt-lifecycle.spec.ts`
- Modify: `tests/browser/fixtures/ops.ts`

- [ ] **Step 1: Leg de pointerprioriteit vast als gebruikersuitkomst**

Schrijf cases voor deze huidige volgorde:

1. een al actieve gesture weigert een tweede;
2. middelklik pant ook boven een balk en verandert geen taakdatums;
3. de tabel/chart-splitter wint van header, bar en achtergrond;
4. onder de header start geen taakgesture;
5. Shift of dependency mode op geldige bron start dependency-draw vóór bar drag;
6. Ctrl/Cmd op een bar is selectie en geen drag;
7. gewone barbody/rand start move/resize;
8. kale taakrij in de tabel start alleen in tree mode rowdrag;
9. chartachtergrond in drag-mode pant, behalve Ctrl/Cmd dat boxselect start;
10. overige achtergrond start boxselect;
11. Escape annuleert de bestaande row- en boxgesture zonder domeinmutatie. Dependency-draw behoudt
    zijn bestaande muisgestuurde lifecycle; de basisversie had daarvoor geen Escape-annulering.

Assert relaties, selecties, scroll, datums, overlays en undo; expose geen "force gesture"-API.

- [ ] **Step 2: Leg viewportacties vast**

Cases:

- primary wheel in elk `scrollMode`-pad;
- secondary wheel wijzigt eigen `secondaryScrollX` en gedeelde `scrollY`;
- Ctrl+0/fit gebruikt hele projectspan en reset Y;
- focus-task past zoom/scroll aan en zet pending signaal terug;
- minimapklik verandert alleen de bijbehorende pane-scroll;
- splitterratio blijft geklemd en persisteert pas bij mouseup;
- documentwissel met verschillende splitviews herstelt beide paneviews.

- [ ] **Step 3: Leg histogram/picker vast**

Seed twee resources waarvan één overallocated is. Klik de echte pickerzone in het histogramcanvas,
assert `histogramResourceId`, serieswissel en tooltipinhoud. Resize histogram via echte splitter en
assert hoogte/persistentiepad zonder resize-loop.

- [ ] **Step 4: Leg renderer-lifecycle vast**

Gebruik de in Plan 0 Task 4 al geleverde observer-only `paintCount(surface)` en
`lastSize(surface)`. Deze task voegt geen productinstrumentatie toe. Test:

- primary mount en resize;
- secondary aan/uit/aan zonder stale ref;
- histogram aan/uit;
- thema- en fontwijziging veroorzaakt een eindig aantal paints;
- geen `pageerror`, console-error of onafgebroken countgroei: wacht eerst op `document.fonts.ready`
  en de verwachte resize/theme-trigger, poll daarna tot de count 500 ms stabiel is en bewijs dat hij
  nog een tweede quiet window van 500 ms niet groeit. Nul retries; de driver start zelf geen paint.

De driver observeert; hij start geen paint.

- [ ] **Step 5: Maak de TableEditor-freeze expliciet toetsbaar**

Breid de bestaande tablecase uit met:

- keyboardnavigatie en celcommit;
- rowdrag op het DOM-oppervlak;
- dezelfde `viewRows`/selectie-uitkomst als canvas-rowdrag voor een identieke fixture.

Dit karakteriseert beide oppervlakken; het verenigt ze niet.

- [ ] **Step 6: Draai de matrix driemaal**

```bash
npm run test:browser -- --grep "Gantt|gantt|histogram|table surface"
npm run test:browser -- --grep "Gantt|gantt|histogram|table surface"
npm run test:browser -- --grep "Gantt|gantt|histogram|table surface"
npm run typecheck
```

Verwacht: vier exitcodes 0; drie browserruns zonder retries en daarna een groene typecheck.

- [ ] **Step 7: Commit uitsluitend karakterisering**

```bash
git add tests/browser/gantt-drag-undo.spec.ts tests/browser/gantt-split-scroll.spec.ts tests/browser/document-switch.spec.ts tests/browser/table-editor.spec.ts tests/browser/gantt-pointer-priority.spec.ts tests/browser/gantt-viewport.spec.ts tests/browser/gantt-histogram.spec.ts tests/browser/gantt-lifecycle.spec.ts tests/browser/fixtures/ops.ts
git commit -m "test(gantt): karakteriseer renderer viewport en pointerprioriteit"
```

---

## Task 2: Definieer de drie naadcontracten vóór verplaatsing

**Files:**
- Create: `src/components/canvas/hooks/ganttCoordinatorTypes.ts`
- Create: `tests/planning/check-gantt-coordinator-contracts.ts`
- Modify: `tests/planning/run.sh`

- [ ] **Step 1: Registreer een compile-/shapecheck**

De check construeert minimale inputs/outputs zonder DOM te mounten en borgt dat de contracten geen
`AppState`-megaobject of domeinmutator buiten hun verantwoordelijkheid aannemen.

- [ ] **Step 2: Definieer rendererhostcontract**

Richtinggevende vorm:

```ts
export interface GanttRendererHostInput {
  primary: GanttRenderOptionsInput;
  secondary?: GanttRenderOptionsInput;
  histogram?: HistogramRenderInput;
  renderRevision: string | number;
}

export interface GanttRendererHost {
  primaryCanvasRef: RefObject<HTMLCanvasElement | null>;
  secondaryCanvasRef: RefObject<HTMLCanvasElement | null>;
  histogramCanvasRef: RefObject<HTMLCanvasElement | null>;
  primaryRendererRef: RefObject<GanttRenderer | null>;
  secondaryRendererRef: RefObject<GanttRenderer | null>;
  histogramRendererRef: RefObject<HistogramRenderer | null>;
}
```

Containerrefs komen van viewportinput. De host bouwt options via bestaande builders, maakt
renderers en registreert dev-surfaces.

- [ ] **Step 3: Definieer viewportcontract**

Het inputobject bevat alleen concrete view-/project-/UI-waarden, storeacties en persistencecallbacks.
Output groepeert:

```ts
export interface GanttViewportCoordinator {
  refs: GanttViewportRefs;
  primary: PaneViewport;
  secondary?: PaneViewport;
  effectiveView: ViewState;
  sharedAxis: GanttAxis;
  scrollHandlers: GanttScrollHandlers;
  splitters: { table: Splitter; histogram: Splitter; ratio: SplitRatioController };
  minimap: { primaryScrollTo(x: number): void; secondaryScrollTo(x: number): void };
}
```

Fit/focus/wheel zijn interne effecten/handlers; de shell krijgt alleen wat JSX nodig heeft.

- [ ] **Step 4: Definieer pointercontract**

```ts
export interface GanttPointerCoordinator {
  onMouseDown(e: React.MouseEvent<HTMLCanvasElement>): void;
  onMouseMove(e: React.MouseEvent<HTMLCanvasElement>): void;
  onClick(e: React.MouseEvent<HTMLCanvasElement>): void;
  onDoubleClick(e: React.MouseEvent<HTMLCanvasElement>): void;
  onContextMenu(e: React.MouseEvent<HTMLCanvasElement>): void;
  cursor: string;
  overlays: GanttGestureOverlays;
  contextMenu: ContextMenuState | null;
  relationPopover: RelationPopoverState | null;
  tooltip: TooltipState | null;
}
```

De coordinator mag de bestaande vijf gesturehooks aanroepen. Hij ontvangt renderer-/canvasrefs,
viewportcontrollers en gerichte storeacties; niet de hele store.

- [ ] **Step 5: Draai typecheck en contractcheck**

```bash
npm run typecheck
bash tests/planning/run.sh
```

Verwacht: beide exit 0; contracten zijn nog niet op `GanttCanvas` aangesloten.

- [ ] **Step 6: Commit de contractnaad**

```bash
git add src/components/canvas/hooks/ganttCoordinatorTypes.ts tests/planning/check-gantt-coordinator-contracts.ts
git add -p tests/planning/run.sh
git diff --cached -- tests/planning/run.sh
git diff --cached --name-only
git commit -m "refactor(gantt): definieer renderer viewport en pointercontracten"
```

Selecteer alleen de coordinatorcontractregistratie; de cached diff mag
`check-dependency-presentation.ts` niet bevatten.

---

## Task 3: Extraheer de rendererhost zonder renderoptieduplicatie

**Files:**
- Create: `src/components/canvas/hooks/useGanttRendererHost.ts`
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/components/canvas/ganttRenderOptions.ts` alleen voor geëxporteerde inputtypes
- Modify: `src/utils/ganttTestDriver.ts`
- Modify: `tests/browser/gantt-lifecycle.spec.ts`
- Modify: `tests/planning/check-gantt-render-options.ts`

- [ ] **Step 1: Maak een negatieve bronassertie in de lifecycletestkop**

Leg vast dat vóór deze task twee `new GanttRenderer`-calls en één `new HistogramRenderer` in
`GanttCanvas.tsx` staan. De latere mechanische poort maakt dit blijvend.

- [ ] **Step 2: Verplaats primary lifecycle letterlijk**

De host bezit:

- primary canvas-/rendererref;
- primary `useCanvasLayer`;
- `buildGanttRenderOptions(primaryInput)`;
- `new GanttRenderer`, `draw()` en dev-testregistratie.

Geen inhoudelijke opschoning in dezelfde stap. Draai:

```bash
npm run test:browser -- --grep "lifecycle|drag"
bash tests/planning/run.sh
```

Verwacht: beide exit 0.

- [ ] **Step 3: Verplaats secondary lifecycle letterlijk**

Secondary heeft eigen zoom/scrollX, taskTableWidth 0 en gedeelde rows/scrollY. Houd precies die
asymmetrie. Draai dezelfde checks.

- [ ] **Step 4: Verplaats histogram lifecycle letterlijk**

De host bouwt `HistogramRenderer` met dezelfde shared axis, picker, series, labels en
renderRevision. Histogramclick/tooltip blijft voorlopig in de shell/pointerlaag; alleen lifecycle
verhuist.

- [ ] **Step 5: Laat `buildGanttRenderOptions` één eigenaar houden**

In React-code roept alleen `useGanttRendererHost.ts` de builder aan. `GanttCanvas` maakt uitsluitend
de getypeerde `GanttRenderOptionsInput`-waarden.

- [ ] **Step 6: Zoek constructorcalls**

```bash
rg -n "new (GanttRenderer|HistogramRenderer)" src/components
```

Verwacht: alleen `useGanttRendererHost.ts`.

- [ ] **Step 7: Draai full browser Gantt en planning**

```bash
npm run test:browser -- --grep "Gantt|gantt|histogram"
bash tests/planning/run.sh
```

Verwacht: beide exit 0.

- [ ] **Step 8: Commit alleen de hostextractie**

```bash
git add src/components/canvas/hooks/useGanttRendererHost.ts src/components/canvas/GanttCanvas.tsx src/components/canvas/ganttRenderOptions.ts src/utils/ganttTestDriver.ts tests/browser/gantt-lifecycle.spec.ts tests/planning/check-gantt-render-options.ts
git commit -m "refactor(gantt): geef rendererlifecycle één host"
```

Rollback bij regressie: revert alleen deze commit; er is geen state-/bestandsmigratie.

---

## Task 4: Extraheer viewport, bounds en scrollsync

**Files:**
- Create: `src/components/canvas/hooks/useGanttViewportCoordinator.ts`
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/hooks/useGanttZoom.ts`
- Modify: `src/hooks/useZoomShortcuts.ts`
- Modify: `src/utils/ganttViewport.ts` alleen voor pure gedeelde helpers
- Modify: `tests/browser/gantt-viewport.spec.ts`
- Modify: `tests/browser/gantt-split-scroll.spec.ts`
- Modify: `tests/browser/document-switch.spec.ts`
- Modify: `tests/planning/check-axis-consolidation.ts`
- Modify: `tests/planning/check-focus-task.ts`
- Modify: `tests/planning/check-gantt-render-options.ts`
- Modify: `tests/planning/check-zoom-steps.ts`

- [ ] **Step 1: Verplaats effective origin, axis en contentmaten**

De coordinator wordt eigenaar van:

- `effectiveViewStart`/`effectiveView`;
- shared primary/histogram axis;
- primary/secondary content width;
- chart widthmetingen;
- `computeGanttScrollBounds`/`setGanttScrollBounds`-effecten.

Pure formules blijven in `src/utils/ganttViewport.ts`; de hook orkestreert ze.

- [ ] **Step 2: Draai viewport- en rendererchecks**

```bash
bash tests/planning/run.sh
npm run test:browser -- --grep "viewport|split scroll|document switch"
```

Verwacht: beide exit 0.

- [ ] **Step 3: Verplaats DOM-scrollsync**

De coordinator bezit hScroll primary/secondary, vScroll en hun `onScroll`-handlers/effecten. Exacte
regels:

- primary horizontal schrijft `view.scrollX` en behoudt actuele Y;
- secondary horizontal schrijft alleen `splitView.secondaryScrollX`;
- vertical schrijft gedeelde `view.scrollY` en behoudt primary X;
- DOM en store worden alleen gesynchroniseerd bij verschil >1 px om loops te voorkomen.

- [ ] **Step 4: Verplaats wheelpaden**

Primary en secondary wheelhandlers lezen actuele state, gebruiken dezelfde `resolveWheelFunction`
en dezelfde zoomankerformule. Houd de bestaande fallback van verticale overscroll naar horizontaal.

- [ ] **Step 5: Verplaats zoom, shortcuts, fit en focus**

Integreer of composeer `useGanttZoom`/`useZoomShortcuts` in de coordinator. De coordinator bezit de
pending-fit- en pending-focus-effecten en wist signalen precies één keer. Geen tweede formule naast
`computeFitToProject`, `computeFocusTaskHorizontal` of `computeFocusTaskScrollY`.

- [ ] **Step 6: Verplaats minimap- en ratio-splitroutes**

Primary/secondary minimap schrijven hun eigen X. Ratio drag gebruikt pane-rowgeometrie, klem en
mouseupcommit op één plek. Table/histogram splitters worden via `useSplitter` samengesteld.

- [ ] **Step 7: Zoek viewportownership**

```bash
rg -n "computeGanttScrollBounds|setGanttScrollBounds|computeFitToProject|computeFocusTaskHorizontal|resolveWheelFunction" src/components/canvas
```

Verwacht: orchestratie alleen in `useGanttViewportCoordinator.ts`; pure helperdefinities wonen in
`src/utils`.

- [ ] **Step 8: Draai browsermatrix en typecheck**

```bash
npm run test:browser -- --grep "viewport|split|focus|fit|minimap|document switch"
npm run typecheck
```

Verwacht: beide exit 0.

- [ ] **Step 9: Commit alleen viewportextractie**

```bash
git add src/components/canvas/hooks/useGanttViewportCoordinator.ts src/components/canvas/GanttCanvas.tsx src/hooks/useGanttZoom.ts src/hooks/useZoomShortcuts.ts src/utils/ganttViewport.ts tests/browser/gantt-viewport.spec.ts tests/browser/gantt-split-scroll.spec.ts tests/browser/document-switch.spec.ts tests/planning/check-axis-consolidation.ts tests/planning/check-focus-task.ts tests/planning/check-gantt-render-options.ts tests/planning/check-zoom-steps.ts
git commit -m "refactor(gantt): centraliseer viewport en scrollsync"
```

---

## Task 5: Extraheer histograminteractie rond dezelfde host en viewport

**Files:**
- Create: `src/components/canvas/hooks/useGanttHistogramInteraction.ts`
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/components/canvas/hooks/useGanttRendererHost.ts`
- Modify: `tests/browser/gantt-histogram.spec.ts`
- Modify: `tests/planning/check-gantt-render-options.ts`

- [ ] **Step 1: Verplaats picker- en seriesafleiding niet**

`buildHistogramPicker` en `buildHistogramSeries` blijven in `ganttRenderOptions.ts`; de shell mag de
gememoiseerde uitkomst maken of de hostinput laten bouwen. Er komt geen tweede implementatie.

- [ ] **Step 2: Geef interactie één kleine hook**

De hook ontvangt histogramcanvas-/rendererref, assignments/resources/tasks, selectieactie en
vertaallabels. Hij levert `onClick`, `onMouseMove`, `onMouseLeave` en tooltipstate.

- [ ] **Step 3: Behoud dezelfde coordinate mapping**

Gebruik renderer-`pickAt`/bestaande hittest; herbereken geen x-as in React. Contributing task names
blijven dezelfde filtersemantiek gebruiken.

- [ ] **Step 4: Draai histogramheadless/browser**

```bash
bash tests/planning/run.sh
npm run test:browser -- --grep "histogram"
```

Verwacht: beide exit 0.

- [ ] **Step 5: Commit histograminteractie**

```bash
git add src/components/canvas/hooks/useGanttHistogramInteraction.ts src/components/canvas/GanttCanvas.tsx src/components/canvas/hooks/useGanttRendererHost.ts tests/browser/gantt-histogram.spec.ts tests/planning/check-gantt-render-options.ts
git commit -m "refactor(gantt): isoleer histograminteractie"
```

---

## Task 6: Extraheer de ene pointercoordinator

**Files:**
- Create: `src/components/canvas/hooks/useGanttPointerCoordinator.ts`
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Modify: `src/components/canvas/hooks/useBarDrag.ts`
- Modify: `src/components/canvas/hooks/usePan.ts`
- Modify: `src/components/canvas/hooks/useBoxSelect.ts`
- Modify: `src/components/canvas/hooks/useRowDrag.ts`
- Modify: `src/components/canvas/hooks/useDependencyDraw.ts`
- Modify: `tests/browser/gantt-pointer-priority.spec.ts`
- Modify: `tests/browser/gantt-drag-undo.spec.ts`

- [ ] **Step 1: Verplaats eerst state en bestaande gesturehookcompositie**

De coordinator bezit:

- `justBoxSelectedRef` en `justRowDraggedRef`;
- bar/pan/box/row/dependency hookinstanties;
- cursor, contextmenu, relationpopover en taaktooltip;
- de bestaande centrale handlers.

Verander in deze stap geen prioriteitsvolgorde.

- [ ] **Step 2: Maak prioriteit leesbaar als early-returnsecties**

Gebruik benoemde interne helpers maar één top-level `onMouseDown`. De volgorde uit Task 1 staat als
genummerde commentaarlijst bij de implementatie en elke tak verwijst naar een browsercase.

- [ ] **Step 3: Houd splitter en viewport als geïnjecteerde controllers**

Pointercode roept `viewport.splitters.table.start()` en `viewport.primary.startPan(...)`/gesturehook
aan; hij berekent geen scrollbounds of rendergeometrie zelf.

- [ ] **Step 4: Behoud rendererhit-tests als enige waarheid**

Alle row/bar/relation/collapse/add hittest gaat via `GanttRenderer`. Geen `barGeometry`, datum-naar-x
of rij-indexformule kopiëren naar de coordinator.

- [ ] **Step 5: Draai elke pointercase afzonderlijk bij een failure**

```bash
npm run test:browser -- --grep "pointer priority"
npm run test:browser -- --grep "drag.*undo"
```

Verwacht: beide exit 0.

- [ ] **Step 6: Zoek dubbele dispatchers**

```bash
rg -n "handleMouseDown|onMouseDown=.*handle|startBarDrag|startDepDraw|startBoxSelect|startRowDrag" src/components/canvas/GanttCanvas.tsx src/components/canvas/hooks/useGanttPointerCoordinator.ts
```

Verwacht: de shell bekabelt alleen coordinatorhandlers; prioriteitsbeslissingen staan alleen in de
coordinator.

- [ ] **Step 7: Commit pointerextractie**

```bash
git add src/components/canvas/hooks/useGanttPointerCoordinator.ts src/components/canvas/GanttCanvas.tsx src/components/canvas/hooks/useBarDrag.ts src/components/canvas/hooks/usePan.ts src/components/canvas/hooks/useBoxSelect.ts src/components/canvas/hooks/useRowDrag.ts src/components/canvas/hooks/useDependencyDraw.ts tests/browser/gantt-pointer-priority.spec.ts tests/browser/gantt-drag-undo.spec.ts
git commit -m "refactor(gantt): geef pointerprioriteit één coordinator"
```

---

## Task 7: Maak `GanttCanvas` een shell en voorkom nieuwe grenslekken

**Files:**
- Modify: `src/components/canvas/GanttCanvas.tsx`
- Create: `scripts/verify-gantt-boundaries.mjs`
- Modify: `package.json`
- Create: `tests/planning/check-gantt-boundaries.ts`
- Modify: `tests/planning/run.sh`

- [ ] **Step 1: Verwijder achtergebleven eigenaarsloze refs/state**

Na de drie extracties houdt `GanttCanvas` alleen:

- atomische storeselectors en vertalingen;
- pure `useMemo`-afleidingen voor hostinput;
- coordinatorcompositie;
- JSX en kleine presentational callbacks die nergens anders thuishoren.

Een ref/state die uitsluitend door één coordinator wordt gebruikt verhuist naar die coordinator.

- [ ] **Step 2: Voeg een mechanische bronpoort toe**

`verify-gantt-boundaries.mjs` faalt wanneer:

- `new GanttRenderer` of `new HistogramRenderer` in `src/components` buiten
  `useGanttRendererHost.ts` staat;
- `buildGanttRenderOptions` in React-code buiten de host staat;
- viewportorchestratiehelpers buiten `useGanttViewportCoordinator.ts` worden geïmporteerd;
- gesture-startmethodes rechtstreeks in `GanttCanvas.tsx` worden aangeroepen;
- `GanttRenderer.ts` React/Zustand/componentimports krijgt;
- `TableEditor.tsx` een Ganttcoordinator of renderer importeert.

Parse importregels of gebruik een kleine TypeScript-AST via de reeds geïnstalleerde compiler; scan
niet naïef commentaarstrings.

- [ ] **Step 3: Voeg de poort aan verify toe**

```json
"verify:gantt-boundaries": "node scripts/verify-gantt-boundaries.mjs"
```

Voeg hem naast `verify:store-boundaries` en vóór `verify:cycles` toe.

- [ ] **Step 4: Bewijs de negatieve controle**

`check-gantt-boundaries.ts` voedt de checker een kleine tijdelijke brontekst met een verboden
constructor/import en verwacht een failure; productiecode wordt niet tijdelijk vervuild.

- [ ] **Step 5: Controleer geen kunstmatige monolietverplaatsing**

Inspecteer de drie nieuwe hooks:

- rendererhost bevat geen pointer-/storemutatielogica;
- viewport bevat geen bar-/row-/dependencyhit-tests;
- pointer bevat geen date-to-x/boundsformules;
- geen hook accepteert de volledige `AppState`.

- [ ] **Step 6: Draai boundary, cycles en typecheck**

```bash
npm run verify:gantt-boundaries
npm run verify:cycles
npm run typecheck
```

Verwacht: alle drie exit 0.

- [ ] **Step 7: Commit shell en grenspoort**

```bash
git add src/components/canvas/GanttCanvas.tsx scripts/verify-gantt-boundaries.mjs package.json tests/planning/check-gantt-boundaries.ts
git add -p tests/planning/run.sh
git diff --cached -- tests/planning/run.sh
git diff --cached --name-only
git commit -m "chore(gantt): bewaak renderer viewport en pointergrenzen"
```

Selecteer alleen de Gantt-boundaryregistratie; stage de bestaande dependency-presentationhunk niet.

---

## Task 8: Verifieer de TableEditor-freeze en documenteer de latere exit

**Files:**
- Modify: `CLAUDE.md`
- Modify: `tests/browser/table-editor.spec.ts`
- Modify: `tests/browser/gantt-pointer-priority.spec.ts`

- [ ] **Step 1: Controleer de diff tegen de freeze**

```bash
gantt_plan_base="$(git rev-parse "$(git log -n 1 --format=%H --grep='^test(gantt): karakteriseer renderer viewport en pointerprioriteit$')^")"
git diff --stat "$gantt_plan_base"..HEAD -- src/components/panels/TableEditor.tsx src/components/panels/hooks/useTableRowDrag.ts
git diff "$gantt_plan_base"..HEAD -- src/components/panels/TableEditor.tsx src/components/panels/hooks/useTableRowDrag.ts
```

Verwacht: geen productdiff sinds het begin van Plan 3. Plan-0-hookfixes en testankers vallen bewust
vóór deze basis. Als een aantoonbare regressiefix toch nodig was, moet die in een apart gemotiveerd
commit staan; geen nieuwe Gantt-/viewport-/rendererrol.

- [ ] **Step 2: Vergelijk beide tabeloppervlakken opnieuw**

```bash
npm run test:browser -- --grep "table surface|pointer priority"
```

Verwacht: exit 0; canvas-rowdrag en DOM-rowdrag leveren voor dezelfde fixture dezelfde tree/undo.

- [ ] **Step 3: Documenteer de freeze in `CLAUDE.md`**

Kort en feitelijk:

- er zijn twee oppervlakken;
- Gantt-taaktabel blijft Canvas 2D;
- geen nieuwe structurele TableEditor-verantwoordelijkheid;
- exit alleen via de bredere tabelrevisie die navigatie, kolommen, relaties en resources samen
  ontwerpt.

- [ ] **Step 4: Commit alleen freeze-documentatie/testversterking**

```bash
git add CLAUDE.md tests/browser/table-editor.spec.ts tests/browser/gantt-pointer-priority.spec.ts
git commit -m "docs(tables): bevries beide oppervlakken tot de brede revisie"
```

---

## Task 9: Volledige Gantt-verificatie en stopbesluit

**Files:** geen productwijzigingen; alleen bewijs verzamelen.

- [ ] **Step 1: Draai alle Gantt-headless checks**

```bash
bash tests/planning/run.sh
npm run verify:gantt-boundaries
```

Verwacht: beide exit 0.

- [ ] **Step 2: Draai de volledige browserpoort driemaal**

```bash
npm run test:browser
npm run test:browser
npm run test:browser
```

Verwacht: drie keer exit 0, nul retries, geen page-/console-errors.

- [ ] **Step 3: Controleer de vier structurele zoekvoorwaarden**

```bash
rg -n "new GanttRenderer" src/components
rg -n "buildGanttRenderOptions" src/components
rg -n "computeGanttScrollBounds|resolveWheelFunction|computeFitToProject|computeFocusTaskHorizontal" src/components/canvas
rg -n "startBarDrag|startDepDraw|startBoxSelect|startRowDrag" src/components/canvas/GanttCanvas.tsx
```

Verwacht:

- constructor alleen in rendererhost;
- builder alleen in rendererhost plus definitiebestand;
- viewporthelpers alleen in viewportcoordinator;
- laatste commando exit 1 zonder uitvoer.

- [ ] **Step 4: Inspecteer geometry-eigendom**

```bash
rg -n "barGeometry|getTaskBarBounds|getRelationSourceAt|getRowIndex|getRowZone" src/engine/renderer/GanttRenderer.ts src/components/canvas/hooks
```

Verwacht: definities/formules blijven in `GanttRenderer`; hooks roepen alleen publieke hit-tests.

- [ ] **Step 5: Draai de werkelijke gate**

```bash
npm run verify
```

Verwacht: exit 0.

- [ ] **Step 6: Controleer stopcriteria uit de spec**

- één rendererhost;
- één viewportcoordinator;
- één pointercoordinator;
- geen renderoptieduplicatie;
- browsercase per naad;
- geen paint-/resize-oscillatie;
- drag/undo, split, histogram, splitter, wheel/pan/zoom/focus/fit, pointerprioriteit en documentwissel
  bewezen;
- TableEditor-freeze intact.

- [ ] **Step 7: Stop bij elke bedradingafwijking**

Een kleinere `GanttCanvas.tsx` is geen succescriterium op zichzelf. Als browsergedrag, state, undo,
hit-test of lifecycle afwijkt, revert de afzonderlijke extractiecommit en herstel de naad onder de
karakterisering; pas daarna verder.
