// De SVG-backend van het rapportpapier (issue #817). Bewaakt:
//  1. Dezelfde tekenopdrachten: `SvgRecordingDraw2D` neemt van `renderReport` precies de opdrachten op
//     die een opnemende Draw2D (de canvas-API, zoals de canvas- en de PDF-backend die krijgen) ziet:
//     zelfde soort, volgorde, kleur, plek, tekst, letter en lijnstijl. Tekst schuift naar de
//     alfabetische basislijn met de basislijnafstand van de letter (zoals de PDF-backend).
//  2. Dezelfde bladen als de PDF: het papier gebruikt dezelfde tegelinvoer en dezelfde tweede render
//     voor een smallere voet als `paginateVectorToPdfBytes`.
//  3. Een blad als SVG: viewBox in punten, per venster een geneste <svg> met de bron-viewBox, alleen de
//     opdrachten van dat blad, het paginanummer zoals de PDF; tekst ge-escapet.
//  4. Klikbare delen: kop, kolommen, balken en voet liggen waar de render ze tekent; een klik in de
//     tabel weet de kolom.
//  5. Papier = PDF, ook in het afkappen: dezelfde opname naar SVG (met de meting van het papier) en naar
//     de echte vector-PDF (`paginateVectorToPdfBytes` met de ingebedde TTF's), met kolombreedtes zoals het
//     paneel ze meet. Per tekstitem dezelfde tekst ná het afkappen, op dezelfde plek en basislijn. Geen
//     datum wordt in de PDF afgekapt. Voor #817 mat het papier met het canvas van de browser; dat rondt
//     bij kleine letters af (9 november 2026: "Stakeholder management" 115 tegen 109,0 in de PDF), dus
//     het papier kapte namen af die de PDF voluit toonde, en de PDF kapte datums af ("30-03-2027 0…").
//     Let op: de opgenomen grenzen van het papier en de plaatsing in de PDF komen uit dezelfde meting. Of de
//     browser de tekst ook zo breed tekent (met dezelfde letter), meet deze check niet; een Arabische naam
//     in een systeemletter bleef hier groen terwijl hij over de kolom liep (review Sol #847). Dat bewaakt
//     `tests/browser/report-studio.spec.ts`: de getekende tekst (`getBBox`) tegen de getekende kolomlijn.
//  6. Alleen de rijen van de bladen in beeld: het papier tekent bij een klik alleen de rijen van de
//     bladen die gevraagd worden (`createReportPaperRecorder`, rijvenster in `renderReport`). Elk blad uit
//     zo'n gedeeltelijke opname is byte voor byte gelijk aan hetzelfde blad uit de volledige opname, met
//     dezelfde bladindeling.
//  7. Vaste schaal begint op de passende breedte: dezelfde bladindeling als "Op de breedte", ook als die
//     breedte onder 1 px per dag ligt (vroeger klemde het tabblad op 1 en sprong A4 staand van 2 naar 6
//     pagina's, en 5000 taken van 139 naar 695).
import './domStub';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixedScaleStartDayWidth, renderReport, REPORT_MIN_DAY_WIDTH, type PrintOptions, type RenderReportResult } from '@/services/print/printPreview';
import { computeTileLayout, footerLayoutWidthFor, footerRelayoutWidth, reportTileInput } from '@/services/print/tileLayout';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import {
  clipOpToWindow, fontClassCss, opsInWindow, opsToSvg, opToSvg, REPORT_PAGE_TEXT_RULE, reportFontClass, reportFontRule,
  SvgRecordingDraw2D, type SvgOp, type SvgTextMetrics,
} from '@/services/pdf/svgDraw2d';
import { createReportPaperRecorder, ganttTileOptions, recordReportPaper } from '@/services/print/reportPaperModel';
import { hitPaperRegion, pageLabel, pageWindows, reportPageSvg, reportPaperRegions } from '@/services/print/reportPaper';
import { readIFC } from '@/services/ifc/ifcReader';
import { reportFontStack } from '@/services/pdf/reportFont';
import fontkit from '@pdf-lib/fontkit';
import {
  assembleReportMeasureFonts, createReportTextMetrics, fontVerticalMetrics, parseReportFont,
  type ReportFontFiles, type ReportFontkitFont, type ReportMeasureFonts,
} from '@/services/pdf/reportTextMeasure';
import { paginateVectorToPdfBytes } from '@/services/print/paginateVector';
import { buildPrintRows, measureTableColumnWidths, measureTaskNameColumnWidth, nameCellFont } from '@/services/print/printPreview';
import type { PdfVectorDraw2D } from '@/services/pdf/pdfVectorDraw2d';
import type { Task } from '@/types/task';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };
const near = (a: number, b: number, eps = 0.011) => Math.abs(a - b) <= eps;

// De echte meting van het papier: de lettermaten uit de gevendorde TTF's, samengesteld zoals de app dat
// doet (`loadReportTextMetrics` → `assembleReportMeasureFonts`), dezelfde als de vector-PDF.
const ttf = (rel: string) => new Uint8Array(readFileSync(join(ROOT, rel)));
const FONT_DIR = 'src/services/pdf/fonts';
const INTER: ReportFontFiles = { regular: ttf(`${FONT_DIR}/Inter-Regular.ttf`), bold: ttf(`${FONT_DIR}/Inter-Bold.ttf`) };
const CARLITO: ReportFontFiles = { regular: ttf(`${FONT_DIR}/Carlito-Regular.ttf`), bold: ttf(`${FONT_DIR}/Carlito-Bold.ttf`) };
const ARABIC: ReportFontFiles = { regular: ttf(`${FONT_DIR}/NotoSansArabic-Regular.ttf`), bold: ttf(`${FONT_DIR}/NotoSansArabic-Bold.ttf`) };
const fkCreate = (bytes: Uint8Array) => (fontkit as unknown as { create(b: Uint8Array): ReportFontkitFont }).create(bytes);
const interFonts: ReportMeasureFonts = assembleReportMeasureFonts(fkCreate, INTER, { arabic: ARABIC, baseDir: 'ltr' });
const carlitoFonts: ReportMeasureFonts = assembleReportMeasureFonts(fkCreate, CARLITO, { interFallback: INTER, arabic: ARABIC, baseDir: 'ltr' });
const metrics: SvgTextMetrics = createReportTextMetrics(interFonts);

