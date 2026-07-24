// Byte-identiteit-bewijs voor de fase-0-consolidatie van de tijd-as (issue #21 punt 5,
// `docs/superpowers/werkdagen-as-ontwerp.md` §2.1/§3.1/§3.2, review §10).
//
// Fase 0 verplaatst een aantal `pixels = dagen × zoom`-formules (en hun inverses) naar de al
// bestaande gedeelde `dateToX` uit `src/engine/renderer/timeAxis.ts`, plus twee nieuwe
// consolidatie-helpers in datzelfde bestand (`xToDayOffset`, `xToDate`). Er verandert
// EXPLICIET geen enkel getal — dit is puur het opheffen van verspreide kopieën.
//
// Bewijsaanpak (§3.2, gekozen variant): "de check is een VERGELIJKING tussen de geconsolideerde
// dateToX/xToDate en een lokaal in de test gedefinieerde referentie-implementatie (de oude
// formule letterlijk gekopieerd) over een raster van datums × zoom × scrollX — exact gelijk
// (===, geen epsilon)." Dat past het beste bij deze fase: de call-sites die zijn aangepakt
// (printPreview.ts:318, GanttCanvas.tsx `revealTaskIfOffscreen`, GanttRenderer.ts's
// grid-`startOffset`, useBarDrag.ts's uur-drag) waren stuk voor stuk PURE, lokaal gedefinieerde
// arithmetiek zonder DOM/canvas-afhankelijkheid — een headless ctx-recorder-render (zoals
// `check-gantt-float-cull.ts`) zou voor drie van de vier niets bewijzen dat de pure-vergelijking
// niet al aantoont, want `GanttRenderer.dateToX` zelf riep vóór deze fase AL `timeAxis.dateToX`
// aan (dat was al geconsolideerd in fase 2.7). De ENE render-interne wijziging — de
// grid-`startOffset`-berekening (`GanttRenderer.ts` regel ~260) — wordt daarom AANVULLEND ook
// via een echte headless render geverifieerd (zie deel 2), zodat de daadwerkelijk-getekende
// verticale grid-lijnen bewijsbaar ongewijzigd blijven, niet alleen de kale formule.
//
// Exit 0 = alles groen (draait mee in tests/planning/run.sh).

// ── DOM-stubs (vóór het instantiëren): de renderer leest themakleuren via
//    getComputedStyle(document.documentElement); zonder stub gooit dat in Node.
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {}, createElement: () => ({ getContext: () => null }) };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { dateToX, xToDate, xToDayOffset, MS_PER_DAY } from '@/engine/renderer/timeAxis';
import { addCalendarDays, diffCalendarDays } from '@/utils/dateUtils';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}

// ── Raster: datums × zoom × scrollX × taskTableWidth ─────────────────────────────────────────
const VIEW_START = new Date(Date.UTC(2026, 0, 1)); // 2026-01-01T00:00:00Z
const ZOOMS = [3, 7.5, 22, 40.333, 100];
const SCROLLS = [0, 1, 37.5, 300, 999.9];
const TABLE_WIDTHS = [0, 90, 300];
// Dag-offsets (hele dagen, zoals de meeste call-sites gebruiken) + een paar sub-dag-offsets
// (in ms) voor de fractionele call-sites (GanttCanvas reveal-on-select, uur-taken).
const DAY_OFFSETS = [-30, -1, 0, 1, 2, 5, 13, 90, 365];
const SUBDAY_MS_OFFSETS = [0, 3 * 3600000, 11.5 * 3600000, 23 * 3600000 + 59 * 60000];

function dateAt(dayOffset: number, extraMs = 0): Date {
  return new Date(VIEW_START.getTime() + dayOffset * MS_PER_DAY + extraMs);
}

// ── 1a. Referentie: de HOOFD-`dateToX` zoals GanttRenderer/HistogramRenderer hem gebruiken
//        (`taskTableWidth + daysFromStart*zoom - scrollX`). Dit was AL geconsolideerd vóór
//        fase 0 — hier alleen bevestigd dat de fase-0-wijzigingen dat pad niet raakten.
function oldDateToXWithScroll(date: Date, viewStart: Date, tableWidth: number, zoom: number, scrollX: number): number {
  const daysFromStart = (date.getTime() - viewStart.getTime()) / MS_PER_DAY;
  return tableWidth + daysFromStart * zoom - scrollX;
}

// ── 1b. Referentie: printPreview.ts:318 vóór de refactor —
//        `TABLE_WIDTH + diffCalendarDays(minDate, date) * zoom` (scrollX bestond niet, dus 0).
function oldPrintDateToX(date: Date, minDate: Date, tableWidth: number, zoom: number): number {
  return tableWidth + diffCalendarDays(minDate, date) * zoom;
}

