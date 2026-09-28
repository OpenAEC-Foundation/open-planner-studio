// Relatiepijlen op uurtaken ankeren op de BALKranden — de ECHTE GanttRenderer met een opnemende
// 2D-context-stub (zelfde opzet als check-arrow-routing.ts). Vóór de fix rekende de pijl ook bij een
// uurtaak met `parseDate` + één dagcel: een FS-pijl vertrok aan het einde van de DAG i.p.v. aan het
// einde van de balk (14:00) en kwam aan op het BEGIN van de dag i.p.v. op de balkstart (15:00) — op
// zoom 48 px/dag zo'n 20 px ernaast. Dagtaken blijven op de dagcelranden (check-arrow-routing).
//
// Draait via run.sh. Exit 0 = alles groen.
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { readGanttPalette } from '@/engine/renderer/themePalette';

const S = () => useAppStore.getState();
let checks = 0;
const fails: string[] = [];
const ok = (label: string, cond: boolean, detail = '') => { checks++; if (!cond) fails.push(`${label}${detail ? `: ${detail}` : ''}`); };

const BAR = new Set(['#b0b0b0', '#b1b1b1']);
const ARROW = new Set(['#a0a0a0', '#b0b0b0']);
const palette = {
  ...readGanttPalette(), normal: '#b1b1b1', critical: '#b0b0b0', dependency: '#a0a0a0',
  normalLight: '#010101', criticalLight: '#010102', nearCritical: '#010103', milestone: '#010104',
  float: '#010105', baseline: '#010106', selected: '#010107', ghost: '#010108',
};

interface Rect { x: number; y: number; w: number; h: number }
function makeCtx() {
  const bars: Rect[] = [];
  const arrows: number[][] = [];
  let cur: number[] = [];
  let pending: Rect | null = null;
  const st = { fillStyle: '', strokeStyle: '' };
  const noop = () => {};
  const ctx = {
    get fillStyle() { return st.fillStyle; }, set fillStyle(v: string) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v: string) { st.strokeStyle = v; },
    lineWidth: 1, font: '', textAlign: '', textBaseline: '', globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    beginPath: () => { cur = []; pending = null; },
    moveTo: (x: number, y: number) => { cur.push(x, y); }, lineTo: (x: number, y: number) => { cur.push(x, y); },
    roundRect: (x: number, y: number, w: number, h: number) => { pending = { x, y, w, h }; },
    rect: (x: number, y: number, w: number, h: number) => { pending = { x, y, w, h }; },
    fill: () => { if (pending && BAR.has(String(st.fillStyle).toLowerCase())) bars.push(pending); pending = null; },
    stroke: () => { if (!pending && cur.length >= 4 && ARROW.has(String(st.strokeStyle).toLowerCase())) arrows.push(cur.slice()); pending = null; },
    closePath: noop, fillRect: noop, strokeRect: noop, clearRect: noop, arc: noop, arcTo: noop, ellipse: noop,
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop, setLineDash: noop, getLineDash: () => [],
    fillText: noop, strokeText: noop, measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }), createPattern: () => null, quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, bars, arrows };
}

S().newProject();
const a = S().addTask({ name: 'A uren' });
const b = S().addTask({ name: 'B uren' });
S().addSequence({ predecessorId: a, successorId: b, type: 'FINISH_START', lagDays: 0 });
useAppStore.setState((s) => {
  const set = (id: string, es: string, ef: string) => {
    const t = s.tasks.find((x) => x.id === id)!;
    Object.assign(t.time, { durationUnit: 'hours', earlyStart: es, earlyFinish: ef, scheduleStart: es, scheduleFinish: ef });
  };
  set(a, '2026-03-02T10:00', '2026-03-02T14:00');
  set(b, '2026-03-02T15:00', '2026-03-03T09:00');
});
S().recomputeViewRows();

const ROW = 28;
const HEADER = 50;
for (const zoom of [24, 48, 96]) {
  const { ctx, bars, arrows } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: st.viewRows, sequences: st.sequences, calendar: st.calendar,
    view: { ...st.view, zoom, scrollX: 0, scrollY: 0, viewStartDate: '2026-02-23' },
    selectedTaskIds: [], canvasWidth: 1600, canvasHeight: 300, rowHeight: ROW, headerHeight: HEADER, palette,
    barSplitMode: 'never',
  }).render();
  const rowIdx = (id: string) => st.viewRows.findIndex((r) => r.kind === 'task' && r.task.id === id);
  const inRow = (i: number) => bars.filter((r) => r.y >= HEADER + i * ROW - 1 && r.y + r.h <= HEADER + (i + 1) * ROW + 1);
  const aBars = inRow(rowIdx(a));
  const bBars = inRow(rowIdx(b));
  ok(`zoom ${zoom}: balken en één pijl opgenomen`, aBars.length > 0 && bBars.length > 0 && arrows.length === 1,
    `A ${aBars.length}, B ${bBars.length}, pijlen ${arrows.length}`);
  if (aBars.length === 0 || bBars.length === 0 || arrows.length !== 1) continue;
  const aRight = Math.max(...aBars.map((r) => r.x + r.w));
  const bLeft = Math.min(...bBars.map((r) => r.x));
  const pts = arrows[0];
  const fromX = pts[0];
  const toX = pts[pts.length - 2];
  ok(`zoom ${zoom}: pijl vertrekt op het balkeinde van A (14:00)`, Math.abs(fromX - aRight) < 0.75, `pijl ${fromX.toFixed(2)}, balk ${aRight.toFixed(2)}`);
  ok(`zoom ${zoom}: pijl komt aan op de balkstart van B (15:00)`, Math.abs(toX - bLeft) < 0.75, `pijl ${toX.toFixed(2)}, balk ${bLeft.toFixed(2)}`);
}

if (fails.length) {
  for (const f of fails) console.log(`XX ${f}`);
  console.log(`check-arrow-hour-anchor: ${fails.length}/${checks} ROOD`);
  process.exit(1);
}
console.log(`check-arrow-hour-anchor: ${checks}/${checks} groen`);