// ── Opnemende Draw2D die dezelfde regels van de canvas-API volgt ───────────────────────────────
type Expected =
  | { k: 'rect'; x: number; y: number; w: number; h: number; paint: string; lw?: number; dash: string }
  | { k: 'path'; bbox: [number, number, number, number]; paint: string; lw?: number; dash: string }
  | { k: 'text'; text: string; x: number; y: number; font: string; fill: string; align: TextAlign; baseline: TextBaseline };

function expectedOps(run: (mk: (w: number, h: number) => Draw2D) => RenderReportResult) {
  const ops: Expected[] = [];
  const st = { font: '10px sans-serif', fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline, dash: '' };
  let pts: { x: number; y: number }[] = [];
  const d2d: Draw2D = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash(d) { st.dash = d.length > 0 && d.some(s => s > 0) ? d.join(' ') : ''; },
    fillRect(x, y, w, h) {
      if (w === 0 || h === 0) return;
      ops.push({ k: 'rect', x: Math.min(x, x + w), y: Math.min(y, y + h), w: Math.abs(w), h: Math.abs(h), paint: `fill:${st.fillStyle}`, dash: '' });
    },
    strokeRect(x, y, w, h) {
      ops.push({ k: 'rect', x: Math.min(x, x + w), y: Math.min(y, y + h), w: Math.abs(w), h: Math.abs(h), paint: `stroke:${st.strokeStyle}`, lw: st.lineWidth, dash: st.dash });
    },
    beginPath() { pts = []; },
    moveTo(x, y) { pts.push({ x, y }); },
    lineTo(x, y) { pts.push({ x, y }); },
    closePath() {},
    fill() { if (pts.length) ops.push({ k: 'path', bbox: bbox(pts), paint: `fill:${st.fillStyle}`, dash: '' }); },
    stroke() { if (pts.length) ops.push({ k: 'path', bbox: bbox(pts), paint: `stroke:${st.strokeStyle}`, lw: st.lineWidth, dash: st.dash }); },
    roundRect(x, y, w, h) { if (w < 0) return; pts = [{ x, y }, { x: x + w, y: y + h }]; },
    fillText(text, x, y) {
      if (!text) return;
      ops.push({ k: 'text', text, x, y, font: st.font, fill: st.fillStyle, align: st.textAlign, baseline: st.textBaseline });
    },
    measureText(text) { return { width: metrics.measure(text, st.font) }; },
  };
  const result = run(() => d2d);
  return { ops, result };
}
function bbox(pts: { x: number; y: number }[]): [number, number, number, number] {
  return [Math.min(...pts.map(p => p.x)), Math.min(...pts.map(p => p.y)), Math.max(...pts.map(p => p.x)), Math.max(...pts.map(p => p.y))];
}

function compare(label: string, expected: Expected[], rec: SvgRecordingDraw2D): void {
  if (expected.length !== rec.ops.length) {
    fail(`${label}: ${expected.length} opdrachten verwacht, SVG nam er ${rec.ops.length} op`);
    return;
  }
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i];
    const o: SvgOp = rec.ops[i];
    const where = `${label} #${i}`;
    if (e.k !== o.k) { fail(`${where}: soort ${e.k} ↔ ${o.k}`); return; }
    if (e.k === 'rect' && o.k === 'rect') {
      const paint = o.stroke !== undefined ? `stroke:${o.stroke}` : `fill:${o.fill}`;
      if (!(near(e.x, o.x) && near(e.y, o.y) && near(e.w, o.w) && near(e.h, o.h)) || paint !== e.paint
        || (e.lw !== undefined && e.lw !== o.lw) || (o.dash ?? '') !== e.dash) {
        fail(`${where}: rechthoek ${JSON.stringify(e)} ↔ ${JSON.stringify(o)}`); return;
      }
    } else if (e.k === 'path' && o.k === 'path') {
      const paint = o.stroke !== undefined ? `stroke:${o.stroke}` : `fill:${o.fill}`;
      const half = o.stroke !== undefined ? (o.lw ?? 1) / 2 : 0;
      const sameBox = near(e.bbox[0] - half, o.b[0]) && near(e.bbox[1] - half, o.b[1]) && near(e.bbox[2] + half, o.b[2]) && near(e.bbox[3] + half, o.b[3]);
      if (!sameBox || paint !== e.paint || (e.lw !== undefined && e.lw !== o.lw) || (o.dash ?? '') !== e.dash) {
        fail(`${where}: pad ${JSON.stringify(e)} ↔ ${JSON.stringify({ ...o, d: o.d.slice(0, 60) })}`); return;
      }
    } else if (e.k === 'text' && o.k === 'text') {
      const anchor = e.align === 'center' ? 'middle' : e.align === 'right' ? 'end' : 'start';
      const y = e.y + metrics.baselineShift(e.font, e.baseline);
      if (e.text !== o.text || !near(e.x, o.x) || !near(y, o.y) || anchor !== o.anchor || e.fill !== o.fill || rec.fonts[o.font] !== e.font) {
        fail(`${where}: tekst ${JSON.stringify(e)} ↔ ${JSON.stringify({ ...o, font: rec.fonts[o.font] })}`); return;
      }
    }
  }
}

