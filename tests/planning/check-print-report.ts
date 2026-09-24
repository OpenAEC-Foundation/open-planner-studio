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
import {
  renderReport, measurePrintReport, PrintOptions, REPORT_MIN_ZOOM, buildPrintRows, measureTaskNameColumnWidth, measureCurveColumnWidth,
  measureTableColumnWidths, AUTO_COLUMN_MIN_WIDTH,
  NAME_COLUMN_WIDTH_DEFAULT, NAME_COLUMN_WIDTH_MIN, NAME_COLUMN_AUTO_MAX,
} from '@/services/print/printPreview';
import { computeTileLayout, footerLayoutWidthFor, PAPER_PT } from '@/services/print/tileLayout';
import { fitColumnsToHeaders, makeSectionedRenderReport, makeTableRenderReport } from '@/services/pdf/pdfTable';
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

import nlReport from '@/i18n/locales/nl/report.json';
import enReport from '@/i18n/locales/en/report.json';
import frReport from '@/i18n/locales/fr/report.json';
import nlCommon from '@/i18n/locales/nl/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import frCommon from '@/i18n/locales/fr/common.json';

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
  // Gevulde paden (mijlpaal- en baselineruiten, samenvattingshaakjes) — `fill()` legde ze eerder
  // stil weg, waardoor een ruit die over de tabel steekt onzichtbaar bleef voor de tests.
  const fills: PathEv[] = [];
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
    closePath() {}, fill() { if (curPath) fills.push({ pts: curPath, color: st.fillStyle, dash: [], seq: seq++ }); curPath = null; },
    stroke() { if (curPath) paths.push({ pts: curPath, color: st.strokeStyle, dash: [...st.dash], seq: seq++ }); curPath = null; },
    roundRect(x, y, w, h) { roundRects.push({ x, y, w, h, color: st.fillStyle, strokeColor: st.strokeStyle, mode: 'fill', seq: seq++ }); },
    fillText(text, x, y) { texts.push({ text, x, y, color: st.fillStyle, font: st.font, seq: seq++ }); },
    measureText(t) { return measure(t); },
  };
  const dims = renderReport(() => d2d, tasks, sequences, calendar, 'P', options);
  return { texts, rects, paths, roundRects, fills, dims };
}

// ── Fixtures ───────────────────────────────────────────────────────────────────────────────────
// Het PRINTpalet loopt bewust niet mee met de U2-schermkleuren: papier is wit, dus de verzadigde
// merkhexen blijven staan (zie de toelichting bij PRINT_PALETTE in themePalette.ts).
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
  { kind: 'group', rowKey: 'group:metselaar', key: '["Metselaar"]', label: 'Metselaar', count: 1, depth: 0, levelIndex: 0, collapsed: false },
  { kind: 'task', rowKey: T_NORM.id, task: T_NORM, depth: 1, dimmed: false },
  { kind: 'task', rowKey: T_CRIT.id, task: T_CRIT, depth: 1, dimmed: false },
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
    noTasks: '-', printed: '-', today: '-', statusDate: 'Statusdatum',
    progressDate: 'Voortgangsdatum',
    legend: {
      criticalPath: 'Kritiek pad', normal: 'Normaal', nearCritical: 'Bijna-kritiek',
      milestone: 'Mijlpaal', summary: 'Samenvatting', float: 'Speling', completion: 'Voortgang',
      relationStyle: 'Bepalend / niet-bepalend',
    },
    tableHeaders: { wbs: 'WBS', taskName: 'Taak', start: 'Start', end: 'Eind', duration: 'Duur', completion: 'Volt.' },
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
  let logicalTableWidth = 0;
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
    logicalTableWidth = dims.tableWidth;
    ok(Math.abs(layout.scale - 0.75) < 0.000_001,
      `#74 ${paperSize} ${orientation}, tijdlijn over ${timelineColumns}: auto-fit houdt vaste rapporttekst-schaal 0,75 (got ${layout.scale})`);
    ok(layout.cols === timelineColumns,
      `#74 ${paperSize} ${orientation}, tijdlijn over ${timelineColumns}: juiste horizontale pagina-indeling (got ${layout.cols})`);
  }
  ok(physicalTableWidths.every(width => Math.abs(width - physicalTableWidths[0]) < 0.000_001),
    `#74 alle papier-/tijdlijncombinaties: tabel houdt gelijke fysieke breedte (got ${physicalTableWidths.join(' / ')})`);
  const manualLayout = computeTileLayout({
    paperSize: 'a3', orientation: 'landscape', mode: 'actual',
    logicalWidth: 720, logicalHeight: 900, frozenColumnWidthPx: logicalTableWidth,
  });
  ok(Math.abs(manualLayout.scale - 0.75) < 0.000_001,
    `#74 handmatige zoom houdt dezelfde rapporttekst-schaal (got ${manualLayout.scale})`);
  ok(Math.abs(logicalTableWidth * manualLayout.scale - physicalTableWidths[0]) < 0.000_001,
    `#74 handmatige zoom houdt tabel fysiek even groot als auto-fit (got ${logicalTableWidth * manualLayout.scale})`);
  ok(REPORT_MIN_ZOOM === 1, 'handmatige rapportzoom kan tot 1 px/dag terug voor lange projecten');
}

