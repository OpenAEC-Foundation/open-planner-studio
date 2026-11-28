const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {}, createElement: () => ({ getContext: () => null }) };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer, gridDensityForZoom } from '@/engine/renderer/GanttRenderer';
import { dateToX, xToDate, xToDayOffset } from '@/engine/renderer/timeAxis';
import { addCalendarDays, diffCalendarDays, parseDate, MS_PER_DAY } from '@/utils/dateUtils';
import fs from 'node:fs';
import path from 'node:path';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}

const VIEW_START = new Date(Date.UTC(2026, 0, 1));
const ZOOMS = [3, 7.5, 22, 40.333, 100];
const SCROLLS = [0, 1, 37.5, 300, 999.9];
const TABLE_WIDTHS = [0, 90, 300];
const DAY_OFFSETS = [-30, -1, 0, 1, 2, 5, 13, 90, 365];
const SUBDAY_MS_OFFSETS = [0, 3 * 3600000, 11.5 * 3600000, 23 * 3600000 + 59 * 60000];

function dateAt(dayOffset: number, extraMs = 0): Date {
  return new Date(VIEW_START.getTime() + dayOffset * MS_PER_DAY + extraMs);
}

function oldDateToXWithScroll(date: Date, viewStart: Date, tableWidth: number, zoom: number, scrollX: number): number {
  const daysFromStart = (date.getTime() - viewStart.getTime()) / MS_PER_DAY;
  return tableWidth + daysFromStart * zoom - scrollX;
}

function oldPrintDateToX(date: Date, minDate: Date, tableWidth: number, zoom: number): number {
  return tableWidth + diffCalendarDays(minDate, date) * zoom;
}

function oldGanttCanvasRevealX(date: Date, evs: Date, tableWidth: number, zoom: number): number {
  return tableWidth + ((date.getTime() - evs.getTime()) / MS_PER_DAY) * zoom;
}

function oldStartOffset(scrollX: number, zoom: number): number {
  return Math.floor(scrollX / zoom);
}

function oldHourDragRawMs(pixelDelta: number, zoom: number): number {
  return (pixelDelta / zoom) * 86400000;
}

for (const zoom of ZOOMS) {
  for (const scrollX of SCROLLS) {
    for (const tableWidth of TABLE_WIDTHS) {
      for (const dayOffset of DAY_OFFSETS) {
        const date = dateAt(dayOffset);
        eq(
          `dateToX(main) z=${zoom} sx=${scrollX} tw=${tableWidth} d=${dayOffset}`,
          dateToX(date, VIEW_START, tableWidth, zoom, scrollX),
          oldDateToXWithScroll(date, VIEW_START, tableWidth, zoom, scrollX),
        );
      }

      for (const dayOffset of DAY_OFFSETS) {
        const date = dateAt(dayOffset);
        eq(
          `dateToX(print) z=${zoom} tw=${tableWidth} d=${dayOffset}`,
          dateToX(date, VIEW_START, tableWidth, zoom, 0),
          oldPrintDateToX(date, VIEW_START, tableWidth, zoom),
        );
      }

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

      eq(
        `startOffset z=${zoom} sx=${scrollX} tw=${tableWidth}`,
        Math.floor(xToDayOffset(tableWidth, tableWidth, zoom, scrollX)),
        oldStartOffset(scrollX, zoom),
      );

      for (const dayOffset of DAY_OFFSETS) {
        const date = dateAt(dayOffset);
        const x = dateToX(date, VIEW_START, tableWidth, zoom, scrollX);
        const roundTripped = xToDate(x, VIEW_START, tableWidth, zoom, scrollX);
        checks++;
        if (!(Math.abs(roundTripped.getTime() - date.getTime()) <= 1)) {
          diffs.push(`xToDate∘dateToX niet-inverse: z=${zoom} sx=${scrollX} tw=${tableWidth} d=${dayOffset} → Δ=${roundTripped.getTime() - date.getTime()}ms`);
        }
      }
    }
  }

  for (const pixelDelta of [-500, -37.5, 0, 12, 240, 1234.5]) {
    eq(
      `hourDragRawMs z=${zoom} px=${pixelDelta}`,
      (pixelDelta / zoom) * MS_PER_DAY,
      oldHourDragRawMs(pixelDelta, zoom),
    );
  }
}

eq('MS_PER_DAY', MS_PER_DAY, 86400000);

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

function renderedGridDays(canvasWidth: number, zoom: number, scrollX: number): number[] {
  const { ctx, verticalGridX } = makeRecordingCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: st.viewRows,
    sequences: st.sequences,
    calendar: st.calendar,
    view: { ...st.view, zoom, scrollX, scrollY: 0 },
    selectedTaskIds: [],
    canvasWidth,
    canvasHeight: CANVAS_HEIGHT,
    rowHeight: 28,
    headerHeight: HEADER_HEIGHT,
  }).render();
  return verticalGridX;
}

