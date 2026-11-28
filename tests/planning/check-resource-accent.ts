import { useAppStore } from '@/state/appStore';
import { paletteColorForId } from '@/engine/renderer/resourcePalette';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { barLayout } from '@/engine/renderer/rowGeometry';
import { doneBarTones } from '@/engine/renderer/themePalette';
import type { Task } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { BarColorSelection } from '@/types/barColor';

const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

const S = () => useAppStore.getState();

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };

interface Rect { x: number; y: number; w: number; h: number; color: string; }
interface RoundShape { x: number; y: number; w: number; h: number; fill: string; stroke: string; }
function makeCtx(): { ctx: CanvasRenderingContext2D; fillRects: Rect[]; shapes: RoundShape[]; polys: RoundShape[] } {
  const fillRects: Rect[] = [];
  const shapes: RoundShape[] = [];
  const polys: RoundShape[] = [];
  let path: { x: number; y: number }[] = [];
  const st = { fillStyle: '', strokeStyle: '' };
  const noop = () => {};
  const ctx = {
    lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    set fillStyle(v: string) { st.fillStyle = v; }, get fillStyle() { return st.fillStyle; },
    set strokeStyle(v: string) { st.strokeStyle = v; }, get strokeStyle() { return st.strokeStyle; },
    fillRect: (x: number, y: number, w: number, h: number) => { fillRects.push({ x, y, w, h, color: st.fillStyle }); },
    strokeRect: noop, clearRect: noop, beginPath: () => { path = []; }, closePath: noop,
    moveTo: (x: number, y: number) => { path.push({ x, y }); },
    lineTo: (x: number, y: number) => { path.push({ x, y }); },
    arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, y: number, w: number, h: number) => { shapes.push({ x, y, w, h, fill: st.fillStyle, stroke: st.strokeStyle }); },
    fill: () => {
      if (path.length < 3) return;
      const xs = path.map(p => p.x), ys = path.map(p => p.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      polys.push({ x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, fill: st.fillStyle, stroke: st.strokeStyle });
    },
    stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [], fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fillRects, shapes, polys };
}

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
  const { ctx, fillRects, shapes, polys } = makeCtx();
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
  return { fillRects, shapes, polys };
}

const ACCENT_H = barLayout(ROWH).accentHeight;
const accents = (rects: Rect[]) => rects.filter(r => r.h === ACCENT_H && r.y > HDRH);

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

{
  const { fillRects, polys } = render(true, { baseline: true });
  const a = accents(fillRects);
  const baseline = polys.find(sh => sh.fill === '#1F2937' && sh.h < 10);
  ok(a.length === 2, `baseline-combinatie: beide accentsegmenten aanwezig (got ${a.length})`);
  ok(!!baseline, 'baseline-combinatie: baseline aanwezig');
  if (a.length > 0 && baseline) {
    ok(baseline.y >= a[0].y + a[0].h,
      `baseline-combinatie: geen overlap (accent eindigt ${a[0].y + a[0].h}, baseline begint ${baseline.y})`);
    ok(baseline.y + baseline.h <= HDRH + ROWH,
      `baseline-combinatie: gestapelde baseline blijft binnen de rij (eindigt ${baseline.y + baseline.h}, rij eindigt ${HDRH + ROWH})`);
  }
  const alone = render(false, { baseline: true }).polys.find(sh => sh.fill === '#1F2937' && sh.h < 10);
  ok(!!alone && Math.abs(alone.h - barLayout(ROWH).baselineHeight) < 1e-9, 'baseline-hoogte zonder accent volgt barLayout');
  ok(!!baseline && Math.abs(baseline.h - barLayout(ROWH).baselineHeight) < 1e-9,
    `baseline-hoogte met accent is dezelfde als zonder (got ${baseline?.h})`);
  ok(!!alone && alone.y + alone.h <= HDRH + ROWH, 'baseline zonder accent blijft binnen de rij');
}

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

{
  const colored = { ...task, id: task.id + '-kleur', color: '#00FF00' } as Task;
  const { shapes } = render(false, { task: colored, selection: { mode: 'critical' } });
  const bars = shapes.filter(sh => sh.h > 10 && sh.h < 20 && sh.w > 3 && sh.x >= -1);
  ok(bars.every(b => b.fill !== '#00FF00'), 'legacy Task.color verandert de critical-vulling niet');
}

const barShapes = (shapes: RoundShape[]) => shapes.filter(sh => sh.h > 10 && sh.h < 20 && sh.w > 3 && sh.x >= -1);
{
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
  ok(bars.some(b => b.stroke === '#DC2626'), 'scherm Resource-categorie: rode rand om kritieke taak');
}
{
  const { shapes } = render(false, { selection: { mode: 'auto' } });
  const bars = barShapes(shapes);
  ok(bars.some(b => b.fill === paletteColorForId(task.id)), `scherm auto-modus: balk in hash-kleur (fills: ${[...new Set(bars.map(b => b.fill))].join(', ')})`);
}
{
  const { shapes } = render(false, { selection: { mode: 'category', field: { src: 'builtin', key: 'taskType' } } });
  const bars = barShapes(shapes);
  ok(bars.some(b => b.fill === '#1E293B'), 'scherm Task-Type-categorie: CONSTRUCTION gebruikt vaste paletkleur');
}
{
  const { shapes } = render(false, { selection: { mode: 'category', field: { src: 'resource' } }, darkTheme: true });
  const bars = barShapes(shapes);
  const lum = (hex: string): number => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  ok(bars.length > 0 && bars.every(b => lum(b.fill) >= 0.33), `scherm resource-modus donker: elke vulling zichtbaar (fills: ${[...new Set(bars.map(b => b.fill))].join(', ')})`);
}
{
  const { shapes } = render(false);
  const bars = barShapes(shapes);
  ok(!bars.some(b => b.fill === paletteColorForId(task.id)), 'default: geen moduskleuren');
}

{
  const half: Task = { ...task, time: { ...task.time, completion: 0.6 } };
  const { shapes } = render(false, { task: half, selection: { mode: 'category', field: { src: 'resource' } } });
  const fills = new Set(barShapes(shapes).map(b => b.fill.toLowerCase()));
  const p1 = doneBarTones('#111111', false).fill.toLowerCase();
  const p2 = doneBarTones('#222222', false).fill.toLowerCase();
  ok(fills.has(p1) && fills.has(p2),
    `scherm resource-modus: voortgang per segment in eigen afgeleide kleur (${p1}, ${p2}; fills: ${[...fills].join(', ')})`);
  ok(!fills.has('rgba(0, 0, 0, 0.25)'), 'scherm resource-modus: geen vaste 25%-zwartlaag meer');
  ok(fills.has('#222222'), `scherm resource-modus: tweede stuk houdt rechts van de voortgang zijn kleur (fills: ${[...fills].join(', ')})`);
}

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