// ── Fixture: het echte voorbeeldproject ────────────────────────────────────────────────────────
const project = readIFC(readFileSync(join(ROOT, 'public/examples/03-kantoorgebouw-zuidas.ifc'), 'utf8'));
const baseOptions = (over: Partial<PrintOptions> = {}): PrintOptions => ({
  showCritical: true, showFloat: true, showDeps: true, showWeekends: true, showLegend: true,
  showTaskNames: true, showCompletion: true, autoFit: true, customZoom: 22,
  paperSize: 'A3', orientation: 'landscape', companyName: 'Bouw & <Co> "BV"',
  locale: 'nl', calendars: [project.calendar], resources: project.resources, assignments: project.assignments,
  projectStartDate: project.project.startDate, projectEndDate: project.project.endDate,
  statusLine: 'statusDate', statusDate: project.project.startDate,
  ...over,
});
const renderWith = (options: PrintOptions) => (mk: (w: number, h: number) => Draw2D) =>
  renderReport(mk, project.tasks, project.sequences, project.calendar, project.project.name, options);

// ── 1. Dezelfde tekenopdrachten ────────────────────────────────────────────────────────────────
const variants: [string, PrintOptions][] = [
  ['standaard', baseOptions()],
  ['A4 staand, vaste schaal', baseOptions({ paperSize: 'A4', orientation: 'portrait', autoFit: false, customZoom: 30 })],
  ['zonder tekst en relaties', baseOptions({ showTaskNames: false, showDeps: false, showLegend: false, statusLine: 'progress' })],
  ['met eigen kolom', baseOptions({ tableColumns: [
    { key: 'task.name', builtin: 'name' }, { key: 'x.kolom', header: 'Eigen <kop>', align: 'center', cells: new Map([[project.tasks[0].id, 'a & b']]) },
  ] })],
  // Een andere rapportletter (#770): het papier neemt dezelfde fontstack op als canvas en PDF.
  ['letter Carlito', baseOptions({ fontFamily: reportFontStack('carlito') })],
];
for (const [label, options] of variants) {
  let svg: SvgRecordingDraw2D | undefined;
  const svgResult = renderWith(options)((w, h) => { svg = new SvgRecordingDraw2D(w, h, metrics); return svg; });
  const { ops, result } = expectedOps(renderWith(options));
  ok(!!svg, `${label}: de render maakt een SVG-tekenvlak`);
  if (!svg) continue;
  ok(svg.width === result.width && svg.height === result.height, `${label}: tekenvlak even groot als de render`);
  ok(svgResult.width === result.width && svgResult.height === result.height && svgResult.tableWidth === result.tableWidth,
    `${label}: zelfde maten met beide backends`);
  ok(ops.length > 200, `${label}: genoeg opdrachten om te vergelijken (${ops.length})`);
  compare(label, ops, svg);
}

// ── 2. Dezelfde bladen als de PDF ──────────────────────────────────────────────────────────────
for (const [label, options, rh, rf] of [
  ['één kolom', baseOptions(), true, true],
  ['tijdlijn over 3', baseOptions({ timelineColumns: 3, paperSize: 'A4' }), true, true],
  ['zonder herhaling', baseOptions({ timelineColumns: 2 }), false, false],
] as [string, PrintOptions, boolean, boolean][]) {
  const paper = recordReportPaper(project.tasks, project.sequences, project.calendar, project.project.name, options, rh, rf, metrics);
  // De weg van `paginateVectorToPdfBytes`, met de keuzes die `buildGanttReportPdf` meegeeft.
  const tile = ganttTileOptions(options, rh, rf);
  const firstPass = renderWith(options)(() => new SvgRecordingDraw2D(1, 1, metrics));
  let layout = computeTileLayout(reportTileInput(firstPass, tile));
  const flw = footerRelayoutWidth(layout, firstPass.width);
  let pdfDims = firstPass;
  if (flw !== undefined) {
    pdfDims = renderWith({ ...options, footerLayoutWidth: flw })(() => new SvgRecordingDraw2D(1, 1, metrics));
    layout = computeTileLayout(reportTileInput(pdfDims, tile));
  }
  ok(JSON.stringify(paper.layout) === JSON.stringify(layout), `${label}: papier en PDF hebben dezelfde bladindeling`);
  ok(paper.result.height === pdfDims.height && paper.result.footerHeight === pdfDims.footerHeight, `${label}: zelfde render (hoogte, voet)`);
  ok(paper.passes === (flw !== undefined ? 2 : 1), `${label}: tweede render alleen voor een smallere voet`);
  if (label === 'tijdlijn over 3') {
    ok(paper.layout.cols === 3, `tijdlijn over 3: drie bladen naast elkaar (kreeg ${paper.layout.cols})`);
    ok(footerLayoutWidthFor(paper.layout) !== undefined, 'tijdlijn over 3: de voet wordt binnen één blad gelegd');
  }
}

