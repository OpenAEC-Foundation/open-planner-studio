// Issue #114 (manuvarkey): "Predecessors/Successors colour not being set". De trace-tint (goud voor
// voorgangers, paars voor opvolgers) werd wél als balkkleur gezet, maar in de standaard kleurmodus
// tekende de voortgangsvulling daarna `normalLight`-blauw (of `criticalLight`-rood) over de balk —
// bij een voltooide taak dus de héle balk. Precies de voorbeeldprojecten (status-datum in het verleden,
// vroege taken 100 %) toonden zo geen enkele trace-kleur; alleen het dimmen van de rest was zichtbaar.
//
// Sinds de balkweergave van oktober 2026 wordt voltooid werk grijs (`doneBarTones`). Dat grijs mag
// de trace NIET wegpoetsen: in een trace wint de trace-tint, ook op een voltooide taak.
//
// Deze batterij draait de ECHTE GanttRenderer met een opnemende 2D-context over één voltooide
// voorganger + focus-taak, met de trace aan, en eist dat de rij van de voorganger in de trace-tint
// zelf getekend wordt, zonder grijs en zonder standaardkleur. Zonder trace tekent een voltooide
// taak het grijs van zijn eigen standaardkleur (regressie-anker).
//
// Draait via run.sh. Exit 0 = alles groen.

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { GANTT_TRACE_COLORS, doneBarTones, readGanttPalette } from '@/engine/renderer/themePalette';
import { buildTrace } from '@/engine/taskGrid/trace';
import type { ViewRow } from '@/engine/view/visibleRows';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

// Opnemende context: elke `fill()` legt de op dat moment actieve fillStyle + laatste roundRect vast.
interface Fill { x: number; y: number; w: number; h: number; style: string }
function makeCtx(): { ctx: CanvasRenderingContext2D; fills: Fill[] } {
  const fills: Fill[] = [];
  const noop = () => {};
  let last: { x: number; y: number; w: number; h: number } | null = null;
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: () => { last = null; }, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, y: number, w: number, h: number) => { last = { x, y, w, h }; },
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

// ── Scenario: voltooide voorganger → focus-taak (beide 100 %) ────────────────
S().newProject();
S().addTask({ name: 'Voorganger' });
S().addTask({ name: 'Focus' });
const [predId, focusId] = S().tasks.map(t => t.id);
S().addSequence({ predecessorId: predId, successorId: focusId, type: 'FINISH_START', lagDays: 0 });
S().updateTask(predId, { time: { ...S().tasks[0].time, completion: 1 } });
S().updateTask(focusId, { time: { ...S().tasks[1].time, completion: 1 } });
S().runCPM();

const st = S();
const rows: ViewRow[] = st.tasks.map(task => ({ kind: 'task', rowKey: task.id, task, depth: 0, dimmed: false }));
const ROWH = 28, HDRH = 60;
const inRow = (f: Fill, i: number) => f.y >= HDRH + i * ROWH && f.y + f.h <= HDRH + (i + 1) * ROWH;
// Voltooid zonder trace = het grijs van de standaardkleur (`doneBarTones`, licht thema).
const PAL = readGanttPalette();
const GREY = [doneBarTones(PAL.normal, false).fill, doneBarTones(PAL.critical, false).fill].map(c => c.toLowerCase());
const STANDARD = [PAL.normal, PAL.critical].map(c => c.toLowerCase());

function render(traceMode: 'off' | 'predecessors' | 'successors'): Fill[] {
  const { ctx, fills } = makeCtx();
  const focus = traceMode === 'successors' ? predId : focusId;
  const renderer = new GanttRenderer(ctx, {
    rows,
    sequences: st.sequences,
    calendar: st.calendar,
    view: { ...st.view, scrollX: 0, scrollY: 0 },
    selectedTaskIds: [focus],
    trace: buildTrace(traceMode, [focus], st.sequences, st.cpmResult),
    canvasWidth: 1200,
    canvasHeight: 400,
    rowHeight: ROWH,
    headerHeight: HDRH,
  });
  renderer.render();
  return fills;
}

// Regressie-anker: zonder trace tekent een voltooide taak het grijs van zijn standaardkleur.
const off = render('off').filter(f => inRow(f, 0));
ok(`zonder trace: voltooide balk is grijs (${off.map(f => f.style).join(', ')})`, off.some(f => GREY.includes(f.style.toLowerCase())));

// Predecessors: rij 0 (de voorganger) krijgt de goudtint, zonder grijs of standaardkleur.
const pred = render('predecessors').filter(f => inRow(f, 0));
const GOLD = [GANTT_TRACE_COLORS.predecessor, GANTT_TRACE_COLORS.predecessorDriving].map(c => c.toLowerCase());
ok(`predecessors: voorgangerbalk tekent in de trace-goudtint (${pred.map(f => f.style).join(', ')})`, pred.some(f => GOLD.includes(f.style.toLowerCase())));
ok(
  `predecessors: voltooide voorganger wordt grijs of standaardkleur over de trace-tint (${pred.map(f => f.style).join(', ')})`,
  !pred.some(f => GREY.includes(f.style.toLowerCase()) || STANDARD.includes(f.style.toLowerCase())),
);

// Successors (focus = voorganger): rij 1 (de opvolger) idem in paars.
const succ = render('successors').filter(f => inRow(f, 1));
const PURPLE = [GANTT_TRACE_COLORS.successor, GANTT_TRACE_COLORS.successorDriving].map(c => c.toLowerCase());
ok(`successors: opvolgerbalk tekent in de trace-paarstint (${succ.map(f => f.style).join(', ')})`, succ.some(f => PURPLE.includes(f.style.toLowerCase())));
ok(
  `successors: voltooide opvolger wordt grijs of standaardkleur over de trace-tint (${succ.map(f => f.style).join(', ')})`,
  !succ.some(f => GREY.includes(f.style.toLowerCase()) || STANDARD.includes(f.style.toLowerCase())),
);

if (diffs.length === 0) {
  console.log(`check-gantt-trace-progress: ${checks} checks, alles groen`);
} else {
  for (const d of diffs) console.log(`XX ${d}`);
  console.log(`check-gantt-trace-progress: ${diffs.length}/${checks} checks rood`);
  process.exit(1);
}