// ── 6. A2-papierformaat (#83) ─────────────────────────────────────────────────────────────────
// Eén definitie voedt zowel de live preview als de raster- en vector-PDF-pagineerder. A2 is precies
// de ISO-216-tussenmaat: A3 verdubbeld, A1 gehalveerd.
{
  const a2 = PAPER_PT.a2;
  ok(a2.width === PAPER_PT.a3.height && a2.height === PAPER_PT.a1.width,
    `#83 A2 gebruikt de gedeelde ISO-afmetingen (got ${a2.width}×${a2.height} pt)`);
  // Issue #110 punt 3 — rij-bewuste paginering: met breekposities eindigt elke body-tegel op de
  // laatste breek die past; zonder breekposities blijft de tegeling byte-identiek.
  {
    const base = { paperSize: 'a4' as const, orientation: 'portrait' as const, mode: 'fit-width' as const, logicalWidth: 800, logicalHeight: 3000, frozenColumnWidthPx: 0 };
    const plain = computeTileLayout(base);
    const pageSrcH = plain.printH / plain.scale;
    // Rijen van 26 px vanaf y = 66 (titel + kop), zoals pdfTable.
    const rowBreaks: number[] = [];
    for (let y = 66 + 26; y < 3000; y += 26) rowBreaks.push(y);
    const broken = computeTileLayout({ ...base, breakOffsetsPx: rowBreaks });
    ok(plain.bodyRows.every(r => r.srcH <= pageSrcH + 1e-9), 'tegels zonder breekposities passen op de pagina');
    ok(broken.bodyRows.every(r => r.srcH <= pageSrcH + 1e-9), 'tegels met breekposities passen op de pagina');
    ok(broken.bodyRows.slice(0, -1).every(r => rowBreaks.includes(r.srcY + r.srcH)),
      'elke tegel (behalve de laatste) eindigt op een rijgrens');
    ok(broken.bodyRows[0].srcY === 0 && broken.bodyRows.every((r, i) => i === 0 || r.srcY === broken.bodyRows[i - 1].srcY + broken.bodyRows[i - 1].srcH),
      'tegels sluiten aan zonder gat of overlap');
    const last = broken.bodyRows[broken.bodyRows.length - 1];
    ok(Math.abs(last.srcY + last.srcH - 3000) < 1e-9, 'de laatste tegel eindigt op de bronhoogte');
    ok(broken.rows === broken.bodyRows.length && broken.rows >= plain.rows, 'rows = aantal tegels, nooit minder dan de vaste tegeling');
    ok(JSON.stringify(computeTileLayout({ ...base, breakOffsetsPx: [] }).bodyRows) === JSON.stringify(plain.bodyRows), 'lege breeklijst ⇒ byte-identiek');
    // Rijen HOGER dan de pagina (breaks op 1500/3000/4500 bij ±1140 px per pagina): geen passende
    // breek ⇒ volle pagina; en de restpagina erna mag geen runt worden (vulgraad ≥ 50%, bevinding 10).
    const tall = computeTileLayout({ ...base, logicalHeight: 6000, breakOffsetsPx: [1500, 3000, 4500] });
    ok(tall.bodyRows.every(r => r.srcH > 0 && r.srcH <= pageSrcH + 1e-9), 'te hoge rijen ⇒ elke tegel ≤ paginahoogte, eindig');
    ok(tall.bodyRows.slice(0, -1).every(r => r.srcH >= 0.5 * pageSrcH), `te hoge rijen ⇒ geen runt-pagina's (${tall.bodyRows.map(r => Math.round(r.srcH)).join(',')})`);
    ok(tall.bodyRows.some(r => r.srcH === pageSrcH), 'te hoge rijen ⇒ minstens één gedwongen volle pagina');
    // Een breek vlak onder de kop (10 px) mag de eerste pagina niet tot 10 px reduceren.
    const early = computeTileLayout({ ...base, logicalHeight: 3000, breakOffsetsPx: [10, 2500] });
    ok(early.bodyRows[0].srcH >= 0.5 * pageSrcH, 'vroege breek ⇒ eerste pagina geen runt');
    // Issue #113 — GEDWONGEN posities: een tegel eindigt op de eerste gedwongen positie die past, óók
    // als dat een dunne pagina geeft (blad per resource); één die niet past telt als gewone positie en
    // wordt op een latere pagina alsnog gehonoreerd; een lege lijst is byte-identiek.
    const thinY = 66 + 26 * 3;
    const forcedThin = computeTileLayout({ ...base, breakOffsetsPx: rowBreaks, forcedBreakOffsetsPx: [thinY] });
    ok(forcedThin.bodyRows[0].srcY + forcedThin.bodyRows[0].srcH === thinY, `gedwongen positie ⇒ dunne eerste pagina (got ${forcedThin.bodyRows[0].srcH})`);
    ok(forcedThin.bodyRows[1].srcY === thinY, 'de tweede pagina begint precies op de gedwongen positie');
    ok(forcedThin.bodyRows.slice(1, -1).every(r => rowBreaks.includes(r.srcY + r.srcH)), 'na de gedwongen positie weer gewone rijgrenzen');
    const farY = 4000;
    const tallBreaks: number[] = [];
    for (let y = 66 + 26; y < 6000; y += 26) tallBreaks.push(y);
    const forcedFar = computeTileLayout({ ...base, logicalHeight: 6000, breakOffsetsPx: tallBreaks, forcedBreakOffsetsPx: [farY] });
    ok(forcedFar.bodyRows[0].srcH >= 0.5 * pageSrcH, 'gedwongen positie buiten de eerste pagina ⇒ eerste pagina gewoon gevuld');
    ok(forcedFar.bodyRows.some(r => r.srcY + r.srcH === farY), 'een verre gedwongen positie wordt later alsnog gehonoreerd');
    ok(forcedFar.bodyRows.every(r => r.srcH <= pageSrcH + 1e-9), 'gedwongen posities laten geen tegel boven de paginahoogte uitkomen');
    ok(JSON.stringify(computeTileLayout({ ...base, breakOffsetsPx: rowBreaks, forcedBreakOffsetsPx: [] }).bodyRows) === JSON.stringify(broken.bodyRows), 'lege gedwongen lijst ⇒ byte-identiek');
  }

  // Gantt-afdruk (issue #110, Manu's nabespreking): de render levert per taakrij een breekpositie,
  // en de pagineerder eindigt elke pagina op zo'n rijgrens — ook met herhaalde kop.
  {
    const many = Array.from({ length: 120 }, (_, i) => ({ ...T_NORM, id: `g${i}`, name: `Taak ${i}`, wbsCode: String(i + 1) }));
    const dims = measurePrintReport(many, [], cal, 'Rijgrenzen', baseOptions());
    ok(dims.breakOffsets?.length === many.length, 'Gantt-render: één breekpositie per printrij');
    ok((dims.breakOffsets ?? []).every((y, i, arr) => i === 0 || y - arr[i - 1] === arr[1] - arr[0]),
      'Gantt-render: breekposities liggen op vaste rijhoogte');
    ok((dims.breakOffsets ?? [])[0] > dims.headerHeight, 'Gantt-render: eerste breek ligt onder de kopstrook');
    const set = new Set(dims.breakOffsets);
    for (const repeat of [0, dims.headerHeight]) {
      const layout = computeTileLayout({
        paperSize: 'a4', orientation: 'landscape', mode: 'fit-width',
        logicalWidth: dims.width, logicalHeight: dims.height, frozenColumnWidthPx: dims.tableWidth,
        repeatHeaderHeightPx: repeat, breakOffsetsPx: dims.breakOffsets,
      });
      ok(layout.rows > 1, `Gantt (kop ${repeat ? 'herhaald' : 'niet herhaald'}): meer dan één pagina`);
      ok(layout.bodyRows.slice(0, -1).every(r => set.has(r.srcY + r.srcH)),
        `Gantt (kop ${repeat ? 'herhaald' : 'niet herhaald'}): elke pagina eindigt op een rijgrens`);
    }
  }

  // Resourcediagram (issue #113, "een blad per persoon"): met `pageBreakBeforeGroups` levert de render
  // vóór elke bandrij ná de eerste een gedwongen breekpositie — op een bestaande rijgrens — en de
  // pagineerder begint elke band op een nieuwe pagina, ook al passen alle rijen samen op één.
  {
    const bands: ViewRow[] = [];
    for (let b = 0; b < 3; b++) {
      bands.push({ kind: 'group', rowKey: `band${b}`, key: `band${b}`, label: `Resource ${b}`, count: 2, depth: 0, levelIndex: 0, collapsed: false });
      for (let i = 0; i < 2; i++) {
        const task = { ...T_NORM, id: `b${b}t${i}`, name: `Taak ${b}.${i}` };
        bands.push({ kind: 'task', rowKey: task.id, task, depth: 1, dimmed: false });
      }
    }
    const bandTasks = bands.flatMap(r => (r.kind === 'task' ? [r.task] : []));
    const plain = measurePrintReport(bandTasks, [], cal, 'Resourcediagram', baseOptions({ rows: bands }));
    ok(plain.forcedBreakOffsets === undefined, 'zonder pageBreakBeforeGroups: geen gedwongen posities');
    const forced = measurePrintReport(bandTasks, [], cal, 'Resourcediagram', baseOptions({ rows: bands, pageBreakBeforeGroups: true }));
    const rowH = (forced.breakOffsets ?? [])[1] - (forced.breakOffsets ?? [])[0];
    ok(JSON.stringify(forced.forcedBreakOffsets) === JSON.stringify([forced.headerHeight + 3 * rowH, forced.headerHeight + 6 * rowH]),
      `gedwongen posities vóór band 2 en 3 (got ${JSON.stringify(forced.forcedBreakOffsets)})`);
    const allowed = new Set(forced.breakOffsets);
    ok((forced.forcedBreakOffsets ?? []).every(y => allowed.has(y)), 'elke gedwongen positie is ook een toegestane rijgrens');
    const tile = {
      paperSize: 'a4' as const, orientation: 'landscape' as const, mode: 'fit-width' as const,
      logicalWidth: forced.width, logicalHeight: forced.height, frozenColumnWidthPx: forced.tableWidth,
      repeatHeaderHeightPx: forced.headerHeight, breakOffsetsPx: forced.breakOffsets,
    };
    ok(computeTileLayout(tile).rows === 1, 'negen rijen passen zonder gedwongen posities op één pagina');
    const perBand = computeTileLayout({ ...tile, forcedBreakOffsetsPx: forced.forcedBreakOffsets });
    ok(perBand.rows === 3, `drie banden ⇒ drie pagina's (got ${perBand.rows})`);
    ok(perBand.bodyRows[0].srcY + perBand.bodyRows[0].srcH === forced.forcedBreakOffsets![0]
      && perBand.bodyRows[1].srcY + perBand.bodyRows[1].srcH === forced.forcedBreakOffsets![1],
      'pagina 1 en 2 eindigen exact op de bandgrens');
    // Eén band ⇒ niets te breken: geen gedwongen posities, dus ook geen lege eerste pagina.
    const single = measurePrintReport(bandTasks.slice(0, 2), [], cal, 'Eén resource', baseOptions({ rows: bands.slice(0, 3), pageBreakBeforeGroups: true }));
    ok(single.forcedBreakOffsets === undefined, 'één band ⇒ geen gedwongen posities');
    // Typelaag (manuvarkey punt 2): een band direct ónder een band krijgt géén eigen gedwongen
    // positie — de typekop blijft bij zijn eerste resource; de tweede resource onder hetzelfde type
    // en de volgende typekop breken wél.
    const typed: ViewRow[] = [
      { kind: 'group', rowKey: 'type0', key: 'type0', label: 'Ploeg', count: 4, depth: 0, levelIndex: 0, collapsed: false },
      ...bands.slice(0, 6).map(r => ({ ...r, depth: r.depth + 1 })),
      { kind: 'group', rowKey: 'type1', key: 'type1', label: 'Materieel', count: 2, depth: 0, levelIndex: 0, collapsed: false },
      ...bands.slice(6).map(r => ({ ...r, depth: r.depth + 1 })),
    ];
    const typedForced = measurePrintReport(bandTasks, [], cal, 'Resourcediagram', baseOptions({ rows: typed, pageBreakBeforeGroups: true }));
    ok(JSON.stringify(typedForced.forcedBreakOffsets) === JSON.stringify([typedForced.headerHeight + 4 * rowH, typedForced.headerHeight + 7 * rowH]),
      `typelaag: gedwongen posities vóór resource 2 (rij 4) en typeband 2 (rij 7), niet vóór een band direct onder een typekop (got ${JSON.stringify(typedForced.forcedBreakOffsets)})`);

    // Tijdvenster (manuvarkey punt 3): de tijdas loopt exact over het venster (einde inclusief, geen
    // marge van 7/14 dagen), balken worden op de chartrand geklemd, en een taak buiten het venster
    // tekent geen balk en geen balklabel (zijn tabelrij blijft: welke rijen meedoen beslist de
    // rijenbron). Zonder venster byte-identiek. Venster 10–14 jan bij 60 px/dag: de kritieke taak
    // (12–16 jan) begint 120 px in de chart — ruimte voor het label links van de balk — en wordt
    // rechts afgekapt; de zichtbare (5–9 jan) en de gefilterde (19–23 jan) taak vallen erbuiten.
    {
      const win = { from: '2026-01-10', to: '2026-01-14' };
      const fixed = baseOptions({ autoFit: false, customZoom: 60, showFloat: false });
      const rec = record(FIX_TASKS, [], cal, { ...fixed, timeWindow: win });
      const d = rec.dims;
      ok(Math.abs(d.width - (d.tableWidth + 5 * 60)) < 1e-6, `venster van 5 dagen ⇒ chart 5 × zoom breed (got ${d.width - d.tableWidth})`);
      const inBody = (y: number) => y >= d.headerHeight && y < d.height - d.footerHeight;
      const bars = rec.roundRects.filter(r => (r.color === CRITICAL || r.color === NORMAL) && inBody(r.y));
      ok(bars.length === 1 && bars[0].color === CRITICAL, `alleen de kritieke taak tekent een balk (got ${bars.length})`);
      ok(bars.every(b => b.x >= d.tableWidth - 1e-6 && b.x + b.w <= d.width + 1e-6), 'de balk ligt binnen het chartgebied');
      ok(Math.abs(bars[0].x - (d.tableWidth + 2 * 60)) < 1e-6 && Math.abs(bars[0].x + bars[0].w - d.width) < 1e-6,
        'de balk begint op 12 jan en eindigt op de rechter chartrand, niet erbuiten');
      const chartTexts = rec.texts.filter(t => t.x >= d.tableWidth && inBody(t.y)).map(t => t.text);
      ok(chartTexts.some(t => t.startsWith('Kritieke')), `balklabel van de kritieke taak in de chart (got ${JSON.stringify(chartTexts)})`);
      ok(!chartTexts.some(t => t.startsWith('Gefilterde') || t.startsWith('Zichtbare')), 'taken buiten het venster: geen balklabel');
      ok(rec.texts.filter(t => t.text === T_HIDDEN.name && t.x < d.tableWidth).length === 1, 'taak buiten het venster houdt zijn tabelrij');
      ok(JSON.stringify(record(FIX_TASKS, [], cal, fixed)) === JSON.stringify(record(FIX_TASKS, [], cal, { ...fixed, timeWindow: undefined })),
        'zonder venster byte-identiek');

      // Review-bevinding 2: een mijlpaal op de eerste vensterdag bij lage zoom (4 px/dag, ruit ± 6 px)
      // hangt niet half over de tabel — het middelpunt wordt naar binnen geklemd. Niets in het
      // chartgebied (gevulde paden, balken, lijnen) ligt links van de tabelrand of rechts van de chart.
      const ms = mkTask('t-ms', 'Mijlpaal', { isMilestone: true, time: mkTime({ earlyStart: '2026-01-10', earlyFinish: '2026-01-10', scheduleStart: '2026-01-10', scheduleFinish: '2026-01-10' }) });
      const low = record([ms, T_CRIT], [], cal, { ...fixed, customZoom: 4, timeWindow: win });
      const ld = low.dims;
      const inBodyPt = (y: number) => y >= ld.headerHeight && y < ld.height - ld.footerHeight;
      // `pts.length > 0`: een lege `beginPath(); roundRect(); fill()` (voortgangsoverlay) mag de
      // assertie niet vacuüm vervullen (review ronde 2, bevinding 9).
      const bodyFills = low.fills.filter(f => f.pts.length > 0 && f.pts.every(p => inBodyPt(p.y)));
      ok(bodyFills.length >= 1, `de ruit wordt getekend (got ${bodyFills.length} gevulde paden)`);
      ok(bodyFills.every(f => f.pts.every(p => p.x >= ld.tableWidth - 1e-6 && p.x <= ld.width + 1e-6)),
        `ruit binnen het chartgebied (got ${JSON.stringify(bodyFills.map(f => f.pts.map(p => Math.round(p.x * 100) / 100)))}, tabel ${ld.tableWidth}, chart tot ${ld.width})`);
      const lowBars = low.roundRects.filter(r => (r.color === CRITICAL || r.color === NORMAL) && inBodyPt(r.y));
      ok(lowBars.every(b => b.x >= ld.tableWidth - 1e-6 && b.x + b.w <= ld.width + 1e-6), 'ook bij 4 px/dag blijft de balk binnen de chart');
      // Review-bevinding 7: de 3 px-minimumbreedte steekt niet meer over de rechter chartrand.
      const tiny = record([T_CRIT], [], cal, { ...fixed, customZoom: 1, timeWindow: { from: '2026-01-10', to: '2026-01-12' } });
      const tinyBar = tiny.roundRects.find(r => r.color === CRITICAL && r.y >= tiny.dims.headerHeight && r.y < tiny.dims.height - tiny.dims.footerHeight);
      ok(!!tinyBar && tinyBar.x + tinyBar.w <= tiny.dims.width + 1e-6 && tinyBar.w >= 3 - 1e-6, `minimumbreedte naar binnen geschoven en op de chartrand geklemd (got ${JSON.stringify(tinyBar)}, chart tot ${tiny.dims.width})`);
      // Lege staat: een lange instructie wordt op woordgrenzen gewrapt, nooit halverwege afgekapt.
      // De testmeter rekent 6 px per teken; deze tekst is 143 tekens = 858 px, dus minstens twee regels.
      const lang = 'Keine Vorgänge im Berichtszeitraum — wählen Sie einen anderen Zeitraum oder Gesamtes Projekt, um alle Vorgänge des Projekts wieder zu sehen.';
      const leeg = record([], [], cal, baseOptions({ labels: { ...baseOptions().labels!, noTasks: lang } }));
      const leegTexts = leeg.texts.map(t => t.text);
      ok(leegTexts.length >= 2 && leegTexts.join(' ') === lang && leegTexts.every(t => !t.includes('…')),
        `lege staat gewrapt zonder afkappen (got ${JSON.stringify(leegTexts)})`);
    }

    // Toewijzingskolommen (manuvarkey punt 1): twee kolommen direct achter de naam (x 180–225 en
    // 225–300 bij de standaardnaamkolom van 130), gevuld per rijsleutel; de tabel wordt precies de
    // twee kolombreedtes breder; zonder de optie (ook mét `rowAssignments`) byte-identiek.
    {
      const aBands: ViewRow[] = [
        { kind: 'group', rowKey: 'b', key: 'b', label: 'Metselaar', count: 2, depth: 0, levelIndex: 0, collapsed: false },
        { kind: 'task', rowKey: 'b/norm', task: T_NORM, depth: 1, dimmed: false },
        { kind: 'task', rowKey: 'b/crit', task: T_CRIT, depth: 1, dimmed: false },
      ];
      const rowAssignments = new Map([
        ['b/norm', { unitsPerDay: 1.5, curve: 'FRONT_LOADED' as const }],
        ['b/crit', { unitsPerDay: 2, curve: null }],
      ]);
      const plainA = record([T_NORM, T_CRIT], [], cal, baseOptions({ rows: aBands }));
      const withCols = record([T_NORM, T_CRIT], [], cal, baseOptions({
        rows: aBands, assignmentColumns: true, rowAssignments, curveLabels: { FRONT_LOADED: 'Vooraan belast' },
      }));
      ok(withCols.dims.tableWidth === plainA.dims.tableWidth + 45 + 98, `tabel precies twee kolommen breder (got +${withCols.dims.tableWidth - plainA.dims.tableWidth})`);
      const inCol = (t: { x: number; y: number }, x0: number, x1: number) => t.x >= x0 && t.x <= x1 && t.y > withCols.dims.headerHeight && t.y < withCols.dims.height - withCols.dims.footerHeight;
      const unitsTexts = withCols.texts.filter(t => inCol(t, 180, 225)).map(t => t.text).sort();
      const curveTexts = withCols.texts.filter(t => inCol(t, 225, 300)).map(t => t.text).sort();
      ok(JSON.stringify(unitsTexts) === JSON.stringify(['1.5', '2']), `eenheden per rij in de kolom (got ${JSON.stringify(unitsTexts)})`);
      // De testmeter rekent 6 px per teken, dus "Vooraan belast" (84 px) kapt in de 75 px-kolom af op
      // een beletselteken — dat is het bedoelde `fitText`-gedrag; met het echte 8 px-font past het.
      ok(curveTexts.length === 2 && curveTexts.some(t => t.startsWith('Vooraan be')) && curveTexts.includes('—'),
        `vertaalde curve (desnoods afgekort), streepje bij verschillende curves (got ${JSON.stringify(curveTexts)})`);
      const heads = withCols.texts.filter(t => t.y <= withCols.dims.headerHeight).map(t => t.text);
      ok(heads.includes('Eenh./d') && heads.includes('Curve'), 'kolomkoppen aanwezig (Nederlandse terugval zonder label)');
      ok(!plainA.texts.some(t => t.text === 'Eenh./d' || t.text === 'Vooraan belast'), 'zonder optie geen kolommen');
      ok(JSON.stringify(record([T_NORM, T_CRIT], [], cal, baseOptions({ rows: aBands, rowAssignments }))) === JSON.stringify(plainA),
        'rowAssignments zonder assignmentColumns ⇒ byte-identiek');

      // Restpunt review #138 (ronde 2, bevinding 5), aangescherpt na review #139 (twee rondes): laat
      // de tabel mét kolommen minder dan `minChartWidthPx` (een vijfde van de printbreedte, vloer
      // 160 px) tijdlijn over op één papierbreedte, dan laat de render de twee kolommen vallen en
      // meldt dat — monotoon in de tabelbreedte. A4 liggend is 1058,5 px breed ⇒ de tabel mag 846,8
      // px zijn: een naamkolom van 500 px geeft 893 px mét de kolommen.
      const a4 = { paperSize: 'A4' as const, orientation: 'landscape' as const };
      const wideOpts = baseOptions({ rows: aBands, assignmentColumns: true, rowAssignments, ...a4, taskNameColumnWidth: 500 });
      const wide = record([T_NORM, T_CRIT], [], cal, wideOpts);
      const wideNoCols = record([T_NORM, T_CRIT], [], cal, { ...wideOpts, assignmentColumns: false, rowAssignments: undefined });
      ok(wide.dims.assignmentColumnsDropped === true, 'brede naamkolom ⇒ toewijzingskolommen weggelaten en gemeld');
      ok(wide.dims.tableWidth === wideNoCols.dims.tableWidth && !wide.texts.some(t => t.text === 'Eenh./d'),
        'weggelaten ⇒ dezelfde tabel als zonder de optie, geen kolomkop');
      ok(withCols.dims.assignmentColumnsDropped === undefined, 'gewone naamkolom ⇒ kolommen blijven, geen melding');
      // Monotoon: ook een tabel die zónder de kolommen te breed blijft (800 px naamkolom: 1050 px)
      // laat ze vallen — weglaten maakt de tijdas nooit smaller (review #139 ronde 2, bevinding 3).
      const wider = record([T_NORM, T_CRIT], [], cal, baseOptions({ rows: aBands, assignmentColumns: true, rowAssignments, ...a4, taskNameColumnWidth: 800 }));
      ok(wider.dims.assignmentColumnsDropped === true && !wider.texts.some(t => t.text === 'Eenh./d'),
        'tabel ook zonder de kolommen te breed ⇒ kolommen tóch weggelaten (monotoon)');
      // A4 staand (729,7 px, vloer 160 ⇒ 569,7 px tabel) met verse instellingen: 523 px past.
      const portrait = record([T_NORM, T_CRIT], [], cal, baseOptions({ rows: aBands, assignmentColumns: true, rowAssignments, paperSize: 'A4', orientation: 'portrait' }));
      ok(portrait.dims.assignmentColumnsDropped === undefined && portrait.texts.some(t => t.text === 'Eenh./d'),
        'A4 staand met standaardinstellingen ⇒ kolommen blijven');
      // De dode zone van de tussenvariant: A4 staand, naamkolom 350 ⇒ 743 px mét (past de pagina niet
      // eens), 600 px zonder (past de pagina, maar niet de grens). Kolommen weg, tijdas 129,7 px.
      const dead = record([T_NORM, T_CRIT], [], cal, baseOptions({ rows: aBands, assignmentColumns: true, rowAssignments, paperSize: 'A4', orientation: 'portrait', taskNameColumnWidth: 350 }));
      ok(dead.dims.assignmentColumnsDropped === true && dead.dims.tableWidth === 600,
        `A4 staand met naamkolom 350 ⇒ kolommen weggelaten, tabel 600 px (got ${dead.dims.tableWidth})`);
      // De lettergrootte schaalt de tabel mee, de grens niet: 125 % op A4 staand geeft 654 px ⇒ weg.
      const bigFont = record([T_NORM, T_CRIT], [], cal, baseOptions({ rows: aBands, assignmentColumns: true, rowAssignments, paperSize: 'A4', orientation: 'portrait', reportFontScale: 125 }));
      ok(bigFont.dims.assignmentColumnsDropped === true, 'grote lettergrootte op A4 staand ⇒ kolommen weggelaten');

      // Restpunt bevinding 8: een venster zonder werkdag valt op de kalender-as terug — en nummert
      // dan óók de weekenddagen, anders staat er geen enkel dagcijfer in de kop.
      const weekend = record([T_CRIT], [], cal, baseOptions({ compressNonWorkdays: true, autoFit: false, customZoom: 20, timeWindow: { from: '2026-01-10', to: '2026-01-11' } }));
      const headTexts = weekend.texts.filter(t => t.y <= weekend.dims.headerHeight).map(t => t.text);
      ok(headTexts.includes('10') && headTexts.includes('11'), `weekendvenster op de kalender-as toont de dagcijfers 10 en 11 (got ${JSON.stringify(headTexts)})`);

      // Restpunt bevinding 10: het decimaalteken volgt de app-taal via `numberLocale`.
      const nlUnits = record([T_NORM, T_CRIT], [], cal, baseOptions({ rows: aBands, assignmentColumns: true, rowAssignments, numberLocale: 'nl' }));
      ok(nlUnits.texts.some(t => t.text === '1,5' && inCol(t, 180, 225)), 'numberLocale nl ⇒ "1,5" in de eenhedenkolom');
      ok(withCols.texts.some(t => t.text === '1.5' && inCol(t, 180, 225)), 'zonder numberLocale ⇒ "1.5"');
      // Review #139 bevinding 5: de Duur-cel in dezelfde tabel volgt dezelfde notatie.
      const T_HALF = mkTask('t-half', 'Halve dag', { time: mkTime({ scheduleDuration: 2.5 }) });
      const nlDur = record([T_HALF], [], cal, baseOptions({ numberLocale: 'nl' }));
      const plainDur = record([T_HALF], [], cal, baseOptions());
      ok(nlDur.texts.some(t => t.text === '2,5d') && plainDur.texts.some(t => t.text === '2.5d'),
        `duurcel volgt numberLocale ("2,5d" in nl, "2.5d" zonder; got ${JSON.stringify(nlDur.texts.filter(t => t.text.endsWith('d')).map(t => t.text))})`);
      // manuvarkey op #113: de curvekolom is zo breed als de langste curvenaam in dít rapport, met
      // 98 px als maximum (alle talen) en 40 px als vloer; zonder meting het maximum, byte-identiek.
      const narrow = record([T_NORM, T_CRIT], [], cal, baseOptions({ rows: aBands, assignmentColumns: true, rowAssignments, curveColumnWidth: 50 }));
      ok(withCols.dims.tableWidth - narrow.dims.tableWidth === 48, `curveColumnWidth 50 ⇒ tabel 48 px smaller (got ${withCols.dims.tableWidth - narrow.dims.tableWidth})`);
      ok(record([T_NORM, T_CRIT], [], cal, baseOptions({ rows: aBands, assignmentColumns: true, rowAssignments, curveColumnWidth: 10 })).dims.tableWidth === withCols.dims.tableWidth - 58,
        'curveColumnWidth onder de vloer ⇒ 40 px');
      ok(record([T_NORM, T_CRIT], [], cal, baseOptions({ rows: aBands, assignmentColumns: true, rowAssignments, curveColumnWidth: 500 })).dims.tableWidth === withCols.dims.tableWidth,
        'curveColumnWidth boven het maximum ⇒ 98 px');
      const meter = (text: string) => text.length * 6;
      ok(measureCurveColumnWidth(['Curve', 'Uniform'], meter) === 51 && measureCurveColumnWidth(['—'], meter) === 40
        && measureCurveColumnWidth(['Een heel erg lange curvenaam'], meter) === 98,
        `measureCurveColumnWidth: langste label + 2×celmarge + 1, geklemd op 40..98 (got ${measureCurveColumnWidth(['Curve', 'Uniform'], meter)})`);
      const T_NAN = mkTask('t-nan', 'Onbekende duur', { time: mkTime({ scheduleDuration: NaN }) });
      const nanDur = record([T_NAN], [], cal, baseOptions());
      ok(nanDur.texts.some(t => t.text === '—') && !nanDur.texts.some(t => t.text === 'd'), 'niet-eindige duur ⇒ streepje, geen losse "d"');
    }
    // Dezelfde drie banden in de overige pagineermodi (review op #132, bevinding 9): zonder
    // kopherhaling, in 'actual' (1 pt = 1 px, horizontaal getegeld) en met de tijdlijn over twee
    // paginabreedtes — steeds drie body-rijen die exact op de bandgrenzen eindigen.
    const forcedSet = new Set(forced.forcedBreakOffsets);
    const endsOnBands = (l: ReturnType<typeof computeTileLayout>) =>
      l.bodyRows.length === 3 && l.bodyRows.slice(0, -1).every(r => forcedSet.has(r.srcY + r.srcH));
    ok(endsOnBands(computeTileLayout({ ...tile, repeatHeaderHeightPx: 0, forcedBreakOffsetsPx: forced.forcedBreakOffsets })),
      'blad per band zonder kopherhaling: drie pagina\'s op de bandgrenzen');
    const actual = computeTileLayout({ ...tile, mode: 'actual', forcedBreakOffsetsPx: forced.forcedBreakOffsets });
    ok(endsOnBands(actual) && actual.rows * actual.cols === 3 * actual.cols,
      `blad per band in 'actual': drie rijen × ${actual.cols} kolom(men) (got ${actual.rows}×${actual.cols})`);
    const twoCols = computeTileLayout({ ...tile, timelineColumns: 2, forcedBreakOffsetsPx: forced.forcedBreakOffsets });
    ok(endsOnBands(twoCols) && twoCols.cols === 2 && twoCols.rows * twoCols.cols === 6,
      `blad per band met tijdlijn over 2 pagina's: 3 × 2 = 6 pagina's (got ${twoCols.rows}×${twoCols.cols})`);
  }

  // Voet op elke pagina (issue #113, "een blad per persoon"): de render meldt zijn voethoogte, de
  // tegeling houdt onderaan elke pagina die strook vrij (body tot `logicalHeight - voet`), en zonder
  // de optie is alles byte-identiek — inclusief de oude situatie waarin de voet aan de laatste
  // body-tegel hangt.
  {
    const many = Array.from({ length: 120 }, (_, i) => ({ ...T_NORM, id: `f${i}`, name: `Taak ${i}`, wbsCode: String(i + 1) }));
    const dims = measurePrintReport(many, [], cal, 'Voet', baseOptions());
    ok((dims.footerHeight ?? 0) > 0, `Gantt-render meldt een voethoogte (got ${dims.footerHeight})`);
    const lastBreak = (dims.breakOffsets ?? [])[dims.breakOffsets!.length - 1];
    ok(Math.abs(lastBreak + dims.footerHeight! - dims.height) < 1e-9, 'de voet is precies het stuk onder de laatste rijgrens');
    const scaled = measurePrintReport(many, [], cal, 'Voet', baseOptions({ reportFontScale: 125 }));
    ok(Math.abs(scaled.footerHeight! - dims.footerHeight! * 1.25) < 1e-9, 'de voethoogte schaalt met de rapport-lettergrootte');
    const tile = {
      paperSize: 'a4' as const, orientation: 'landscape' as const, mode: 'fit-width' as const,
      logicalWidth: dims.width, logicalHeight: dims.height, frozenColumnWidthPx: dims.tableWidth,
      repeatHeaderHeightPx: dims.headerHeight, breakOffsetsPx: dims.breakOffsets,
    };
    const plain = computeTileLayout(tile);
    const withFooter = computeTileLayout({ ...tile, repeatFooterHeightPx: dims.footerHeight });
    ok(plain.repeatFooterPx === 0 && plain.footerTopPt === plain.marginPt + plain.printH, 'zonder optie: geen voetstrook, voetrand = onderrand printgebied');
    ok(JSON.stringify(computeTileLayout({ ...tile, repeatFooterHeightPx: 0 }).bodyRows) === JSON.stringify(plain.bodyRows), 'repeatFooterHeightPx 0 ⇒ byte-identiek');
    const lastPlain = plain.bodyRows[plain.bodyRows.length - 1];
    ok(Math.abs(lastPlain.srcY + lastPlain.srcH - dims.height) < 1e-9, 'zonder optie hangt de voet aan de laatste body-tegel (oud gedrag)');
    ok(withFooter.repeatFooterPx === dims.footerHeight && withFooter.repeatFooterSrcY === dims.height - dims.footerHeight!,
      'met optie: voetstrook = onderste voethoogte van de bron');
    const lastFooter = withFooter.bodyRows[withFooter.bodyRows.length - 1];
    ok(Math.abs(lastFooter.srcY + lastFooter.srcH - withFooter.repeatFooterSrcY) < 1e-9, 'met optie eindigt de laatste body-tegel boven de voet');
    const set = new Set(dims.breakOffsets);
    ok(withFooter.bodyRows.slice(0, -1).every(r => set.has(r.srcY + r.srcH)), 'met voet eindigt elke pagina nog steeds op een rijgrens');
    ok(withFooter.bodyRows.every(r => r.srcH * withFooter.scale <= withFooter.printH - withFooter.repeatHeaderPtH - withFooter.repeatFooterPtH + 1e-9),
      'kop + body + voet passen samen in het printgebied');
    ok(Math.abs(withFooter.footerTopPt - (withFooter.marginPt + withFooter.printH - withFooter.repeatFooterPtH)) < 1e-9, 'voetstrook staat onderaan het printgebied');
    ok(withFooter.rows >= plain.rows, 'de voet kost hooguit pagina\'s, nooit minder');
    // Review #135 bevinding 1: de voet wordt uit één vast venster getekend (x vanaf 0, één
    // paginabreedte) — op elke kolompagina hetzelfde — en de render legt de voetinhoud binnen die
    // breedte, zodat merk én legenda op elk vel staan, ook met de tijdlijn over meerdere pagina's.
    const twoCols = computeTileLayout({ ...tile, timelineColumns: 2, repeatFooterHeightPx: dims.footerHeight });
    ok(twoCols.cols === 2 && twoCols.repeatFooterPx === dims.footerHeight, 'twee kolommen: voet herhaald');
    ok(twoCols.footerWindow.srcX === 0 && twoCols.footerWindow.pageX === twoCols.marginPt
      && Math.abs(twoCols.footerWindow.srcW * twoCols.scale - twoCols.printW) < 1e-6,
      `voetvenster = één paginabreedte vanaf x=0 (got srcW·scale=${twoCols.footerWindow.srcW * twoCols.scale}, printW=${twoCols.printW})`);
    ok(twoCols.footerLayoutWidthPx < dims.width && twoCols.footerLayoutWidthPx === twoCols.footerWindow.srcW,
      'de voet-layoutbreedte is die paginabreedte, kleiner dan het canvas');
    const narrow = record(many, [], cal, baseOptions({ footerLayoutWidth: twoCols.footerLayoutWidthPx }));
    const footerTexts = narrow.texts.filter(t => t.y > narrow.dims.height - narrow.dims.footerHeight);
    ok(footerTexts.some(t => t.text === 'Open Planner Studio') && footerTexts.every(t => t.x <= twoCols.footerLayoutWidthPx + 1e-6),
      `met footerLayoutWidth staat alle voettekst (merk incl.) binnen één paginabreedte (max x ${Math.max(...footerTexts.map(t => t.x)).toFixed(1)} ≤ ${twoCols.footerLayoutWidthPx.toFixed(1)})`);
    const wide = record(many, [], cal, baseOptions());
    ok(wide.texts.some(t => t.text === 'Open Planner Studio' && t.x > twoCols.footerLayoutWidthPx), 'zonder footerLayoutWidth staat het merk rechts op het canvas (controle dat de meting iets meet)');
    ok(Math.abs(narrow.dims.width - wide.dims.width) < 1e-9 && Math.abs(narrow.dims.height - wide.dims.height) < 1e-9, 'de voetbreedte verandert de canvasmaten niet');
    // Review #135 bevinding 4: past alles op één pagina, dan valt er niets te herhalen — de voet blijft
    // onder de laatste rij en de tegeling is byte-identiek aan die zonder optie.
    const few = Array.from({ length: 5 }, (_, i) => ({ ...T_NORM, id: `s${i}`, name: `Taak ${i}`, wbsCode: String(i + 1) }));
    const small = measurePrintReport(few, [], cal, 'Eén pagina', baseOptions());
    const smallTile = { ...tile, logicalWidth: small.width, logicalHeight: small.height, frozenColumnWidthPx: small.tableWidth, repeatHeaderHeightPx: small.headerHeight, breakOffsetsPx: small.breakOffsets };
    const smallPlain = computeTileLayout(smallTile);
    const smallFooter = computeTileLayout({ ...smallTile, repeatFooterHeightPx: small.footerHeight });
    ok(smallPlain.rows === 1 && smallFooter.repeatFooterPx === 0 && JSON.stringify(smallFooter.bodyRows) === JSON.stringify(smallPlain.bodyRows),
      'éénpagina-afdruk: voet niet herhaald, tegeling identiek');
    ok(footerLayoutWidthFor(smallFooter) === undefined && footerLayoutWidthFor(withFooter) === withFooter.footerLayoutWidthPx,
      'footerLayoutWidthFor: undefined zonder herhaling (oude render), de paginabreedte mét');
    // Review #135 ronde 2, B1: één rij hoog maar over meerdere kolommen getegeld is óók meer dan één
    // vel — dan hoort de voet wél herhaald (en dus binnen één paginabreedte gelegd) te worden.
    const smallTwoCols = computeTileLayout({ ...smallTile, timelineColumns: 2, repeatFooterHeightPx: small.footerHeight });
    ok(smallTwoCols.rows === 1 && smallTwoCols.cols === 2 && smallTwoCols.repeatFooterPx === small.footerHeight,
      `één rij × twee kolommen: voet herhaald (got rows ${smallTwoCols.rows}, cols ${smallTwoCols.cols}, voet ${smallTwoCols.repeatFooterPx})`);
    ok(Math.abs(smallTwoCols.bodyRows[0].srcY + smallTwoCols.bodyRows[0].srcH - smallTwoCols.repeatFooterSrcY) < 1e-9,
      'één rij × twee kolommen: de body-tegel eindigt boven de voet');
    const smallActual = computeTileLayout({ ...smallTile, mode: 'actual', repeatFooterHeightPx: small.footerHeight });
    ok(smallActual.cols > 1 ? smallActual.repeatFooterPx === small.footerHeight : smallActual.repeatFooterPx === 0,
      `'actual' met ${smallActual.cols} kolom(men): voet ${smallActual.cols > 1 ? 'wel' : 'niet'} herhaald`);
    // B5: een gedwongen positie ín de voetstrook (onbereikbaar voor de echte render, maar de functie
    // is de bron van waarheid voor beide backends) zet de herhaling niet aan — anders zou hij de
    // voet loskoppelen en daarna als breekpositie wegvallen. Zonder herhaling is de voet gewoon body
    // en mag zo'n positie hem als elke andere gedwongen positie afsplitsen; dat is niet deze zaak.
    const inFooter = computeTileLayout({ ...smallTile, repeatFooterHeightPx: small.footerHeight, forcedBreakOffsetsPx: [small.height - small.footerHeight / 2] });
    ok(inFooter.repeatFooterPx === 0, 'gedwongen positie in de voetstrook zet de herhaling niet aan');
    // Degeneratie: een voet die (met de kop) de hele pagina of de hele bron opeet wordt niet herhaald.
    const tooTall = computeTileLayout({ ...tile, repeatFooterHeightPx: dims.height });
    ok(tooTall.repeatFooterPx === 0 && JSON.stringify(tooTall.bodyRows) === JSON.stringify(plain.bodyRows), 'te hoge voet ⇒ niet herhaald, tegeling als zonder');
    // Zonder kopherhaling en in 'actual': dezelfde voetgarantie.
    for (const variant of [{ repeatHeaderHeightPx: 0 }, { mode: 'actual' as const }]) {
      const l = computeTileLayout({ ...tile, ...variant, repeatFooterHeightPx: dims.footerHeight });
      const last = l.bodyRows[l.bodyRows.length - 1];
      ok(l.repeatFooterPx === dims.footerHeight && Math.abs(last.srcY + last.srcH - l.repeatFooterSrcY) < 1e-9,
        `voet herhaald in variant ${JSON.stringify(variant)}`);
    }
    // Samen met een blad per resource (#113): de gedwongen posities blijven bandgrenzen, de voet komt op elk vel.
    const bands: ViewRow[] = [];
    for (let b = 0; b < 3; b++) {
      bands.push({ kind: 'group', rowKey: `vb${b}`, key: `vb${b}`, label: `Resource ${b}`, count: 2, depth: 0, levelIndex: 0, collapsed: false });
      for (let i = 0; i < 2; i++) {
        const task = { ...T_NORM, id: `vb${b}t${i}`, name: `Taak ${b}.${i}` };
        bands.push({ kind: 'task', rowKey: task.id, task, depth: 1, dimmed: false });
      }
    }
    const perBand = measurePrintReport(bands.flatMap(r => (r.kind === 'task' ? [r.task] : [])), [], cal, 'Blad per resource', baseOptions({ rows: bands, pageBreakBeforeGroups: true }));
    const l = computeTileLayout({
      ...tile, logicalWidth: perBand.width, logicalHeight: perBand.height, frozenColumnWidthPx: perBand.tableWidth,
      repeatHeaderHeightPx: perBand.headerHeight, breakOffsetsPx: perBand.breakOffsets,
      forcedBreakOffsetsPx: perBand.forcedBreakOffsets, repeatFooterHeightPx: perBand.footerHeight,
    });
    ok(l.rows === 3 && l.repeatFooterPx === perBand.footerHeight, `blad per resource mét voet: drie pagina's, elk met voetstrook — de gedwongen posities maken het meerpagina, ook al past alles op één (got ${l.rows}, voet ${l.repeatFooterPx})`);
    const forcedSet = new Set(perBand.forcedBreakOffsets);
    ok(l.bodyRows.slice(0, -1).every(r => forcedSet.has(r.srcY + r.srcH)), 'blad per resource mét voet: pagina 1 en 2 eindigen op de bandgrens');
    // De voet zelf bevat geen nep-paginanummer meer: de pagineerders drukken "n / totaal" in de marge.
    const rec = record(many.slice(0, 3), [], cal, baseOptions());
    ok(!rec.texts.some(t => /^(Pagina|Page) 1 (van|of) 1$/.test(t.text)), 'geen vast "Pagina 1 van 1" in de voet');
  }

  // Contract pdfTable → tileLayout (issue #110 punt 3): de breekposities die de tabelrender levert
  // vallen precies op rijgrenzen, en de pagineerder eindigt elke pagina op zo'n grens.
  {
    const stub: Draw2D = {
      font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: 'left', textBaseline: 'alphabetic',
      setLineDash() {}, fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
      fill() {}, stroke() {}, roundRect() {}, fillText() {}, measureText: (t: string) => ({ width: t.length * 6 }),
    };
    const rows = Array.from({ length: 300 }, (_, i) => ({ n: `rij ${i}` }));
    const columns = [{ header: 'Naam', width: 300, align: 'left' as const, text: (r: { n: string }) => r.n }];
    const dims = makeSectionedRenderReport({
      title: 'Test', subtitle: 'sub', summary: [{ label: 'a', value: '1' }],
      sections: [{ heading: 'A', columns, rows }, { heading: 'B', columns, rows: rows.slice(0, 40) }],
    })(() => stub);
    ok((dims.breakOffsets?.length ?? 0) >= 340, 'gesectioneerde render levert een breekpositie per rij');
    const layout = computeTileLayout({
      paperSize: 'a4', orientation: 'portrait', mode: 'fit-width',
      logicalWidth: dims.width, logicalHeight: dims.height, frozenColumnWidthPx: 0, breakOffsetsPx: dims.breakOffsets,
    });
    const set = new Set(dims.breakOffsets);
    ok(layout.rows > 1, 'de 340 rijen vullen meer dan één pagina');
    ok(layout.bodyRows.slice(0, -1).every(r => set.has(r.srcY + r.srcH)), 'elke pagina eindigt op een rijgrens uit de render');
    const single = makeTableRenderReport({ title: 'T', columns, rows })(() => stub);
    ok(single.breakOffsets?.length === 300, 'losse tabelrender: één breekpositie per rij');

    // Kolomkoppen die niet in hun kolom passen (een vertaalde kop is langer dan de Nederlandse
    // brontekst waarop de breedte gemeten is) werden afgekapt; ze verbreden nu de kolom.
    const meterPdf = (text: string) => text.length * 6;
    const narrowCols = [
      { header: 'Duration (wd)', width: 70, align: 'right' as const, text: () => '1' },
      { header: 'Naam', width: 300, align: 'left' as const, text: () => 'x' },
    ];
    const fitted = fitColumnsToHeaders(narrowCols, meterPdf);
    // 'Duration (wd)' = 13 tekens ⇒ 78 px + 2×8 celmarge + 1 = 95 > 70.
    ok(fitted[0].width === 95, `tabelrapport: te smalle kolom groeit naar zijn kop (got ${fitted[0].width})`);
    ok(fitted[1] === narrowCols[1], 'tabelrapport: een kolom die zijn kop wél kwijt kan blijft ongemoeid (ook qua identiteit)');
    const wideRows = [{ n: 'x' }];
    const noMeasure = makeTableRenderReport({ title: 'T', columns: narrowCols, rows: wideRows })(() => stub);
    const measured = makeTableRenderReport({ title: 'T', columns: narrowCols, rows: wideRows }, meterPdf)(() => stub);
    ok(noMeasure.width === 370 && measured.width === 395,
      `tabelrapport: zonder meting de spec-breedte, met meting 25 px breder (got ${noMeasure.width}/${measured.width})`);
    const sectioned = makeSectionedRenderReport({
      title: 'T', summary: [], sections: [{ columns: narrowCols, rows: wideRows }],
    }, meterPdf)(() => stub);
    ok(sectioned.width === 395, `tabelrapport: ook gesectioneerd groeit de kolom mee (got ${sectioned.width})`);
  }

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
  // Alle kwaliteitsstanden houden exact dezelfde CSS-breedte. Voor het vaste A3-landscape
  // voorbeeld is de onderste stand zelf al leesbaar: 900 × 636 rasterpixels. Hoog en Maximaal
  // verhogen uitsluitend die rasterdichtheid naar 1350 × 954 en 1800 × 1272.
  const cssWidth = 900;
  const standard = computePreviewRasterLimits(1_200, 1_800, 'a3', 'landscape', cssWidth, 1, 1);
  const high = computePreviewRasterLimits(1_200, 1_800, 'a3', 'landscape', cssWidth, 1, 2);
  const maximum = computePreviewRasterLimits(1_200, 1_800, 'a3', 'landscape', cssWidth, 1, 3);
  const standardRaster = { width: standard.pageRasterWidth, height: standard.pageRasterHeight };
  const highRaster = { width: high.pageRasterWidth, height: high.pageRasterHeight };
  const maximumRaster = { width: maximum.pageRasterWidth, height: maximum.pageRasterHeight };
  ok(standardRaster.width === 900 && standardRaster.height === 636,
    `Standaard rastert A3-landscape op 900×636 (got ${standardRaster.width}×${standardRaster.height})`);
  ok(highRaster.width === 1_350 && highRaster.height === 954,
    `Hoog rastert A3-landscape op 1350×954 (got ${highRaster.width}×${highRaster.height})`);
  ok(maximumRaster.width === 1_800 && maximumRaster.height === 1_272,
    `Maximaal rastert A3-landscape op 1800×1272 (got ${maximumRaster.width}×${maximumRaster.height})`);
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

// ── 8. Tabelkolommen (#93) ───────────────────────────────────────────────────────────────────
// "Voltooiing tonen" uit ⇒ de Volt.-kolom verdwijnt écht uit de tabel (kop, waarden én breedte),
// niet alleen de percentages. En de `#`-rijnummerkolom bestaat niet meer: WBS nummert al.
{
  const shown = record(FIX_TASKS, [], cal, baseOptions({ showCompletion: true }));
  const hidden = record(FIX_TASKS, [], cal, baseOptions({ showCompletion: false }));
  ok(shown.texts.some(t => t.text === 'Volt.'), '#93 voltooiing aan: kolomkop Volt. aanwezig');
  ok(shown.texts.some(t => t.text === '60%'), '#93 voltooiing aan: percentage van t-norm aanwezig');
  ok(!hidden.texts.some(t => t.text === 'Volt.'), '#93 voltooiing uit: kolomkop Volt. verdwenen');
  ok(!hidden.texts.some(t => /^\d+%$/.test(t.text)), '#93 voltooiing uit: geen enkel percentage in de tabel');
  ok(hidden.dims.tableWidth < shown.dims.tableWidth,
    `#93 voltooiing uit: tabel smaller (${hidden.dims.tableWidth} < ${shown.dims.tableWidth})`);
  // De kopstrook en de tabel tekenen hun rechterrand op `tableWidth`; niets mag daar voorbij in de
  // tabelzone staan — de tijdlijn begint precies daar.
  const tableTexts = hidden.texts.filter(t => ['WBS', 'Taak', 'Duur', 'Start', 'Eind'].includes(t.text));
  ok(tableTexts.length === 5 && tableTexts.every(t => t.x < hidden.dims.tableWidth),
    '#93 voltooiing uit: de overige kolomkoppen staan allemaal links van de tabelrand');
  ok(!shown.texts.some(t => t.text === '#'), '#93 geen #-kolomkop meer');
  // Rijnummers werden rechts-uitgelijnd in kolom 0 getekend; die tekst ("1", "2", "3") ontbreekt nu
  // in de TABELZONE (de tijdschaal-kop rechts van de tabel tekent zelf dagnummers, die tellen niet).
  ok(!shown.texts.some(t => t.x < shown.dims.tableWidth && /^[123]$/.test(t.text)),
    '#93 geen rijnummers meer in de tabel');
  ok(shown.texts.some(t => t.text === 'WBS' && t.x < 50), '#93 WBS is de eerste kolom (kop binnen 50 px)');
}

// ── 9. Instelbare naamkolom ──────────────────────────────────────────────────────────────────
// De naamkolom is een getal in PrintOptions; het paneel kiest dat getal (slider, of gemeten
// langste naam). De printlaag klemt, kapt met ellipsis af en laat de tabelbreedte meebewegen.
{
  const longName = 'Een bewust erg lange taaknaam die in de standaardkolom nooit past';
  const T_LONG = mkTask('t-lang', longName, { time: mkTime({ earlyStart: '2026-01-05', earlyFinish: '2026-01-09', scheduleStart: '2026-01-05', scheduleFinish: '2026-01-09' }) });
  // De opnemende Draw2D meet 6 px per teken; de naam is 65 tekens ⇒ 390 px tekst.
  const dflt = record([T_LONG], [], cal, baseOptions());
  const narrow = record([T_LONG], [], cal, baseOptions({ taskNameColumnWidth: 80 }));
  const wide = record([T_LONG], [], cal, baseOptions({ taskNameColumnWidth: 400 }));
  const auto = record([T_LONG], [], cal, baseOptions({ taskNameColumnWidth: 600 }));
  ok(dflt.texts.some(t => t.text.endsWith('…') && longName.startsWith(t.text.slice(0, -1))),
    'naamkolom: standaardbreedte kapt een lange naam met ellipsis af');
  ok(narrow.dims.tableWidth === dflt.dims.tableWidth - (NAME_COLUMN_WIDTH_DEFAULT - 80),
    `naamkolom: smallere kolom ⇒ tabel evenveel smaller (got ${narrow.dims.tableWidth} vs ${dflt.dims.tableWidth})`);
  ok(wide.dims.tableWidth === dflt.dims.tableWidth + (400 - NAME_COLUMN_WIDTH_DEFAULT),
    `naamkolom: bredere kolom ⇒ tabel evenveel breder (got ${wide.dims.tableWidth})`);
  ok(wide.texts.some(t => t.text === longName), 'naamkolom: bij 400 px staat de volledige naam in de tabel');
  ok(auto.dims.tableWidth === dflt.dims.tableWidth + (600 - NAME_COLUMN_WIDTH_DEFAULT),
    'naamkolom: boven de slider-max (gemeten breedte) accepteert de printlaag tot AUTO_MAX');
  const clampedLow = record([T_LONG], [], cal, baseOptions({ taskNameColumnWidth: 5 }));
  const clampedHigh = record([T_LONG], [], cal, baseOptions({ taskNameColumnWidth: 99_999 }));
  const nan = record([T_LONG], [], cal, baseOptions({ taskNameColumnWidth: Number.NaN }));
  ok(clampedLow.dims.tableWidth === dflt.dims.tableWidth - (NAME_COLUMN_WIDTH_DEFAULT - NAME_COLUMN_WIDTH_MIN),
    'naamkolom: te klein ⇒ geklemd op MIN');
  ok(clampedHigh.dims.tableWidth === dflt.dims.tableWidth + (NAME_COLUMN_AUTO_MAX - NAME_COLUMN_WIDTH_DEFAULT),
    'naamkolom: te groot ⇒ geklemd op AUTO_MAX');
  ok(nan.dims.tableWidth === dflt.dims.tableWidth, 'naamkolom: NaN ⇒ default');

  // Meting: exact het spiegelbeeld van de teken-som (tekst + inspringing 12/niveau + padding 4+2 + 1).
  const parent = mkTask('p', 'Ouder', { childIds: ['c'] });
  const child = mkTask('c', 'Kindnaam', { parentId: 'p' });
  const rows = buildPrintRows([child, parent], undefined);
  ok(rows.length === 2 && rows[0].task?.id === 'p' && rows[0].depth === 0 && rows[1].task?.id === 'c' && rows[1].depth === 1,
    'buildPrintRows: ouder vóór kind, diepte 0/1, ongeacht invoervolgorde');
  const measured = measureTaskNameColumnWidth(rows, (text, bold) => text.length * 10 + (bold ? 1 : 0));
  // 'Kindnaam' = 8 tekens ⇒ 80 + indent 12 + 7 = 99 ; 'Ouder' vet = 51 + 0 + 7 = 58 ⇒ max 99.
  ok(measured === 99, `measureTaskNameColumnWidth: langste rij incl. inspringing (got ${measured})`);
  const bandRows = buildPrintRows([], [
    { kind: 'group', rowKey: 'g', key: '["x"]', label: 'Metselaar', count: 12, depth: 0, levelIndex: 0, collapsed: false },
  ]);
  const bandMeasured = measureTaskNameColumnWidth(bandRows, (text, bold) => (bold && text === 'Metselaar (12)' ? 200 : 0));
  ok(bandMeasured === 207, `measureTaskNameColumnWidth: groepsband meet vet mét "(count)" (got ${bandMeasured})`);
  ok(measureTaskNameColumnWidth([], () => 0) === NAME_COLUMN_WIDTH_MIN, 'measureTaskNameColumnWidth: leeg ⇒ MIN');
  ok(measureTaskNameColumnWidth(rows, () => 5000) === NAME_COLUMN_AUTO_MAX, 'measureTaskNameColumnWidth: absurd lang ⇒ AUTO_MAX');
  // Rondgang: een kolom op de gemeten breedte kapt met de echte opnemende meting (6 px/teken) niets af.
  const exact = measureTaskNameColumnWidth(buildPrintRows([T_LONG], undefined), text => text.length * 6);
  const roundTrip = record([T_LONG], [], cal, baseOptions({ taskNameColumnWidth: exact }));
  ok(roundTrip.texts.some(t => t.text === longName), `naamkolom: gemeten breedte (${exact}) toont de naam onafgekapt`);
}

// ── 12. Automatisch meeschalende datakolommen (WBS/Duur/Start/Einde/Volt./Eenh./d) ────────────
// De zes kolommen met een vaste breedte hielden hun inhoud niet: de Poolse duur-kop "Czas trwania"
// (57 px in een kolom van 45) en een diepe WBS-code liepen over de buurkolom heen, terwijl korte
// inhoud ruimte verspilde die de tijdlijn kan gebruiken. Ze meten nu — net als de naam- en de
// curvekolom — op de kop én de cellen die dít rapport toont.
{
  const meter = (text: string) => text.length * 6;   // dezelfde meting als de opnemende Draw2D
  const headers = { wbs: 'WBS', taskName: 'Taak', start: 'Start', end: 'Eind', duration: 'Duur', completion: 'Volt.' };
  // Eén taak met bekende celteksten: WBS 'a.b' (3), duur '5d' (2), datums '05-01-2026' (10), 60 %.
  const T_M = mkTask('t-meet', 'Meettaak', { wbsCode: 'a.b', time: mkTime({ scheduleDuration: 5, completion: 0.6 }) });
  const rows = buildPrintRows([T_M], undefined);
  const w = measureTableColumnWidths(rows, { showCompletion: true, tableHeaders: headers }, meter);
  // Per kolom: max(kop, breedste cel) × 6 px + 2×celmarge (4) + 1.
  ok(w.wbs === AUTO_COLUMN_MIN_WIDTH, `kolommeting WBS: kop 'WBS' en cel 'a.b' (18) ⇒ 27, geklemd op de vloer (got ${w.wbs})`);
  ok(w.duration === 33, `kolommeting Duur: kop 'Duur' (24) wint van cel '5d' (12) ⇒ 33 (got ${w.duration})`);
  ok(w.start === 69 && w.end === 69, `kolommeting datums: cel '05-01-2026' (60) ⇒ 69 (got ${w.start}/${w.end})`);
  ok(w.complete === 39, `kolommeting Volt.: kop 'Volt.' (30) wint van cel '60%' (18) ⇒ 39 (got ${w.complete})`);
  ok(w.units === undefined, 'kolommeting: zonder toewijzingskolommen wordt Eenh./d niet gemeten');
  ok(measureTableColumnWidths(rows, { showCompletion: false, tableHeaders: headers }, meter).complete === undefined,
    'kolommeting: zonder de Volt.-kolom wordt die niet gemeten');

  // De Poolse duur-kop groeit voorbij de oude vaste 45 px in plaats van over de Start-kolom te lopen.
  const pl = measureTableColumnWidths(rows, { showCompletion: true, tableHeaders: { ...headers, duration: 'Czas trwania' } }, meter);
  ok(pl.duration === 81, `kolommeting: een lange vertaalde kop verbreedt de kolom (got ${pl.duration})`);

  // Klemmen: een absurde kop/cel stopt op COL.max, een piepkleine kop op de vloer.
  const huge = measureTableColumnWidths(rows, { showCompletion: true, tableHeaders: { ...headers, duration: 'x'.repeat(200) } }, meter);
  ok(huge.duration === 90, `kolommeting: geklemd op het maximum van de Duur-kolom (got ${huge.duration})`);
  const tiny = measureTableColumnWidths(buildPrintRows([mkTask('t-k', 'K', { wbsCode: '', time: mkTime({ scheduleDuration: 5 }) })], undefined),
    { showCompletion: false, tableHeaders: { ...headers, wbs: '' } }, meter);
  ok(tiny.wbs === AUTO_COLUMN_MIN_WIDTH, `kolommeting: geklemd op de vloer (got ${tiny.wbs})`);

  // De gemeten breedtes komen 1-op-1 in de tabelbreedte terecht; een ontbrekende of onbruikbare
  // sleutel valt terug op de vaste breedte van vóór de meting (byte-identiek).
  const dflt = record([T_M], [], cal, baseOptions());
  const measured = record([T_M], [], cal, baseOptions({ columnWidths: w }));
  const delta = (w.wbs! - 50) + (w.duration! - 45) + (w.start! - 55) + (w.end! - 55) + (w.complete! - 45);
  ok(measured.dims.tableWidth === dflt.dims.tableWidth + delta,
    `gemeten kolommen: tabelbreedte verschuift met de som van de deltas (got ${measured.dims.tableWidth} vs ${dflt.dims.tableWidth + delta})`);
  ok(record([T_M], [], cal, baseOptions({ columnWidths: {} })).dims.tableWidth === dflt.dims.tableWidth,
    'geen gemeten kolommen ⇒ de vaste breedtes, byte-identiek');
  ok(record([T_M], [], cal, baseOptions({ columnWidths: { duration: Number.NaN } })).dims.tableWidth === dflt.dims.tableWidth,
    'onbruikbare kolombreedte ⇒ terugval op de vaste breedte');
  ok(record([T_M], [], cal, baseOptions({ columnWidths: { wbs: 5 } })).dims.tableWidth === dflt.dims.tableWidth - (50 - AUTO_COLUMN_MIN_WIDTH),
    'te kleine kolombreedte ⇒ geklemd op de vloer');
  ok(record([T_M], [], cal, baseOptions({ columnWidths: { wbs: 9999 } })).dims.tableWidth === dflt.dims.tableWidth + 50,
    'te grote kolombreedte ⇒ geklemd op het maximum (100)');

  // Rondgang: op de gemeten breedte staat elke cel er onafgekapt; zónder meting kapt een te lange
  // WBS-code af met een ellipsis in plaats van over de naamkolom heen te lopen.
  const longWbs = '10.11.12.13.14';   // 14 tekens = 84 px: past in de kolom-max (100), niet in de vaste 50
  const T_W = mkTask('t-wbs', 'Diepe code', { wbsCode: longWbs, time: mkTime({ scheduleDuration: 5 }) });
  const wWide = measureTableColumnWidths(buildPrintRows([T_W], undefined), { showCompletion: true, tableHeaders: headers }, meter);
  ok(record([T_W], [], cal, baseOptions({ columnWidths: wWide })).texts.some(t => t.text === longWbs),
    `gemeten kolom toont de volledige WBS-code (breedte ${wWide.wbs})`);
  const clipped = record([T_W], [], cal, baseOptions());
  ok(clipped.texts.some(t => t.text.endsWith('…') && longWbs.startsWith(t.text.slice(0, -1))),
    `zonder meting: WBS-cel afgekapt i.p.v. over de naamkolom (got ${JSON.stringify(clipped.texts.slice(0, 6).map(t => t.text))})`);
  // Dezelfde vangnetregel voor een kop die zelfs boven het maximum uitkomt.
  const clippedHead = record([T_M], [], cal, baseOptions({
    labels: { ...baseOptions().labels!, tableHeaders: { ...headers, duration: 'Czas trwania' } },
  }));
  ok(clippedHead.texts.some(t => t.text.endsWith('…') && 'Czas trwania'.startsWith(t.text.slice(0, -1))),
    'zonder meting: een te lange kop wordt afgekapt i.p.v. over de buurkolom getekend');
}

// ── 13. Projectkop: vertaalde start-/eind-/duurlabels ─────────────────────────────────────────
// De derde kopregel (`drawProjectHeader`) droeg hard-gecodeerd "Start:", "Eind:" en "Duur: …d",
// dus elke niet-Nederlandse afdruk toonde "Eind:"/"Duur: 120d". De labels komen nu, net als
// `printed`, uit `options.labels`; hier gevuld zoals ReportPanel dat doet (`report:projectStart`
// e.d. plus de dag-afkorting `common:duration.suffixDay`). De duur zelf blijft kalenderdagen.
{
  type HeaderKeys = { projectStart: string; projectEnd: string; projectDuration: string };
  const headerLabels = (report: HeaderKeys, common: { duration: { suffixDay: string } }) => ({
    ...baseOptions().labels!,
    projectStart: report.projectStart,
    projectEnd: report.projectEnd,
    projectDuration: report.projectDuration,
    daySuffix: common.duration.suffixDay,
  });
  // Projectdatums bewust anders dan de taakdatums (05-01-2026), zodat alleen kopregel 3 ze draagt.
  // 01-01 → 01-05-2026 = 31 + 28 + 31 + 30 = 120 kalenderdagen.
  const dates = { projectStartDate: '2026-01-01', projectEndDate: '2026-05-01' };
  const row3 = (over: Partial<PrintOptions>) => {
    const hits = record([T_NORM], [], cal, baseOptions({ ...dates, ...over })).texts
      .filter(t => t.text.includes('01-01-2026'));
    ok(hits.length === 1, `projectkop: precies één tekst met de projectstart (got ${JSON.stringify(hits.map(t => t.text))})`);
    return hits[0]?.text ?? '';
  };

  const en = row3({ labels: headerLabels(enReport, enCommon) });
  ok(en === 'Start: 01-01-2026  |  End: 01-05-2026  |  Duration: 120d',
    `projectkop (en): Engelse labels uit de vertaling (got ${JSON.stringify(en)})`);
  ok(!/Eind:|Duur:/.test(en), `projectkop (en): geen Nederlands "Eind:"/"Duur:" meer (got ${JSON.stringify(en)})`);

  // Frans: eigen labels én een eigen dag-afkorting ('j') — bewijst dat ook de eenheid uit de labels komt.
  const fr = row3({ labels: headerLabels(frReport, frCommon) });
  ok(fr === 'Début : 01-01-2026  |  Fin : 01-05-2026  |  Durée : 120j',
    `projectkop (fr): Franse labels en dag-afkorting (got ${JSON.stringify(fr)})`);

  // Nederlands blijft byte-identiek aan de oude hard-gecodeerde kop.
  const nl = row3({ labels: headerLabels(nlReport, nlCommon) });
  ok(nl === 'Start: 01-01-2026  |  Eind: 01-05-2026  |  Duur: 120d',
    `projectkop (nl): ongewijzigd t.o.v. de oude kop (got ${JSON.stringify(nl)})`);

  // Zonder labels: Engelse terugval, net als `printed` ('Printed:').
  const fallback = row3({ labels: undefined });
  ok(fallback === 'Start: 01-01-2026  |  End: 01-05-2026  |  Duration: 120d',
    `projectkop zonder labels: Engelse terugval (got ${JSON.stringify(fallback)})`);
}

if (failures > 0) { console.log(`print-report: ${failures} faalregels`); process.exit(1); }
console.log('print-report: alles groen');
