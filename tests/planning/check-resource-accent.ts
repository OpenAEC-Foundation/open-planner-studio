/**
 * Resource-accent op het scherm (#21 punt 1-nieuw) — regressiebatterij.
 *
 * Bewaakt: met `showResourceAccent: true` tekent de renderer onder élke bladbalk met resources een
 * dun streepje (h = 3, direct onder de balk) dat bij meerdere resources gesegmenteerd is naar rato
 * van unitsPerDay; zonder vlag (of `false`) tekent hij niets extra. Mijlpalen en samenvattingstaken
 * krijgen géén accent (geen bladbalk). De balkvulling zelf verandert nooit door de vlag — alleen
 * het streepje komt erbij (supplement, geen vervanging).
 *
 * Zelfde opzet als check-renderer-dateless.ts: de ECHTE GanttRenderer met een opnemende 2D-context-
 * stub; het accent is een fillRect (geen roundRect), dus de stub registreert fillRects.
 */
import { useAppStore } from '@/state/appStore';
import { paletteColorForId } from '@/engine/renderer/resourcePalette';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { BarColorSelection } from '@/types/barColor';

// Node-shim (zelfde als check-renderer-dateless): readGanttPalette roept
// getComputedStyle(document.documentElement); zonder stub gooit dat in Node.
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

const S = () => useAppStore.getState();

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };

// ── Opnemende 2D-context-stub (fillRects zijn het accent; roundRects de balken) ──────────────────
interface Rect { x: number; y: number; w: number; h: number; color: string; }
interface RoundShape { x: number; y: number; w: number; h: number; fill: string; stroke: string; }
function makeCtx(): { ctx: CanvasRenderingContext2D; fillRects: Rect[]; shapes: RoundShape[] } {
  // shapes: roundRect-aanroepen mét de fill/stroke-stijl die op dat moment gold (renderer zet
  // fillStyle vóór roundRect+fill, strokeStyle vóór roundRect+stroke — dus lezen op roundRect-tijd klopt).
  const fillRects: Rect[] = [];
  const shapes: RoundShape[] = [];
  const st = { fillStyle: '', strokeStyle: '' };
  const noop = () => {};
  const ctx = {
    lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    set fillStyle(v: string) { st.fillStyle = v; }, get fillStyle() { return st.fillStyle; },
    set strokeStyle(v: string) { st.strokeStyle = v; }, get strokeStyle() { return st.strokeStyle; },
    fillRect: (x: number, y: number, w: number, h: number) => { fillRects.push({ x, y, w, h, color: st.fillStyle }); },
    strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, y: number, w: number, h: number) => { shapes.push({ x, y, w, h, fill: st.fillStyle, stroke: st.strokeStyle }); },
    fill: noop, stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [], fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fillRects, shapes };
}

// ── Fixture: echte store-taak (geldige CPM-datums) + resources 1:3 ──────────────────────────────
S().newProject();
S().addTask({ name: 'Balktaak' });
S().runCPM();
const task = S().tasks[0] as Task;

const R1: Resource = { id: 'ra1', name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 1, color: '#111111' };
const R2: Resource = { id: 'ra2', name: 'Loodgieter', type: 'LABOR', description: '', maxUnits: 1, color: '#222222' };
const ASG: ResourceAssignment[] = [
  { id: 'aa1', taskId: task.id, resourceId: 'ra1', unitsPerDay: 1 },
  { id: 'aa2', taskId: task.id, resourceId: 'ra2', unitsPerDay: 3 },
];

const W = 1200, H = 200, ROWH = 28, HDRH = 60;

