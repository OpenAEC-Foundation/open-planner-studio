# Issue #65 — WBS-sprongknop bij afhankelijkheden — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In het eigenschappenpaneel, sectie Afhankelijkheden, krijgt elke afhankelijkheidsregel een
klikbaar knopje (richtingspijl + WBS-nummer van de gekoppelde taak). Hover toont dezelfde
detailtooltip als op het canvas; klik selecteert die taak, klapt een eventuele ingeklapte
oudersketen uit, en het canvas zoomt/scrollt ernaartoe.

**Architecture:** Een nieuw `HoverTooltip` dat via een portal naar `document.body` rendert (i.p.v.
lokaal `position: absolute`) plus een geëxtraheerd `TaskTooltipContent`-component maken de
canvas-tooltip herbruikbaar buiten het canvas. Een nieuwe cross-slice actie `focusOnTask` (in
`viewSlice.ts`) klapt de oudersketen uit, selecteert de taak, en zet een transient
`view.pendingFocusTaskId`-signaal — naar het bestaande patroon van `view.pendingFit` — dat
`GanttCanvas` oppikt om het zoomniveau en de scroll te berekenen (het kent de canvas-afmetingen,
de store niet).

**Tech Stack:** React 19, Zustand + Immer (`AppSlice<T>` = `StateCreator`), TypeScript strict,
Tailwind-utility-classes, react-i18next, geen componenttestrunner — headless `tests/planning/`
(esbuild-bundel + Node) voor pure functies, browserpreview (dit worktree se dev-server) voor UI.

