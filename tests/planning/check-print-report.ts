/**
 * Rapportexport-features #21/#54 — regressiebatterij tegen renderReport met opnemende Draw2D.
 *
 * Bewaakt (dezelfde renderer die de raster-preview én de vector-PDF voedt — dus wat hier klopt,
 * klopt in beide exportpaden):
 *  1. VOLG-WEERGAVE (#54): gegeven `options.rows` tekent het rapport precies die rijen — een
 *     gefilterde taak is nergens (tabel, labels, balken), een groepsband-rij tekent als band, en
 *     relaties naar onzichtbare endpoints worden overgeslagen.
 *  2. STATUSLIJN (#54): 'statusDate' tekent exact één verticale stippellijn op de statusdatum-x;
 *     'progress' stulpt per leaf-rij uit naar de voortgangspositie; 'none' of geen statusDate
 *     tekent niets extra (de vandaag-lijn valt buiten beeld door de fixture-datums).
 *  3. KLEURMODI (#21): critical = oud gedrag; auto = palet-hash per taak-id; task = Task.color;
 *     resource = segmenten in rato van unitsPerDay + rode outline op kritieke taken.
 *  4. LEGENDA: resource-modus toont resourcenamen + rand-verklaring; critical-modus niet.
 */
import { renderReport, PrintOptions, REPORT_MIN_ZOOM } from '@/services/print/printPreview';
import { computeTileLayout, PAPER_PT } from '@/services/print/tileLayout';
import {
  computePreviewRasterLimits,
  PREVIEW_MAX_PAGE_PIXELS,
  PREVIEW_MAX_RASTER_PIXELS,
  PREVIEW_QUALITY_RASTER_BUDGETS,
} from '@/services/print/previewSafety';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import type { ViewRow } from '@/engine/view/visibleRows';
import type { Task, TaskTime } from '@/types/task';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };

// ── Opnemende Draw2D (patroon: check-today-label.ts, uitgebreid met path-recording) ─────────────
interface TextEv { text: string; x: number; y: number; color: string; font: string; seq: number; }
interface RectEv { x: number; y: number; w: number; h: number; color: string; seq: number; }
interface PathEv { pts: { x: number; y: number }[]; color: string; dash: number[]; seq: number; }
interface RoundRectEv { x: number; y: number; w: number; h: number; color: string; strokeColor: string; mode: 'fill' | 'stroke'; seq: number; }

function record(tasks: Task[], sequences: Sequence[], calendar: WorkCalendar, options: PrintOptions) {
  const texts: TextEv[] = [];
  const rects: RectEv[] = [];
  const paths: PathEv[] = [];
  const roundRects: RoundRectEv[] = [];
  let seq = 0;
  let curPath: { x: number; y: number }[] | null = null;
  const st = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline, dash: [] as number[] };
  const measure = (t: string) => ({ width: t.length * 6 });
  const d2d: Draw2D = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash(d) { st.dash = [...d]; },
    fillRect(x, y, w, h) { rects.push({ x, y, w, h, color: st.fillStyle, seq: seq++ }); },
    strokeRect() {}, beginPath() { curPath = []; }, moveTo(x, y) { if (!curPath) curPath = []; curPath.push({ x, y }); },
    lineTo(x, y) { if (!curPath) curPath = []; curPath.push({ x, y }); },
    closePath() {}, fill() { curPath = null; },
    stroke() { if (curPath) paths.push({ pts: curPath, color: st.strokeStyle, dash: [...st.dash], seq: seq++ }); curPath = null; },
    roundRect(x, y, w, h) { roundRects.push({ x, y, w, h, color: st.fillStyle, strokeColor: st.strokeStyle, mode: 'fill', seq: seq++ }); },
    fillText(text, x, y) { texts.push({ text, x, y, color: st.fillStyle, font: st.font, seq: seq++ }); },
    measureText(t) { return measure(t); },
  };
  const dims = renderReport(() => d2d, tasks, sequences, calendar, 'P', options);
  return { texts, rects, paths, roundRects, dims };
}

