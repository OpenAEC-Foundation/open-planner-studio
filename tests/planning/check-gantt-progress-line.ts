// Voortgangslijn (fase 2.6, §6.3): of een rij uitstulpt, hangt af van een DAGNIVEAU-vergelijking
// tussen de balk en de statusdatum. Die vergelijking rekende met LOKALE getters
// (`new Date(d.getFullYear(), d.getMonth(), d.getDate())`) tegen een statusdatum op UTC-middernacht,
// zodat de lijn per tijdzone van de machine anders liep: in een zone vóór UTC (Auckland, maar ook
// Amsterdam) valt de lokale middernacht van 2026-06-10 op 2026-06-09 in UTC, dus een uurtaak die
// pas op de statusdag start telde als "al begonnen" en trok de lijn naar zijn balkstart. De
// tijdzone-matrix in run.sh draait deze check onder vijf zones; de engine rekent overal in UTC.
//
// Draait via run.sh. Exit 0 = alles groen.

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
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}

interface Pt { kind: 'M' | 'L'; x: number; y: number }
/** Legt alleen padpunten vast die getekend worden terwijl er een streepjespatroon actief is: de
 *  voortgangslijn (en de statusdatumlijn), niet de balken, labels of vinkjes. */
function makeCtx(): { ctx: CanvasRenderingContext2D; lines: Pt[] } {
  const lines: Pt[] = [];
  const noop = () => {};
  let dashed = false;
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: (x: number, y: number) => { if (dashed) lines.push({ kind: 'M', x, y }); },
    lineTo: (x: number, y: number) => { if (dashed) lines.push({ kind: 'L', x, y }); },
    arc: noop, arcTo: noop, ellipse: noop, rect: noop, roundRect: noop,
    fill: noop, stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop,
    setLineDash: (d: number[]) => { dashed = d.length > 0; }, getLineDash: () => [],
    fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, lines };
}

S().newProject();
S().addTask({ name: 'Basis' });
const template = S().tasks[0];
const STATUS = '2026-06-10';

function task(id: string, start: string, finish: string, completion: number): Task {
  return {
    ...template,
    id,
    childIds: [],
    time: {
      ...template.time,
      scheduleStart: start, scheduleFinish: finish,
      earlyStart: start, earlyFinish: finish,
      lateStart: start, lateFinish: finish,
      completion,
    },
  } as Task;
}

const tasks = [
  // Start op de statusdag om 08:00 UTC, nog niet begonnen ⇒ rechte lijn.
  task('uur-niet-gestart', '2026-06-10T08:00', '2026-06-10T16:00', 0),
  // Voltooid op de statusdag om 20:00 UTC ⇒ rechte lijn.
  task('uur-voltooid', '2026-06-10T12:00', '2026-06-10T20:00', 1),
  // Positieve controle: halverwege en over de statusdatum heen ⇒ stulpt uit.
  task('dag-halverwege', '2026-06-08', '2026-06-12', 0.5),
];
const rows: ViewRow[] = tasks.map(t => ({ kind: 'task', rowKey: t.id, task: t, depth: 0, dimmed: false }));

const ROWH = 28, HDRH = 60;
const view = { ...S().view, scrollX: 0, scrollY: 0, viewStartDate: '2026-06-01' };
const { ctx, lines } = makeCtx();
new GanttRenderer(ctx, {
  rows,
  sequences: [],
  calendar: S().calendar,
  view,
  selectedTaskIds: [],
  statusDate: STATUS,
  showProgressLine: true,
  canvasWidth: 1600,
  canvasHeight: 400,
  rowHeight: ROWH,
  headerHeight: HDRH,
}).render();

/** Per rij tekent de voortgangslijn óf een recht stuk `statusX` van rowTop naar rowBottom, óf een
 *  uitstulping: twee stukken die op de voortgangspunt (rowMid) BEGINNEN en naar de statusdatumlijn
 *  lopen. Geeft progressX − statusX terug (0 = recht), of null als de rij geen lijn kreeg. */
function bend(row: number): number | null {
  const top = HDRH + row * ROWH;
  const mid = top + ROWH / 2;
  const atTop = lines.find(p => p.y === top);
  if (!atTop) return null;
  const atMid = lines.find(p => p.y === mid);
  return atMid ? atMid.x - atTop.x : 0;
}

eq('Uurtaak die pas op de statusdag start: rechte lijn (tijdzone-onafhankelijk)', bend(0), 0);
eq('Uurtaak die op de statusdag voltooid is: rechte lijn (tijdzone-onafhankelijk)', bend(1), 0);
const control = bend(2);
eq('Controle: een half voltooide taak stulpt uit', control !== null && control !== 0, true);
// De uitstulping begint met een moveTo OP de punt: dan begint het streepjespatroon daar, en staat er
// altijd een streepje precies op de voortgangsgrens van de balk (zie drawProgressLine).
const tip = lines.find(p => p.y === HDRH + 2 * ROWH + ROWH / 2);
eq('Uitstulping begint op de voortgangspunt', tip?.kind, 'M');

if (diffs.length === 0) {
  console.log(`OK  gantt-progress-line: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  gantt-progress-line: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