**Bron:** [issue #65](https://github.com/OpenAEC-Foundation/open-planner-studio/issues/65),
uitgewerkt in [docs/superpowers/specs/2026-08-18-issue-65-dependency-jump-design.md](../specs/2026-08-18-issue-65-dependency-jump-design.md).

---

## Task 1: `HoverTooltip` naar portal + `position: fixed`

**Waarom eerst:** dit is een pure herpositionering zonder gedragswijziging (zelfde canvas-tooltip
blijft precies zo werken), maar is de bouwsteen die het knopje in het eigenschappenpaneel straks
zonder clipping kan hergebruiken (het paneel scrolt zelf — `TaskPropertiesPanel.tsx:85`,
`overflow-y-auto` — en de oude `position: absolute`-variant ging uit van een niet-scrollende
canvas-pane).

**Files:**
- Modify: `src/components/canvas/HoverTooltip.tsx`
- Modify: `src/styles/globals.css:416` (`.gantt-tooltip { position: absolute; }` → `position: fixed;`)
- Modify: `src/components/canvas/GanttCanvas.tsx:1412-1416` (aanroep van `HoverTooltip`)

- [ ] **Step 1: Herschrijf `HoverTooltip.tsx` naar portal + viewport-coördinaten**

Vervang de volledige inhoud van `src/components/canvas/HoverTooltip.tsx` door:

```tsx
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * De zwevende hover-tooltip (`.gantt-tooltip`), gerenderd via een portal naar `document.body`
 * met `position: fixed` — naar hetzelfde patroon als `Popover`/`Tooltip` elders in de app.
 *
 * Voorheen (issue #58) was dit een `position: absolute`-element binnen de dichtstbijzijnde
 * gepositioneerde voorouder, met een clip-berekening tegen die voorouders `overflow: hidden`
 * (de Gantt-pane). Issue #65 hergebruikt deze tooltip vanuit het eigenschappenpaneel — dat zelf
 * scrolt (`overflow-y-auto`) — waar diezelfde clip-aanname niet opgaat. De portal ontsnapt aan
 * ELKE omringende overflow-clip, dus de klem-logica hieronder hoeft alleen nog tegen het venster
 * te klemmen, niet tegen een positionerende ouder.
 *
 * `left`/`top` zijn VIEWPORT-coördinaten (dezelfde schaal als `MouseEvent.clientX/clientY`) —
 * de aanroeper geeft dus rechtstreeks `event.clientX ± offset` door, geen container-relatieve
 * berekening meer nodig.
 */

/** Marge tot de rand waarbinnen de tooltip moet blijven. */
const VIEWPORT_MARGIN = 8;
/** Horizontale afstand tussen cursor en tooltip: de offset die de aanroeper in `left` verwerkt.
 *  Alleen gebruikt om bij het spiegelen dezelfde ruimte aan de andere kant te laten. */
const CURSOR_GAP = 16;

/** Klem `v` in [lo, hi]; is dat interval leeg (doos past niet), dan wint `lo`. */
function clampInto(v: number, lo: number, hi: number): number {
  if (lo > hi) return lo;
  return Math.min(Math.max(v, lo), hi);
}

interface HoverTooltipProps {
  /** Positie in viewport-coördinaten (zie docstring hierboven). */
  left: number;
  top: number;
  children: ReactNode;
}

export function HoverTooltip({ left, top, children }: HoverTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Bewust ZONDER dependency-array: de doos verandert ook van formaat door inhoud die niet in
  // `left`/`top` zit (andere taak, andere taal, andere lettergrootte).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.transform = '';
    const r = el.getBoundingClientRect();

    // Horizontaal: past de rechterkant niet, dan naar de linkerzijde van de cursor spiegelen.
    const flipped = -(r.width + CURSOR_GAP * 2);
    const wanted = r.right > window.innerWidth - VIEWPORT_MARGIN ? flipped : 0;
    const dx = clampInto(wanted, VIEWPORT_MARGIN - r.left, window.innerWidth - VIEWPORT_MARGIN - r.right);

    // Verticaal: gewoon omhoog schuiven tot hij past.
    const dy = clampInto(0, VIEWPORT_MARGIN - r.top, window.innerHeight - VIEWPORT_MARGIN - r.bottom);

    el.style.transform = dx || dy ? `translate(${dx}px, ${dy}px)` : '';
  });

  return createPortal(
    <div ref={ref} className="gantt-tooltip" style={{ left, top }}>
      {children}
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: CSS naar `position: fixed`**

In `src/styles/globals.css`, regel 416-417:

```css
.gantt-tooltip {
  position: fixed;
  pointer-events: none;
```

(was `position: absolute;`)

- [ ] **Step 3: Update de aanroep in `GanttCanvas.tsx`**

Regel 1412-1416 gaat van:

```tsx
        {tooltip && (
          <HoverTooltip
            left={tooltip.x - (containerRef.current?.getBoundingClientRect().left || 0) + 16}
            top={tooltip.y - (containerRef.current?.getBoundingClientRect().top || 0) - 10}
          >
```

naar:

```tsx
        {tooltip && (
          <HoverTooltip left={tooltip.x + 16} top={tooltip.y - 10}>
```

(de rest van het `HoverTooltip`-blok, regels 1417-1448, blijft voor deze stap ongewijzigd — dat is Task 2.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: geen fouten.

- [ ] **Step 5: Handmatige check dat de canvas-tooltip nog werkt**

Zie Task 10 voor de volledige browserverificatie — deze stap is optioneel tussentijds testen, geen
losse gate. Ga door naar Task 2.

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/HoverTooltip.tsx src/styles/globals.css src/components/canvas/GanttCanvas.tsx
git commit -m "refactor(canvas): HoverTooltip via portal i.p.v. lokaal absoluut (issue #65 voorwerk)"
```

---

## Task 2: `TaskTooltipContent` extraheren

**Files:**
- Create: `src/components/canvas/TaskTooltipContent.tsx`
- Modify: `src/components/canvas/GanttCanvas.tsx:1417-1448`

- [ ] **Step 1: Schrijf `TaskTooltipContent.tsx`**

```tsx
import { useTranslation } from 'react-i18next';
import { useDisplayDate } from '@/hooks/displayDate';
import { Task } from '@/types/task';

/**
 * Inhoud van de taak-hovertooltip (naam, WBS, duur, start/finish, status, kritiek, total float) —
 * geëxtraheerd uit `GanttCanvas` (issue #58) zodat issue #65 'm kan hergebruiken vanuit het
 * eigenschappenpaneel: hover op de WBS-sprongknop bij een afhankelijkheid moet exact dezelfde
 * details tonen als hover over de taakbalk op het canvas. Puur een `{ task }`-in, JSX-uit —
 * de positionering (`HoverTooltip`) blijft aan de aanroeper.
 */
export function TaskTooltipContent({ task }: { task: Task }) {
  const { t: tTask } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const dd = useDisplayDate();
  const formatTooltipDate = (dateStr: string) => (dateStr ? dd.date(dateStr) : '-');

  return (
    <>
      <div className="tooltip-title">{task.name}</div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('table.wbs')}:</span>
        <span className="tooltip-value">{task.wbsCode || '-'}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('table.duration')}:</span>
        <span className="tooltip-value">{task.time.scheduleDuration}d</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('table.start')}:</span>
        <span className="tooltip-value">{formatTooltipDate(task.time.earlyStart || task.time.scheduleStart)}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('table.finish')}:</span>
        <span className="tooltip-value">{formatTooltipDate(task.time.earlyFinish || task.time.scheduleFinish)}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('tooltip.status')}:</span>
        <span className="tooltip-value">{task.status}</span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('table.critical')}:</span>
        <span className={task.time.isCritical ? 'tooltip-critical-yes' : 'tooltip-value'}>
          {task.time.isCritical ? tCommon('yes') : tCommon('no')}
        </span>
      </div>
      <div className="tooltip-row">
        <span className="tooltip-label">{tTask('properties.totalFloat')}</span>
        <span className="tooltip-value">{task.time.totalFloat}d</span>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Vervang de inline JSX in `GanttCanvas.tsx`**

Regels 1410-1449 gaan van:

```tsx
        {/* Tooltip — issue #58: de titel wrapt nu (CSS) en `HoverTooltip` houdt de doos binnen het
            venster; die twee horen bij elkaar, want een wrappende titel maakt hem hoger. */}
        {tooltip && (
          <HoverTooltip left={tooltip.x + 16} top={tooltip.y - 10}>
            <div className="tooltip-title">{tooltip.task.name}</div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('table.wbs')}:</span>
              <span className="tooltip-value">{tooltip.task.wbsCode || '-'}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('table.duration')}:</span>
              <span className="tooltip-value">{tooltip.task.time.scheduleDuration}d</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('table.start')}:</span>
              <span className="tooltip-value">{formatTooltipDate(tooltip.task.time.earlyStart || tooltip.task.time.scheduleStart)}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('table.finish')}:</span>
              <span className="tooltip-value">{formatTooltipDate(tooltip.task.time.earlyFinish || tooltip.task.time.scheduleFinish)}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('tooltip.status')}:</span>
              <span className="tooltip-value">{tooltip.task.status}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('table.critical')}:</span>
              <span className={tooltip.task.time.isCritical ? 'tooltip-critical-yes' : 'tooltip-value'}>
                {tooltip.task.time.isCritical ? tCommon('yes') : tCommon('no')}
              </span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">{tTask('properties.totalFloat')}</span>
              <span className="tooltip-value">{tooltip.task.time.totalFloat}d</span>
            </div>
          </HoverTooltip>
        )}