// ── Fixtures ───────────────────────────────────────────────────────────────────────────────────
const CRITICAL = '#DC2626';
const NORMAL = '#2563EB';
const BASELINE = '#6B7280';

const cal: WorkCalendar = {
  id: 'c1', name: 'Standaard', description: '', workDays: [1, 2, 3, 4, 5, 6, 7],
  workStartHour: 7, workEndHour: 15, hoursPerDay: 8, holidays: [],
} as WorkCalendar;

const mkTime = (over: Partial<TaskTime> = {}): TaskTime => ({
  earlyStart: '2026-01-05', earlyFinish: '2026-01-09', lateStart: '', lateFinish: '',
  duration: 5, totalFloat: 0, isCritical: false, completion: 0,
  scheduleStart: '2026-01-05', scheduleFinish: '2026-01-09',
  ...over,
} as TaskTime);
const mkTask = (id: string, name: string, over: Partial<Task> = {}): Task => ({
  id, name, parentId: undefined, childIds: [], isMilestone: false, wbsCode: id,
  taskType: 'CONSTRUCTION', activityCodes: {}, customFields: {},
  time: mkTime(),
  ...over,
} as unknown as Task);

// Drie bladtaken: t-norm (blauw, 2 resources 1:3), t-crit (kritiek), t-gefilterd (buiten viewRows).
// completion 0.6: bij 0.4 (met deze datums) valt de uitstulping EXACT op de spine — dan is er
// niets te bewijzen. 0.6 stulpt rechts van de 07-01-spine uit.
const T_NORM = mkTask('t-norm', 'Zichtbare taak', { time: mkTime({ completion: 0.6 }) });
const T_CRIT = mkTask('t-crit', 'Kritieke taak', { time: mkTime({ isCritical: true, earlyStart: '2026-01-12', earlyFinish: '2026-01-16', scheduleStart: '2026-01-12', scheduleFinish: '2026-01-16' }) });
const T_HIDDEN = mkTask('t-gefilterd', 'Gefilterde taak', { taskType: 'INSTALLATION', time: mkTime({ earlyStart: '2026-01-19', earlyFinish: '2026-01-23', scheduleStart: '2026-01-19', scheduleFinish: '2026-01-23' }) });
const FIX_TASKS = [T_NORM, T_CRIT, T_HIDDEN];

const R1: Resource = { id: 'r1', name: 'Metselaar', type: 'LABOR', description: '', maxUnits: 1, color: '#111111' };
const R2: Resource = { id: 'r2', name: 'Loodgieter', type: 'LABOR', description: '', maxUnits: 1, color: '#222222' };
const FIX_ASG: ResourceAssignment[] = [
  { id: 'a1', taskId: 't-norm', resourceId: 'r1', unitsPerDay: 1 },
  { id: 'a2', taskId: 't-norm', resourceId: 'r2', unitsPerDay: 3 },
];

const SEQ_HIDDEN: Sequence[] = [
  { id: 's1', predecessorId: 't-norm', successorId: 't-gefilterd', type: 'FINISH_START', lagDays: 0 } as Sequence,
];

const viewRows: ViewRow[] = [
  { kind: 'group', key: '["Metselaar"]', label: 'Metselaar', count: 1, depth: 0, levelIndex: 0, collapsed: false },
  { kind: 'task', task: T_NORM, depth: 1, dimmed: false },
  { kind: 'task', task: T_CRIT, depth: 1, dimmed: false },
];

