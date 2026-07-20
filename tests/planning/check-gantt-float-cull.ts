// Gantt-cull-regressie: de SPELING-BAND mag niet verdwijnen zolang hij zichtbaar is.
//
// Bug (gerapporteerd, gereproduceerd): `drawTaskBar` cullde op de extent van de BALK
// (`x2 < taskTableWidth`), terwijl de speling-band ná de balk doorloopt tot `x2 + floatWidth`.
// Zodra de balk links buiten beeld schoof verdween daardoor ook een band die nog honderden
// pixels in beeld stond.
//
// Deze batterij draait de ECHTE GanttRenderer met een opnemende 2D-context-stub en toetst per
// horizontale scrollpositie de invariant:
//
//     band getekend  ⟺  rechterrand van de band ligt nog op/voorbij taskTableWidth
//
// De verwachte bandpositie wordt zelf-gekalibreerd op scrollX=0 (bandpositie schuift 1:1 met
// scrollX), dus de test blijft kloppen als zoom/kalender/lay-out veranderen.
//
// Draait via run.sh. Exit 0 = alles groen.

// ── DOM-stubs (vóór het instantiëren): de renderer leest themakleuren via
//    getComputedStyle(document.documentElement); zonder stub gooit dat in Node.
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

// ── Opnemende 2D-context-stub ────────────────────────────────────────────────
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

// De stub geeft fillStyle letterlijk terug (geen canvas-normalisatie naar rgba()), en met de
// lege getComputedStyle-stub valt de float-kleur terug op de hardcoded default.
const FLOAT_FILL = '#059669E6';
const isFloat = (fill: string) => fill.toUpperCase() === FLOAT_FILL.toUpperCase();

// ── Scenario: één taak met speling naast een langere kritieke taak ───────────
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
S().addSequence({ predecessorId: a.id, successorId: c.id, type: 'FINISH_START' });
S().addSequence({ predecessorId: b.id, successorId: c.id, type: 'FINISH_START' });
S().runCPM();

const floatTask = S().tasks.find((t) => t.id === a.id)!;
checks++;
if (!(floatTask.time.totalFloat > 0)) {
  diffs.push(`opzet: taak zonder speling (totalFloat=${floatTask.time.totalFloat}) — scenario ongeldig`);
}
checks++;
if (floatTask.time.isCritical) diffs.push('opzet: speling-taak is kritiek — scenario ongeldig');

// ── Renderen per scrollX ─────────────────────────────────────────────────────
const W = 1200, H = 600, TTW = 300;
function bandAt(scrollX: number): { x: number; right: number } | null {
  const { ctx, rects } = makeCtx();
  const st = S();
  new GanttRenderer(ctx, {
    rows: st.viewRows,
    sequences: st.sequences,
    calendar: st.calendar,
    view: { ...st.view, scrollX, scrollY: 0 },
    selectedTaskIds: [],
    collapsedTaskIds: [],
    canvasWidth: W,
    canvasHeight: H,
    taskTableWidth: TTW,
    rowHeight: 28,
    headerHeight: 60,
  }).render();
  const fl = rects.filter((r) => isFloat(r.fill));
  return fl.length ? { x: fl[0].x, right: fl[0].x + fl[0].w } : null;
}

// Kalibreer op scrollX = 0: daar staat de band gegarandeerd volledig in beeld.
const base = bandAt(0);
checks++;
if (!base) {
  diffs.push('kalibratie: geen speling-band getekend bij scrollX=0 — renderer/scenario klopt niet');
} else {
  // De band schuift 1:1 mee met scrollX ⇒ verwachte rechterrand = base.right - scrollX.
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

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  gantt-float-cull: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  gantt-float-cull: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