```

naar:

```tsx
        {/* Tooltip — issue #58: HoverTooltip houdt de doos binnen het venster. Issue #65: de
            content zit sinds de extractie in TaskTooltipContent, gedeeld met de WBS-sprongknop
            in het eigenschappenpaneel. */}
        {tooltip && (
          <HoverTooltip left={tooltip.x + 16} top={tooltip.y - 10}>
            <TaskTooltipContent task={tooltip.task} />
          </HoverTooltip>
        )}
```

- [ ] **Step 3: Import toevoegen, ongebruikte `formatTooltipDate` opruimen**

In `GanttCanvas.tsx`: voeg toe (bij de andere `./`-imports rond regel 23):

```tsx
import { TaskTooltipContent } from './TaskTooltipContent';
```

En verwijder de nu ongebruikte lokale `formatTooltipDate`-definitie op regel 1282 (die alleen
door het zojuist verwijderde inline blok werd aangeroepen — `noUnusedLocals` staat aan, dus
`typecheck` in de volgende stap vangt het als je 'm laat staan).

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: geen fouten (met name geen "declared but never used" op `formatTooltipDate` of `tCommon`/
`tTask`/`dd` als die nergens anders in `GanttCanvas.tsx` meer nodig zijn — check met `grep -n
"tCommon\|dd\." src/components/canvas/GanttCanvas.tsx` of ze nog gebruikt worden vóór je ze
weghaalt; laat staan als ze elders in het bestand nog gebruikt worden).

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/TaskTooltipContent.tsx src/components/canvas/GanttCanvas.tsx
git commit -m "refactor(canvas): tooltip-inhoud naar TaskTooltipContent (issue #65 voorwerk)"
```

---

## Task 3: Zoom-/scrollgeometrie voor "spring naar taak"

**Files:**
- Modify: `src/utils/ganttViewport.ts`
- Create: `tests/planning/check-focus-task.ts`
- Modify: `tests/planning/run.sh`

- [ ] **Step 1: Voeg de pure helpers toe aan `ganttViewport.ts`**

Voeg toe aan het einde van `src/utils/ganttViewport.ts` (na de bestaande `clampGanttScroll`/
`getGanttScrollBounds`-export, en voeg de import bovenaan het bestand toe):

Bovenaan het bestand, bij de bestaande imports (regel 8), toevoegen:

```ts
import { TIMESCALE_ZOOM } from '@/engine/renderer/timelineTiers';
```

Aan het einde van het bestand:

```ts
/** Aandeel van de bruikbare breedte dat de taakbalk zelf inneemt bij "spring naar taak" (issue
 *  #65): hoog genoeg voor duidelijke context ervoor/erna, laag genoeg om niet edge-to-edge te
 *  ogen zoals `computeFitToProject`. */
const FOCUS_TASK_WIDTH_FRACTION = 0.2;

/** Onder-/bovengrens van het zoomniveau bij "spring naar taak": zonder grens verschrompelt een
 *  taak van maanden tot een streepje, en zoomt een milestone zo ver in dat alle context
 *  verdwijnt. Geankerd aan de bestaande tijdschaal-presets (kwartaal…dag) zodat het resultaat
 *  nooit een willekeurig getal is maar altijd een niveau dat de gebruiker ook via het lint kan
 *  kiezen. */
export const FOCUS_TASK_MIN_ZOOM = TIMESCALE_ZOOM.quarter;
export const FOCUS_TASK_MAX_ZOOM = TIMESCALE_ZOOM.day;

export interface FocusTaskHorizontal {
  zoom: number;
  scrollX: number;
}

/**
 * Zoom + horizontale scroll voor "spring naar taak" (issue #65, WBS-sprongknop bij afhankelijk-
 * heden): de taakbalk krijgt een vast aandeel van de bruikbare breedte en wordt gecentreerd —
 * bewust anders dan `computeFitToProject` (heel project, edge-to-edge) en `computeScrollToDate`/
 * `GanttCanvas.revealTaskIfOffscreen` (scroll-only, tegen de linkerrand, zoom ongewijzigd).
 *
 * `durationDays`/`midDayOffset` zijn al opgeloste dageenheden (fracties toegestaan, voor
 * uur-taken) — de aanroeper kent de datums/hour-mode-logica al (dezelfde conventie als
 * `revealTaskIfOffscreen`), dus dit blijft een pure functie zonder Date-parsing.
 */
export function computeFocusTaskHorizontal(
  durationDays: number,
  midDayOffset: number,
  usableWidth: number,
): FocusTaskHorizontal {
  const duration = Math.max(1, durationDays);
  const rawZoom = (usableWidth * FOCUS_TASK_WIDTH_FRACTION) / duration;
  const zoom = Math.max(FOCUS_TASK_MIN_ZOOM, Math.min(FOCUS_TASK_MAX_ZOOM, rawZoom));
  const scrollX = Math.max(0, midDayOffset * zoom - usableWidth / 2);
  return { zoom, scrollX };
}

/**
 * Verticale scroll voor "spring naar taak": centreert rij `rowIndex` (0-based, index in
 * `viewRows`) in de zichtbare canvas-hoogte. Zelfde `rowToY`-formule als `GanttRenderer`
 * (`headerHeight + rowIndex * rowHeight - scrollY`, zie `GanttRenderer.ts:295`), hier omgekeerd
 * opgelost naar `scrollY`.
 */
export function computeFocusTaskScrollY(
  rowIndex: number,
  rowHeight: number,
  headerHeight: number,
  canvasHeight: number,
): number {
  const visibleHeight = canvasHeight - headerHeight;
  return Math.max(0, rowIndex * rowHeight + rowHeight / 2 - visibleHeight / 2);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: geen fouten. (Controleer even dat `timelineTiers.ts` niets uit `ganttViewport.ts`
importeert — dat is al geverifieerd tijdens het ontwerp; `grep -n "^import" src/engine/renderer/timelineTiers.ts` moet geen `ganttViewport` tonen.)

- [ ] **Step 3: Schrijf de headless check**

Create `tests/planning/check-focus-task.ts`:

```ts
// "Spring naar taak"-geometrie (issue #65, WBS-sprongknop bij afhankelijkheden): de twee pure
// functies die het zoomniveau en de scroll bepalen wanneer je vanuit een afhankelijkheidsregel
// naar de gekoppelde taak springt.
//
// EERLIJK OVER WAT DIT MEET. Checks 01/02/06 herhalen de formule uit de implementatie zelf — die
// zijn per constructie groen, net als bij `check-zoom-steps.ts`. Wat ze wél vangen: een refactor
// die de formule stilletjes verandert zonder deze suite bij te werken. De checks die de
// klemgrenzen op een vast getal pinnen (03, 04, 05, 07) zijn de echte regressiebewaking. De
// BEDRADING (GanttCanvas geeft de juiste argumenten door aan deze pure functies) is geen headless
// test — dat is een browser-pass, zie docs/self-test-harness.md, net als bij
// `check-gantt-render-options.ts`.
//
// Draait via run.sh. Exit 0 = alles groen.
import {
  computeFocusTaskHorizontal, computeFocusTaskScrollY,
  FOCUS_TASK_MIN_ZOOM, FOCUS_TASK_MAX_ZOOM,
} from '@/utils/ganttViewport';

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const close = (label: string, got: number, want: number, eps = 0.001) => {
  checks++;
  if (Math.abs(got - want) > eps) {
    diffs.push(`${label}: verwacht ≈${want}, kreeg ${got}`);
  }
};