const baseOptions = (over: Partial<PrintOptions> = {}): PrintOptions => ({
  showCritical: true, showFloat: true, showDeps: true, showWeekends: true, showLegend: true,
  showTaskNames: true, showCompletion: true, autoFit: true, customZoom: 22,
  paperSize: 'A3', orientation: 'landscape', companyName: 'Test',
  barColorSelection: { mode: 'critical' },
  activityCodeTypes: [{
    id: 'discipline', name: 'Discipline',
    values: [{ id: 'elektra', code: 'E', description: 'Elektra', color: '#11AA55' }],
  }],
  customFieldDefs: [],
  taskTypeLabels: { CONSTRUCTION: 'Constructie', INSTALLATION: 'Installatie' },
  barColorNoneLabel: '(geen)',
  // De labels komen in het product vanuit ReportPanel. De voortgangsdatum moet een eigen label
  // krijgen: met alleen `statusDate` zou de export bij beide lijnsoorten "Statusdatum" afdrukken.
  labels: {
    noTasks: '-', printed: '-', page: '-', of: '-', today: '-', statusDate: 'Statusdatum',
    progressDate: 'Voortgangsdatum',
    legend: {
      criticalPath: 'Kritiek pad', normal: 'Normaal', nearCritical: 'Bijna-kritiek',
      milestone: 'Mijlpaal', summary: 'Samenvatting', float: 'Speling', completion: 'Voortgang',
      relationStyle: 'Bepalend / niet-bepalend',
    },
    tableHeaders: { rowNum: '#', wbs: 'WBS', taskName: 'Taak', start: 'Start', end: 'Eind', duration: 'Duur', completion: 'Volt.' },
  } as PrintOptions['labels'],
  barColorsLegendLabels: {
    criticalOutline: 'Kritiek pad (rand)',
    categoriesMore: (n: number) => `… en ${n} meer`,
  },
  ...over,
});

// ── 1. Volg-weergave ───────────────────────────────────────────────────────────────────────────
{
  const { texts } = record(FIX_TASKS, SEQ_HIDDEN, cal, baseOptions({ rows: viewRows }));
  ok(!texts.some(t => t.text.includes('Gefilterde taak')), 'volg-weergave: gefilterde taak komt nergens voor');
  ok(texts.some(t => t.text === 'Metselaar (1)'), 'volg-weergave: groepsband-label met count aanwezig');
}
{
  // Zonder rows: de volledige boom — de gefilterde taak is er wél (oud gedrag).
  const { texts } = record(FIX_TASKS, SEQ_HIDDEN, cal, baseOptions());
  ok(texts.some(t => t.text.includes('Gefilterde taak')), 'boom-modus: alle taken zichtbaar (oud gedrag)');
}
{
  // Dependency-filter: de sequence naar de gefilterde taak tekent niet. De pijlen zijn paths met
  // ≥3 punten (knik) — check dat geen enkel path een y binnen de rij-band van t-gefilterd raakt.
  const { paths } = record(FIX_TASKS, SEQ_HIDDEN, cal, baseOptions({ rows: viewRows, showDeps: true }));
  // t-gefilterd zou rij 3 zijn (band, t-norm, t-crit, dan t-gefilterd) — maar is niet in rows;
  // concreet: er zijn géén dependency-paths (de enige sequence eindigt op een onzichtbare taak).
  const depPaths = paths.filter(p => p.pts.length >= 3);
  ok(depPaths.length === 0, `volg-weergave: geen relatiepijlen naar onzichtbare endpoints (got ${depPaths.length})`);
}

