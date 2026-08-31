// Z15 (etappe "nul afwijkingen") — onderbroken balken in de Gantt-canvas én print/PDF.
//
// ACHTERGROND. `GanttRenderer.drawTaskBar` had de segmentmachinerie al (barGeometry → shouldSplit
// → workIntervalsBetween → segs, necking-connector, per-segment roundRect, voortgangsvulling op de
// GLOBALE progressEnd, selectiering over de volle extent) — alleen gevoed vanuit de kalender-
// necking (`barSplitMode`). Deze taak voedt `segs` daarnaast uit `Task.splitGaps` (Z4: ECHTE MS
// Project-splits, uit een .mpp-import afgeleid), met dezelfde `split`-vlag, via de gedeelde
// afleiding `computeSplitSegments` — de implementatie leeft sinds B1c-W0.4 in
// `src/engine/scheduler/splitWalk.ts`; `src/engine/renderer/splitBarGeometry.ts` is een dunne
// re-export, gebruikt door zowel `GanttRenderer` als `printPreview.ts` (via de `Draw2D`-
// abstractie: bedient zowel de rasterpreview als de vector-PDF). De semantiek van de wandeling zelf
// (H1-as, overlap-samenvoeging, taakeinde-klem, vijandige invoer) wordt getoetst in
// `check-split-walk.ts` — dit bestand toetst alleen het RENDER-specifieke gedrag (x-posities,
// rects, necking-connector, voortgangsvulling).
//
// O5 (orkestratorbesluit 2026-08-17, plan-§10): een ECHTE split tekent ALTIJD gesplitst, ongeacht
// `barSplitMode` (die blijft uitsluitend de kalender-necking sturen). Model naar
// `check-milestone-duration-render.ts`/`check-gantt-float-cull.ts`/`check-renderer-dateless.ts`:
// DOM-stubs + een opnemende 2D-context-stub (Gantt) resp. `Draw2D`-stub (print/PDF).
//
// Draait via run.sh. Exit 0 = alles groen.

