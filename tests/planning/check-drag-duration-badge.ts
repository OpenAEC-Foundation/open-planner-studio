// Issue #51 — live duur-pilletje tijdens het rekken van een taakbalk.
//
// De renderer zet, zolang `opts.durationDrag` gevuld is, een compact duur-chipje tegen de
// gesleepte balkrand. Alles wat daaraan mis kan gaan is GEOMETRIE (waar landt het pilletje bij een
// smalle balk, bij een balk tegen de vensterrand, bij een weggescrolde rij) en de EENHEID (een
// uur-taak mag geen "1d" tonen). Beide zijn hier headless te toetsen met de echte GanttRenderer.
//
// Meetmethode: render TWEE keer met een opnemende 2D-context — één keer zónder `durationDrag`, één
// keer mét — en neem het VERSCHIL in getekende ops. Wat erbij komt ís het pilletje. Zo hoeft deze
// test niets te weten van de rest van de tekenlaag en blijft hij groen als daar iets verandert.
//
// Draait via run.sh. Exit 0 = alles groen.

// ── DOM-stubs vóór de imports: de renderer leest themakleuren via getComputedStyle. ──
// De accent-vars krijgen SENTINEL-waarden. Zo bewijst de kleurcontrole hieronder dat het pilletje
// zijn kleuren echt uit `--theme-accent`/`--theme-accent-on` haalt (dus per thema meebeweegt) en
// niet uit een hardgecodeerde hex of een andere paletrol. Alle overige vars blijven leeg ⇒ de rest
// van de tekenlaag valt terug op zijn defaults, precies als in de andere renderer-checks.
const ACCENT = '#AA1111';       // sentinel voor --theme-accent
const ACCENT_ON = '#22BB22';    // sentinel voor --theme-accent-on
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({
  getPropertyValue: (name: string) =>
    name === '--theme-accent' ? ACCENT : name === '--theme-accent-on' ? ACCENT_ON : '',
});

import { useAppStore } from '@/state/appStore';
import { GanttRenderer, type GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { WorkCalendar } from '@/types/calendar';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}
function near(label: string, actual: number, expected: number, tol = 0.51): void {
  checks++;
  if (!(Math.abs(actual - expected) <= tol)) diffs.push(`${label}: kreeg ${actual}, verwacht ≈${expected}`);
}

// ── Opnemende 2D-context-stub ────────────────────────────────────────────────
// `measureText` geeft 6px per teken — dezelfde afspraak als check-gantt-float-cull, zodat de
// verwachte pilbreedte in deze test gewoon uit te rekenen is.
const CHAR_W = 6;
interface RoundRect { kind: 'roundRect'; x: number; y: number; w: number; h: number }
interface FillText { kind: 'fillText'; text: string; x: number; y: number; style: string }
interface Fill { kind: 'fill'; style: string }
interface Stroke { kind: 'stroke'; style: string }
type Op = RoundRect | FillText | Fill | Stroke;

function makeCtx(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, y: number, w: number, h: number) => { ops.push({ kind: 'roundRect', x, y, w, h }); },
    // `fill`/`stroke` nemen de op dát moment ingestelde stijl mee — zo is de KLEUR van het pilletje
    // toetsbaar (de vulling wordt gezet ná `roundRect`, dus die kan er niet in).
    fill: () => { ops.push({ kind: 'fill', style: String((ctx as { fillStyle: string }).fillStyle) }); },
    stroke: () => { ops.push({ kind: 'stroke', style: String((ctx as { strokeStyle: string }).strokeStyle) }); },
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop,
    rotate: noop, setLineDash: noop, getLineDash: () => [],
    fillText: (text: string, x: number, y: number) => {
      ops.push({ kind: 'fillText', text, x, y, style: String((ctx as { fillStyle: string }).fillStyle) });
    },
    strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * CHAR_W }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

const CANVAS_W = 900;
const CANVAS_H = 300;
const TABLE_W = 300;
const ROW_H = 28;
const HEADER_H = 50;