// ── 2. Statuslijn ──────────────────────────────────────────────────────────────────────────────
// Fixture-datums liggen in januari 2026; "vandaag" (echte run-datum) valt ver buiten het
// chart-gebied, dus elke dash-[5,3]-path hieronder is de statuslijn.
{
  const { paths, roundRects } = record(FIX_TASKS, [], cal, baseOptions({ statusLine: 'statusDate', statusDate: '2026-01-07' }));
  const dashed = paths.filter(p => p.dash.length === 2 && p.dash[0] === 5);
  ok(dashed.length === 1, `statusDate: exact één gestippelde lijn (got ${dashed.length})`);
  const ln = dashed[0];
  const vertical = ln.pts.length === 2 && ln.pts[0].x === ln.pts[1].x && ln.pts[0].y < ln.pts[1].y;
  ok(vertical, 'statusDate: de lijn is verticaal (moveTo + lineTo, zelfde x)');
  const lastBar = Math.max(...roundRects.filter(r => r.h > 10).map(r => r.seq));
  ok(ln.seq > lastBar, 'statusDate: de referentielijn ligt boven alle activiteitbalken');
}
{
  // progress: dezelfde spine, maar met uitstulpingen — ≥ 1 punt met x ≠ spine-x per lopende taak.
  const { paths, roundRects, texts } = record(FIX_TASKS, [], cal, baseOptions({ statusLine: 'progress', statusDate: '2026-01-07' }));
  const dashed = paths.filter(p => p.dash.length === 2 && p.dash[0] === 5);
  ok(dashed.length === 1, `progress: één path (got ${dashed.length})`);
  const ln = dashed[0];
  ok(ln.pts.length > 2, `progress: meer dan 2 punten — zigzag aanwezig (got ${ln.pts.length})`);
  const spineX = ln.pts[0].x;
  ok(ln.pts.some(p => p.x !== spineX), 'progress: minstens één uitstulping van de spine');
  // t-norm heeft completion 0.4 ⇒ de uitstulping wijst naar rechts van de spine (balk begint 05-01).
  const bulges = ln.pts.filter(p => p.x !== spineX);
  ok(bulges.length >= 1 && bulges.every(b => b.x > spineX), 'progress: t-norm stulpt rechts uit (completion 0.6)');
  const lastBar = Math.max(...roundRects.filter(r => r.h > 10).map(r => r.seq));
  ok(ln.seq > lastBar, 'progress: de referentielijn ligt boven alle activiteitbalken');
  ok(texts.some(t => t.text === 'Voortgangsdatum'), 'progress: de exportkop benoemt de voortgangsdatum');
}
{
  // 'none' en ontbrekende statusDate: geen enkele statuslijn.
  const a = record(FIX_TASKS, [], cal, baseOptions({ statusLine: 'none', statusDate: '2026-01-07' }));
  const b = record(FIX_TASKS, [], cal, baseOptions({ statusLine: 'statusDate' }));
  const dashedA = a.paths.filter(p => p.dash.length === 2 && p.dash[0] === 5);
  const dashedB = b.paths.filter(p => p.dash.length === 2 && p.dash[0] === 5);
  ok(dashedA.length === 0 && dashedB.length === 0, 'statuslijn: none/geen statusDate tekent niets');
}