// ── 3. Een blad als SVG ────────────────────────────────────────────────────────────────────────
{
  const carlito = recordReportPaper(project.tasks, project.sequences, project.calendar, project.project.name,
    baseOptions({ fontFamily: reportFontStack('carlito') }), true, true, metrics);
  ok(carlito.recording.fonts.length > 0 && carlito.recording.fonts.every(f => f.includes('"OpsReportCarlito", InterPDF')),
    `letter: elke tekst op het papier in de gekozen letter, met Inter als terugval (${carlito.recording.fonts.join(' | ')})`);
  const options = baseOptions({ timelineColumns: 2, paperSize: 'A4' });
  const paper = recordReportPaper(project.tasks, project.sequences, project.calendar, project.project.name, options, true, true, metrics);
  const { layout, recording } = paper;
  const total = layout.rows * layout.cols;
  ok(total >= 2, `blad: meer dan één blad (${total})`);
  const svg0 = reportPageSvg(recording, layout, 0, { pageLabelFont: '8px InterPDF, sans-serif' });
  const r2 = (v: number) => Math.round(v * 100) / 100;
  ok(svg0.startsWith('<svg') && svg0.includes(`viewBox="0 0 ${r2(layout.pageWidthPt)} ${r2(layout.pageHeightPt)}"`), 'blad: wortel-svg met viewBox in punten');
  const windows = pageWindows(layout, 0);
  const nested = (svg0.match(/<svg /g) ?? []).length - 1;
  ok(nested === windows.length, `blad: één geneste svg per venster (${nested} ↔ ${windows.length})`);
  ok(windows.length === 3, `blad: kop, body en voet als venster (kreeg ${windows.length})`);
  const label = pageLabel(layout, 0);
  ok(label.text === `1 / ${total}` && svg0.includes(`>1 / ${total}</text>`), 'blad: paginanummer zoals de PDF');
  ok(svg0.includes('Bouw &amp; &lt;Co&gt; "BV"') && !svg0.includes('<Co>'), 'blad: tekst ge-escapet');
  ok(svg0.includes(`<rect width="${r2(layout.pageWidthPt)}" height="${r2(layout.pageHeightPt)}" fill="#ffffff"/>`), 'blad: wit papier, ook in donker thema');
  // Het papier op het scherm zet de letterregels één keer in het document (`embedFontStyle: false`) en bewaart
  // de vensterinhoud van kop en voet (`windowCache`); het blad blijft verder hetzelfde.
  const bare = reportPageSvg(recording, layout, 0, { pageLabelFont: '8px InterPDF, sans-serif', embedFontStyle: false });
  ok(svg0.includes('<style>') && !bare.includes('<style>') && bare === svg0.replace(/<style>[^<]*<\/style>/, ''),
    'blad: zonder eigen <style> verder gelijk');
  ok(svg0.includes(`class="${reportFontClass(recording.fonts[0])}"`), 'blad: tekst met de letterklasse van de letter zelf');
  const windowCache = new Map<string, string[]>();
  const cached = [0, 0, 1].map(i => reportPageSvg(recording, layout, i, { pageLabelFont: '8px InterPDF, sans-serif', windowCache }));
  ok(cached[0] === svg0 && cached[1] === svg0 && cached[2] === reportPageSvg(recording, layout, 1, { pageLabelFont: '8px InterPDF, sans-serif' }) && windowCache.size > 0,
    `blad: met bewaarde vensters dezelfde bladen (${windowCache.size} vensters bewaard)`);

  // Alleen de opdrachten van het blad: blad 2 (tweede tijdlijnkolom) heeft andere balken dan blad 1.
  const body0 = windows.find(w => w.srcY > 0 && w.dstY === layout.bodyTopPt)!;
  const inBody = opsInWindow(recording, body0.srcX, body0.srcY, body0.srcX + body0.srcW, body0.srcY + body0.srcH);
  const brute = recording.ops.map((op, i) => [op, i] as const)
    .filter(([op]) => op.b[2] >= body0.srcX && op.b[0] <= body0.srcX + body0.srcW && op.b[3] >= body0.srcY && op.b[1] <= body0.srcY + body0.srcH)
    .map(([, i]) => i);
  ok(JSON.stringify(inBody) === JSON.stringify(brute), `index: zelfde opdrachten als lineair zoeken (${inBody.length} ↔ ${brute.length})`);
  ok(inBody.length < recording.ops.length, 'index: een venster bevat niet alle opdrachten');
  const svg1 = reportPageSvg(recording, layout, 1, {});
  ok(svg1 !== svg0 && svg1.includes(`>2 / ${total}</text>`), 'blad 2: eigen inhoud en nummer');
  ok(!reportPageSvg(recording, layout, total, {}).includes('<svg x='), 'blad buiten bereik: geen vensters');

  // RTL: links/rechts-anker draait om, midden blijft.
  const textOp: SvgOp = { k: 'text', x: 1, y: 2, text: 'a', font: 0, fill: '#000', anchor: 'start', b: [0, 0, 1, 1] };
  ok(opToSvg(textOp, 'f', true).includes('text-anchor="end"') && !opToSvg(textOp, 'f', false).includes('text-anchor'), 'rtl: start wordt end');
  ok(opToSvg({ ...textOp, anchor: 'middle' }, 'f', true).includes('text-anchor="middle"'), 'rtl: midden blijft midden');

  // Samenvoegen: opeenvolgende lijnen met dezelfde stijl en dekkende rechthoeken met dezelfde kleur
  // worden één <path>; volgorde, doorzichtige kleuren en andere stijlen blijven apart.
  const line = (d: string, stroke = '#cccccc', lw = 1): SvgOp => ({ k: 'path', d, stroke, lw, b: [0, 0, 1, 1] });
  const box = (x: number, w: number, fill = '#ff0000'): SvgOp => ({ k: 'rect', x, y: 0, w, h: 2, fill, b: [0, 0, 1, 1] });
  const merged = opsToSvg([line('M0 0L1 0'), line('M0 1L1 1'), line('M0 2L1 2', '#000000'), textOp, box(0, 1), box(1, 1)], 'f');
  ok(merged.length === 4, `samenvoegen: 2 lijnen + 1 lijn + tekst + 2 vlakken = 4 elementen (kreeg ${merged.length})`);
  ok(merged[0] === '<path d="M0 0L1 0M0 1L1 1" fill="none" stroke="#cccccc" stroke-width="1"/>', `samenvoegen: lijnen achter elkaar in één pad (${merged[0]})`);
  ok(merged[2].startsWith('<text'), 'samenvoegen: tekst houdt zijn plek in de volgorde');
  ok(merged[3] === '<path d="M0 0h1v2h-1ZM1 0h1v2h-1Z" fill="#ff0000"/>', `samenvoegen: vlakken als subpaden met de klok mee (${merged[3]})`);
  ok(opsToSvg([line('M0 0L1 0', 'rgba(0,0,0,0.5)'), line('M0 1L1 1', 'rgba(0,0,0,0.5)')], 'f').length === 2,
    'samenvoegen: doorzichtige lijnen blijven los (overlap zou donkerder worden)');
  ok(opsToSvg([line('M0 0L1 0', '#cccccc', 1), line('M0 1L1 1', '#cccccc', 2)], 'f').length === 2, 'samenvoegen: andere lijndikte blijft los');
  // Per kleurreeks: dun en dik om en om in één kleur geeft één pad per dikte, in de volgorde van eerste voorkomen.
  const run = opsToSvg([line('M0 0L1 0', '#cccccc', 1), line('M0 1L1 1', '#cccccc', 2), line('M0 2L1 2', '#cccccc', 1), textOp,
    line('M0 3L1 3', '#cccccc', 1)], 'f');
  ok(run.length === 4 && run[0].startsWith('<path d="M0 0L1 0M0 2L1 2"') && run[1].includes('stroke-width="2"') && run[2].startsWith('<text'),
    `samenvoegen: één kleurreeks, één pad per dikte; tekst breekt de reeks (${run.length}: ${run[0]})`);

  // Afknippen op het venster (`clipOpToWindow`): binnen het venster blijft elk pixel gelijk.
  {
    const clip = (op: SvgOp) => clipOpToWindow(op, 0, 0, 100, 50);
    const rect = clip({ k: 'rect', x: -100, y: 10, w: 300, h: 10, fill: '#ff0000', b: [-100, 10, 200, 20] });
    ok(rect?.k === 'rect' && rect.x === -4 && rect.w === 108 && rect.y === 10 && rect.h === 10,
      `afknippen: rechthoek tot het venster plus 4 px marge (${JSON.stringify(rect)})`);
    ok(clip({ k: 'rect', x: 200, y: 0, w: 10, h: 10, fill: '#ff0000', b: [200, 0, 210, 10] }) === null, 'afknippen: rechthoek buiten het venster valt weg');
    const dashedRect: SvgOp = { k: 'rect', x: -100, y: 0, w: 300, h: 10, stroke: '#000000', lw: 1, dash: '4 2', b: [-100.5, -0.5, 200.5, 10.5] };
    ok(clip(dashedRect) === dashedRect, 'afknippen: gestreepte rand blijft heel (de strepen lopen rondom)');
    const filled: SvgOp = { k: 'path', d: 'M-100 0L200 0L200 10Z', fill: '#0000ff', b: [-100, 0, 200, 10] };
    ok(clip(filled) === filled, 'afknippen: gevuld pad blijft heel');
    const inside: SvgOp = { k: 'path', d: 'M10 10L20 10', stroke: '#cccccc', lw: 1, b: [10, 9.5, 20, 10.5], pts: [[10, 10, 20, 10]] };
    ok(clip(inside) === inside, 'afknippen: een lijn binnen het venster blijft dezelfde opdracht');
    const grid = clip({ k: 'path', d: 'M50 -5000L50 5000', stroke: '#cccccc', lw: 1, b: [49.5, -5000, 50.5, 5000], pts: [[50, -5000, 50, 5000]] });
    ok(grid?.k === 'path' && grid.d === 'M50 -5L50 55', `afknippen: rasterlijn over 10.000 px ingekort tot het venster (${grid?.k === 'path' ? grid.d : grid})`);
    ok(clip({ k: 'path', d: 'M50 -100L50 0', stroke: '#cccccc', lw: 1, b: [49.5, -100, 50.5, 0], pts: [[50, -100, 50, 0]] }) === null,
      'afknippen: een lijn die alleen de bovenrand raakt, valt weg (platte uiteinden tekenen daar niets)');
    // Gestreepte relatielijn met een hoek: begin op een hele periode van het oude begin, de hoek blijft.
    const dep = clip({ k: 'path', d: 'M-1000 10L50 10L50 1000', stroke: '#000000', lw: 1, dash: '6 4', b: [-1000.5, 9.5, 50.5, 1000], pts: [[-1000, 10, 50, 10, 50, 1000]] });
    const depD = dep?.k === 'path' ? dep.d : '';
    const startX = Number(/^M(-?[\d.]+) /.exec(depD)?.[1]);
    ok(depD.includes('L50 10') && Number.isFinite(startX) && startX <= -5 && startX > -16 && (startX + 1000) % 10 === 0 && /L50 5[0-9](\.\d+)?$/.test(depD),
      `afknippen: streeplijn begint op een hele periode (fase gelijk), de hoek blijft, het eind valt weg (${depD})`);
    ok(dep?.k === 'path' && dep.pts === undefined, 'afknippen: een afgeknipte lijn draagt geen oude punten meer');
  }

  // Letterklassen: dezelfde letter geeft overal dezelfde klasse; één regel per letter plus de vaste tekstregel.
  {
    const font = 'bold 9px InterPDF, sans-serif';
    ok(reportFontClass(font) === reportFontClass(font) && reportFontClass(font) !== reportFontClass('9px InterPDF, sans-serif'),
      'letterklasse: volgt uit de letter zelf');
    ok(/^rf[0-9a-z]+$/.test(reportFontClass(font)), `letterklasse: geldige CSS-naam (${reportFontClass(font)})`);
    ok(reportFontRule(font) === `.${reportFontClass(font)}{font:${font}}`, 'letterregel: de canvas-letter als CSS-font');
    ok(fontClassCss([font]).endsWith(REPORT_PAGE_TEXT_RULE), 'lettercss: met de vaste tekstregel');
  }
  const stubMetrics: SvgTextMetrics = { measure: () => 1, baselineShift: () => 0 };
  const rec = new SvgRecordingDraw2D(10, 10, stubMetrics);
  rec.fillStyle = '#ff0000';
  rec.fillRect(2, 0, -1, 2);
  const negRect = rec.ops[0];
  ok(negRect?.k === 'rect' && negRect.x === 1 && negRect.w === 1, 'samenvoegen: de opname zet een negatieve breedte recht (geen gat door de draairichting)');

  // ── 4. Klikbare delen ────────────────────────────────────────────────────────────────────────
  const regions = reportPaperRegions(paper.result, layout, 0);
  const ids = regions.regions.map(r => r.id);
  ok(['header', 'columns', 'chart', 'footer'].every(id => ids.includes(id as never)), `delen: kop, kolommen, balken en voet op blad 1 (${ids.join(',')})`);
  const header = regions.regions.find(r => r.id === 'header')!.rects[0];
  ok(near(header.y, layout.marginPt, 0.5), 'delen: de kop begint bij de bovenmarge');
  const centre = (r: { x: number; y: number; w: number; h: number }) => [r.x + r.w / 2, r.y + r.h / 2] as const;
  const [hx, hy] = centre(header);
  ok(hitPaperRegion(regions, hx, hy)?.id === 'header', 'klik in de kop ⇒ kop');
  const col = regions.columns.find(c => c.key === 'start');
  ok(!!col, 'delen: kolom Start op blad 1');
  if (col) {
    const [cx] = centre(col);
    const bodyCols = regions.regions.find(r => r.id === 'columns')!.rects.find(r => r.y >= layout.bodyTopPt - 0.01)!;
    const hit = hitPaperRegion(regions, cx, bodyCols.y + 5);
    ok(hit?.id === 'columns' && hit.column === 'start', `klik in de tabel ⇒ kolom start (kreeg ${JSON.stringify(hit)})`);
  }
  const chart = regions.regions.find(r => r.id === 'chart')!.rects.find(r => r.y >= layout.bodyTopPt - 0.01)!;
  ok(hitPaperRegion(regions, chart.x + chart.w / 2, chart.y + 10)?.id === 'chart', 'klik in de balken ⇒ balken en tijdlijn');
  const footer = regions.regions.find(r => r.id === 'footer')!.rects[0];
  ok(near(footer.y, layout.footerTopPt, 0.5), 'delen: de voet staat waar de PDF hem zet');
  ok(hitPaperRegion(regions, 2, 2) === null, 'klik in de marge ⇒ geen deel (stap Pagina)');
  const regions1 = reportPaperRegions(paper.result, layout, 1);
  ok(!regions1.regions.some(r => r.id === 'chart' && r.rects.some(rr => rr.x < layout.marginPt + 1 && rr.w > layout.pageWidthPt / 2)),
    'blad 2: de balken beginnen na de herhaalde tabelstrook');
}