function baseOpts(rows: ViewRow[], zoom: number, scrollX: number, extra: Partial<GanttRenderOptions> = {}): GanttRenderOptions {
  const st = S();
  return {
    rows,
    sequences: [],
    calendar: st.calendar,
    view: { ...st.view, zoom, scrollX, scrollY: 0, viewStartDate: '2026-08-01' },
    selectedTaskIds: [],
    collapsedTaskIds: [],
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    taskTableWidth: TABLE_W,
    rowHeight: ROW_H,
    headerHeight: HEADER_H,
    ...extra,
  };
}

/** Render één keer zónder en één keer mét `durationDrag`; geef de ERBIJ gekomen ops terug. */
function badgeOps(opts: GanttRenderOptions, drag: GanttRenderOptions['durationDrag']): Op[] {
  const a = makeCtx();
  new GanttRenderer(a.ctx, { ...opts, durationDrag: undefined }).render();
  const b = makeCtx();
  new GanttRenderer(b.ctx, { ...opts, durationDrag: drag }).render();
  const baseline = a.ops.map((o) => JSON.stringify(o));
  const seen = new Map<string, number>();
  for (const k of baseline) seen.set(k, (seen.get(k) ?? 0) + 1);
  const extra: Op[] = [];
  for (const op of b.ops) {
    const k = JSON.stringify(op);
    const n = seen.get(k) ?? 0;
    if (n > 0) seen.set(k, n - 1);
    else extra.push(op);
  }
  return extra;
}

/** Het pilletje = precies één roundRect + één vulling + één randje + één fillText. */
function badge(opts: GanttRenderOptions, drag: GanttRenderOptions['durationDrag'], label: string) {
  const extra = badgeOps(opts, drag);
  const rects = extra.filter((o): o is RoundRect => o.kind === 'roundRect');
  const texts = extra.filter((o): o is FillText => o.kind === 'fillText');
  const fills = extra.filter((o): o is Fill => o.kind === 'fill');
  eq(`${label}: aantal extra roundRects`, rects.length, 1);
  eq(`${label}: aantal extra fillTexts`, texts.length, 1);
  // De accentkleur is een BINDENDE eigenaarskeuze (issue #51, tweede ronde): het pilletje draagt
  // het OpenAEC-accent, niet een neutrale/thema-omgekeerde tint. Beide kleuren moeten uit de
  // CSS-vars komen, dus de sentinels hierboven.
  eq(`${label}: vulling = accentkleur`, fills[0]?.style, ACCENT);
  eq(`${label}: tekstkleur = accent-on`, texts[0]?.style, ACCENT_ON);
  // Scheidend randje: de gesleepte balk is ALTIJD ook de geselecteerde balk, en die draagt een
  // selectiering in diezelfde accentkleur. Valt het randje weg (of krijgt het de accentkleur), dan
  // vloeien pil en ring aan de balkrand in elkaar over.
  const strokes = extra.filter((o): o is Stroke => o.kind === 'stroke');
  checks++;
  if (!strokes.some((s) => s.style !== ACCENT)) {
    diffs.push(`${label}: pil heeft geen contrasterend randje (alle strokes ${JSON.stringify(strokes.map((s) => s.style))})`);
  }
  return { rect: rects[0], text: texts[0] };
}

// ── Scenario-opbouw ──────────────────────────────────────────────────────────
S().newProject();
S().addTask({ name: 'Brede taak' });
S().addTask({ name: 'Smalle taak' });
const [wide, narrow] = S().tasks;

function setDates(id: string, start: string, finish: string, days: number): void {
  const t = S().tasks.find((x) => x.id === id)!;
  S().updateTask(id, {
    time: { ...t.time, scheduleStart: start, scheduleFinish: finish, earlyStart: start, earlyFinish: finish, scheduleDuration: days },
  });
}
setDates(wide.id, '2026-08-03', '2026-08-14', 10);
setDates(narrow.id, '2026-08-03', '2026-08-03', 1);