// ── 3. Kleurmodi ───────────────────────────────────────────────────────────────────────────────
// Balken zijn roundRect-fills met barHeight ≈ 0.55 × rowHeight (24 × 0.55 ≈ 13) — de filters
// hieronder herkennen ze aan die hoogte-band plus een minimale breedte.
{
  // critical (default): kritiek rood + gewone taak blauw — de twee roundRect-fills bestaan.
  const { roundRects } = record(FIX_TASKS, [], cal, baseOptions({ barColorSelection: { mode: 'critical' } }));
  const fills = roundRects.filter(r => r.mode === 'fill');
  ok(fills.some(r => r.color === CRITICAL), 'critical-modus: rode balk (kritiek)');
  ok(fills.some(r => r.color === NORMAL), 'critical-modus: blauwe balk (normaal)');
}
{
  // auto: elke balk in de hash-kleur van zijn taak-id.
  const { roundRects } = record(FIX_TASKS, [], cal, baseOptions({ barColorSelection: { mode: 'auto' } }));
  const fills = roundRects.filter(r => r.mode === 'fill' && r.h > 10 && r.h < 20 && r.w > 3);
  ok(fills.some(r => r.color === '#1E293B'), 'auto-modus: balk in vaste hash-kleur t-norm');
  ok(fills.some(r => r.color === '#FBBF24'), 'auto-modus: balk in vaste hash-kleur t-crit');
  // De kritieke taak krijgt een stroke in critical-rood: roundRect gevolgd door stroke() met strokeStyle=rood.
  ok(roundRects.some(r => r.strokeColor === CRITICAL), 'auto-modus: kritieke rand aanwezig');
}
{
  // Task Type: twee CONSTRUCTION-taken delen een kleur; INSTALLATION krijgt een andere.
  const { roundRects } = record(FIX_TASKS, [], cal, baseOptions({
    barColorSelection: { mode: 'category', field: { src: 'builtin', key: 'taskType' } },
  }));
  const fills = roundRects.filter(r => r.mode === 'fill' && r.h > 10 && r.h < 20 && r.w > 3);
  ok(fills.filter(r => r.color === '#1E293B').length >= 2, 'Task Type: beide CONSTRUCTION-taken delen #1E293B');
  ok(fills.some(r => r.color === '#0D9488'), 'Task Type: INSTALLATION gebruikt #0D9488');
}
{
  // Resource-categorie: t-norm heeft 2 resources 1:3 ⇒ twee segmenten met 25%/75%.
  const { roundRects } = record(FIX_TASKS, [], cal, baseOptions({
    barColorSelection: { mode: 'category', field: { src: 'resource' } },
    resources: [R1, R2], assignments: FIX_ASG,
  }));
  const fills = roundRects.filter(r => r.mode === 'fill' && r.h > 10 && r.h < 20 && r.w > 3);
  const seg1 = fills.find(r => r.color === '#111111');
  const seg2 = fills.find(r => r.color === '#222222');
  ok(!!seg1 && !!seg2, 'resource-modus: beide segmenten getekend');
  if (seg1 && seg2) {
    const total = seg1.w + seg2.w;
    const ratio1 = seg1.w / total;
    ok(Math.abs(ratio1 - 0.25) < 0.02, `resource-modus: segmentverhouding ≈ 25/75 (got ${(ratio1 * 100).toFixed(1)}%)`);
    ok(Math.abs(seg2.x - (seg1.x + seg1.w)) < 1.5, 'resource-modus: segmenten liggen aaneengesloten');
  }
  // Kritieke taak zonder resource: neutraal grijs + rode rand.
  ok(fills.some(r => r.color === '#94A3B8'), 'Resource-categorie: taak zonder resource → neutraal grijs');
  ok(roundRects.some(r => r.strokeColor === CRITICAL), 'resource-modus: rode outline aanwezig');
}
{
  // Activity code: expliciete waarde-kleur wint van het palet.
  const coded = mkTask('coded', 'Elektra', { activityCodes: { discipline: 'elektra' } });
  const { roundRects } = record([coded], [], cal, baseOptions({
    barColorSelection: { mode: 'category', field: { src: 'activityCode', typeId: 'discipline' } },
  }));
  ok(roundRects.some(r => r.mode === 'fill' && r.color === '#11AA55' && r.h > 10),
    'Activity code: expliciete #11AA55 wordt getekend');
}