// ── 5. Papier = PDF, ook in het afkappen ─────────────────────────────────────────────────────────
{
  interface DrawnText { text: string; font: string }
  /** Een Draw2D die elke `fillText` noteert en verder alles aan de echte backend doorgeeft. */
  const noteTexts = <T extends object>(target: T, notes: DrawnText[]): T => new Proxy(target, {
    get(t, prop) {
      if (prop === 'fillText') {
        return (text: string, x: number, y: number) => {
          if (text) notes.push({ text, font: (t as unknown as Draw2D).font });
          (t as unknown as Draw2D).fillText(text, x, y);
        };
      }
      const v = Reflect.get(t, prop, t) as unknown;
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
    },
    set(t, prop, value) { return Reflect.set(t, prop, value, t); },
  });

  // Het paneel meet de kolommen op de koppen en cellen van dít rapport, met de meting van het papier
  // (`useStudioPrintOptions`), en geeft ze door als `columnWidths` (en bij "Volledig" de naambreedte).
  const studioOptions = (fonts: ReportMeasureFonts, tasks: Task[], over: Partial<PrintOptions>, fullNames: boolean): PrintOptions => {
    const m = createReportTextMetrics(fonts);
    const options = baseOptions(over);
    const rows = buildPrintRows(tasks, undefined);
    const columnWidths = measureTableColumnWidths(rows, {
      showCompletion: options.showCompletion ?? false, numberLocale: 'nl', calendar: project.calendar, calendars: [project.calendar],
      fontFamily: options.fontFamily, tableColumns: options.tableColumns,
    }, (text, font) => m.measure(text, font));
    const taskNameColumnWidth = fullNames
      ? measureTaskNameColumnWidth(rows, (text, bold) => m.measure(text, nameCellFont(bold, options.fontFamily)))
      : 130;
    return { ...options, columnWidths, taskNameColumnWidth };
  };

  // Lastige namen: een lange naam, de pijl die Inter met GSUB tot één teken maakt, een teken dat Carlito
  // mist (komt uit Inter), en Arabisch (door de shaping-kern).
  const carlitoMissing = [0x2300, 0x2316, 0x2192, 0x2264, 0x2713].find(cp => !carlitoFonts.regular.hasGlyphForCodePoint(cp) && interFonts.regular.hasGlyphForCodePoint(cp));
  const leaves = project.tasks.filter(t => t.childIds.length === 0);
  const renamed = new Map<string, string>([
    [leaves[1].id, 'Stakeholder management en afstemming met de gemeente over de bouwlogistiek'],
    [leaves[2].id, 'Afstemming -> opdrachtgever'],
    [leaves[3].id, `Peil ${String.fromCodePoint(carlitoMissing ?? 0x2264)} 0,00 controleren`],
    [leaves[4].id, 'تسليم المفتاح'],
  ]);
  const tasks: Task[] = project.tasks.map(t => (renamed.has(t.id) ? { ...t, name: renamed.get(t.id)! } : t));
  ok(carlitoMissing !== undefined, 'fixture: een teken dat Carlito mist en Inter heeft');

  const variants: [string, ReportMeasureFonts, ReportFontFiles, Partial<PrintOptions>, boolean, boolean][] = [
    ['standaard (A3 liggend, namen afkappen)', interFonts, INTER, {}, false, true],
    ['namen volledig', interFonts, INTER, {}, true, true],
    ['A4 staand, tijdlijn over 2', interFonts, INTER, { paperSize: 'A4', orientation: 'portrait', timelineColumns: 2 }, false, true],
    ['vaste schaal, zonder herhaling', interFonts, INTER, { autoFit: false, customZoom: 18 }, false, false],
    ['Carlito met Inter als terugval', carlitoFonts, CARLITO, { fontFamily: reportFontStack('carlito') }, true, true],
  ];
  const subsetFont = async (bytes: Uint8Array) => bytes;
  for (const [label, fonts, files, over, fullNames, repeat] of variants) {
    const options = studioOptions(fonts, tasks, over, fullNames);
    const m = createReportTextMetrics(fonts);
    const paper = recordReportPaper(tasks, project.sequences, project.calendar, project.project.name, options, repeat, repeat, m);
    const svgTexts = paper.recording.ops.filter((op): op is Extract<SvgOp, { k: 'text' }> => op.k === 'text');

    // De echte vector-PDF, met dezelfde keuzes als `buildGanttReportPdf`. De laatste render telt (een
    // smallere herhaalde voet geeft een tweede render, net als op het papier).
    const passes: { notes: DrawnText[]; d2d?: PdfVectorDraw2D }[] = [];
    await paginateVectorToPdfBytes(
      (make, footerLayoutWidth) => {
        const pass: { notes: DrawnText[]; d2d?: PdfVectorDraw2D } = { notes: [] };
        passes.push(pass);
        return renderReport((w, h) => {
          const d2d = make(w, h) as PdfVectorDraw2D;
          pass.d2d = d2d;
          return noteTexts(d2d, pass.notes);
        }, tasks, project.sequences, project.calendar, project.project.name, { ...options, footerLayoutWidth });
      },
      { ...ganttTileOptions(options, repeat, repeat), baseDir: 'ltr', subsetFont, fallbackFonts: files === INTER ? [] : [{ id: 'inter', bytes: INTER }] },
      files,
      ARABIC,
    );
    const last = passes[passes.length - 1];
    const placements = last?.d2d?.texts ?? [];
    ok(!!last && last.notes.length === placements.length, `${label}: PDF-meting heeft voor elke tekst één plaatsing (${last?.notes.length} ↔ ${placements.length})`);
    ok(svgTexts.length === last.notes.length, `${label}: papier en PDF tekenen evenveel teksten (${svgTexts.length} ↔ ${last.notes.length})`);
    const n = Math.min(svgTexts.length, last.notes.length);
    let textDiffs = 0;
    let placeDiffs = 0;
    const textExamples: string[] = [];
    const placeExamples: string[] = [];
    for (let i = 0; i < n; i++) {
      const svg = svgTexts[i];
      const pdf = last.notes[i];
      const place = placements[i];
      if (svg.text !== pdf.text) {
        textDiffs++;
        if (textExamples.length < 4) textExamples.push(`"${svg.text}" ↔ "${pdf.text}"`);
        continue;
      }
      if (!place) continue;
      const { bold, size } = parseReportFont(pdf.font);
      const baseline = place.y0 + fontVerticalMetrics(bold ? fonts.bold : fonts.regular).ascentEm * size;
      if (!near(svg.b[0], place.x0) || !near(svg.b[2], place.x1) || !near(svg.y, baseline)) {
        placeDiffs++;
        if (placeExamples.length < 4) placeExamples.push(`"${svg.text}" x ${svg.b[0].toFixed(3)}–${svg.b[2].toFixed(3)} y ${svg.y.toFixed(3)} ↔ x ${place.x0.toFixed(3)}–${place.x1.toFixed(3)} y ${baseline.toFixed(3)}`);
      }
    }
    ok(textDiffs === 0, `${label}: ${textDiffs} tekst(en) anders afgekapt op papier dan in de PDF: ${textExamples.join(' · ')}`);
    ok(placeDiffs === 0, `${label}: ${placeDiffs} tekst(en) op een andere plek of basislijn: ${placeExamples.join(' · ')}`);
    // Datums horen in de PDF nooit afgekapt te zijn: het paneel meet hun kolom op dezelfde maat.
    const cutDates = last.notes.filter(t => /^\d{2}-\d{2}-/.test(t.text) && t.text.endsWith('…'));
    ok(cutDates.length === 0, `${label}: ${cutDates.length} afgekapte datum(s) in de PDF (${cutDates.slice(0, 3).map(t => t.text).join(', ')})`);
    if (label.startsWith('standaard')) {
      ok(svgTexts.some(t => t.text.startsWith('Stakeholder') && t.text.endsWith('…')), 'standaard: de lange naam wordt afgekapt (op papier en dus ook in de PDF)');
      ok(svgTexts.some(t => /^\d{2}-\d{2}-\d{4}/.test(t.text)), 'standaard: er staan datums in de tabel');
    }
    if (fullNames) ok(svgTexts.some(t => t.text === renamed.get(leaves[1].id)), `${label}: met "Volledig" staat de lange naam er heel`);
  }
}

