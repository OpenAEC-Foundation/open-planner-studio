const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {}, createElement: () => ({ getContext: () => null }) };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { createDefaultCalendar } from '@/engine/calendar/defaultCalendar';
import { addCalendarDays } from '@/utils/dateUtils';
import { buildCalendarAxis } from '@/engine/renderer/workdayAxis';

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}

interface TextOp { x: number; y: number; text: string; width: number }
function makeCtx(): { ctx: CanvasRenderingContext2D; ops: TextOp[] } {
  const ops: TextOp[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop, fill: noop, stroke: noop,
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [],
    fillText: (text: string, x: number, y: number) => {
      ops.push({ x, y, text, width: String(text).length * 6 });
    },
    strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

const S = () => useAppStore.getState();
S().newProject();
const cal = createDefaultCalendar(2026);
if (cal.holidays.length === 0) {
  cal.holidays.push(
    { name: 'Kerst', startDate: '2026-12-25', endDate: '2026-12-27' },
    { name: 'Nieuwjaar', startDate: '2027-01-01', endDate: '2027-01-01' },
  );
}
S().setCalendar(cal);
S().addTask({ name: 'Lange taak' });
const [ta] = S().tasks;
S().updateTask(ta.id, { time: { ...S().tasks[0].time, scheduleStart: '2026-01-01', scheduleDuration: 500 } });
S().runCPM();

const W = 1200, H = 600, TTW = 0, HEADER_H = 44;
const VIEW_START = '2026-11-15';

function renderHeaderOps(
  zoom: number,
  scrollX: number,
  compress: boolean,
  enableQuarterHourZoom = false,
): TextOp[] {
  const { ctx, ops } = makeCtx();
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
    weekStartDay: 'monday',
    enableQuarterHourZoom,
  }).render();
  return ops.filter((o) => o.y < HEADER_H);
}

{
  const ops = renderHeaderOps(4000, 0, false, true);
  const labels = new Set(ops.map(op => op.text));
  checks++;
  if (!labels.has('00:00')) diffs.push('uurheader ontbreekt: 00:00 is niet zichtbaar op de uur-/kwartierstand');
  checks++;
  if (!labels.has('00:15')) diffs.push('kwartierheader ontbreekt: 00:15 is niet zichtbaar op de fijnste kwartierstand');
}

const ZOOMS = [8, 15, 26, 45, 60, 100];
const SCROLLS = [0, 500, 1500, 3000, 6000, 10000, 25000];

for (const zoom of ZOOMS) {
  for (const scrollX of SCROLLS) {
    const ops = renderHeaderOps(zoom, scrollX, true);

    const byY = new Map<number, TextOp[]>();
    for (const op of ops) {
      const ry = Math.round(op.y);
      if (!byY.has(ry)) byY.set(ry, []);
      byY.get(ry)!.push(op);
    }
    for (const [y, list] of byY) {
      const sorted = [...list].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        checks++;
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (cur.x < prev.x + prev.width) {
          diffs.push(
            `stapeling z=${zoom} sx=${scrollX} y=${y}: "${prev.text}"@x${prev.x.toFixed(1)}(w${prev.width}) ` +
            `overlapt "${cur.text}"@x${cur.x.toFixed(1)}`,
          );
        }
      }
    }

    const dayY = Math.max(...ops.map((o) => Math.round(o.y)));
    const dayOps = ops.filter((o) => Math.round(o.y) === dayY);
    checks++;
    if (dayOps.length === 0) {
      diffs.push(`dag-rij ontbreekt volledig: z=${zoom} sx=${scrollX} (${ops.length} header-ops totaal)`);
    } else {
      const maxX = Math.max(...dayOps.map((o) => o.x));
      const margin = Math.max(zoom * 4, 150);
      checks++;
      if (maxX < W - margin) {
        diffs.push(
          `onderste header-rij dekt canvas niet: z=${zoom} sx=${scrollX} laatste label bij x=${maxX.toFixed(1)}, ` +
          `verwacht ≥${(W - margin).toFixed(1)} (canvasWidth=${W})`,
        );
      }
    }
  }
}

const ORIGIN = new Date(VIEW_START + 'T00:00:00.000Z');
for (const zoom of ZOOMS) {
  for (const scrollX of SCROLLS) {
    const axis = buildCalendarAxis({ origin: ORIGIN, chartOriginX: TTW, zoom, scrollX });
    checks++;
    if (axis.dayIndexOf(ORIGIN) !== 0) {
      diffs.push(`CalendarAxis.dayIndexOf(origin) !== 0 bij z=${zoom} sx=${scrollX}: kreeg ${axis.dayIndexOf(ORIGIN)}`);
    }
    const startOffset = Math.floor(scrollX / zoom) - 1;
    const endOffset = Math.ceil((scrollX + W) / zoom) + 1;
    const axisStart = axis.dateAtIndex(axis.dayIndexOf(ORIGIN) + startOffset);
    const axisEnd = axis.dateAtIndex(axis.dayIndexOf(ORIGIN) + endOffset);
    const oldStart = addCalendarDays(ORIGIN, startOffset);
    const oldEnd = addCalendarDays(ORIGIN, endOffset);
    eq(`startDate as-index vs oude formule z=${zoom} sx=${scrollX}`, axisStart.getTime(), oldStart.getTime());
    eq(`endDate as-index vs oude formule z=${zoom} sx=${scrollX}`, axisEnd.getTime(), oldEnd.getTime());

    const first = renderHeaderOps(zoom, scrollX, false);
    const second = renderHeaderOps(zoom, scrollX, false);
    checks++;
    if (JSON.stringify(first) !== JSON.stringify(second)) {
      diffs.push(`compressie-uit: render niet deterministisch bij z=${zoom} sx=${scrollX}`);
    }
    checks++;
    if (first.length === 0) {
      diffs.push(`compressie-uit: geen header-ops bij z=${zoom} sx=${scrollX} — onverwacht leeg`);
    }
  }
}

if (diffs.length === 0) {
  console.log(`OK  header-compress: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  header-compress: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs.slice(0, 40)) console.log(`   - ${d}`);
  process.exit(1);
}