// ── 4. Legenda ─────────────────────────────────────────────────────────────────────────────────
{
  const near = mkTask('t-near', 'Bijna-kritieke taak', { time: mkTime({ isNearCritical: true }) });
  const crit = record([...FIX_TASKS, near], [], cal, baseOptions({ barColorSelection: { mode: 'critical' } }));
  ok(!crit.texts.some(t => t.text === 'Metselaar' || t.text === 'Loodgieter'), 'critical-legenda: géén resourcenamen');
  ok(crit.texts.some(t => t.text === 'Bijna-kritiek'), 'critical-legenda: bijna-kritieke kleur wordt verklaard');
  const res = record(FIX_TASKS, [], cal, baseOptions({
    barColorSelection: { mode: 'category', field: { src: 'resource' } },
    resources: [R1, R2], assignments: FIX_ASG,
  }));
  // In resource-modus met alle taken zichtbaar (boom-modus) komen r1/r2 via t-norm voor.
  ok(res.texts.some(t => t.text === 'Metselaar') && res.texts.some(t => t.text === 'Loodgieter'), 'resource-legenda: resourcenamen aanwezig');
  // …en de swatches in de juiste kleuren (roundRect 16×10 in de voettekst-zone).
  ok(res.roundRects.some(r => r.color === '#111111' && r.h < 14), 'resource-legenda: swatch in resourcekleur');
}
{
  // Issue #81: dezelfde actieve-baselinegegevens als de Gantt krijgen een eigen, grijze
  // onderbalk in de rapportpreview én PDF. Zonder expliciete rapportoptie blijft het oude beeld
  // byte-identiek; de legenda komt alleen mee wanneer er daadwerkelijk een zichtbare overlay is.
  const overlay = new Map([
    ['t-norm', { start: '2026-01-06', finish: '2026-01-08', isMilestone: false }],
  ]);
  const without = record(FIX_TASKS, [], cal, baseOptions({ baselineOverlay: overlay }));
  ok(!without.roundRects.some(r => r.mode === 'fill' && r.color === BASELINE),
    'baseline-overlay uit: geen grijze baselinebalk');
  ok(!without.texts.some(t => t.text === 'Baseline'),
    'baseline-overlay uit: geen baselinelegenda');

  const withOverlay = record(FIX_TASKS, [], cal, baseOptions({
    showBaselineOverlay: true,
    baselineOverlay: overlay,
  }));
  ok(withOverlay.roundRects.some(r => r.mode === 'fill' && r.color === BASELINE && r.h < 10),
    'baseline-overlay aan: grijze onderbalk aanwezig');
  ok(withOverlay.texts.some(t => t.text === 'Baseline'),
    'baseline-overlay aan: legenda verklaart de grijze onderbalk');
}
{
  const nine = Array.from({ length: 9 }, (_, i) => mkTask(`legend-${i + 1}`, `L${i + 1}`, {
    customFields: { legend: `V${i + 1}` },
    time: mkTime({
      earlyStart: `2026-01-${String(5 + i).padStart(2, '0')}`,
      earlyFinish: `2026-01-${String(6 + i).padStart(2, '0')}`,
      scheduleStart: `2026-01-${String(5 + i).padStart(2, '0')}`,
      scheduleFinish: `2026-01-${String(6 + i).padStart(2, '0')}`,
    }),
  }));
  const legend = record(nine, [], cal, baseOptions({
    barColorSelection: { mode: 'category', field: { src: 'customField', defId: 'legend' } },
    customFieldDefs: [{ id: 'legend', name: 'Legenda', type: 'text' }],
  }));
  for (let i = 1; i <= 8; i++) ok(legend.texts.some(t => t.text === `V${i}`), `categorielegenda bevat zichtbare waarde V${i}`);
  ok(!legend.texts.some(t => t.text === 'V9'), 'categorielegenda kapt af na acht waarden');
  ok(legend.texts.some(t => t.text === '… en 1 meer'), 'categorielegenda meldt één extra waarde');
}