const rowsOf = (...ids: string[]): ViewRow[] =>
  ids.map((id) => ({ kind: 'task', task: S().tasks.find((t) => t.id === id)!, depth: 0, dimmed: false }) as ViewRow);

// Kalender-as (geen compressie): x = TABLE_W + dagen-sinds-2026-08-01 × zoom − scrollX.
const MS = 86400000;
const dayX = (iso: string, zoom: number, scrollX: number) =>
  TABLE_W + ((Date.parse(`${iso}T00:00:00Z`) - Date.parse('2026-08-01T00:00:00Z')) / MS) * zoom - scrollX;

const PAD_X = 5;      // GanttRenderer.DRAG_BADGE_PAD_X
const GAP = 4;        // GanttRenderer.DRAG_BADGE_GAP
const BADGE_H = 16;   // GanttRenderer.DRAG_BADGE_H
const wOf = (label: string) => label.length * CHAR_W + PAD_X * 2;

// ── 1. Rechterrand van een BREDE balk: pilletje net BINNEN de balk ───────────
{
  const zoom = 30;
  const opts = baseOpts(rowsOf(wide.id), zoom, 0);
  const x2 = dayX('2026-08-14', zoom, 0) + zoom;
  const b = badge(opts, { taskId: wide.id, edge: 'right' }, 'breed/rechts');
  eq('breed/rechts: label', b.text.text, '10d');
  near('breed/rechts: rechterrand pil', b.rect.x + b.rect.w, x2 - GAP);
  eq('breed/rechts: pilbreedte', b.rect.w, wOf('10d'));
  eq('breed/rechts: pilhoogte', b.rect.h, BADGE_H);
  // Verticaal gecentreerd op de balk (balkhoogte = rowHeight/2, rij 0).
  near('breed/rechts: pil-y', b.rect.y, HEADER_H + (ROW_H - ROW_H / 2) / 2 + (ROW_H / 2 - BADGE_H) / 2);
}

// ── 2. Rechterrand van een SMALLE balk: past niet binnenin ⇒ er net BUITEN ───
{
  const zoom = 8; // 1 dag = 8px, het pilletje is breder dan de balk
  const opts = baseOpts(rowsOf(narrow.id), zoom, 0);
  const x2 = dayX('2026-08-03', zoom, 0) + zoom;
  const b = badge(opts, { taskId: narrow.id, edge: 'right' }, 'smal/rechts');
  eq('smal/rechts: label', b.text.text, '1d');
  near('smal/rechts: linkerrand pil', b.rect.x, x2 + GAP);
}

// ── 3. Linkerrand: pilletje BUITEN de balk (binnenin dekt het het naamlabel) ──
{
  const zoom = 30;
  const opts = baseOpts(rowsOf(wide.id), zoom, 0);
  const x1 = dayX('2026-08-03', zoom, 0);
  const b = badge(opts, { taskId: wide.id, edge: 'left' }, 'breed/links');
  near('breed/links: rechterrand pil', b.rect.x + b.rect.w, x1 - GAP);
}

// ── 4. Balk tegen de LINKER chart-rand: pil geklemd, nooit over de taaktabel ──
{
  const zoom = 30;
  const scrollX = dayX('2026-08-03', zoom, 0) - TABLE_W; // balkstart exact op de chart-rand
  const opts = baseOpts(rowsOf(wide.id), zoom, scrollX);
  const b = badge(opts, { taskId: wide.id, edge: 'left' }, 'linkerrand');
  checks++;
  if (b.rect.x < TABLE_W) diffs.push(`linkerrand: pil begint op ${b.rect.x}, dus links van de taaktabelgrens ${TABLE_W}`);
}

