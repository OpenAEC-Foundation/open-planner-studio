const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}

interface Rect { x: number; w: number; fill: string }
function makeCtx(): { ctx: CanvasRenderingContext2D; rects: Rect[] } {
  const rects: Rect[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: (x: number, _y: number, w: number, _h: number) => {
      rects.push({ x, w, fill: String((ctx as { fillStyle: string }).fillStyle) });
    },
    strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop, fill: noop, stroke: noop,
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [], fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}

const FLOAT_FILL = '#05966940';
const isFloat = (fill: string) => fill.toUpperCase() === FLOAT_FILL.toUpperCase();

S().newProject();
S().addTask({ name: 'Kort (speling)' });
S().addTask({ name: 'Lang (kritiek)' });
S().addTask({ name: 'Samenkomst' });
const [a, b, c] = S().tasks;
const setDur = (id: string, d: number) => {
  const t = S().tasks.find((x) => x.id === id)!;
  S().updateTask(id, { time: { ...t.time, scheduleDuration: d } });
};
setDur(a.id, 2);
setDur(b.id, 12);
setDur(c.id, 2);
S().addSequence({ predecessorId: a.id, successorId: c.id, type: 'FINISH_START', lagDays: 0 });
S().addSequence({ predecessorId: b.id, successorId: c.id, type: 'FINISH_START', lagDays: 0 });
S().runCPM();

const floatTask = S().tasks.find((t) => t.id === a.id)!;
checks++;
if (!(floatTask.time.totalFloat > 0)) {
  diffs.push(`opzet: taak zonder speling (totalFloat=${floatTask.time.totalFloat}) — scenario ongeldig`);
}
checks++;
if (floatTask.time.isCritical) diffs.push('opzet: speling-taak is kritiek — scenario ongeldig');

const W = 1200, H = 600, TTW = 0;
function bandAt(scrollX: number, showFloatBand?: boolean): { x: number; right: number } | null {
  const { ctx, rects } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: st.viewRows,
    sequences: st.sequences,
    calendar: st.calendar,
    view: { ...st.view, scrollX, scrollY: 0 },
    selectedTaskIds: [],
    showFloatBand,
    canvasWidth: W,
    canvasHeight: H,
    rowHeight: 28,
    headerHeight: 60,
  }).render();
  const fl = rects.filter((r) => isFloat(r.fill));
  return fl.length ? { x: fl[0].x, right: fl[0].x + fl[0].w } : null;
}

const base = bandAt(0);
checks++;
if (!base) {
  diffs.push('kalibratie: geen speling-band getekend bij scrollX=0 — renderer/scenario klopt niet');
} else {
  for (let scrollX = 0; scrollX <= 480; scrollX += 30) {
    const verwachtZichtbaar = base.right - scrollX >= TTW;
    const getekend = bandAt(scrollX) !== null;
    eq(
      `scrollX=${scrollX}: band ${verwachtZichtbaar ? 'moet zichtbaar zijn' : 'ligt buiten beeld'}`,
      getekend,
      verwachtZichtbaar,
    );
  }
}

eq('showFloatBand ontbreekt: band getekend', bandAt(0) !== null, true);
eq('showFloatBand=true: band getekend', bandAt(0, true) !== null, true);
eq('showFloatBand=false: band NIET getekend', bandAt(0, false), null);

if (diffs.length === 0) {
  console.log(`OK  gantt-float-cull: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  gantt-float-cull: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