// ── 5. Rapportbreedte (#74) ───────────────────────────────────────────────────────────────────
// Een lang project mag de tabeltekst niet mee verkleinen. In auto-fit moet de renderer daarom de
// tijdlijn zó ver comprimeren dat de pagineerder steeds de vaste CSS→PDF-schaal 0,75 gebruikt
// (96 CSS-pixels per inch versus 72 PDF-punten per inch), onafhankelijk van het papierformaat.
{
  const long = mkTask('long', 'Meerjarig project', {
    time: mkTime({
      earlyStart: '2026-01-05', earlyFinish: '2031-01-03',
      scheduleStart: '2026-01-05', scheduleFinish: '2031-01-03',
    }),
  });
  const physicalTableWidths: number[] = [];
  // Dek alle papier-/oriëntatie- en tijdlijncombinaties die het gebruikerscontract noemt. Vooral
  // `timelineColumns: 4` is belangrijk: elke extra pagina herhaalt de tabel en mag daardoor de
  // schaal niet ongemerkt veranderen.
  const paperCases = [
    { paperSize: 'A4', orientation: 'landscape', timelineColumns: 1 },
    { paperSize: 'A3', orientation: 'landscape', timelineColumns: 1 },
    { paperSize: 'A2', orientation: 'portrait', timelineColumns: 1 },
    { paperSize: 'A1', orientation: 'portrait', timelineColumns: 1 },
    { paperSize: 'A1', orientation: 'landscape', timelineColumns: 4 },
  ] as const;
  for (const { paperSize, orientation, timelineColumns } of paperCases) {
    const { dims } = record([long], [], cal, baseOptions({ paperSize, orientation, timelineColumns }));
    const layout = computeTileLayout({
      paperSize: paperSize.toLowerCase() as 'a4' | 'a3' | 'a2' | 'a1', orientation, mode: 'fit-width',
      logicalWidth: dims.width, logicalHeight: dims.height, frozenColumnWidthPx: dims.tableWidth, timelineColumns,
    });
    physicalTableWidths.push(dims.tableWidth * layout.scale);
    ok(Math.abs(layout.scale - 0.75) < 0.000_001,
      `#74 ${paperSize} ${orientation}, tijdlijn over ${timelineColumns}: auto-fit houdt vaste rapporttekst-schaal 0,75 (got ${layout.scale})`);
    ok(layout.cols === timelineColumns,
      `#74 ${paperSize} ${orientation}, tijdlijn over ${timelineColumns}: juiste horizontale pagina-indeling (got ${layout.cols})`);
  }
  ok(physicalTableWidths.every(width => Math.abs(width - physicalTableWidths[0]) < 0.000_001),
    `#74 alle papier-/tijdlijncombinaties: tabel houdt gelijke fysieke breedte (got ${physicalTableWidths.join(' / ')})`);
  const manualLayout = computeTileLayout({
    paperSize: 'a3', orientation: 'landscape', mode: 'actual',
    logicalWidth: 720, logicalHeight: 900, frozenColumnWidthPx: 450,
  });
  ok(Math.abs(manualLayout.scale - 0.75) < 0.000_001,
    `#74 handmatige zoom houdt dezelfde rapporttekst-schaal (got ${manualLayout.scale})`);
  ok(Math.abs(450 * manualLayout.scale - physicalTableWidths[0]) < 0.000_001,
    `#74 handmatige zoom houdt tabel fysiek even groot als auto-fit (got ${450 * manualLayout.scale})`);
  ok(REPORT_MIN_ZOOM === 1, 'handmatige rapportzoom kan tot 1 px/dag terug voor lange projecten');
}

// ── 6. A2-papierformaat (#83) ─────────────────────────────────────────────────────────────────
// Eén definitie voedt zowel de live preview als de raster- en vector-PDF-pagineerder. A2 is precies
// de ISO-216-tussenmaat: A3 verdubbeld, A1 gehalveerd.
{
  const a2 = PAPER_PT.a2;
  ok(a2.width === PAPER_PT.a3.height && a2.height === PAPER_PT.a1.width,
    `#83 A2 gebruikt de gedeelde ISO-afmetingen (got ${a2.width}×${a2.height} pt)`);
  const portrait = computeTileLayout({
    paperSize: 'a2', orientation: 'portrait', mode: 'fit-width', logicalWidth: 900, logicalHeight: 1200,
  });
  const landscape = computeTileLayout({
    paperSize: 'a2', orientation: 'landscape', mode: 'fit-width', logicalWidth: 900, logicalHeight: 1200,
  });
  ok(portrait.pageWidthPt === a2.width && portrait.pageHeightPt === a2.height,
    '#83 A2-portret behoudt de gedeelde papierafmetingen');
  ok(landscape.pageWidthPt === a2.height && landscape.pageHeightPt === a2.width,
    '#83 A2-liggend wisselt de gedeelde papierafmetingen om');
}

