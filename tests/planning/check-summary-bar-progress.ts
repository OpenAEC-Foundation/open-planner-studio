// Voortgang op samenvattingsbalken (discussie #175: "an immediate overall picture of project
// progress"). Net als bij een taakbalk wordt het voltooide deel van een fase grijs
// (`paintProgressBarPiece` + `doneBarTones`), op het scherm (GanttRenderer) én op de afdruk
// (printPreview).
//
// Draait de ECHTE renderers met een opnemende 2D-context. Exit 0 = alles groen.

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { doneBarTones, readGanttPalette, PRINT_PALETTE } from '@/engine/renderer/themePalette';
import { renderReport } from '@/services/print/printPreview';
import type { Draw2D } from '@/services/pdf/draw2d';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task } from '@/types/task';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

interface Fill { x: number; w: number; style: string }

/** Canvas-stub: elke `fill()` legt de fillStyle en de laatste roundRect vast. */
function makeCtx(): { ctx: CanvasRenderingContext2D; fills: Fill[] } {
  const fills: Fill[] = [];
  const noop = () => {};
  let last: { x: number; w: number } | null = null;
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: () => { last = null; }, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, _y: number, w: number) => { last = { x, w }; },
    fill: () => { if (last) fills.push({ ...last, style: String(ctx.fillStyle) }); },
    stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [], fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills };
}

// ── Scène: één fase (samenvatting) op 40% ────────────────────────────────────
S().newProject();
S().addTask({ name: 'Basis' });
const template = S().tasks[0];
const START = '2026-06-01';
const FINISH = '2026-06-12';
function summary(completion: number): Task {
  return {
    ...template,
    id: 'fase',
    name: 'Fase',
    isSummary: true,
    childIds: ['kind'],
    time: {
      ...template.time,
      scheduleStart: START, scheduleFinish: FINISH,
      earlyStart: START, earlyFinish: FINISH, lateStart: START, lateFinish: FINISH,
      completion,
    },
  } as Task;
}

function renderScreen(task: Task): Fill[] {
  const { ctx, fills } = makeCtx();
  const st = S();
  const rows: ViewRow[] = [{ kind: 'task', rowKey: task.id, task, depth: 0, dimmed: false }];
  new GanttRenderer(ctx, {
    rows,
    sequences: [],
    calendar: st.calendar,
    view: { ...st.view, scrollX: 0, scrollY: 0, zoom: 20, viewStartDate: '2026-05-25' },
    selectedTaskIds: [],
    showStatusDateLine: false,
    showProgressLine: false,
    canvasWidth: 1200,
    canvasHeight: 300,
    rowHeight: 32,
    headerHeight: 60,
  }).render();
  return fills;
}

const SUMMARY = readGanttPalette().summary;
const GREY = doneBarTones(SUMMARY, false).fill;

{
  const fills = renderScreen(summary(0.4));
  const grey = fills.find(f => f.style === GREY);
  const base = fills.find(f => f.style === SUMMARY);
  ok(`scherm, 40%: grijs voltooid deel aanwezig (${fills.map(f => f.style).join(', ')})`, !!grey);
  ok('scherm, 40%: rest in de samenvattingskleur', !!base);
  if (grey && base) {
    const total = (base.x + base.w) - grey.x;
    ok(`scherm, 40%: grijs beslaat ≈ 40% (${(grey.w / total * 100).toFixed(1)}%)`, Math.abs(grey.w / total - 0.4) < 0.03);
  }
}
{
  const fills = renderScreen(summary(0));
  ok('scherm, 0%: geen grijs', !fills.some(f => f.style === GREY));
}
{
  const fills = renderScreen(summary(1));
  ok('scherm, 100%: wel grijs, geen samenvattingskleur meer in de balk',
    fills.some(f => f.style === GREY) && !fills.some(f => f.style === SUMMARY && f.w > 10));
}

// ── Afdruk ──────────────────────────────────────────────────────────────────
function renderPrint(task: Task, showCompletion: boolean): Fill[] {
  const fills: Fill[] = [];
  const noop = () => {};
  let last: { x: number; w: number } | null = null;
  const d2d = {
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: 'left', textBaseline: 'middle',
    setLineDash: noop, fillRect: noop, strokeRect: noop,
    beginPath: () => { last = null; }, moveTo: noop, lineTo: noop, closePath: noop,
    fill: () => { if (last) fills.push({ ...last, style: String(d2d.fillStyle) }); },
    stroke: noop,
    roundRect: (x: number, _y: number, w: number) => { last = { x, w }; },
    fillText: noop, measureText: (t: string) => ({ width: String(t).length * 6 }),
  } as unknown as Draw2D;
  renderReport(() => d2d, [task], [], S().calendar, 'P', {
    paperSize: 'A3', orientation: 'landscape', showDeps: false, showCritical: true,
    showTaskNames: false, showCompletion, autoFit: true, showFloat: false, showLegend: false,
    companyName: '',
  } as never);
  return fills;
}
{
  const PGREY = doneBarTones(PRINT_PALETTE.summary, false).fill;
  const on = renderPrint(summary(0.4), true);
  ok(`afdruk, 40% en voltooiing aan: grijs voltooid deel (${on.map(f => f.style).join(', ')})`, on.some(f => f.style === PGREY));
  ok('afdruk, 40%: rest in de afdruk-samenvattingskleur', on.some(f => f.style === PRINT_PALETTE.summary));
  const off = renderPrint(summary(0.4), false);
  ok('afdruk, voltooiing uit: geen grijs', !off.some(f => f.style === PGREY));
}

if (diffs.length === 0) {
  console.log(`OK  summary-bar-progress: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  summary-bar-progress: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
