// M3 (Opus-review T15-iteratie-2, "UI-rimpel"): een taak met `isMilestone=true` ÉN een reële duur
// ("mijlpaal-met-duur", T15 — MSP staat dit toe, zie CPMSolver.isZeroDurationMilestone) is voor de
// PLANNING geen mijlpaal. GanttRenderer moet daarom hetzelfde onderscheid maken als de solver:
//   1. `durationText` toont haar EIGEN duur, niet de hardgecodeerde "0d".
//   2. de tekendispatch kiest `drawTaskBar` (een balk, `roundRect`), niet `drawMilestone` (een ruit,
//      `moveTo`/`lineTo`/`fill`, GEEN `roundRect`) — dezelfde `roundRect`-detector als
//      check-renderer-dateless.ts gebruikt om "hier is een balk getekend" vast te stellen.
//   3. `getTaskBarBounds` (drag/resize-hittest) accepteert haar zoals elke andere balk-taak.
// Ter controle draait een ECHTE (0-duur) mijlpaal in dezelfde scène mee: die moet het OUDE gedrag
// behouden (durationText "0d", GEEN roundRect in haar rij, getTaskBarBounds weigert haar).
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

// ── Scenario: een taak met echte duur, een mijlpaal-met-duur, en een ECHTE mijlpaal ──
S().newProject();
S().addTask({ name: 'Gewoon' });
S().runCPM();
const base = S().tasks[0];

// Mijlpaal-met-duur: isMilestone=true, scheduleDuration=5 (spant meerdere dagen, zichtbaar breed
// genoeg voor een balk-roundRect). earlyStart/earlyFinish 5 dagen uit elkaar (dag-modus).
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
// Forceer een 5-dagen-venster ongeacht wat de solver voor de basistaak leverde, zodat de balk-
// breedte niet toevallig 0 is.
{
  const startIso = (msWithDuration.time.earlyStart || '').slice(0, 10);
  if (startIso) {
    const d = new Date(`${startIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7); // ruim voorbij een weekend, dag-modus
    const finishIso = d.toISOString().slice(0, 10);
    msWithDuration.time.earlyFinish = finishIso;
    msWithDuration.time.scheduleFinish = finishIso;
  }
}

// Echte (0-duur) mijlpaal: controlecase, moet het bestaande gedrag behouden.
const realMs: Task = {
  ...base,
  id: 'ms-echt',
  isMilestone: true,
  time: { ...base.time, scheduleDuration: 0 },
} as Task;

const rows: ViewRow[] = [
  { kind: 'task', task: base, depth: 0, dimmed: false },
  { kind: 'task', task: msWithDuration, depth: 0, dimmed: false },
  { kind: 'task', task: realMs, depth: 0, dimmed: false },
];

const W = 1200, H = 600, TTW = 300, ROWH = 28, HDRH = 60;
const st = S();
const view = { ...st.view, scrollX: 0, scrollY: 0 };

const { ctx, roundRects, texts } = makeCtx();
const renderer = new GanttRenderer(ctx, {
  rows,
  sequences: [],
  calendar: st.calendar,
  view,
  selectedTaskIds: [],
  collapsedTaskIds: [],
  statusDate: view.viewStartDate,
  showProgressLine: false,
  canvasWidth: W,
  canvasHeight: H,
  taskTableWidth: TTW,
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

  // 1. Mijlpaal-met-duur (rij 1): roundRect getekend ⇒ drawTaskBar, niet drawMilestone.
  const msWithDurationBars = roundRects.filter(r => inRow(r, 1));
  ok('mijlpaal-met-duur (rij 1): balk (roundRect) getekend, niet een ruit', msWithDurationBars.length > 0);

  // 2. Echte mijlpaal (rij 2): GEEN roundRect (drawMilestone tekent een ruit via moveTo/lineTo/fill).
  const realMsBars = roundRects.filter(r => inRow(r, 2));
  ok('echte mijlpaal (rij 2): GEEN balk-roundRect (blijft een ruit)', realMsBars.length === 0);

  // 3. durationText: mijlpaal-met-duur toont "5d", niet "0d"; echte mijlpaal blijft "0d".
  const msWithDurationText = texts.find(t => t.text === '5d' && inRow({ y: t.y - ROWH / 2 }, 1));
  ok(`mijlpaal-met-duur: duurtekst "5d" getekend (kreeg: ${texts.filter(t => inRow({ y: t.y - ROWH / 2 }, 1)).map(t => t.text).join(',')})`, !!msWithDurationText);
  const realMsText = texts.find(t => t.text === '0d' && inRow({ y: t.y - ROWH / 2 }, 2));
  ok(`echte mijlpaal: duurtekst blijft "0d" (kreeg: ${texts.filter(t => inRow({ y: t.y - ROWH / 2 }, 2)).map(t => t.text).join(',')})`, !!realMsText);

  // 4. getTaskBarBounds: mijlpaal-met-duur is sleep-/resize-baar zoals elke balk-taak; de echte
  //    mijlpaal blijft geweigerd (geen visuele breedte om aan te slepen).
  const rowMidY = (i: number) => HDRH + i * ROWH + ROWH / 2;
  const hitWithDuration = renderer.getTaskBarBounds(TTW + 20, rowMidY(1));
  ok(`mijlpaal-met-duur: getTaskBarBounds accepteert haar (kreeg: ${JSON.stringify(hitWithDuration && { edge: hitWithDuration.edge })})`, hitWithDuration !== null && hitWithDuration.task.id === 'ms-met-duur');
  const hitReal = renderer.getTaskBarBounds(TTW + 20, rowMidY(2));
  ok('echte mijlpaal: getTaskBarBounds weigert haar nog steeds', hitReal === null);
}

if (diffs.length === 0) {
  console.log(`OK  milestone-duration-render: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  milestone-duration-render: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
