// Renderer-regressie (TODO-item, gevonden 2026-07-28): `GanttRenderer.barGeometry` crashte op een
// taak ZONDER datums — heeft een taak noch `earlyStart` noch `scheduleStart` (idem finish-kant,
// bv. uit een onvolledige import), dan gooide `startStr.includes('T')` per frame een TypeError en
// bleef de hele Gantt zwart. Hetzelfde ongegarde patroon zat in `drawMilestone` (en via
// `barGeometry` ook onder `drawSummaryBar`).
//
// Deze batterij draait de ECHTE GanttRenderer met een opnemende 2D-context-stub over een rijenlijst
// met één gezonde taak plus datumloze varianten van alle drie de tekenpaden (leaf-balk,
// samenvattingsbalk, mijlpaal) en toetst:
//   1. render() gooit NIET (aantoonbaar rood tegen de oude, ongegarde code);
//   2. de gezonde taak wordt nog gewoon getekend (de guard dooft de tekenlaag niet);
//   3. de datumloze leaf krijgt de terugval-stub op de viewstart (zichtbaar i.p.v. verdwenen);
//   4. getTaskBarBounds weigert de datumloze taak (geen sleep/resize op de stub — de drag-hooks
//      zouden anders met undefined originalStart/originalFinish rekenen) maar vindt de gezonde wél.
//
// Draait via run.sh. Exit 0 = alles groen.

// ── DOM-stubs (vóór het instantiëren): de renderer leest themakleuren via
//    getComputedStyle(document.documentElement); zonder stub gooit dat in Node.
const g = globalThis as unknown as Record<string, unknown>;
g.document = { documentElement: {} };
g.getComputedStyle = () => ({ getPropertyValue: () => '' });

import { useAppStore } from '@/state/appStore';
import { GanttRenderer } from '@/engine/renderer/GanttRenderer';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import type { Task } from '@/types/task';
import type { ViewRow } from '@/engine/view/visibleRows';

const S = () => useAppStore.getState();

let checks = 0;
const diffs: string[] = [];
function ok(label: string, cond: boolean): void {
  checks++;
  if (!cond) diffs.push(label);
}

// ── Opnemende 2D-context-stub (naar het model van check-gantt-float-cull) ────
interface RRect { x: number; y: number; w: number; h: number }
function makeCtx(): { ctx: CanvasRenderingContext2D; roundRects: RRect[] } {
  const roundRects: RRect[] = [];
  const noop = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
    globalAlpha: 1, lineCap: '', lineJoin: '', shadowBlur: 0, shadowColor: '',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    roundRect: (x: number, y: number, w: number, h: number) => { roundRects.push({ x, y, w, h }); },
    fill: noop, stroke: noop, save: noop, restore: noop, clip: noop,
    translate: noop, scale: noop, rotate: noop,
    setLineDash: noop, getLineDash: () => [], fillText: noop, strokeText: noop,
    measureText: (t: string) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createPattern: () => null,
    quadraticCurveTo: noop, bezierCurveTo: noop, drawImage: noop,
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, roundRects };
}

// ── Scenario: één gezonde taak + datumloze varianten van de drie tekenpaden ──
S().newProject();
S().addTask({ name: 'Gezond' });
S().runCPM();
const healthy = S().tasks[0];

// De crash-vector is `undefined` op runtime (het Task-type zegt string, maar een onvolledige
// import levert undefined) — precies wat `.includes` laat gooien. De ''-variant dekt de
// lege-string-vorm van hetzelfde gat.
function stripDates(t: Task, value: undefined | ''): Task {
  return {
    ...t,
    id: `${t.id}-dateless-${value === undefined ? 'undef' : 'empty'}-${Math.random().toString(36).slice(2, 6)}`,
    time: {
      ...t.time,
      earlyStart: value, earlyFinish: value,
      scheduleStart: value, scheduleFinish: value,
    },
  } as unknown as Task;
}

const datelessLeaf = stripDates(healthy, undefined);
const datelessLeafEmpty = stripDates(healthy, '');
const datelessSummary = { ...stripDates(healthy, undefined), childIds: ['kind-x'] } as Task;
const datelessMilestone = { ...stripDates(healthy, undefined), isMilestone: true } as Task;

