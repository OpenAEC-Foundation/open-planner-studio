const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type { Task } from '@/types/task';
import type { ViewRow } from '@/engine/view/visibleRows';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

interface RRect { x: number; y: number; w: number; h: number }
interface TextCall { text: string; x: number; y: number }
function makeCtx(): { ctx: CanvasRenderingContext2D; roundRects: RRect[]; texts: TextCall[] } {
  const roundRects: RRect[] = [];
  const texts: TextCall[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, y: number, w: number, h: number) => { roundRects.push({ x, y, w, h }); },
    fill: noop, stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [],
    fillText: (text: string, x: number, y: number) => { texts.push({ text: String(text), x, y }); },
    strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, roundRects, texts };
}

const FIXED_MONDAY = '2026-01-05';
S().newProject();
S().setProject({ startDate: FIXED_MONDAY });
S().addTask({ name: 'Gewoon' });
S().runCPM();

const FIXED_START = '2026-01-05';
const FIXED_FINISH = '2026-01-09';
const base: Task = {
  ...S().tasks[0],
  time: {
    ...S().tasks[0].time,
    scheduleStart: FIXED_START,
    scheduleFinish: FIXED_FINISH,
    earlyStart: FIXED_START,
    earlyFinish: FIXED_FINISH,
    lateStart: FIXED_START,
    lateFinish: FIXED_FINISH,
  },
};

const msWithDuration: Task = {
  ...base,
  id: 'ms-met-duur',
  isMilestone: true,
  time: {
    ...base.time,
    scheduleDuration: 5,
    earlyStart: base.time.earlyStart || base.time.scheduleStart,
    earlyFinish: base.time.earlyFinish || base.time.scheduleFinish,
  },
} as Task;
{
  const startIso = (msWithDuration.time.earlyStart || '').slice(0, 10);
  if (startIso) {
    const d = new Date(`${startIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    const finishIso = d.toISOString().slice(0, 10);
    msWithDuration.time.earlyFinish = finishIso;
    msWithDuration.time.scheduleFinish = finishIso;
  }
}

const realMs: Task = {
  ...base,
  id: 'ms-echt',
  isMilestone: true,
  time: { ...base.time, scheduleDuration: 0 },
} as Task;

const rows: ViewRow[] = [
  { kind: 'task', rowKey: base.id, task: base, depth: 0, dimmed: false },
  { kind: 'task', rowKey: msWithDuration.id, task: msWithDuration, depth: 0, dimmed: false },
  { kind: 'task', rowKey: realMs.id, task: realMs, depth: 0, dimmed: false },
];

const W = 1200, H = 600, TTW = 0, ROWH = 28, HDRH = 60;
const st = S();
const view = { ...st.view, scrollX: 0, scrollY: 0, viewStartDate: FIXED_START };

const { ctx, roundRects } = makeCtx();
const renderer = new GanttRenderer(ctx, {
  rows,
  sequences: [],
  calendar: st.calendar,
  view,
  selectedTaskIds: [],
  statusDate: view.viewStartDate,
  showProgressLine: false,
  canvasWidth: W,
  canvasHeight: H,
  rowHeight: ROWH,
  headerHeight: HDRH,
});

let renderError: unknown = null;
try {
  renderer.render();
} catch (err) {
  renderError = err;
}
ok(`render() gooit niet: ${String(renderError)}`, renderError === null);

if (renderError === null) {
  const barTop = (i: number) => HDRH + i * ROWH;
  const inRow = (r: { y: number }, i: number) => r.y >= barTop(i) && r.y < barTop(i + 1);

  const msWithDurationBars = roundRects.filter(r => inRow(r, 1));
  ok('mijlpaal-met-duur (rij 1): balk (roundRect) getekend, niet een ruit', msWithDurationBars.length > 0);

  const realMsBars = roundRects.filter(r => inRow(r, 2));
  ok('echte mijlpaal (rij 2): GEEN balk-roundRect (blijft een ruit)', realMsBars.length === 0);

  const rowMidY = (i: number) => HDRH + i * ROWH + ROWH / 2;
  const rectWithDuration = renderer.getTaskBarRect('ms-met-duur');
  ok(`mijlpaal-met-duur: getTaskBarRect levert een balk (kreeg: ${JSON.stringify(rectWithDuration)})`, rectWithDuration !== null);
  const hitX = rectWithDuration ? (rectWithDuration.left + rectWithDuration.right) / 2 : TTW + 20;
  const hitWithDuration = renderer.getTaskBarBounds(hitX, rowMidY(1));
  ok(`mijlpaal-met-duur: getTaskBarBounds accepteert haar (kreeg: ${JSON.stringify(hitWithDuration && { edge: hitWithDuration.edge })})`, hitWithDuration !== null && hitWithDuration.task.id === 'ms-met-duur' && hitWithDuration.edge === 'body');
  const realRect = renderer.getTaskBarRect('ms-echt');
  const realHit = realRect && renderer.getTaskBarBounds((realRect.left + realRect.right) / 2, rowMidY(2));
  ok(`echte mijlpaal: getTaskBarBounds geeft alleen een verplaatsgreep (kreeg: ${JSON.stringify(realHit && { edge: realHit.edge })})`,
    realHit?.task.id === 'ms-echt' && realHit.edge === 'body');
}

if (diffs.length === 0) {
  console.log(`OK  milestone-duration-render: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  milestone-duration-render: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