// ── 6. Alleen de rijen van de bladen in beeld ────────────────────────────────────────────────────
{
  // Een groter plan: het voorbeeld zes keer, met eigen id's, ouders en relaties (±340 rijen, veel bladen).
  const copies = 6;
  const bigTasks: Task[] = [];
  const bigSequences = [];
  for (let k = 0; k < copies; k++) {
    const id = (v: string) => `${v}~${k}`;
    for (const t of project.tasks) {
      bigTasks.push({ ...t, id: id(t.id), parentId: t.parentId ? id(t.parentId) : null, childIds: t.childIds.map(id), name: `${t.name} ${k + 1}` });
    }
    for (const q of project.sequences) bigSequences.push({ ...q, id: id(q.id), predecessorId: id(q.predecessorId), successorId: id(q.successorId) });
  }
  // Een relatie van de eerste naar de laatste taak: een lange lijn door alle bladen heen.
  bigSequences.push({ ...project.sequences[0], id: 'lang', predecessorId: bigTasks[1].id, successorId: bigTasks[bigTasks.length - 1].id });
  const cases: [string, PrintOptions, boolean][] = [
    ['A3 liggend', baseOptions(), true],
    ['A4 staand, tijdlijn over 3', baseOptions({ paperSize: 'A4', orientation: 'portrait', timelineColumns: 3 }), true],
    ['vaste schaal, voortgangslijn, zonder herhaling', baseOptions({ autoFit: false, customZoom: 14, statusLine: 'progress' }), false],
  ];
  for (const [label, options, repeat] of cases) {
    const full = recordReportPaper(bigTasks, bigSequences, project.calendar, project.project.name, options, repeat, repeat, metrics);
    const total = full.layout.rows * full.layout.cols;
    const middle = Math.floor(full.layout.rows / 2) * full.layout.cols;
    const rec = createReportPaperRecorder(bigTasks, bigSequences, project.calendar, project.project.name, options, repeat, repeat, metrics, [middle]);
    ok(total >= 6, `${label}: genoeg bladen om te vergelijken (${total})`);
    ok(JSON.stringify(rec.layout) === JSON.stringify(full.layout), `${label}: dezelfde bladindeling als de volledige opname`);
    ok(rec.passes === full.passes, `${label}: evenveel renders voor de maten (${rec.passes} ↔ ${full.passes})`);
    ok(JSON.stringify(rec.result) === JSON.stringify(full.result), `${label}: dezelfde maten als de volledige opname`);
    const partOps = rec.recordingFor([middle]).ops.length;
    ok(partOps < full.recording.ops.length * 0.6, `${label}: de eerste opname tekent alleen de rijen in beeld (${partOps} van ${full.recording.ops.length} opdrachten)`);
    let diffs = 0;
    const firstDiff: string[] = [];
    for (let page = 0; page < total; page++) {
      const want = reportPageSvg(full.recording, full.layout, page, { pageLabelFont: '8px InterPDF, sans-serif' });
      const got = reportPageSvg(rec.recordingFor([page]), rec.layout, page, { pageLabelFont: '8px InterPDF, sans-serif' });
      if (want !== got) {
        diffs++;
        if (firstDiff.length === 0) {
          let at = 0;
          while (at < want.length && want[at] === got[at]) at++;
          firstDiff.push(`blad ${page + 1}: vanaf teken ${at}: "${want.slice(at, at + 90)}" ↔ "${got.slice(at, at + 90)}"`);
        }
      }
    }
    ok(diffs === 0, `${label}: ${diffs} van ${total} bladen anders dan in de volledige opname. ${firstDiff.join('')}`);
    // Een groep bladen in één keer, daarna komt elk blad uit die ene opname.
    const fresh = createReportPaperRecorder(bigTasks, bigSequences, project.calendar, project.project.name, options, repeat, repeat, metrics, [0]);
    // Bladen naast elkaar delen hun rijen; tel dus per bladrij (rij 1 tot en met de laatste).
    const secondRow = fresh.layout.cols;
    ok(fresh.layout.rows >= 3, `${label}: de proef heeft minstens drie bladrijen (${fresh.layout.rows})`);
    const batch = fresh.recordingFor([secondRow, total - 1]);
    ok(
      fresh.recordingFor([total - 1]) === batch && fresh.recordingFor([secondRow]) === batch && fresh.recordingFor([secondRow + fresh.layout.cols]) === batch,
      `${label}: een blad uit een eerdere opname rekent niet opnieuw`,
    );
  }
}