// Gedateerde varianten voor de relatie-hittest: die moet mijlpalen WÉL accepteren (dat is de bug
// die spec 2026-08-14 repareert) en sinds het eigenaarsbesluit van 2026-08-15 ook verzameltaken
// (expandSummaryRelations rekent zo'n relatie door — geen spookrelatie meer).
// M3 (Opus-review T15-iteratie-2, regressie-anker): `scheduleDuration: 0` expliciet gezet — zonder
// dat erft deze taak `healthy`'s reële duur (5), wat sinds T15/M3 een "mijlpaal-met-duur" is
// (isZeroDurationMilestone===false, tekent als BALK, is WEL sleep-/resize-baar). Deze case test
// bewust de ECHTE (0-duur) mijlpaal — "een ruit heeft geen duur om te resizen" hieronder.
const datedMilestone = { ...healthy, id: 'ms-dated', isMilestone: true, time: { ...healthy.time, scheduleDuration: 0 } } as Task;
const datedSummary = { ...healthy, id: 'sum-dated', childIds: ['kind-y'] } as Task;

// Uur-mijlpaal (coördinator-nabespreking 2026-08-14): in UUR-modus voegt `barGeometry` géén
// `+ zoom` toe aan x2, dus met start === finish geldt daar x1 === x2 exact — anders dan de
// dag-mijlpaal hierboven, waar de greep al een volle dagcel beslaat. Precies dít pad hangt dus
// echt van de ±6px-marge af. `T08:00` maakt hem ondubbelzinnig een uur-instant (`.includes('T')`).
const hourInstant = `${(healthy.time.earlyStart || healthy.time.scheduleStart || '').slice(0, 10)}T08:00`;
const hourMilestone: Task = {
  ...healthy,
  id: 'ms-hour',
  isMilestone: true,
  time: {
    ...healthy.time,
    earlyStart: hourInstant, earlyFinish: hourInstant,
    scheduleStart: hourInstant, scheduleFinish: hourInstant,
  },
} as Task;

// docs/TODO.md-randgeval: een mijlpaal met alleen een START — géén finish — bv. een handmatig
// gezette mijlpaal vóórdat runCPM() is gedraaid. `drawMilestone` tekende hem altijd al (leent bij
// ontbreken van de finish desnoods van de start zelf), maar `getRelationSourceAt` weigerde hem
// door de onvoorwaardelijke `earlyFinish`/`scheduleFinish`-guard — geen relatie-sleepbron, terwijl
// er wél een zichtbare ruit staat. `milestoneAnchorX` repareert dat.
const startOnlyMilestone: Task = {
  ...healthy,
  id: 'ms-start-only',
  isMilestone: true,
  time: {
    ...healthy.time,
    earlyStart: healthy.time.earlyStart, scheduleStart: healthy.time.scheduleStart,
    earlyFinish: undefined, scheduleFinish: undefined,
    scheduleDuration: 0,
  },
} as unknown as Task;

const rows: ViewRow[] = [
  { kind: 'task', rowKey: healthy.id, task: healthy, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datelessLeaf.id, task: datelessLeaf, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datelessLeafEmpty.id, task: datelessLeafEmpty, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datelessSummary.id, task: datelessSummary, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datelessMilestone.id, task: datelessMilestone, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datedMilestone.id, task: datedMilestone, depth: 0, dimmed: false },
  { kind: 'task', rowKey: datedSummary.id, task: datedSummary, depth: 0, dimmed: false },
  { kind: 'task', rowKey: hourMilestone.id, task: hourMilestone, depth: 0, dimmed: false },
  { kind: 'task', rowKey: startOnlyMilestone.id, task: startOnlyMilestone, depth: 0, dimmed: false },
];

const W = 1200, H = 600, TTW = 0, ROWH = 28, HDRH = 60;
const st = S();
const view = { ...st.view, scrollX: 0, scrollY: 0 };

const { ctx, roundRects } = makeCtx();
const renderer = new GanttRenderer(ctx, {
  rows,
  sequences: [],
  calendar: st.calendar,
  view,
  selectedTaskIds: [],
  // statusDate + voortgangslijn AAN: drawProgressLine loopt óók door barGeometry en moet de
  // datumloze rijen zonder crash passeren.
  statusDate: view.viewStartDate,
  showProgressLine: true,
  canvasWidth: W,
  canvasHeight: H,
  rowHeight: ROWH,
  headerHeight: HDRH,
});