// ── 7. Veilige grote rapportpreview (#74) ────────────────────────────────────────────────────
// De preview mag niet eerst een broncanvas en tientallen A1-pagina's zonder rasterbudget maken.
// Dit is puur rekenwerk, dus de bescherming is toetsbaar zonder een browsercanvas te reserveren.
{
  // Alle kwaliteitsstanden houden exact dezelfde CSS-breedte. De dichtheden liggen bewust rond
  // de fysieke schermresolutie: snel half-native, Hoog driekwart en Maximaal native.
  const cssWidth = 900;
  const standard = computePreviewRasterLimits(1_200, 1_800, 'a3', 'landscape', cssWidth, 1, 1);
  const high = computePreviewRasterLimits(1_200, 1_800, 'a3', 'landscape', cssWidth, 1, 2);
  const maximum = computePreviewRasterLimits(1_200, 1_800, 'a3', 'landscape', cssWidth, 1, 3);
  ok(high.pageSupersample >= standard.pageSupersample * 1.49
    && maximum.pageSupersample >= high.pageSupersample * 1.32,
    'Standaard/Hoog/Maximaal verhogen de paginaresolutie in zichtbare stappen');
  ok(1_191 * standard.pageSupersample >= cssWidth * 0.5 - 1,
    'Standaard gebruikt de snelle halve CSS×DPR-paginadichtheid');
  ok(1_191 * high.pageSupersample >= cssWidth * 0.75 - 1,
    'Hoog bereikt driekwart CSS×DPR-paginadichtheid bij normaal rapport');
  ok(1_191 * maximum.pageSupersample >= cssWidth - 1,
    'Maximaal bereikt native CSS×DPR-paginadichtheid bij normaal rapport');
  ok(maximum.maxPages <= high.maxPages,
    'Maximaal houdt niet meer pagina’s tegelijk vast dan Hoog');
}
{
  for (const quality of [1, 2, 3] as const) {
    const limits = computePreviewRasterLimits(20_000, 10_000, 'a1', 'landscape', 900, 2, quality);
    const onePagePixels = 2384 * 1684 * limits.pageSupersample * limits.pageSupersample;
    const cachedPixels = limits.maxPages * onePagePixels;
    ok(onePagePixels <= PREVIEW_MAX_PAGE_PIXELS + 20_000,
      `A1-preview begrenst iedere page-local buffer op kwaliteit ${quality} (got ${onePagePixels})`);
    ok(cachedPixels <= PREVIEW_QUALITY_RASTER_BUDGETS[quality] + 40_000,
      `A1-preview respecteert het eigen cachebudget op kwaliteit ${quality} (got ${cachedPixels})`);
    ok(limits.pageSupersample > 0 && limits.maxPages >= 2,
      `extreme A1-preview houdt twee aangrenzende pagina’s bruikbaar op kwaliteit ${quality} (got ${limits.maxPages})`);
  }
  ok(PREVIEW_QUALITY_RASTER_BUDGETS[3] === PREVIEW_MAX_RASTER_PIXELS,
    'het maximale kwaliteitsbudget blijft de globale rastergrens');
}
{
  const absurdlyLong = mkTask('very-long', 'Veilige lange tijdas', {
    time: mkTime({
      earlyStart: '2026-01-05', earlyFinish: '2526-01-03',
      scheduleStart: '2026-01-05', scheduleFinish: '2526-01-03',
    }),
  });
  const rendered = record([absurdlyLong], [], cal, baseOptions({ paperSize: 'A4', orientation: 'landscape' }));
  ok(rendered.paths.length < 6_000,
    `lange auto-fit-tijdas begrenst onzichtbare rasterarbeid (got ${rendered.paths.length})`);
}

if (failures > 0) { console.log(`print-report: ${failures} faalregels`); process.exit(1); }
console.log('print-report: alles groen');