function expectedGridX(canvasWidth: number, zoom: number, scrollX: number): number[] {
  const viewStart = parseDate(S().view.viewStartDate);
  const visibleDays = Math.ceil(canvasWidth / zoom) + 2;
  const startOffset = oldStartOffset(scrollX, zoom);
  const density = gridDensityForZoom(zoom);
  const xs: number[] = [];
  for (let i = -1; i < visibleDays; i++) {
    const date = addCalendarDays(viewStart, startOffset + i);
    if (density === 'week' && date.getUTCDay() !== 1) continue;
    if (density === 'month' && date.getUTCDate() !== 1) continue;
    xs.push(oldDateToXWithScroll(date, viewStart, 0, zoom, scrollX));
  }
  return xs;
}

const RENDER_CASES: Array<{ canvasWidth: number; zoom: number; scrollX: number }> = [
  { canvasWidth: 1200, zoom: 22, scrollX: 0 },
  { canvasWidth: 1200, zoom: 22, scrollX: 137 },
  { canvasWidth: 1200, zoom: 7.5, scrollX: 950.5 },
  { canvasWidth: 1200, zoom: 100, scrollX: 0 },
  { canvasWidth: 800, zoom: 40, scrollX: 63 },
];

for (const c of RENDER_CASES) {
  const actual = renderedGridDays(c.canvasWidth, c.zoom, c.scrollX);
  const expected = expectedGridX(c.canvasWidth, c.zoom, c.scrollX);
  checks++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    diffs.push(
      `live-render grid-lijnen wijken af voor ${JSON.stringify(c)}: kreeg ${actual.length} lijnen, verwacht ${expected.length}` +
      (actual.length === expected.length ? ` — eerste afwijking bij index ${actual.findIndex((v, i) => v !== expected[i])}` : ''),
    );
  }
}

const sourceRoot = process.cwd();
const originContractFiles = [
  'src/components/canvas/GanttCanvas.tsx',
  'src/components/canvas/MiniMap.tsx',
  'src/components/canvas/ganttRenderOptions.ts',
  'src/components/canvas/hooks/useBarDrag.ts',
  'src/components/canvas/hooks/useBoxSelect.ts',
  'src/components/canvas/hooks/useCanvasLayer.ts',
  'src/components/canvas/hooks/useDependencyDraw.ts',
  'src/components/canvas/hooks/usePan.ts',
  'src/engine/renderer/GanttRenderer.ts',
  'src/engine/renderer/HistogramRenderer.ts',
  'src/engine/renderer/timeAxis.ts',
  'src/engine/renderer/workdayAxis.ts',
  'src/hooks/useGanttZoom.ts',
  'src/hooks/useZoomShortcuts.ts',
  'src/utils/ganttViewport.ts',
];
const oldOriginHits = originContractFiles.filter(file =>
  fs.readFileSync(path.join(sourceRoot, file), 'utf8').includes('taskTableWidth'),
);
eq('oude taskTableWidth-naam ontbreekt in alle timeline-, as-, gesture- en histogramcode',
  JSON.stringify(oldOriginHits), JSON.stringify([]));
const histogramSource = fs.readFileSync(
  path.join(sourceRoot, 'src/engine/renderer/HistogramRenderer.ts'),
  'utf8',
);
eq('HistogramRenderer leidt zijn indeling exact eenmaal van pickerWidth en pickerSide af',
  (histogramSource.match(/histogramLayout\(opts\.canvasWidth,\s*opts\.pickerWidth,\s*opts\.pickerSide\)/g) ?? []).length, 1);
eq('HistogramRenderer leidt chartOriginX exact eenmaal van het plotbegin af',
  (histogramSource.match(/chartOriginX\s*=\s*this\.layout\.plot\.left/g) ?? []).length, 1);
eq('HistogramRenderer schrijft chartOriginX nergens rechtstreeks als pickerWidth',
  /chartOriginX\s*=\s*opts\.pickerWidth/.test(histogramSource), false);
const viewportCoordinatorSource = fs.readFileSync(
  path.join(sourceRoot, 'src/components/canvas/hooks/useGanttViewportCoordinator.ts'),
  'utf8',
);
eq('histogramas in de viewportcoördinator begint op het plotbegin van dezelfde indeling',
  /chartOriginX:\s*histogramPlotInsets\(input\.histogramPickerWidth,\s*input\.histogramPickerSide\)\.left/
    .test(viewportCoordinatorSource), true);

if (diffs.length === 0) {
  console.log(`OK  axis-consolidation: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  axis-consolidation: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 40)) console.log(`   - ${d}`);
  process.exit(1);
}