// ── 1) Horizontaal: een taak van "normale" duur landt tussen de grenzen. ─────
{
  const { zoom, scrollX } = computeFocusTaskHorizontal(10, 100, 1000);
  close('01 zoom = (bruikbareBreedte × 20%) / duur', zoom, (1000 * 0.2) / 10);
  close('02 scrollX centreert het midden van de taak', scrollX, 100 * zoom - 1000 / 2);
}

// ── 2) Horizontaal: ondergrens (lange taak) en bovengrens (milestone). ──────
{
  const long = computeFocusTaskHorizontal(730, 400, 1000);
  eq('03 een taak van jaren klemt op de ondergrens', long.zoom, FOCUS_TASK_MIN_ZOOM);

  const milestone = computeFocusTaskHorizontal(0, 50, 1000);
  eq('04 een milestone (0 dagen) telt als 1 dag en klemt op de bovengrens', milestone.zoom, FOCUS_TASK_MAX_ZOOM);
}

// ── 3) Horizontaal: scrollX gaat nooit negatief. ────────────────────────────
{
  const { scrollX } = computeFocusTaskHorizontal(5, 1, 100);
  eq('05 scrollX klemt op 0', scrollX, 0);
}

// ── 4) Verticaal: rij wordt gecentreerd in de zichtbare hoogte. ─────────────
{
  const scrollY = computeFocusTaskScrollY(10, 28, 40, 600);
  close('06 verticaal centreren', scrollY, 10 * 28 + 28 / 2 - (600 - 40) / 2);
}