// 1. render() mag niet gooien — dit is de eigenlijke regressie (oude code: TypeError per frame).
let renderError: unknown = null;
try {
  renderer.render();
} catch (err) {
  renderError = err;
}
ok(`render() gooit op datumloze taken: ${String(renderError)}`, renderError === null);

if (renderError === null) {
  // Y-midden van rij i (scrollY=0).
  const rowMidY = (i: number) => HDRH + i * ROWH + ROWH / 2;

  // 2. De gezonde taak tekent nog gewoon een balk in zijn eigen rij-band.
  const barTop = (i: number) => HDRH + i * ROWH;
  const inRow = (r: RRect, i: number) => r.y >= barTop(i) && r.y + r.h <= barTop(i + 1);
  const healthyBars = roundRects.filter(r => inRow(r, 0));
  ok('gezonde taak: geen balk-roundRect in rij 0 getekend', healthyBars.length > 0);

  // 3. De datumloze leaf krijgt de terugval-stub op de viewstart: dateToX(viewStart) = TTW bij
  //    scrollX=0, één dag-cel breed.
  const stubBars = roundRects.filter(r => inRow(r, 1));
  ok('datumloze leaf: geen terugval-stub getekend in rij 1', stubBars.length > 0);
  ok(
    `datumloze leaf: stub niet op de viewstart (x=${stubBars[0]?.x}, verwacht ~${TTW})`,
    stubBars.length > 0 && Math.abs(stubBars[0].x - TTW) < 1,
  );
  // Idem voor de ''-variant.
  ok('datumloze leaf (lege strings): geen terugval-stub getekend in rij 2', roundRects.some(r => inRow(r, 2)));

  // 4a. Hit-test óp de stub van de datumloze leaf: géén drag/resize armen.
  let hitError: unknown = null;
  let datelessHit: unknown = 'niet-gezet';
  try {
    datelessHit = renderer.getTaskBarBounds(TTW + 5, rowMidY(1));
  } catch (err) {
    hitError = err;
  }
  ok(`getTaskBarBounds gooit op datumloze taak: ${String(hitError)}`, hitError === null);
  ok('getTaskBarBounds armt drag op een datumloze taak (verwacht null)', datelessHit === null);

  // 4b. Dezelfde hit-test vindt de gezonde balk wél (guard is niet te breed). Kalibreer de x op
  //     het midden van de opgenomen balk uit stap 2.
  if (healthyBars.length > 0) {
    const bar = healthyBars[0];
    const healthyHit = renderer.getTaskBarBounds(bar.x + bar.w / 2, rowMidY(0));
    ok('getTaskBarBounds vindt de gezonde balk niet meer (guard te breed)', healthyHit !== null);
  }

  // 5. Relatie-hittest (spec 2026-08-14). Bewust een ÁNDERE functie dan getTaskBarBounds: die
  //    laatste armt slepen/resizen en moet mijlpalen blijven weigeren (een ruit heeft geen duur
  //    om te resizen, een verzamelbalk heeft afgeleide datums).
  if (healthyBars.length > 0) {
    const bar = healthyBars[0];
    const midX = bar.x + bar.w / 2;

    ok('getRelationSourceAt vindt de gezonde bladtaak niet',
      renderer.getRelationSourceAt(midX, rowMidY(0))?.id === healthy.id);

    // De mijlpaal deelt de datums van `healthy`, dus zijn barGeometry-x1 valt op bar.x (dag-modus:
    // x2 = x1 + zoom, dus de greep beslaat sowieso een volle dagcel — zie check 6 hieronder voor
    // het uur-pad, waar de ±6px-marge wél het enige is dat de ruit grijpbaar maakt).
    ok('getRelationSourceAt weigert een MIJLPAAL (dit is de bug die we repareren)',
      renderer.getRelationSourceAt(bar.x, rowMidY(5))?.id === 'ms-dated');

    // Eigenaarsbesluit 2026-08-15: een verzameltaak als relatiebron is legaal sinds
    // `expandSummaryRelations` zulke relaties naar bladtaken doorrekent (MS Project-semantiek) —
    // droppen ERÓP werkte via `relationVerdict` al langer, slepen VANAF moest in lockstep mee. De
    // uiteindelijke legaliteit (voorouder-weigering) wordt pas bij het loslaten bepaald, niet hier.
    ok('getRelationSourceAt WEIGERT een VERZAMELTAAK als bron NIET MEER (regressie-anker 2026-08-15)',
      renderer.getRelationSourceAt(midX, rowMidY(6))?.id === 'sum-dated');

    ok('getRelationSourceAt accepteert een datumloze taak',
      renderer.getRelationSourceAt(TTW + 5, rowMidY(1)) === null);

    // Regressie-anker de andere kant op: de sleep/resize-hittest is NIET versoepeld.
    ok('getTaskBarBounds armt nu wél drag op een mijlpaal (mag niet)',
      renderer.getTaskBarBounds(bar.x, rowMidY(5)) === null);
    ok('getTaskBarBounds armt nu wél drag op een verzamelbalk (mag niet)',
      renderer.getTaskBarBounds(midX, rowMidY(6)) === null);

    // 6. Uur-mijlpaal: x1 === x2 exact (barGeometry voegt in uur-modus géén +zoom toe), en de ruit
    //    ankert op x1 (milestoneKind onbekend ⇒ hier niet relevant, want de hittest kijkt niet naar
    //    de ruit maar naar barGeometry zelf). Dit is het pad waar de ±6px-marge lastdragend is.
    const hourX1 = renderer.dateToX(parseInstant(hourInstant));
    ok('getRelationSourceAt vindt de UUR-mijlpaal niet op zijn exacte x1',
      renderer.getRelationSourceAt(hourX1, rowMidY(7))?.id === 'ms-hour');
    // Bewust NIET exact op x1: met x1 === x2 raakt de inclusieve `>=`/`<=`-grens daar toch precies,
    // ook bij grab=0 (geverifieerd via mutatietest) — die check alléén bewijst dus niet dat de marge
    // iets doet. Dit punt (binnen de marge, 4px van x1) is het lastdragende bewijs.
    ok('getRelationSourceAt vindt de UUR-mijlpaal niet binnen de marge (x1+4)',
      renderer.getRelationSourceAt(hourX1 + 4, rowMidY(7))?.id === 'ms-hour');
    ok('getRelationSourceAt accepteert de UUR-mijlpaal ruim buiten de marge (bewijst dat de marge iets doet)',
      renderer.getRelationSourceAt(hourX1 + 20, rowMidY(7)) === null);

    // 7. docs/TODO.md-randgeval: mijlpaal met alleen een start (geen finish). `drawMilestone` tekent
    //    hem gewoon — deel dezelfde ankerlogica (`milestoneAnchorX`) om te bepalen waar de ruit staat,
    //    onafhankelijk van `barGeometry`/`roundRect` (een mijlpaal tekent geen rechthoek).
    //    `milestoneKind` is hier onbekend (AUTO) ⇒ zelfde dag-gecentreerde anker als drawMilestone
    //    (anchor = zoom / 2), dus + view.zoom / 2 t.o.v. de dagcelstart.
    const startOnlyX = renderer.dateToX(parseDate(startOnlyMilestone.time.earlyStart!)) + view.zoom / 2;
    ok('getRelationSourceAt weigert een MIJLPAAL MET ALLEEN EEN START (dit is de bug die we repareren)',
      renderer.getRelationSourceAt(startOnlyX, rowMidY(8))?.id === 'ms-start-only');
    ok('getRelationSourceAt vindt de start-only mijlpaal ook net binnen de marge (startOnlyX+4)',
      renderer.getRelationSourceAt(startOnlyX + 4, rowMidY(8))?.id === 'ms-start-only');
    ok('getRelationSourceAt weigert de start-only mijlpaal ruim buiten de marge',
      renderer.getRelationSourceAt(startOnlyX + 20, rowMidY(8)) === null);
    // Regressie-anker de andere kant op: sleep/resize blijft geweigerd (een ruit heeft geen duur).
    ok('getTaskBarBounds armt drag op de start-only mijlpaal (mag niet)',
      renderer.getTaskBarBounds(startOnlyX, rowMidY(8)) === null);
  }
}

// ── Uitslag ──────────────────────────────────────────────────────────────────
if (diffs.length === 0) {
  console.log(`OK  renderer-dateless: alle checks groen (${checks})`);
  process.exit(0);
} else {
  console.log(`XX  renderer-dateless: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