function render(showResourceAccent: boolean, over: {
  darkTheme?: boolean;
  task?: Task;
  selection?: BarColorSelection;
  baseline?: boolean;
} = {}) {
  const st = S();
  const { ctx, fillRects, shapes } = makeCtx();
  const row = { kind: 'task' as const, rowKey: (over.task ?? task).id, task: over.task ?? task, depth: 0, dimmed: false };
  const renderer = new GanttRenderer(ctx, {
    rows: [row],
    sequences: [],
    calendar: st.calendar,
    view: { ...st.view, scrollX: 0, scrollY: 0 },
    selectedTaskIds: [],
    canvasWidth: W, canvasHeight: H, rowHeight: ROWH, headerHeight: HDRH,
    showResourceAccent,
    showBaselineOverlay: over.baseline,
    baselineOverlay: over.baseline
      ? new Map([[row.task.id, {
          start: row.task.time.earlyStart,
          finish: row.task.time.earlyFinish,
          isMilestone: false,
        }]])
      : undefined,
    darkTheme: over.darkTheme,
    barColorSelection: over.selection,
    activityCodeTypes: [],
    customFieldDefs: [],
    taskTypeLabels: { CONSTRUCTION: 'Constructie' },
    barColorNoneLabel: '(geen)',
    resources: [R1, R2],
    assignments: ASG,
  });
  renderer.render();
  return { fillRects, shapes };
}

// De balk zelf: rowH 28, barH ≈ 0.55×28 ≈ 15; balk-y ≈ hdrH + (rowH−barH)/2 ≈ 60 + 6.5 = 66.5.
// Het accent: y ≈ balkY + barH + 1 ≈ 82.5, h = 3 — uniek herkenbaar aan h === 3 onder de kopstrook.
// Bewust GEEN x-filter op een tabelgrens: de renderer bezit alleen de tijdlijn en een taak op de
// projectstart begint daarom op x = 0.
const accents = (rects: Rect[]) => rects.filter(r => r.h === 3 && r.y > HDRH);

{
  const { fillRects: on } = render(true);
  const a = accents(on);
  ok(a.length === 2, `accent aan: twee segmenten (1:3-verhouding), got ${a.length}`);
  if (a.length === 2) {
    ok(a[0].color === '#111111' && a[1].color === '#222222', 'accent: segmentkleuren volgen de resources');
    const total = a[0].w + a[1].w;
    ok(Math.abs(a[0].w / total - 0.25) < 0.03, `accent: verhouding ≈ 25/75 (got ${(a[0].w / total * 100).toFixed(1)}%)`);
    ok(Math.abs(a[1].x - (a[0].x + a[0].w)) < 1.5, 'accent: segmenten aaneengesloten');
  }
}
{
  const { fillRects: off } = render(false);
  ok(accents(off).length === 0, 'accent uit: geen streepjes');
}

// Baseline en resource-accent zijn twee onafhankelijke onderbalken. Als beide aan staan, mogen ze
// elkaar niet bedekken: de baseline begint pas onder het volledige 3px-resource-accent.
{
  const { fillRects, shapes } = render(true, { baseline: true });
  const a = accents(fillRects);
  const baseline = shapes.find(sh => sh.fill === '#6B7280' && sh.h < 10);
  ok(a.length === 2, `baseline-combinatie: beide accentsegmenten aanwezig (got ${a.length})`);
  ok(!!baseline, 'baseline-combinatie: baseline aanwezig');
  if (a.length > 0 && baseline) {
    ok(baseline.y >= a[0].y + a[0].h,
      `baseline-combinatie: geen overlap (accent eindigt ${a[0].y + a[0].h}, baseline begint ${baseline.y})`);
    ok(baseline.y + baseline.h <= HDRH + ROWH,
      `baseline-combinatie: gestapelde baseline blijft binnen de rij (eindigt ${baseline.y + baseline.h}, rij eindigt ${HDRH + ROWH})`);
  }
}

// ── Donker thema: te donkere resourcekleuren verlicht (#21 user-bevinding) ──────────────────────
// Slate-achtige accenten waren op de donkere werkruimte onzichtbaar — het accent tekent nu de
// verlichte variant; de EXPORT blijft de exacte kleur gebruiken (die zit in barColors/print).
{
  const { fillRects: dark } = render(true, { darkTheme: true });
  const a = accents(dark);
  ok(a.length === 2, `donker thema: accentsegmenten aanwezig (got ${a.length})`);
  const lum = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  ok(a.every(x => lum(x.color) >= 0.33), `donker thema: elk segment boven zichtbaarheidsdrempel (got ${a.map(x => x.color + ':' + lum(x.color).toFixed(2)).join(', ')})`);
  ok(a[0].color !== '#111111', 'donker thema: donkere resourcekleur daadwerkelijk verlicht');
}

