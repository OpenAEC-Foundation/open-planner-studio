const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer, gridDensityForZoom } from '@/engine/renderer/GanttRenderer';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq<T>(label: string, actual: T, expected: T): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${String(actual)}, verwacht ${String(expected)}`);
}

interface Seg { x1: number; y1: number; x2: number; y2: number; stroke: string; lineWidth: number }
function makeCtx(): { ctx: CanvasRenderingContext2D; segs: Seg[] } {
  const segs: Seg[] = [];
  let pts: { x: number; y: number }[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: () => { pts = []; },
    closePath: noop,
    moveTo: (x: number, y: number) => { pts.push({ x, y }); },
    lineTo: (x: number, y: number) => { pts.push({ x, y }); },
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop,
    fill: noop,
    stroke: function (this: { strokeStyle: string; lineWidth: number }) {
      if (pts.length === 2) {
        segs.push({ x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y, stroke: this.strokeStyle, lineWidth: this.lineWidth });
      }
    },
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [],
    fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, segs };
}

const GRID = '#EDF0F5';

eq('zoom 20 ⇒ dagraster', gridDensityForZoom(20), 'day');
eq('zoom 8 (ondergrens) ⇒ dagraster', gridDensityForZoom(8), 'day');
eq('zoom 7,99 ⇒ weekraster', gridDensityForZoom(7.99), 'week');
eq('zoom 6 ⇒ weekraster', gridDensityForZoom(6), 'week');
eq('zoom 2 (ondergrens) ⇒ weekraster', gridDensityForZoom(2), 'week');
eq('zoom 1,5 ⇒ maandraster', gridDensityForZoom(1.5), 'month');

const FIXED_START = '2026-01-05';
S().newProject();
S().addTask({ name: 'Raster' });
S().runCPM();
const base: Task = {
  ...S().tasks[0],
  time: {
    ...S().tasks[0].time,
    scheduleStart: FIXED_START, scheduleFinish: '2026-01-09',
    earlyStart: FIXED_START, earlyFinish: '2026-01-09',
    lateStart: FIXED_START, lateFinish: '2026-01-09',
  },
};
const rows: ViewRow[] = [{ kind: 'task', rowKey: base.id, task: base, depth: 0, dimmed: false }];

const W = 700, H = 400, ROWH = 28, HDRH = 60;

function visibleDates(zoom: number): Date[] {
  const visibleDays = Math.ceil(W / zoom) + 2;
  const out: Date[] = [];
  for (let i = -1; i < visibleDays; i++) {
    const d = new Date(Date.UTC(2026, 0, 5));
    d.setUTCDate(d.getUTCDate() + i);
    out.push(d);
  }
  return out;
}

function verticalGridLines(zoom: number): Seg[] {
  const { ctx, segs } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows,
    sequences: [],
    calendar: st.calendar,
    view: { ...st.view, scrollX: 0, scrollY: 0, zoom, viewStartDate: FIXED_START },
    selectedTaskIds: [],
    canvasWidth: W,
    canvasHeight: H,
    rowHeight: ROWH,
    headerHeight: HDRH,
  }).render();
  return segs.filter((s) => s.stroke === GRID && s.x1 === s.x2 && s.y1 !== s.y2);
}

{
  const lines = verticalGridLines(20);
  const dates = visibleDates(20);
  eq('zoom 20: één verticale rasterlijn per kalenderdag', lines.length, dates.length);
  const dik = lines.filter((l) => l.lineWidth === 1).length;
  const maandagen = dates.filter((d) => d.getUTCDay() === 1).length;
  eq('zoom 20: dikke weekgrenslijnen = aantal maandagen', dik, maandagen);
  ok('zoom 20: de overige lijnen zijn dun (0,5)', lines.filter((l) => l.lineWidth === 0.5).length === dates.length - maandagen);
  ok('zoom 20: 7 lijnen per week', Math.abs(lines.length / (dates.length / 7) - 7) < 1e-9);
}

{
  const lines = verticalGridLines(6);
  const dates = visibleDates(6);
  const maandagen = dates.filter((d) => d.getUTCDay() === 1);
  eq('zoom 6: uitsluitend weekgrenzen', lines.length, maandagen.length);
  ok('zoom 6: elke lijn is een volle (1 px) weeklijn', lines.every((l) => l.lineWidth === 1));
  const gaps = lines.slice(1).map((l, i) => l.x1 - lines[i].x1);
  ok('zoom 6: lijnafstand = 7 dagen (42 px)', gaps.every((gp) => Math.abs(gp - 7 * 6) < 1e-6));
  ok('zoom 6: 1 lijn per week', Math.abs(lines.length / (dates.length / 7) - 1) < 0.05);
}

{
  const lines = verticalGridLines(1.5);
  const dates = visibleDates(1.5);
  const eersten = dates.filter((d) => d.getUTCDate() === 1);
  eq('zoom 1,5: uitsluitend maandgrenzen', lines.length, eersten.length);
  ok('zoom 1,5: elke lijn is een volle (1 px) maandlijn', lines.every((l) => l.lineWidth === 1));
  const gaps = lines.slice(1).map((l, i) => l.x1 - lines[i].x1);
  ok('zoom 1,5: lijnafstand = 28..31 dagen', gaps.every((gp) => gp >= 28 * 1.5 - 0.25 && gp <= 31 * 1.5 + 0.25));
  ok('zoom 1,5: veel minder dan 1 lijn per week', lines.length < dates.length / 7 / 3);
}

function compressedGridLines(
  zoom: number,
  weekDays: number[],
  weekStartDay: 'monday' | 'sunday',
): Seg[] {
  const { ctx, segs } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows,
    sequences: [],
    calendar: { ...st.calendar, workDays: weekDays, holidays: [] },
    view: { ...st.view, scrollX: 0, scrollY: 0, zoom, viewStartDate: FIXED_START },
    selectedTaskIds: [],
    canvasWidth: W,
    canvasHeight: H,
    rowHeight: ROWH,
    headerHeight: HDRH,
    compressNonWorkdays: true,
    weekStartDay,
  }).render();
  return segs.filter((sg) => sg.stroke === GRID && sg.x1 === sg.x2 && sg.y1 !== sg.y2);
}

function compressedColumns(zoom: number): number {
  return Math.ceil(W / zoom) + 2 + 1;
}

for (const scenario of [
  { label: 'ma-vr, week begint zondag', weekDays: [1, 2, 3, 4, 5], wsd: 'sunday' as const, perWeek: 5 },
  { label: 'ma-vr, week begint maandag', weekDays: [1, 2, 3, 4, 5], wsd: 'monday' as const, perWeek: 5 },
  { label: 'di-za, week begint maandag', weekDays: [2, 3, 4, 5, 6], wsd: 'monday' as const, perWeek: 5 },
]) {
  const lines = compressedGridLines(6, scenario.weekDays, scenario.wsd);
  ok(`gecomprimeerd (${scenario.label}), zoom 6: er zijn rasterlijnen`, lines.length > 0);
  const kolommen = compressedColumns(6);
  const verwachteWeken = kolommen / scenario.perWeek;
  ok(
    `gecomprimeerd (${scenario.label}), zoom 6: één lijn per week (${lines.length} vs ~${verwachteWeken.toFixed(1)})`,
    Math.abs(lines.length - verwachteWeken) <= 1,
  );
  ok(`gecomprimeerd (${scenario.label}), zoom 6: elke lijn is een volle (1 px) weeklijn`, lines.every((l) => l.lineWidth === 1));
  const gaps = lines.slice(1).map((l, i) => l.x1 - lines[i].x1);
  ok(
    `gecomprimeerd (${scenario.label}), zoom 6: lijnafstand = ${scenario.perWeek} werkdagkolommen`,
    gaps.every((gp) => Math.abs(gp - scenario.perWeek * 6) < 1e-6),
  );

  const dagLines = compressedGridLines(12, scenario.weekDays, scenario.wsd);
  const dagKolommen = compressedColumns(12);
  eq(`gecomprimeerd (${scenario.label}), zoom 12: één lijn per werkdagkolom`, dagLines.length, dagKolommen);
  const dik = dagLines.filter((l) => l.lineWidth === 1);
  ok(`gecomprimeerd (${scenario.label}), zoom 12: er zijn dikke (1 px) weekscheidingen`, dik.length > 0);
  ok(
    `gecomprimeerd (${scenario.label}), zoom 12: één dikke lijn per week (${dik.length} vs ~${(dagKolommen / scenario.perWeek).toFixed(1)})`,
    Math.abs(dik.length - dagKolommen / scenario.perWeek) <= 1,
  );
  ok(
    `gecomprimeerd (${scenario.label}), zoom 12: de overige lijnen zijn dun (0,5)`,
    dagLines.filter((l) => l.lineWidth === 0.5).length === dagLines.length - dik.length,
  );
  const dikGaps = dik.slice(1).map((l, i) => l.x1 - dik[i].x1);
  ok(
    `gecomprimeerd (${scenario.label}), zoom 12: dikke lijnen ${scenario.perWeek} kolommen uit elkaar`,
    dikGaps.every((gp) => Math.abs(gp - scenario.perWeek * 12) < 1e-6),
  );
}

if (diffs.length === 0) {
  console.log(`OK  gantt-grid-density: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  gantt-grid-density: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