// ── DOM-stubs (vóór het instantiëren): de renderer leest themakleuren via
//    getComputedStyle(document.documentElement); zonder stub gooit dat in Node.
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import type { GanttRenderOptions } from '@/engine/renderer/GanttRenderer';
import type { Task, TaskSplitGap } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { ViewRow } from '@/engine/view/visibleRows';
import { renderReport, type PrintOptions } from '@/services/print/printPreview';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import { computeSplitSegments } from '@/engine/renderer/splitBarGeometry';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { parseInstant, formatInstant } from '@/utils/dateUtils';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}
function eq(label: string, actual: unknown, expected: unknown): void {
  checks++;
  if (actual !== expected) diffs.push(`${label}: kreeg ${JSON.stringify(actual)}, verwacht ${JSON.stringify(expected)}`);
}
/** Getalvergelijking met tolerantie — voor px-posities die uit een deling volgen. */
function near(label: string, actual: number, expected: number, tol = 0.01): void {
  checks++;
  if (!(Math.abs(actual - expected) <= tol)) diffs.push(`${label}: kreeg ${actual}, verwacht ${expected} (±${tol})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Gedeeld gereedschap — de canvas-opnemer en de twee kalenders
// ═══════════════════════════════════════════════════════════════════════════

interface RRect { x: number; y: number; w: number; h: number; fillStyle: string }
interface LineEv { kind: 'move' | 'line'; x: number; y: number }
function makeCtx(): { ctx: CanvasRenderingContext2D; rects: RRect[]; lines: LineEv[] } {
  const rects: RRect[] = [];
  const lines: LineEv[] = [];
  let pending: { x: number; y: number; w: number; h: number } | null = null;
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: () => { pending = null; },
    closePath: noop,
    moveTo: (x: number, y: number) => { lines.push({ kind: 'move', x, y }); },
    lineTo: (x: number, y: number) => { lines.push({ kind: 'line', x, y }); },
    arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, y: number, w: number, h: number) => { pending = { x, y, w, h }; },
    fill: () => { if (pending) { rects.push({ ...pending, fillStyle: String((ctx as { fillStyle: string }).fillStyle) }); pending = null; } },
    stroke: noop,
    save: noop, restore: noop, clip: noop, translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [],
    fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects, lines };
}

// Uur-kalender: ma-vr 08:00-16:00 (8u/dag) — zelfde vorm als `check-project-start-anchor.ts`.
const HOUR_CAL: WorkCalendar = {
  id: 'cal-hour-z15', name: 'uur', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
  workTime: { byWeekday: {
    1: [{ start: 480, end: 960 }], 2: [{ start: 480, end: 960 }], 3: [{ start: 480, end: 960 }],
    4: [{ start: 480, end: 960 }], 5: [{ start: 480, end: 960 }], 6: [], 7: [],
  } },
};
// Dag-kalender: zelfde weekpatroon, GEEN workTime — dwingt het `addWorkingDaysSigned`-pad af i.p.v.
// `addWorkMinutes` (dat op een dag-kalender crasht, zie `splitBarGeometry.ts`'s moduleuitleg).
const DAY_CAL: WorkCalendar = {
  id: 'cal-day-z15', name: 'dag', description: '', workDays: [1, 2, 3, 4, 5],
  workStartHour: 8, workEndHour: 16, hoursPerDay: 8, holidays: [],
};

// ═══════════════════════════════════════════════════════════════════════════
// Deel 0 — `computeSplitSegments` rechtstreeks: LIGT DE AS GOED?
//
// De as-definitie (H1) staat in `TaskSplitGap`'s docblok en wordt door `splitTotalSpanMinutes`
// (`duration.ts`) al zo gelezen: `afterMinutes` is de positie van het gat op MSP's cumulatieve
// `elapsedWorkMinutes`-as, en die telt de EERDERE GATEN AL MEE. Het zuivere werksegment vóór een
// gat is dus `afterMinutes − asPositie`, met een asPositie die na elk gat naar
// `afterMinutes + gapMinutes` springt.
//
// De renderer las die as eerder fout (asPositie sprong naar `afterMinutes`, dus zónder de gatlengte
// erbij) en telde elk voorgaand gat daardoor DUBBEL. Dat is met een assertie op het AANTAL
// segmenten niet te zien — beide lezingen geven evenveel segmenten. Alleen de GRENZEN verraden het,
// en alleen bij ≥2 gaten die elkaar op de as niet overlappen. Vandaar dit blok.
// ═══════════════════════════════════════════════════════════════════════════

const dayEng = new CalendarEngine(DAY_CAL);
const hourEng = new CalendarEngine(HOUR_CAL);

/** Segmentgrenzen als `"start→eind"`-strings, zodat één `eq` de hele lijst toetst. */
function segStrings(
  gaps: TaskSplitGap[] | undefined, from: string, to: string, hourMode: boolean, eng: CalendarEngine,
): string {
  const mode = hourMode ? 'hour' : 'day';
  return computeSplitSegments(gaps, parseInstant(from), parseInstant(to), hourMode, eng)
    .map(s => `${formatInstant(s.start, mode)}→${formatInstant(s.end, mode)}`)
    .join(' | ');
}

// ── 0a. Dag-modus, twee NIET-overlappende gaten (de reviewer-reproductie) ──────────────────────
//    3 zuivere werkdagen met twee gaten van 1 dag. Op de correcte as: gat 1 op 480 (na dag 1),
//    gat 2 op 1440 (= 480 werk + 480 gat + 480 werk). CPM-spanne = 5 werkdagen ⇒ ma 06-01 t/m
//    vr 06-05. De werkblokken zijn dus ma | wo | vr, elk exact één dag.
//    De oude, foute as gaf hier 06-01→06-02, 06-03→06-05 (twéé werkdagen waar er één hoort) en
//    06-08→06-05 — een segment dat ACHTERSTEVOREN, ná het taakeinde begint.
console.log('-- split-bar-render: as-definitie (H1) bij twee niet-overlappende gaten --');
eq(
  'dag-modus, gaten {480,480}+{1440,480} ⇒ werkblokken ma | wo | vr',
  segStrings([{ afterMinutes: 480, gapMinutes: 480 }, { afterMinutes: 1440, gapMinutes: 480 }],
    '2026-06-01', '2026-06-05', false, dayEng),
  '2026-06-01→2026-06-02 | 2026-06-03→2026-06-04 | 2026-06-05→2026-06-05',
);

// ── 0b. Uur-modus, twee niet-overlappende gaten van een uur ────────────────────────────────────
//    Werk 120 | gat 60 | werk 120 | gat 60 | werk 120 op één werkdag 08:00-16:00.
//    As: gat 1 op 120, gat 2 op 300 (= 120 werk + 60 gat + 120 werk). Spanne 480 min ⇒ 08:00-16:00.
eq(
  'uur-modus, gaten {120,60}+{300,60} ⇒ 08-10 | 11-13 | 14-16',
  segStrings([{ afterMinutes: 120, gapMinutes: 60 }, { afterMinutes: 300, gapMinutes: 60 }],
    '2026-06-01T08:00', '2026-06-01T16:00', true, hourEng),
  '2026-06-01T08:00→2026-06-01T10:00 | 2026-06-01T11:00→2026-06-01T13:00 | 2026-06-01T14:00→2026-06-01T16:00',
);

// ── 0c. Drie gaten: de fout groeide met elk volgend gat (het derde segment liep bij de oude as
//    drie gatlengtes achter). Werk 60 | gat 60 | werk 60 | gat 60 | werk 60 | gat 60 | werk 60. ──
eq(
  'uur-modus, drie gaten ⇒ vier gelijke werkblokken van een uur',
  segStrings(
    [{ afterMinutes: 60, gapMinutes: 60 }, { afterMinutes: 180, gapMinutes: 60 }, { afterMinutes: 300, gapMinutes: 60 }],
    '2026-06-01T08:00', '2026-06-01T15:00', true, hourEng),
  '2026-06-01T08:00→2026-06-01T09:00 | 2026-06-01T10:00→2026-06-01T11:00 | '
  + '2026-06-01T12:00→2026-06-01T13:00 | 2026-06-01T14:00→2026-06-01T15:00',
);

// ── 0d. Volgorde-onafhankelijk: dezelfde gaten omgekeerd aangeleverd geven dezelfde grenzen ────
eq(
  'ongesorteerde invoer geeft dezelfde grenzen',
  segStrings([{ afterMinutes: 300, gapMinutes: 60 }, { afterMinutes: 120, gapMinutes: 60 }],
    '2026-06-01T08:00', '2026-06-01T16:00', true, hourEng),
  segStrings([{ afterMinutes: 120, gapMinutes: 60 }, { afterMinutes: 300, gapMinutes: 60 }],
    '2026-06-01T08:00', '2026-06-01T16:00', true, hourEng),
);

// ── 0e/0f verhuisd naar `check-split-walk.ts` (reviewronde taak 2, B1c-W0.4-vervolg): overlappende
//    gaten die samenvallen tot één werkonderbreking, en vijandige invoer (NaN/Infinity/niet-
//    positieve gatlengtes, geen grens voorbij het taakeinde) zijn semantiek van de wandeling zelf,
//    niet van de renderer — dat bestand is nu de canonieke plek voor die cases.

// ═══════════════════════════════════════════════════════════════════════════
// Deel A — GanttRenderer (canvas)
// ═══════════════════════════════════════════════════════════════════════════

S().newProject();
S().addTask({ name: 'basis' });
const base = S().tasks[0];
const st = S();
const view = { ...st.view, viewStartDate: '2026-06-01', zoom: 30, scrollX: 0, scrollY: 0 };

function hourTask(id: string, earlyStart: string, earlyFinish: string, splitGaps?: TaskSplitGap[], completion = 0): Task {
  return {
    ...base, id,
    time: { ...base.time, earlyStart, earlyFinish, scheduleStart: earlyStart, scheduleFinish: earlyFinish, completion },
    splitGaps,
  } as Task;
}

const W = 1400, H = 600, ROWH = 28, HDRH = 60;
function renderRows(rows: ViewRow[], opts: Partial<GanttRenderOptions> = {}): { rects: RRect[]; lines: LineEv[] } {
  const { ctx, rects, lines } = makeCtx();
  const renderer = new GanttRenderer(ctx, {
    rows,
    sequences: [],
    calendar: DAY_CAL,
    effectiveCalById: new Map([
      ['row0', HOUR_CAL], ['row1', HOUR_CAL], ['row2', HOUR_CAL],
      ['dayrow', DAY_CAL], ['dayrow2', DAY_CAL],
    ]),
    view,
    selectedTaskIds: [],
    statusDate: view.viewStartDate,
    showProgressLine: false,
    canvasWidth: W,
    canvasHeight: H,
    rowHeight: ROWH,
    headerHeight: HDRH,
    ...opts,
  });
  let err: unknown = null;
  try { renderer.render(); } catch (e) { err = e; }
  ok(`render() gooit niet: ${String(err)}`, err === null);
  return { rects, lines };
}
const barTop = (i: number) => HDRH + i * ROWH;
const inRow = (r: { y: number }, i: number) => r.y >= barTop(i) && r.y < barTop(i + 1);
const rowMidY = (i: number) => HDRH + i * ROWH + ROWH / 2;

// ── 1. Taak met 2 NIET-OVERLAPPENDE gaten ⇒ 3 roundRect-aanroepen op die rij, op de X-POSITIES
//    die de as voorschrijft, plus de necking-connector ertussen.
//
//    Het aantal segmenten alleen is geen bewijs: beide as-lezingen geven er drie. Deze case pint
//    daarom de randen. Uur-modus, werkdag 08:00-16:00, zoom 240 px/dag ⇒ 10 px/uur en x(08:00)=80.
//    Werk 120 | gat 60 | werk 120 | gat 60 | werk 120 ⇒ blokken 08-10, 11-13, 14-16, dus
//    x = 80..100, 110..130, 140..160 — drie blokken van 20 px met 10 px ertussen.
console.log('-- split-bar-render: 2 gaten ⇒ 3 segmenten op de juiste x-posities + connector --');
{
  const twoGaps: TaskSplitGap[] = [
    { afterMinutes: 120, gapMinutes: 60 },
    { afterMinutes: 300, gapMinutes: 60 },
  ];
  const rows: ViewRow[] = [
    { kind: 'task', rowKey: 'row0', task: hourTask('row0', '2026-06-01T08:00', '2026-06-01T16:00', twoGaps), depth: 0, dimmed: false },
  ];
  // barSplitMode:'never' — bewijst meteen mede dat de necking-instelling hier NIET aan te pas komt
  // (O5): met 'never' zou de kalender-necking nooit splitsen, maar `splitGaps` doet het toch.
  const { rects, lines } = renderRows(rows, { barSplitMode: 'never', view: { ...view, zoom: 240 } });
  const row0Rects = rects.filter(r => inRow(r, 0));
  eq('2 gaten ⇒ exact 3 roundRect-aanroepen (3 segmenten) op die rij', row0Rects.length, 3);
  if (row0Rects.length === 3) {
    const [s1, s2, s3] = row0Rects;
    near('segment 1 begint op x(08:00)', s1.x, 80);
    near('segment 1 is 2 werkuren breed', s1.w, 20);
    near('segment 2 begint op x(11:00) — NIET op 14:00 (dubbel getelde gaten)', s2.x, 110);
    near('segment 2 is 2 werkuren breed', s2.w, 20);
    near('segment 3 begint op x(14:00)', s3.x, 140);
    near('segment 3 loopt tot x(16:00), het taakeinde', s3.x + s3.w, 160);
  }
  const connectorLines = lines.filter(l => Math.abs(l.y - rowMidY(0)) < 0.01);
  eq('necking-connector: exact 1 moveTo + 1 lineTo op halve rijhoogte', connectorLines.length, 2);
  ok('connector: eerst moveTo dan lineTo', connectorLines[0]?.kind === 'move' && connectorLines[1]?.kind === 'line');
}

// ── 2. Dezelfde assertie in DAG-modus, op de reviewer-reproductie: 3 zuivere werkdagen met twee
//    gaten van één dag ({480,480} en {1440,480}). CPM-spanne 5 werkdagen (ma 06-01 t/m vr 06-05),
//    dus de werkblokken zijn ma | wo | vr. Met zoom 30 en viewStart 06-01 is x(06-01)=0 en elke
//    dag 30 px breed ⇒ blokken op 0, 60 en 120, elk 30 px.
//    Op de oude as werd blok 2 twee dagen breed en begon blok 3 ná het taakeinde (achterstevoren).
console.log('-- split-bar-render: dag-modus, twee gaten ⇒ ma | wo | vr op de juiste x --');
{
  const twoDayGaps: TaskSplitGap[] = [
    { afterMinutes: 480, gapMinutes: 480 },
    { afterMinutes: 1440, gapMinutes: 480 },
  ];
  const dayTask: Task = {
    ...base, id: 'dayrow2',
    time: {
      ...base.time,
      earlyStart: '2026-06-01', earlyFinish: '2026-06-05',
      scheduleStart: '2026-06-01', scheduleFinish: '2026-06-05', completion: 0,
    },
    splitGaps: twoDayGaps,
  } as Task;
  const { rects } = renderRows([{ kind: 'task', rowKey: dayTask.id, task: dayTask, depth: 0, dimmed: false }]);
  const dayRects = rects.filter(r => inRow(r, 0));
  eq('dag-modus, 2 gaten ⇒ exact 3 segmenten', dayRects.length, 3);
  if (dayRects.length === 3) {
    const [s1, s2, s3] = dayRects;
    near('maandag: x 0, breedte 30', s1.x, 0);
    near('maandag is één dag breed', s1.w, 30);
    near('woensdag begint op x 60 — NIET op 30 (blok 2 twee dagen breed)', s2.x, 60);
    near('woensdag is één dag breed, niet twee', s2.w, 30);
    near('vrijdag begint op x 120, binnen de balk', s3.x, 120);
    near('vrijdag loopt tot x 150 (inclusieve laatste dag)', s3.x + s3.w, 150);
    ok('geen enkel segment loopt achterstevoren of buiten de balk',
      dayRects.every(r => r.w > 0 && r.x >= 0 && r.x + r.w <= 150));
  }
}

// ── 3. barSplitMode:'never' ⇒ een taak ZONDER splitGaps blijft ONgesplitst (scheiding van de
//    twee mechanismen — de vorige case bewees al dat een taak MET splitGaps onder 'never' toch
//    splitst) ─────────────────────────────────────────────────────────────────────────────────
console.log('-- split-bar-render: barSplitMode=never + geen splitGaps ⇒ geen split --');
{
  const rows: ViewRow[] = [
    { kind: 'task', rowKey: 'row1', task: hourTask('row1', '2026-06-01T08:00', '2026-06-03T16:00', undefined), depth: 0, dimmed: false },
  ];
  const { rects, lines } = renderRows(rows, { barSplitMode: 'never' });
  const row1Rects = rects.filter(r => inRow(r, 0));
  eq('geen splitGaps + barSplitMode=never ⇒ exact 1 roundRect (ongesplitst)', row1Rects.length, 1);
  const connectorLines = lines.filter(l => Math.abs(l.y - rowMidY(0)) < 0.01);
  eq('geen connector zonder split', connectorLines.length, 0);
}

// ── 4. Voortgangsvulling loopt door over de segmenten heen (GLOBALE progressEnd), niet per
//    segment opnieuw. Twee passes: pass A (completion=0) meet de segmentgrenzen zelf (geen
//    aanname over exacte kalenderposities nodig); pass B zet de voortgang op een punt HALVERWEGE
//    segment 1 en toetst dat ALLEEN segment 1 een voortgangskleur-vulling krijgt. ────────────────
console.log('-- split-bar-render: voortgangsvulling globaal, niet per segment --');
{
  const oneGap: TaskSplitGap[] = [{ afterMinutes: 120, gapMinutes: 2880 }];
  const passA = renderRows([
    { kind: 'task', rowKey: 'row2', task: hourTask('row2', '2026-06-01T08:00', '2026-06-22T16:00', oneGap, 0), depth: 0, dimmed: false },
  ]);
  const bgA = passA.rects.filter(r => inRow(r, 0));
  eq('opzet pass A: 1 gat ⇒ 2 achtergrondsegmenten', bgA.length, 2);
  if (bgA.length === 2) {
    const [seg1, seg2] = bgA;
    const overallX1 = seg1.x;
    const overallX2 = seg2.x + seg2.w;
    const overallWidth = overallX2 - overallX1;
    const targetProgressEnd = seg1.x + seg1.w * 0.5; // halverwege segment 1
    const completion = (targetProgressEnd - overallX1) / overallWidth;
    ok('opzet: completion ligt in (0,1)', completion > 0 && completion < 1);

    const passB = renderRows([
      { kind: 'task', rowKey: 'row2', task: hourTask('row2', '2026-06-01T08:00', '2026-06-22T16:00', oneGap, completion), depth: 0, dimmed: false },
    ]);
    const row2Rects = passB.rects.filter(r => inRow(r, 0));
    // Voortgang gebruikt in critical/default exact de centrale normalLight-kleur. Herken die
    // rechtstreeks; Task.color is legacydata en hoort geen renderer-testhulpmiddel meer te zijn.
    const progressFills = row2Rects.filter(r => r.fillStyle.toUpperCase() === '#1D4ED8');
    ok('er is minstens 1 voortgangsvulling', progressFills.length > 0);
    const seg2Start = seg2.x;
    const leaksIntoSeg2 = progressFills.some(r => r.x >= seg2Start - 0.01);
    ok('GEEN voortgangsvulling in segment 2 (progressEnd valt ruim vóór segment 2)', !leaksIntoSeg2);
    const allInSeg1 = progressFills.every(r => r.x >= seg1.x - 0.01 && r.x + r.w <= seg1.x + seg1.w + 0.01);
    ok('elke voortgangsvulling blijft binnen segment 1 s grenzen', allInSeg1);
  }
}

// ── Extra (dag-modus-regressie, niet één van de 5 genummerde punten maar wél verplicht uit de
//    spec: "denk aan dag- vs uur-modus... kies de juiste engine-primitief per modus"). Een
//    dag-kalender heeft geen `workTime`; `CalendarEngine.addWorkMinutes` GOOIT daarop (leunt op
//    `calendar.workTime!.byWeekday`). Deze case bewijst dat het dag-pad (`addWorkingDaysSigned`)
//    daadwerkelijk gebruikt wordt: render() gooit niet én de taak splitst zichtbaar. ─────────────
console.log('-- split-bar-render: dag-modus splitGaps (addWorkingDaysSigned-pad, geen crash) --');
{
  const dayGap: TaskSplitGap[] = [{ afterMinutes: 1440, gapMinutes: 960 }]; // 3 dagen, gat van 2 dagen
  const dayTask: Task = {
    ...base, id: 'dayrow',
    time: { ...base.time, earlyStart: '2026-06-01', earlyFinish: '2026-06-20', scheduleStart: '2026-06-01', scheduleFinish: '2026-06-20', completion: 0 },
    splitGaps: dayGap,
  } as Task;
  const { rects } = renderRows([{ kind: 'task', rowKey: dayTask.id, task: dayTask, depth: 0, dimmed: false }]);
  const dayRects = rects.filter(r => inRow(r, 0));
  eq('dag-modus: 1 gat ⇒ 2 segmenten, GEEN crash', dayRects.length, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// Deel B — print/PDF (`renderReport`, via de gedeelde `Draw2D`-opnemer, patroon
// `check-print-working-exceptions.ts`/`check-today-label.ts`)
// ═══════════════════════════════════════════════════════════════════════════

interface PRect { x: number; y: number; w: number; h: number; fillStyle: string }
interface PLine { kind: 'move' | 'line'; x: number; y: number; strokeStyle: string }
function makeD2D(): { d2d: Draw2D; rects: PRect[]; lines: PLine[] } {
  const rects: PRect[] = [];
  const lines: PLine[] = [];
  let pending: { x: number; y: number; w: number; h: number } | null = null;
  const stv = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline };
  const d2d: Draw2D = {
    get font() { return stv.font; }, set font(v) { stv.font = v; },
    get fillStyle() { return stv.fillStyle; }, set fillStyle(v) { stv.fillStyle = v; },
    get strokeStyle() { return stv.strokeStyle; }, set strokeStyle(v) { stv.strokeStyle = v; },
    get lineWidth() { return stv.lineWidth; }, set lineWidth(v) { stv.lineWidth = v; },
    get textAlign() { return stv.textAlign; }, set textAlign(v) { stv.textAlign = v; },
    get textBaseline() { return stv.textBaseline; }, set textBaseline(v) { stv.textBaseline = v; },
    setLineDash() {},
    fillRect() {}, strokeRect() {},
    beginPath() { pending = null; },
    moveTo(x, y) { lines.push({ kind: 'move', x, y, strokeStyle: stv.strokeStyle }); },
    lineTo(x, y) { lines.push({ kind: 'line', x, y, strokeStyle: stv.strokeStyle }); },
    closePath() {},
    fill() { if (pending) { rects.push({ ...pending, fillStyle: stv.fillStyle }); pending = null; } },
    stroke() {},
    roundRect(x, y, w, h) { pending = { x, y, w, h }; },
    fillText() {}, measureText(t) { return { width: t.length * 6 }; },
  };
  return { d2d, rects, lines };
}

// De necking-connector is de ENIGE moveTo/lineTo-bron met `strokeStyle` eindigend op de hex-alpha-
// suffix `'80'` (§Deel B, `printPreview.ts`'s nieuwe `d2d.strokeStyle = color + '80'`) — grid-/
// tijdlijn-/vandaag-lijnen gebruiken allemaal hun EIGEN, andere `PRINT_COLORS`-waarden zonder die
// suffix. Isoleert de connector zonder de interne rij-/kolomgeometrie van `renderReport` te hoeven
// kennen (die is bewust niet extern zichtbaar, zie `check-print-working-exceptions.ts`'s
// zelfde-uitleg).
const isConnectorLine = (l: PLine) => l.strokeStyle.endsWith('80');

const printTask = (id: string, from: string, to: string, splitGaps?: TaskSplitGap[], completion = 0): Task => ({
  id, name: 'Print ' + id, taskType: 'CONSTRUCTION', status: 'NOT_STARTED',
  childIds: [], predecessorIds: [], successorIds: [], resourceIds: [], progress: 0, isMilestone: false,
  time: {
    durationType: 'WORKTIME', scheduleDuration: 1,
    scheduleStart: from, scheduleFinish: to, earlyStart: from, earlyFinish: to,
    lateStart: from, lateFinish: to, freeFloat: 0, totalFloat: 0, isCritical: false, completion,
  },
  splitGaps,
} as unknown as Task);

const PRINT_CAL: WorkCalendar = { ...DAY_CAL, id: 'print-cal-z15' };
const printOptions: PrintOptions = {
  showCritical: true, showFloat: false, showDeps: false, showWeekends: true,
  showLegend: false, showTaskNames: false, showCompletion: true,
  autoFit: true, customZoom: 1, paperSize: 'A4', orientation: 'landscape',
  companyName: '', labels: {
    noTasks: '-', printed: '-', legend: {} as any, tableHeaders: { rowNum: '#' } as any,
    page: '-', of: '-', today: '-',
  }, locale: 'nl', reportFontScale: 100,
} as PrintOptions;

// ── 5. Print/PDF: dezelfde assertie (segmentaantal + connector) op de Draw2D-opnemer ───────────
console.log('-- split-bar-render (print/PDF): dezelfde assertie op de Draw2D-opnemer --');
{
  const twoGaps: TaskSplitGap[] = [
    { afterMinutes: 1440, gapMinutes: 960 },
    { afterMinutes: 2880, gapMinutes: 960 },
  ];
  const { d2d, rects, lines } = makeD2D();
  let err: unknown = null;
  try {
    renderReport(() => d2d, [printTask('p0', '2026-06-01', '2026-06-25', twoGaps)], [], PRINT_CAL, 'P', printOptions);
  } catch (e) { err = e; }
  ok(`renderReport gooit niet: ${String(err)}`, err === null);
  eq('print: 2 gaten ⇒ exact 3 roundRect-aanroepen (3 segmenten)', rects.length, 3);
  // Segmentranden, net als in de Gantt — maar `renderReport`'s rij-/kolomgeometrie is bewust niet
  // extern zichtbaar (zelfde uitleg als in `check-print-working-exceptions.ts`), dus meten we
  // RELATIEF: segment 1 is 3 werkdagen breed, dus zijn breedte gedeeld door 3 geeft de px-per-dag
  // van dit rapport. Daarmee liggen de overige randen vast.
  //   werk 3d (ma 06-01→do 06-04) | gat 2d | werk 1d (ma 06-08→di 06-09) | gat 2d | rest
  // Op de oude as werd blok 2 drie dagen breed en schoof blok 3 vier dagen op.
  if (rects.length === 3) {
    const [s1, s2, s3] = rects;
    const pxPerDay = s1.w / 3;
    ok(`opzet: rapportschaal ruim boven de 2px-minimumbreedte (${pxPerDay.toFixed(2)} px/dag)`, pxPerDay > 4);
    near('print: gat 1 is 4 kalenderdagen breed (do→ma)', (s2.x - (s1.x + s1.w)) / pxPerDay, 4, 0.05);
    near('print: werkblok 2 is 1 werkdag breed, niet 3', s2.w / pxPerDay, 1, 0.05);
    near('print: gat 2 is 2 kalenderdagen breed (di→do)', (s3.x - (s2.x + s2.w)) / pxPerDay, 2, 0.05);
    ok('print: geen segment loopt achterstevoren', [s1, s2, s3].every(r => r.w > 0));
  }
  const connectorLines = lines.filter(isConnectorLine);
  eq('print: necking-connector — exact 1 moveTo + 1 lineTo', connectorLines.length, 2);
  ok('print: connector eerst moveTo dan lineTo', connectorLines[0]?.kind === 'move' && connectorLines[1]?.kind === 'line');

  // Negatieve controle: zonder splitGaps blijft het één balk, geen connector.
  const { d2d: d2dNo, rects: rectsNo, lines: linesNo } = makeD2D();
  renderReport(() => d2dNo, [printTask('p1', '2026-06-01', '2026-06-10', undefined)], [], PRINT_CAL, 'P', printOptions);
  eq('print: geen splitGaps ⇒ exact 1 roundRect', rectsNo.length, 1);
  eq('print: geen splitGaps ⇒ geen connector', linesNo.filter(isConnectorLine).length, 0);
}

// ── Print voortgangscontinuïteit (zelfde tweepas-opzet als de Gantt-canvas-case hierboven) ──────
console.log('-- split-bar-render (print/PDF): voortgangsvulling globaal, niet per segment --');
{
  const oneGap: TaskSplitGap[] = [{ afterMinutes: 1440, gapMinutes: 5760 }]; // 3 dagen, gat van 12 dagen
  const passA = makeD2D();
  renderReport(() => passA.d2d, [printTask('p2', '2026-06-01', '2026-07-20', oneGap, 0)], [], PRINT_CAL, 'P', printOptions);
  eq('print opzet pass A: 1 gat ⇒ 2 achtergrondsegmenten', passA.rects.length, 2);
  if (passA.rects.length === 2) {
    const [seg1, seg2] = passA.rects;
    const overallX1 = seg1.x;
    const overallWidth = (seg2.x + seg2.w) - overallX1;
    const completion = ((seg1.x + seg1.w * 0.5) - overallX1) / overallWidth;
    const passB = makeD2D();
    renderReport(() => passB.d2d, [printTask('p2', '2026-06-01', '2026-07-20', oneGap, completion)], [], PRINT_CAL, 'P', printOptions);
    const progressFills = passB.rects.filter(r => r.fillStyle === 'rgba(0, 0, 0, 0.25)');
    ok('print: minstens 1 voortgangsvulling', progressFills.length > 0);
    const leaksIntoSeg2 = progressFills.some(r => r.x >= seg2.x - 0.01);
    ok('print: GEEN voortgangsvulling in segment 2', !leaksIntoSeg2);
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  split-bar-render: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  split-bar-render: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