// ── Legacy Task.color is inert in de gedeelde kleurkeuze ───────────────────────────────────────
{
  const colored = { ...task, id: task.id + '-kleur', color: '#00FF00' } as Task;
  const { shapes } = render(false, { task: colored, selection: { mode: 'critical' } });
  const bars = shapes.filter(sh => sh.h > 10 && sh.h < 20 && sh.w > 3 && sh.x >= -1);
  ok(bars.every(b => b.fill !== '#00FF00'), 'legacy Task.color verandert de critical-vulling niet');
}

// ── Gedeelde schermkleurkeuze: critical, auto en Group-categorie ────────────────────────────────
// Balken herkenbaar als roundRect-shapes met bar-hoogte (≈15px) in de chartzone.
const barShapes = (shapes: RoundShape[]) => shapes.filter(sh => sh.h > 10 && sh.h < 20 && sh.w > 3 && sh.x >= -1);
{
  // Resource-categorie: 1:3-toewijzing ⇒ twee segmentvullingen in de resourcekleuren.
  const { shapes } = render(false, { selection: { mode: 'category', field: { src: 'resource' } } });
  const bars = barShapes(shapes);
  const seg1 = bars.find(b => b.fill === '#111111');
  const seg2 = bars.find(b => b.fill === '#222222');
  ok(!!seg1 && !!seg2, `scherm resource-modus: beide segmenten getekend (fills: ${[...new Set(bars.map(b => b.fill))].join(', ')})`);
  if (seg1 && seg2) {
    const total = seg1.w + seg2.w;
    ok(Math.abs(seg1.w / total - 0.25) < 0.03, `scherm resource-modus: verhouding ≈ 25/75 (got ${(seg1.w / total * 100).toFixed(1)}%)`);
    ok(Math.abs(seg2.x - (seg1.x + seg1.w)) < 1.5, 'scherm resource-modus: segmenten aaneengesloten');
  }
  // Kritieke taak zonder expliciete moduskleur → rode rand.
  ok(bars.some(b => b.stroke === '#DC2626'), 'scherm Resource-categorie: rode rand om kritieke taak');
}
{
  // auto: vulling = palet-hash op taak-id (licht thema ⇒ exacte kleur).
  const { shapes } = render(false, { selection: { mode: 'auto' } });
  const bars = barShapes(shapes);
  ok(bars.some(b => b.fill === paletteColorForId(task.id)), `scherm auto-modus: balk in hash-kleur (fills: ${[...new Set(bars.map(b => b.fill))].join(', ')})`);
}
{
  // Task Type is een gewone Group-categorie; CONSTRUCTION heeft een vaste paletkleur.
  const { shapes } = render(false, { selection: { mode: 'category', field: { src: 'builtin', key: 'taskType' } } });
  const bars = barShapes(shapes);
  ok(bars.some(b => b.fill === '#1E293B'), 'scherm Task-Type-categorie: CONSTRUCTION gebruikt vaste paletkleur');
}
{
  // donker thema + Resource-categorie: segmentkleuren verlicht boven de zichtbaarheidsdrempel.
  const { shapes } = render(false, { selection: { mode: 'category', field: { src: 'resource' } }, darkTheme: true });
  const bars = barShapes(shapes);
  const lum = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  ok(bars.filter(b => b.stroke === '').every(b => lum(b.fill) >= 0.33), `scherm resource-modus donker: elke vulling zichtbaar (fills: ${[...new Set(bars.filter(b => b.stroke === '').map(b => b.fill))].join(', ')})`);
}
{
  // Zonder selectie: critical is de veilige default.
  const { shapes } = render(false);
  const bars = barShapes(shapes);
  ok(!bars.some(b => b.fill === paletteColorForId(task.id) && b.stroke === ''), 'default: geen moduskleuren');
}

// Resource accent is een onafhankelijke overlay: exact dezelfde twee strepen bij elke selectie.
for (const selection of [
  { mode: 'critical' } as const,
  { mode: 'auto' } as const,
  { mode: 'category', field: { src: 'resource' } } as const,
]) {
  const a = accents(render(true, { selection }).fillRects);
  ok(a.length === 2 && a[0].color === '#111111' && a[1].color === '#222222',
    `resource-accent blijft gelijk bij ${selection.mode}`);
}

if (failures > 0) { console.log(`resource-accent: ${failures} faalregels`); process.exit(1); }
console.log('resource-accent: alles groen');