// ── 1c. Referentie: GanttCanvas.tsx `revealTaskIfOffscreen` vóór de refactor —
//        `tableW + ((d - evs)/msPerDay) * zoom` (fractioneel, scrollX bestond niet, dus 0).
function oldGanttCanvasRevealX(date: Date, evs: Date, tableWidth: number, zoom: number): number {
  return tableWidth + ((date.getTime() - evs.getTime()) / MS_PER_DAY) * zoom;
}

// ── 1d. Referentie: GanttRenderer.ts's grid-`startOffset` vóór de refactor —
//        `Math.floor(scrollX / zoom)`.
function oldStartOffset(scrollX: number, zoom: number): number {
  return Math.floor(scrollX / zoom);
}

// ── 1e. Referentie: useBarDrag.ts's uur-drag `rawMs` vóór de refactor —
//        `(pixelDelta / zoom) * 86400000` (hardcoded magic number, nu `MS_PER_DAY`).
function oldHourDragRawMs(pixelDelta: number, zoom: number): number {
  return (pixelDelta / zoom) * 86400000;
}

for (const zoom of ZOOMS) {
  for (const scrollX of SCROLLS) {
    for (const tableWidth of TABLE_WIDTHS) {
      // 1a: hoofd-dateToX (bevestiging, geen wijziging in deze fase)
      for (const dayOffset of DAY_OFFSETS) {
        const date = dateAt(dayOffset);
        eq(
          `dateToX(main) z=${zoom} sx=${scrollX} tw=${tableWidth} d=${dayOffset}`,
          dateToX(date, VIEW_START, tableWidth, zoom, scrollX),
          oldDateToXWithScroll(date, VIEW_START, tableWidth, zoom, scrollX),
        );
      }

      // 1b: printPreview — alleen hele kalenderdagen (zoals print ze via parseDate levert),
      // scrollX bestond niet in de oude formule ⇒ vergelijk tegen dateToX(..., 0).
      for (const dayOffset of DAY_OFFSETS) {
        const date = dateAt(dayOffset);
        eq(
          `dateToX(print) z=${zoom} tw=${tableWidth} d=${dayOffset}`,
          dateToX(date, VIEW_START, tableWidth, zoom, 0),
          oldPrintDateToX(date, VIEW_START, tableWidth, zoom),
        );
      }

      // 1c: GanttCanvas reveal-on-select — fractionele (sub-dag) datums, scrollX=0.
      for (const dayOffset of DAY_OFFSETS) {
        for (const subMs of SUBDAY_MS_OFFSETS) {
          const date = dateAt(dayOffset, subMs);
          eq(
            `dateToX(reveal) z=${zoom} tw=${tableWidth} d=${dayOffset}+${subMs}ms`,
            dateToX(date, VIEW_START, tableWidth, zoom, 0),
            oldGanttCanvasRevealX(date, VIEW_START, tableWidth, zoom),
          );
        }
      }

      // 1d: grid-startOffset — via xToDayOffset op x=taskTableWidth (§ GanttRenderer.ts:260).
      eq(
        `startOffset z=${zoom} sx=${scrollX} tw=${tableWidth}`,
        Math.floor(xToDayOffset(tableWidth, tableWidth, zoom, scrollX)),
        oldStartOffset(scrollX, zoom),
      );

      // Sanity: xToDate ⇄ dateToX zijn elkaars inverse (op de precisie van fractionele dagen).
      for (const dayOffset of DAY_OFFSETS) {
        const date = dateAt(dayOffset);
        const x = dateToX(date, VIEW_START, tableWidth, zoom, scrollX);
        const roundTripped = xToDate(x, VIEW_START, tableWidth, zoom, scrollX);
        checks++;
        if (Math.abs(roundTripped.getTime() - date.getTime()) > 1) {
          diffs.push(`xToDate∘dateToX niet-inverse: z=${zoom} sx=${scrollX} tw=${tableWidth} d=${dayOffset} → Δ=${roundTripped.getTime() - date.getTime()}ms`);
        }
      }
    }
  }

  // 1e: useBarDrag uur-drag — alleen van zoom/pixelDelta afhankelijk (geen scrollX/tableWidth).
  for (const pixelDelta of [-500, -37.5, 0, 12, 240, 1234.5]) {
    eq(
      `hourDragRawMs z=${zoom} px=${pixelDelta}`,
      (pixelDelta / zoom) * MS_PER_DAY,
      oldHourDragRawMs(pixelDelta, zoom),
    );
  }
}

// MS_PER_DAY zelf mag nooit driften van de bekende 86400000 — anders zijn 1a-1e stilzwijgend
// allemaal tegen een verkeerde constante getest.
eq('MS_PER_DAY', MS_PER_DAY, 86400000);

