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
import './domStub';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport, type PrintOptions, type RenderReportResult } from '@/services/print/printPreview';
import { computeTileLayout, footerLayoutWidthFor, footerRelayoutWidth, reportTileInput } from '@/services/print/tileLayout';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';
import {
  fontPx, opsInWindow, opsToSvg, opToSvg, SvgRecordingDraw2D, type SvgOp, type SvgTextMetrics,
} from '@/services/pdf/svgDraw2d';
import { ganttTileOptions, recordReportPaper } from '@/services/print/reportPaperModel';
import { hitPaperRegion, pageLabel, pageWindows, reportPageSvg, reportPaperRegions } from '@/services/print/reportPaper';
import { readIFC } from '@/services/ifc/ifcReader';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };
const near = (a: number, b: number, eps = 0.011) => Math.abs(a - b) <= eps;

// Vaste tekstmeting: breedte per teken naar lettergrootte, basislijn vast per soort.
const metrics: SvgTextMetrics = {
  measure: (text, font) => text.length * fontPx(font) * 0.55,
  baselineShift: (font, baseline) => {
    const size = fontPx(font);
    if (baseline === 'middle') return size * 0.36;
    if (baseline === 'bottom') return -size * 0.24;
    return 0;
  },
};

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

if (failures > 0) {
  console.log(`XX report-svg: ${failures} afwijking(en)`);
  process.exit(1);
}
console.log('OK report-svg: SVG-papier = zelfde tekenopdrachten en bladen als de PDF; delen klikbaar');
