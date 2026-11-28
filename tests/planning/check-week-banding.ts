const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {}, createElement: () => ({ getContext: () => null }) };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { readGanttPalette } from '@/engine/renderer/themePalette';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { resolveGanttAxis } from '@/engine/renderer/workdayAxis';
import { getWeekNumberFor, formatDate } from '@/utils/dateUtils';

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean, detail = ''): void {
  checks++;
  if (!cond) diffs.push(`${label}${detail ? `: ${detail}` : ''}`);
}

const BAND = '#0e0e01';
const WEEKEND = '#0e0e02';
const palette = {
  ...readGanttPalette(),
  gridWeekBand: BAND,
  gridWeekend: WEEKEND,
};

interface RectOp { x: number; y: number; w: number; h: number; color: string }
function makeCtx(): { ctx: CanvasRenderingContext2D; rects: RectOp[] } {
  const rects: RectOp[] = [];
  const noop = () => {};
  const st = { fillStyle: '' };
  const ctx = {
    get fillStyle() { return st.fillStyle; }, set fillStyle(v: string) { st.fillStyle = v; },
    strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: (x: number, y: number, w: number, h: number) => { rects.push({ x, y, w, h, color: st.fillStyle }); },
    strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop, fill: noop, stroke: noop,
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [],
    fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}

const S = () => useAppStore.getState();
S().newProject();
const cal = createDefaultCalendar(2026);
if (cal.holidays.length === 0) {
  cal.holidays.push({ name: 'Test-feestdag', startDate: '2026-04-27', endDate: '2026-04-27' });
}
S().setCalendar(cal);
S().addTask({ name: 'Lange taak' });
const [ta] = S().tasks;
S().updateTask(ta.id, { time: { ...S().tasks[0].time, scheduleStart: '2026-01-01', scheduleDuration: 400 } });
S().runCPM();

const W = 1200, H = 600, HEADER_H = 44;
const VIEW_START = '2026-03-02';

function renderRects(zoom: number, scrollX: number, compress: boolean, weekStartDay: 'monday' | 'sunday'): RectOp[] {
  const { ctx, rects } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: st.viewRows,
    sequences: st.sequences,
    calendar: st.calendar,
    view: { ...st.view, zoom, scrollX, scrollY: 0, viewStartDate: VIEW_START },
    selectedTaskIds: [],
    canvasWidth: W,
    canvasHeight: H,
    rowHeight: 28,
    headerHeight: HEADER_H,
    compressNonWorkdays: compress,
    weekStartDay,
    palette,
  }).render();
  return rects;
}

function visibleWorkdayColumns(zoom: number, scrollX: number): { x: number; date: Date }[] {
  const engine = new CalendarEngine(S().calendar);
  const axis = resolveGanttAxis({
    calendar: engine,
    compressNonWorkdays: true,
    origin: new Date(VIEW_START + 'T00:00:00.000Z'),
    chartOriginX: 0,
    zoom,
    scrollX,
  });
  const visibleDays = Math.ceil(W / zoom) + 2;
  const startIdx = Math.floor(axis.dayIndexOf(new Date(VIEW_START + 'T00:00:00.000Z')) + scrollX / zoom);
  const cols: { x: number; date: Date }[] = [];
  for (let i = -1; i < visibleDays; i++) {
    const date = axis.dateAtIndex(startIdx + i);
    cols.push({ x: axis.dateToX(date), date });
  }
  return cols;
}

const ZOOMS = [10, 26, 45];
const SCROLLS = [0, 500, 1500, 4000, 9000];

for (const wsd of ['monday', 'sunday'] as const) {
  for (const zoom of ZOOMS) {
    for (const scrollX of SCROLLS) {
      const rects = renderRects(zoom, scrollX, true, wsd);
      const bandXs = new Set(rects.filter((r) => r.color === BAND).map((r) => Math.round(r.x * 100) / 100));
      const cols = visibleWorkdayColumns(zoom, scrollX);

      let sawBanded = false;
      let sawPlain = false;
      for (const col of cols) {
        const banded = bandXs.has(Math.round(col.x * 100) / 100);
        const odd = getWeekNumberFor(col.date, wsd) % 2 === 1;
        ok(
          `band ⇔ oneven week (wsd=${wsd} z=${zoom} sx=${scrollX} d=${formatDate(col.date)})`,
          banded === odd,
          `banded=${banded}, weeknr=${getWeekNumberFor(col.date, wsd)}`,
        );
        if (banded) sawBanded = true; else sawPlain = true;
      }
      ok(`beide pariteiten zichtbaar (wsd=${wsd} z=${zoom} sx=${scrollX})`, sawBanded && sawPlain);
      ok(
        `geen weekend-fill onder compressie (wsd=${wsd} z=${zoom} sx=${scrollX})`,
        rects.every((r) => r.color !== WEEKEND),
      );
    }
  }
}

for (const zoom of ZOOMS) {
  for (const scrollX of SCROLLS) {
    const rects = renderRects(zoom, scrollX, false, 'monday');
    ok(
      `geen weekband zonder compressie (z=${zoom} sx=${scrollX})`,
      rects.every((r) => r.color !== BAND),
      `${rects.filter((r) => r.color === BAND).length} band-fills gevonden`,
    );
    ok(
      `weekend-arcering aanwezig zonder compressie (z=${zoom} sx=${scrollX})`,
      rects.some((r) => r.color === WEEKEND),
    );
  }
}

for (const zoom of ZOOMS) {
  const perScroll = SCROLLS.map((sx) => {
    const rects = renderRects(zoom, sx, true, 'monday');
    const bandXs = new Set(rects.filter((r) => r.color === BAND).map((r) => Math.round(r.x * 100) / 100));
    const byDate = new Map<string, boolean>();
    for (const col of visibleWorkdayColumns(zoom, sx)) {
      byDate.set(formatDate(col.date), bandXs.has(Math.round(col.x * 100) / 100));
    }
    return byDate;
  });
  for (let a = 0; a < perScroll.length; a++) {
    for (let b = a + 1; b < perScroll.length; b++) {
      for (const [dateStr, banded] of perScroll[a]) {
        const other = perScroll[b].get(dateStr);
        if (other === undefined) continue;
        ok(
          `scroll-invariant (z=${zoom} sx=${SCROLLS[a]}↔${SCROLLS[b]} d=${dateStr})`,
          banded === other,
        );
      }
    }
  }
}

if (diffs.length === 0) {
  console.log(`OK  week-banding: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  week-banding: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 40)) console.log(`   - ${d}`);
  process.exit(1);
}