// ── 5) Verticaal: rij 0 in een ruime viewport klemt op 0, niet negatief. ────
{
  const scrollY = computeFocusTaskScrollY(0, 28, 40, 600);
  eq('07 rij 0 in een ruime viewport klemt op 0', scrollY, 0);
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  focus-task: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  focus-task: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
```

- [ ] **Step 4: Registreer de check in `run.sh`**

In `tests/planning/run.sh`, direct ná het bestaande `ZOOMCHECK`-blok (rond regel 226, vóór het
`CMDCHECK`-blok), toevoegen:

```bash
  # "Spring naar taak"-geometrie (issue #65, WBS-sprongknop bij afhankelijkheden): het zoomniveau
  # en de verticale/horizontale scroll klemmen op de juiste boven-/ondergrenzen i.p.v. een taak van
  # jaren tot een streepje te laten verschrompelen of een milestone tot in het oneindige in te
  # zoomen.
  FOCUSCHECK="$DIR/.focus-task.mjs"
  if bundle_check "$DIR/check-focus-task.ts" "$FOCUSCHECK"; then node "$FOCUSCHECK" || STATUS=1; fi

```

- [ ] **Step 5: Run de suite en verifieer exitcode**

Run: `npm run test:planning`
Expected: exitcode 0, en in de output een regel `OK  focus-task: alle checks groen (7)`. Vertrouw
op de exitcode, niet op de aanwezigheid van "alles groen" in de tekst (die kan ook bij exit 1
verschijnen als het bundelen faalt — zie `CLAUDE.md`).

- [ ] **Step 6: Commit**

```bash
git add src/utils/ganttViewport.ts tests/planning/check-focus-task.ts tests/planning/run.sh
git commit -m "feat(gantt): zoom-/scrollgeometrie voor spring-naar-taak (issue #65)"
```

---

## Task 4: `pendingFocusTaskId`-signaal + `focusOnTask`-actie

**Files:**
- Modify: `src/types/view.ts`
- Modify: `src/state/slices/viewSlice.ts`

- [ ] **Step 1: Voeg het transiente veld toe aan `ViewState`**

In `src/types/view.ts`, na `pendingFit?: boolean;` (regel 121):

```ts
  /** "Spring naar taak"-signaal (issue #65): `focusOnTask` zet dit op de doel-taak-id; GanttCanvas
   *  voert de zoom-/scrollberekening uit (kent de canvas-afmetingen, de store niet) en wist het
   *  meteen weer. Transient — zelfde precedent als `pendingFit`. */
  pendingFocusTaskId?: string;
```

- [ ] **Step 2: Interface-declaraties in `ViewSlice`**

In `src/state/slices/viewSlice.ts`, na de `clearPendingFit`-declaratie in de `ViewSlice`-interface
(regel 56):

```ts
  /** "Spring naar taak" (issue #65): klapt de oudersketen van `taskId` uit, selecteert 'm, en
   *  zet het `pendingFocusTaskId`-signaal — naar het patroon van `requestFitToProject`.
   *  GanttCanvas kent de canvas-afmetingen en de bijgewerkte `viewRows` (ná het uitklappen) en
   *  voert daar de echte zoom-/scrollberekening uit (`computeFocusTaskHorizontal`/
   *  `computeFocusTaskScrollY` in `ganttViewport.ts`). */
  focusOnTask: (taskId: string) => void;
  /** Wis het `pendingFocusTaskId`-signaal (door GanttCanvas aangeroepen nadat de sprong is
   *  uitgevoerd). */
  clearPendingFocusTask: () => void;
```

- [ ] **Step 3: Implementatie**

In dezelfde file, na de `clearPendingFit`-implementatie (regel 143-146):

```ts
  focusOnTask: (taskId) => {
    get().expandAncestorsOf(taskId);
    get().selectTask(taskId);
    set((s) => {
      s.view.pendingFocusTaskId = taskId;
    });
  },

  clearPendingFocusTask: () =>
    set((s) => {
      s.view.pendingFocusTaskId = undefined;
    }),

```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: fout op `get().expandAncestorsOf` — die actie bestaat nog niet. Dat hoort: Task 5 voegt
'm toe. Ga direct door naar Task 5 vóór je hier verder test (deze twee taken horen bij elkaar; er
is geen zinnig tussenpunt).

- [ ] **Step 5: Commit (samen met Task 5, zie daar)**

---

## Task 5: `expandAncestorsOf` in `uiSlice`

**Files:**
- Modify: `src/state/slices/uiSlice.ts`

- [ ] **Step 1: Interface-declaratie**

In `src/state/slices/uiSlice.ts`, in de `UiSlice`-interface, na `expandTasks` (regel 24):

```ts
  /** Klap de VOLLEDIGE oudersketen van `taskId` uit (issue #65: "spring naar taak" mag een taak
   *  onthullen die in een ingeklapte samenvattingstaak zit). Loopt via `parentId` omhoog tot de
   *  root en klapt elke ingeklapte voorouder uit — niet alleen de directe ouder, want die kan
   *  zelf weer in een ingeklapte grootouder zitten. */
  expandAncestorsOf: (taskId: string) => void;
```

- [ ] **Step 2: Implementatie**

Na de `expandTasks`-implementatie (die eindigt rond regel 335 met `get().recomputeViewRows();`
gevolgd door `},`):

```ts

  expandAncestorsOf: (taskId) => {
    const s = get();
    const taskMap = new Map(s.tasks.map((t) => [t.id, t]));
    const toExpand: string[] = [];
    let parentId = taskMap.get(taskId)?.parentId ?? null;
    while (parentId) {
      if (s.ui.collapsedTaskIds.includes(parentId)) toExpand.push(parentId);
      parentId = taskMap.get(parentId)?.parentId ?? null;
    }
    if (toExpand.length > 0) get().expandTasks(toExpand);
  },
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: geen fouten meer (Task 4's `expandAncestorsOf`-aanroep is nu opgelost).

- [ ] **Step 4: Commit (Task 4 + 5 samen)**

```bash
git add src/types/view.ts src/state/slices/viewSlice.ts src/state/slices/uiSlice.ts
git commit -m "feat(state): focusOnTask-actie + expandAncestorsOf (issue #65)"
```

---

## Task 6: `GanttCanvas` — het `pendingFocusTaskId`-signaal oppikken

**Files:**
- Modify: `src/components/canvas/GanttCanvas.tsx`

- [ ] **Step 1: Selector toevoegen**

Bij de bestaande `pendingFit`-selector (regel 108), direct erna:

```tsx
  const pendingFocusTaskId = useAppStore(s => s.view.pendingFocusTaskId);
```

- [ ] **Step 2: Imports uitbreiden**

Regel 8 (bestaande import uit `ganttViewport`) wordt:

```tsx
import { setGanttChartWidth, setGanttScrollBounds, getGanttScrollBounds, computeFitToProject, computeEffectiveViewStart, computeFocusTaskHorizontal, computeFocusTaskScrollY, DEFAULT_ZOOM } from '@/utils/ganttViewport';
```

Regel 25 (bestaande import uit `timeAxis`) wordt:

```tsx
import { dateToX as axisDateToX, MS_PER_DAY } from '@/engine/renderer/timeAxis';
```

- [ ] **Step 3: Nieuwe effect, direct ná het bestaande `pendingFit`-effect** (na regel 780)

```tsx
  // "Spring naar taak" (issue #65): `focusOnTask` (aangeroepen vanuit de WBS-sprongknop bij een
  // afhankelijkheid) klapt eerst de oudersketen uit en selecteert de taak, en zet dit signaal —
  // hier, waar de canvas-afmetingen én de al-bijgewerkte `viewRows` bekend zijn, kiezen we het
  // zoomniveau + de scroll (computeFocusTaskHorizontal/computeFocusTaskScrollY in
  // ganttViewport.ts) en wissen het signaal. Zelfde start/finish- en hour-mode-conventie als
  // `revealTaskIfOffscreen` hierboven — bewust een aparte effect, want die functie scrollt alleen
  // (zoom ongewijzigd, tegen de linkerrand), dit zoomt juist wél en centreert.
  useEffect(() => {
    if (!pendingFocusTaskId) return;
    const clearPendingFocusTask = useAppStore.getState().clearPendingFocusTask;
    const canvas = canvasRef.current;
    const task = tasks.find(t => t.id === pendingFocusTaskId);
    if (!canvas || !task) { clearPendingFocusTask(); return; }
    const startStr = task.time.earlyStart || task.time.scheduleStart;
    const endStr = task.time.earlyFinish || task.time.scheduleFinish;
    if (!startStr || !endStr) { clearPendingFocusTask(); return; }

    const rect = canvas.getBoundingClientRect();
    const usable = rect.width - taskTableWidth;
    if (usable <= 0) { clearPendingFocusTask(); return; }

    const st = useAppStore.getState();
    const evs = parseDate(computeEffectiveViewStart(st.tasks, st.view.viewStartDate));
    const hourMode = startStr.includes('T') || endStr.includes('T');
    const start = hourMode ? parseInstant(startStr) : parseDate(startStr);
    const endRaw = hourMode ? parseInstant(endStr) : parseDate(endStr);
    const endMs = endRaw.getTime() + (hourMode ? 0 : MS_PER_DAY);
    const durationDays = (endMs - start.getTime()) / MS_PER_DAY;
    const midDayOffset = ((start.getTime() + endMs) / 2 - evs.getTime()) / MS_PER_DAY;

    const { zoom, scrollX } = computeFocusTaskHorizontal(durationDays, midDayOffset, usable);

    const rowIndex = viewRows.findIndex(r => r.kind === 'task' && r.task.id === pendingFocusTaskId);
    const scrollY = rowIndex >= 0
      ? computeFocusTaskScrollY(rowIndex, rowHeight, headerHeight, rect.height)
      : st.view.scrollY; // niet gevonden (bv. weggefilterd) — verticaal onaangeroerd

    clearPendingFocusTask();
    st.setZoom(zoom);
    st.setScroll(scrollX, scrollY);
  }, [pendingFocusTaskId, tasks, viewRows, taskTableWidth, rowHeight, headerHeight]);
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: geen fouten.

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/GanttCanvas.tsx
git commit -m "feat(canvas): reageer op het pendingFocusTaskId-signaal (issue #65)"
```

---

## Task 7: Het knopje in `TaskDependenciesSection`

**Files:**
- Modify: `src/components/task-sections/TaskDependenciesSection.tsx`

- [ ] **Step 1: Herschrijf het bestand**

Vervang de volledige inhoud van `src/components/task-sections/TaskDependenciesSection.tsx` door:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { SequenceType, SEQUENCE_TYPE_OPTIONS } from '@/types/sequence';
import { Task } from '@/types/task';
import { SequenceLagInput } from '@/components/common/SequenceLagInput';
import { HoverTooltip } from '@/components/canvas/HoverTooltip';
import { TaskTooltipContent } from '@/components/canvas/TaskTooltipContent';
import { Trash2, Zap } from 'lucide-react';

interface HoverState { x: number; y: number; task: Task; }

/**
 * Afhankelijkheden (relatietabel: type + lag + driving-badge + verwijderen) — sectie 9 uit
 * `TaskPropertiesPanel` (fase 2.10, item 2). RELATIONEEL/storeful: roept `updateSequence`/
 * `removeSequence` rechtstreeks aan, identiek in paneel én dialoog (dialoog heeft altijd een
 * bestaand `task.id` — zie ontwerp-doc-vondst).
 *
 * Issue #65: de richtingspijl + het WBS-nummer van de gekoppelde taak vormen samen een knop.
 * Hover toont dezelfde `TaskTooltipContent` als het canvas (via de gedeelde, portal-gebaseerde
 * `HoverTooltip`); klik roept `focusOnTask` aan — selecteert de taak, klapt een ingeklapte
 * oudersketen uit, en laat GanttCanvas ernaartoe zoomen/scrollen.
 */
export function TaskDependenciesSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const cpmResult = useAppStore(s => s.cpmResult);
  const updateSequence = useAppStore(s => s.updateSequence);
  const removeSequence = useAppStore(s => s.removeSequence);
  const focusOnTask = useAppStore(s => s.focusOnTask);
  const [hover, setHover] = useState<HoverState | null>(null);

  const taskSequences = sequences.filter(
    s => s.predecessorId === taskId || s.successorId === taskId
  );
  if (taskSequences.length === 0) return null;

  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-xs">{t('properties.dependencies')}</span>
      {taskSequences.map(seq => {
        const other = seq.predecessorId === taskId
          ? tasks.find(t => t.id === seq.successorId)
          : tasks.find(t => t.id === seq.predecessorId);
        const role = seq.predecessorId === taskId ? '→' : '←';
        const isDriving = !!cpmResult && !cpmResult.error
          && cpmResult.drivingSequenceIds.includes(seq.id);
        return (
          <div key={seq.id} className="flex items-center gap-1 text-[10px]">
            {other ? (
              <button
                type="button"
                className="flex items-center gap-1 flex-1 truncate"
                style={{ color: 'var(--theme-accent)' }}
                aria-label={t('properties.jumpToTask', { wbs: other.wbsCode || other.name })}
                onMouseMove={e => setHover({ x: e.clientX, y: e.clientY, task: other })}
                onMouseLeave={() => setHover(null)}
                onClick={() => { setHover(null); focusOnTask(other.id); }}
              >
                <span>{role}</span>
                <span className="truncate">{other.wbsCode || other.name}</span>
              </button>
            ) : (
              <>
                <span>{role}</span>
                <span className="flex-1 truncate">?</span>
              </>
            )}
            {isDriving && (
              <span title={t('properties.driving')} style={{ color: 'var(--theme-accent)' }}>
                <Zap size={10} />
              </span>
            )}
            <select
              value={seq.type}
              onChange={e => updateSequence(seq.id, { type: e.target.value as SequenceType })}
              className="input !text-[10px] !px-1 !py-0.5"
            >
              {SEQUENCE_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <SequenceLagInput
              seq={seq}
              title={t('properties.lag')}
              onCommit={patch => updateSequence(seq.id, patch)}
            />
            <button
              onClick={() => removeSequence(seq.id)}
              style={{ color: 'var(--error)' }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        );
      })}
      {hover && (
        <HoverTooltip left={hover.x + 16} top={hover.y - 10}>
          <TaskTooltipContent task={hover.task} />
        </HoverTooltip>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: fout op `t('properties.jumpToTask', ...)` is GEEN typefout (i18next-sleutels zijn niet
statisch getypeerd in dit project) — dus hier moet de build al schoon zijn. Als er wél een fout
is, is die niet gerelateerd aan de ontbrekende vertaalsleutel; los 'm op vóór je doorgaat.

- [ ] **Step 3: Commit**

```bash
git add src/components/task-sections/TaskDependenciesSection.tsx
git commit -m "feat(task-panel): WBS-sprongknop bij afhankelijkheden (issue #65)"
```

---

## Task 8: Vertaalsleutel `properties.jumpToTask` in alle 14 locales

**Waarom alle 14 en niet alleen nl+en:** `npm run verify:i18n` bewaakt dat élke locale compleet is
t.o.v. `nl` (anders dan de in-app-documentatie, waar alleen nl+en hard vereist zijn) — zie
CLAUDE.md, sectie i18n.

**Files:** `src/i18n/locales/<locale>/task.json` voor elk van de 14 locales.

- [ ] **Step 1: Voeg de sleutel toe in elke locale, direct na `"dependencies"`**

De sleutel bevat één interpolatie-placeholder `{{wbs}}` (het WBS-nummer, of de taaknaam als er geen
WBS-nummer is — zie de `aria-label`-aanroep in Task 7). Voeg in elk bestand, direct na de
`"dependencies"`-regel binnen hetzelfde `"properties"`-blok, deze regel toe:

| locale | regel om toe te voegen (na `"dependencies": ...,`) |
|---|---|
| `nl` | `"jumpToTask": "Ga naar taak {{wbs}}",` |
| `en` | `"jumpToTask": "Go to task {{wbs}}",` |
| `de` | `"jumpToTask": "Zur Aufgabe {{wbs}} springen",` |
| `es` | `"jumpToTask": "Ir a la tarea {{wbs}}",` |
| `fr` | `"jumpToTask": "Aller à la tâche {{wbs}}",` |
| `it` | `"jumpToTask": "Vai all'attività {{wbs}}",` |
| `pt` | `"jumpToTask": "Ir para a tarefa {{wbs}}",` |
| `pl` | `"jumpToTask": "Przejdź do zadania {{wbs}}",` |
| `tr` | `"jumpToTask": "{{wbs}} görevine git",` |
| `zh` | `"jumpToTask": "跳转到任务 {{wbs}}",` |
| `ja` | `"jumpToTask": "タスク {{wbs}} へ移動",` |
| `ko` | `"jumpToTask": "{{wbs}} 작업으로 이동",` |
| `ar` | `"jumpToTask": "الانتقال إلى المهمة {{wbs}}",` |
| `fa` | `"jumpToTask": "رفتن به وظیفه {{wbs}}",` |

Voorbeeld voor `nl` (in `src/i18n/locales/nl/task.json`, regel 111-112):

```json
    "dependencies": "Afhankelijkheden",
    "jumpToTask": "Ga naar taak {{wbs}}",
    "relationPopoverTitle": "Type relatie",
```

Doe dit voor alle 14 bestanden, met de bijbehorende JSON-syntax (komma na de vorige regel, komma
na de nieuwe regel — mirror de bestaande stijl van elk bestand exact; nl/en hebben "dependencies"
op regel 111, de overige 12 op regel 91 — zoek op de string, niet op het regelnummer).

- [ ] **Step 2: Verifieer met `verify:i18n`**

Run: `npm run verify:i18n`
Expected: geen fout over `jumpToTask` (ontbrekend of overtollig) in welke locale dan ook. Faalt
de check op een andere, al bestaande sleutel, dan is dat een pre-existing probleem, niet iets uit
deze stap — meld het, verander het niet stilzwijgend mee.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/locales/*/task.json
git commit -m "i18n(task): vertaal jumpToTask voor alle 14 locales (issue #65)"
```

---

## Task 9: Documentatie — WBS-sprongknop in de relatiegids

**Files:**
- Modify: `public/docs/nl/gids-relaties-constraints.md`
- Modify: `public/docs/en/gids-relaties-constraints.md`

- [ ] **Step 1: Nieuwe sectie in de Nederlandse gids**

In `public/docs/nl/gids-relaties-constraints.md`, direct ná de sectie "## Relaties leggen" (na
regel 60, vóór "## Constraint-types" op regel 62), toevoegen:

```markdown

## Naar een gekoppelde taak springen

In het eigenschappenpaneel toont elke afhankelijkheidsregel naast de richtingspijl ook het
WBS-nummer van de gekoppelde taak, als klikbare knop. Hover erover voor dezelfde details als bij
het hoveren over een taakbalk in het Gantt-diagram (naam, WBS, duur, start/finish, status, kritiek
pad, total float). Klik erop om die taak te selecteren: het Gantt-diagram zoomt en scrolt ernaartoe,
en klapt automatisch elke ingeklapte oudertaak uit als de gekoppelde taak daardoor verborgen was.
```

- [ ] **Step 2: Zelfde sectie in de Engelse gids**

In `public/docs/en/gids-relaties-constraints.md`, direct ná "## Adding relations", vóór
"## Constraint types", toevoegen:

```markdown

## Jumping to a linked task

In the properties panel, every dependency row shows the WBS number of the linked task next to the
direction arrow, as a clickable button. Hover over it to see the same details as hovering over a
task bar in the Gantt chart (name, WBS, duration, start/finish, status, critical path, total
float). Click it to select that task: the Gantt chart zooms and scrolls to it, automatically
expanding any collapsed parent task that was hiding it.
```

- [ ] **Step 3: Verifieer met `verify:docs`**

Run: `npm run verify:docs`
Expected: geen fouten (geen nieuw manifest-artikel nodig — dit is een sectie in een bestaand,
al-gemanifesteerd artikel).

- [ ] **Step 4: Commit**

```bash
git add public/docs/nl/gids-relaties-constraints.md public/docs/en/gids-relaties-constraints.md
git commit -m "docs(gidsen): WBS-sprongknop bij afhankelijkheden (issue #65)"
```

---

## Task 10: Browserverificatie + volledige `npm run verify`

**Geen nieuwe bestanden** — dit is de eindcontrole vóór afronding, langs `docs/self-test-harness.md`
tier 1 (dit worktree se browser-dev-build, poort uit `.claude/launch.json` of de `▶`-print van
`npm run dev`).

- [ ] **Step 1: Start de dev-server en open de preview**

Gebruik `preview_start` met de worktree se dev-server-configuratie (niet los `npm run dev` via
Bash — de projectregels schrijven de preview-tool voor).

- [ ] **Step 2: Zet een project met een ingeklapte oudertaak en een afhankelijkheid neer**

Via `javascript_tool`/de browserconsole (of gewoon met de UI): open een voorbeeldproject met
afhankelijkheden tussen taken in verschillende WBS-takken (bv. een van de gebundelde showcases),
selecteer een taak met minstens één afhankelijkheid, en klap de oudertaak van de GEKOPPELDE taak
in (zodat die taak zelf niet zichtbaar is).

- [ ] **Step 3: Open het eigenschappenpaneel van de bronTaak en controleer het knopje**

Verwacht: bij elke afhankelijkheidsregel staat een klikbare knop met richtingspijl + WBS-nummer
i.p.v. de vroegere platte taaknaam.

- [ ] **Step 4: Hover — vergelijk met de canvas-tooltip**

Hover over de nieuwe knop; noteer de getoonde velden (naam, WBS, duur, start, finish, status,
kritiek, total float). Hover vervolgens over de taakbalk van dezelfde taak op het canvas zelf.
Verwacht: identieke velden en waarden.

- [ ] **Step 5: Klik — selectie, uitklappen, zoom/scroll**

Klik op de knop. Verwacht, in deze volgorde van waarneming:
- de oudertaak van de gekoppelde taak staat niet meer ingeklapt (zichtbaar in de linker takenlijst);
- de gekoppelde taak is nu de geselecteerde taak (het eigenschappenpaneel toont nu ZIJN gegevens);
- het canvas is gezoomd/gescrold zodat de balk van die taak ruim zichtbaar in beeld staat, niet
  plakkend tegen een rand.

Assert de kern hiervan ook via state, niet alleen visueel — `javascript_tool`:
```js
() => {
  const s = window.__OPS__.store.getState();
  return {
    selected: s.selectedTaskIds,
    collapsed: s.ui.collapsedTaskIds,
    zoom: s.view.zoom,
  };
}
```
Verwacht: `selected` bevat de id van de gekoppelde taak; de eerder ingeklapte oudertaak-id staat
niet meer in `collapsed`.

- [ ] **Step 6: Test de grensgevallen**

Herhaal Stap 5-achtig voor: een afhankelijkheid naar een MIJLPAAL (0 dagen duur — zoom mag niet
extreem ver inzoomen), en een afhankelijkheid naar een taak die zelf twéé niveaus diep in
ingeklapte oudertaken zit (beide moeten uitklappen, niet alleen de directe ouder).

- [ ] **Step 7: Volledige verify-poort**

Run: `npm run verify`
Expected: exitcode 0. Dit dekt `typecheck`, `lint`, alle vier testsuites (inclusief de nieuwe
`check-focus-task.ts` uit Task 3), `verify:examples`, `verify:docs`, `verify:i18n`,
`verify:cycles`, `verify:audit`.

- [ ] **Step 8: Los gevonden problemen op**

Vind je in stap 2-6 een afwijking van het verwachte gedrag, los 'm op in het betrokken bestand
(Task 3/6/7 hierboven) en herhaal vanaf Stap 3. Geen nieuwe commit vóór dit groen is.

- [ ] **Step 9: Eindcommit (indien er nog losse fixes zijn)**

Alleen als Stap 8 iets veranderde:

```bash
git add -A
git commit -m "fix: correcties na browserverificatie (issue #65)"
```

---

## Self-Review — dekking t.o.v. het ontwerpdocument

- §1 (gedeelde tooltip-inhoud + portal-correctie) → Task 1, 2.
- §2 (het knopje, vormgeving B) → Task 7.
- §3 (`focusOnTask`, `pendingFocusTaskId`) → Task 4, 5, 6.
- §4 (zoomberekening, boven-/ondergrens, verticaal centreren) → Task 3, 6.
- §5 (documentatie) → Task 9.
- §6 (verificatie) → Task 10; Task 3 voegt bovendien de headless geometrietest toe die het
  ontwerpdocument niet expliciet noemde (ontdekt tijdens het plannen: `tests/planning/` heeft al
  een precedent voor pure Gantt-viewport-functies, `check-zoom-steps.ts`/
  `check-gantt-render-options.ts` — consistent om die lijn door te trekken in plaats van 'm hier
  te breken).