// ── 5. Balk voorbij de RECHTER vensterrand: pil geklemd binnen het canvas ────
{
  const zoom = 30;
  // Schuif zo dat de rechterrand van de balk 10px BUITEN het canvas valt.
  const scrollX = dayX('2026-08-14', zoom, 0) + zoom - (CANVAS_W + 10);
  const opts = baseOpts(rowsOf(wide.id), zoom, scrollX);
  const b = badge(opts, { taskId: wide.id, edge: 'right' }, 'rechterrand');
  checks++;
  if (b.rect.x + b.rect.w > CANVAS_W) diffs.push(`rechterrand: pil loopt tot ${b.rect.x + b.rect.w}, voorbij canvasbreedte ${CANVAS_W}`);
  near('rechterrand: pil geklemd', b.rect.x + b.rect.w, CANVAS_W - 2);
}

// ── 6. Weggescrolde rij: geen pilletje ───────────────────────────────────────
{
  const opts = baseOpts(rowsOf(wide.id), 30, 0, { view: { ...S().view, zoom: 30, scrollX: 0, scrollY: 5000, viewStartDate: '2026-08-01' } });
  const extra = badgeOps(opts, { taskId: wide.id, edge: 'right' });
  eq('weggescrolde rij: geen extra ops', extra.length, 0);
}

// ── 7. Onbekende taak-id: geen pilletje (geen crash) ─────────────────────────
{
  const opts = baseOpts(rowsOf(wide.id), 30, 0);
  eq('onbekend id: geen extra ops', badgeOps(opts, { taskId: 'bestaat-niet', edge: 'right' }).length, 0);
}

// ── 8. Vertaalde dag-afkorting: het pilletje is de ENIGE eenheidsaanduiding ───
{
  const opts = baseOpts(rowsOf(wide.id), 30, 0, { durationSuffixes: { day: 'j', hour: 'h', minute: 'm' } });
  const b = badge(opts, { taskId: wide.id, edge: 'right' }, 'suffix');
  eq('suffix: vertaalde dag-afkorting', b.text.text, '10j');
}

// ── 9. UUR-taak: nooit "1d", ook niet met de urenplanning-schakelaar UIT ─────
// (`useBarDrag.handleHourDrag` muteert `durationMinutes`; `scheduleDuration` staat dan stil.)
{
  S().addTask({ name: 'Uurtaak' });
  const hourTask = S().tasks[S().tasks.length - 1];
  const bands = [{ start: 480, end: 720 }, { start: 780, end: 1020 }]; // 08:00-12:00 / 13:00-17:00
  const hourCal: WorkCalendar = {
    id: 'cal-uur', name: 'Uurkalender', description: '', workDays: [1, 2, 3, 4, 5],
    workStartHour: 8, workEndHour: 17, hoursPerDay: 8, holidays: [],
    workTime: { byWeekday: { 1: bands, 2: bands, 3: bands, 4: bands, 5: bands, 6: [], 7: [] } },
  };
  const t = S().tasks.find((x) => x.id === hourTask.id)!;
  S().updateTask(hourTask.id, {
    calendarId: 'cal-uur',
    time: {
      ...t.time, scheduleStart: '2026-08-03T08:00', scheduleFinish: '2026-08-03T17:00',
      earlyStart: '2026-08-03T08:00', earlyFinish: '2026-08-03T17:00',
      durationUnit: 'hours', scheduleDuration: 1, durationMinutes: 300,
    },
  });
  const effectiveCalById = new Map<string, WorkCalendar>([[hourTask.id, hourCal]]);

  for (const enableHourPlanning of [false, true]) {
    const opts = baseOpts(rowsOf(hourTask.id), 300, 0, { effectiveCalById, enableHourPlanning });
    const b = badge(opts, { taskId: hourTask.id, edge: 'right' }, `uurtaak(hp=${enableHourPlanning})`);
    eq(`uurtaak(hp=${enableHourPlanning}): label in uren`, b.text.text, '5h');
  }
}

// ── Uitkomst ─────────────────────────────────────────────────────────────────
if (diffs.length) {
  for (const d of diffs) console.log(`   XX ${d}`);
  console.log(`XX duur-pil (#51): ${diffs.length} afwijking(en) van ${checks} checks`);
  process.exit(1);
}
console.log(`OK duur-pil (#51): ${checks} checks groen`);