// ── 2. Live-render-bewijs voor de ENE render-interne wijziging: grid-startOffset ────────────
// Render de ECHTE (aangepaste) GanttRenderer en vergelijk de daadwerkelijk getekende verticale
// dag-grid-lijnen (moveTo/lineTo/stroke-triples van bovenrand tot onderrand) tegen een
// onafhankelijk — met de OUDE `startOffset`-formule — berekende verwachte dagenlijst.
interface Op { kind: string; x?: number; y?: number }
function makeRecordingCtx(): { ctx: CanvasRenderingContext2D; verticalGridX: number[] } {
  const verticalGridX: number[] = [];
  let lastMoveTo: { x: number; y: number } | null = null;
  let lastLineTo: { x: number; y: number } | null = null;
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: () => { lastMoveTo = null; lastLineTo = null; },
    closePath: noop,
    moveTo: (x: number, y: number) => { lastMoveTo = { x, y }; },
    lineTo: (x: number, y: number) => { lastLineTo = { x, y }; },
    stroke: () => {
      if (lastMoveTo && lastLineTo) {
        const m = lastMoveTo as { x: number; y: number };
        const l = lastLineTo as { x: number; y: number };
        // Verticale dag-grid-lijn (`drawGridBackground`): van HEADER_HEIGHT naar CANVAS_HEIGHT,
        // zelfde x, lineWidth 0.5/1 (weekdag vs. weekstart). De vandaag-/statusdatumlijn heeft
        // DEZELFDE moveTo/lineTo-vorm maar lineWidth 2 (+ dash) en een `new Date()`-afhankelijke
        // (dus niet-deterministische) x — expliciet uitgesloten zodat deze check reproduceerbaar
        // blijft, ongeacht de datum waarop de suite draait.
        const lw = (ctx as unknown as { lineWidth: number }).lineWidth;
        if (m.x === l.x && m.y === HEADER_HEIGHT && l.y === CANVAS_HEIGHT && lw <= 1) {
          verticalGridX.push(m.x);
        }
      }
    },
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop, fill: noop,
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [], fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  } as unknown as Op;
  return { ctx: ctx as unknown as CanvasRenderingContext2D, verticalGridX };
}

const HEADER_HEIGHT = 60;
const CANVAS_HEIGHT = 600;

const S = () => useAppStore.getState();
S().newProject();
S().addTask({ name: 'Taak A' });
S().addTask({ name: 'Taak B' });
const [ta, tb] = S().tasks;
S().updateTask(ta.id, { time: { ...S().tasks[0].time, scheduleDuration: 5 } });
S().updateTask(tb.id, { time: { ...S().tasks[1].time, scheduleDuration: 3 } });
S().runCPM();

function renderedGridDays(canvasWidth: number, zoom: number, scrollX: number, tableWidth: number): number[] {
  const { ctx, verticalGridX } = makeRecordingCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: st.viewRows,
    sequences: st.sequences,
    calendar: st.calendar,
    view: { ...st.view, zoom, scrollX, scrollY: 0 },
    selectedTaskIds: [],
    collapsedTaskIds: [],
    canvasWidth,
    canvasHeight: CANVAS_HEIGHT,
    taskTableWidth: tableWidth,
    rowHeight: 28,
    headerHeight: HEADER_HEIGHT,
  }).render();
  return verticalGridX;
}

function expectedGridX(canvasWidth: number, zoom: number, scrollX: number, tableWidth: number): number[] {
  const viewStart = new Date(S().view.viewStartDate);
  const visibleDays = Math.ceil(canvasWidth / zoom) + 2;
  const startOffset = oldStartOffset(scrollX, zoom); // de OUDE formule, onafhankelijk berekend
  const xs: number[] = [];
  for (let i = -1; i < visibleDays; i++) {
    const date = addCalendarDays(viewStart, startOffset + i);
    xs.push(oldDateToXWithScroll(date, viewStart, tableWidth, zoom, scrollX));
  }
  return xs;
}

const RENDER_CASES: Array<{ canvasWidth: number; zoom: number; scrollX: number; tableWidth: number }> = [
  { canvasWidth: 1200, zoom: 22, scrollX: 0, tableWidth: 300 },
  { canvasWidth: 1200, zoom: 22, scrollX: 137, tableWidth: 300 },
  { canvasWidth: 1200, zoom: 7.5, scrollX: 950.5, tableWidth: 300 },
  { canvasWidth: 1200, zoom: 100, scrollX: 0, tableWidth: 0 },
  { canvasWidth: 800, zoom: 40, scrollX: 63, tableWidth: 150 },
];

for (const c of RENDER_CASES) {
  const actual = renderedGridDays(c.canvasWidth, c.zoom, c.scrollX, c.tableWidth);
  const expected = expectedGridX(c.canvasWidth, c.zoom, c.scrollX, c.tableWidth);
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(
      `live-render grid-lijnen wijken af voor ${JSON.stringify(c)}: kreeg ${actual.length} lijnen, verwacht ${expected.length}` +
      (actual.length === expected.length ? ` — eerste afwijking bij index ${actual.findIndex((v, i) => v !== expected[i])}` : ''),
    );
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  axis-consolidation: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  axis-consolidation: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 40)) console.log(`   - ${d}`);
  process.exit(1);
}