// ── 7. Vaste schaal begint op de passende breedte ───────────────────────────────────────────────
{
  const cases: [string, PrintOptions][] = [
    ['A4 staand', baseOptions({ paperSize: 'A4', orientation: 'portrait' })],
    ['A4 staand, tijdlijn over 2', baseOptions({ paperSize: 'A4', orientation: 'portrait', timelineColumns: 2 })],
    ['A3 liggend', baseOptions()],
    ['A3 liggend, tijdlijn over 3', baseOptions({ timelineColumns: 3 })],
  ];
  for (const [label, options] of cases) {
    const fit = recordReportPaper(project.tasks, project.sequences, project.calendar, project.project.name, options, true, true, metrics);
    const dayWidth = fit.result.dayWidth ?? 0;
    const start = fixedScaleStartDayWidth(dayWidth);
    const scale = recordReportPaper(project.tasks, project.sequences, project.calendar, project.project.name,
      { ...options, autoFit: false, customZoom: start }, true, true, metrics);
    ok(dayWidth > 0 && Math.abs(start - dayWidth) < dayWidth * 1e-6, `${label}: vaste schaal begint op de passende breedte (${dayWidth} → ${start})`);
    ok(scale.layout.cols === fit.layout.cols && scale.layout.rows === fit.layout.rows,
      `${label}: zelfde bladen na de wissel (${fit.layout.rows}×${fit.layout.cols} → ${scale.layout.rows}×${scale.layout.cols})`);
    if (label === 'A4 staand') {
      ok(dayWidth < 1, `A4 staand: de passende breedte ligt onder 1 px per dag (${dayWidth}), dus de proef dekt de oude klem`);
      const clamped = recordReportPaper(project.tasks, project.sequences, project.calendar, project.project.name,
        { ...options, autoFit: false, customZoom: Math.max(1, Math.floor(dayWidth)) }, true, true, metrics);
      ok(clamped.layout.cols > fit.layout.cols, `A4 staand: met de oude klem op 1 px meer bladen naast elkaar (${clamped.layout.cols}), de proef is gevoelig`);
    }
  }
  ok(fixedScaleStartDayWidth(0.000_1) === REPORT_MIN_DAY_WIDTH, 'vaste schaal: nooit onder de kleinste breedte per dag');
}

if (failures > 0) {
  console.log(`XX report-svg: ${failures} afwijking(en)`);
  process.exit(1);
}
console.log('OK report-svg: SVG-papier = zelfde tekenopdrachten en bladen als de PDF; delen klikbaar');
