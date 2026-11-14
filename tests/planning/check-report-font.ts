/**
 * De rapportletter als parameter, met terugval op Inter (issue #770) — regressiebatterij.
 *
 * ACHTERGROND. De rapporten (Gantt-afdruk, resourcediagram, tabelrapporten) tekenden altijd met het
 * gevendorde Inter: de fontstack stond vast in `printPreview.ts` en `pdfTable.ts`, en de vector-
 * pagineerder kende alleen de Inter-bytes. Voor een keuze van de rapportletter (#770) moet de stack
 * een parameter worden, en de vector-PDF moet een letter aankunnen die een teken mist dat Inter wél
 * heeft. Zonder terugval gooit de pagineerder dan `VectorUnsupportedError` en valt de HELE PDF terug
 * op raster (geen selecteerbare tekst meer) — al om één `≤` of één Cyrillische taaknaam.
 *
 * Deze check bewaakt:
 *   A. de fontstack: zonder optie exact de oude Inter-stack (dus een bestaand rapport tekent als
 *      voorheen), mét optie overal de gegeven stack — in de Gantt-render, de tabel- en
 *      sectierapporten en de meethulpen van het paneel (meten en tekenen op dezelfde letter);
 *   B. de vector-pagineerder, headless met de echte TTF's: een letter zonder Cyrillisch faalt zonder
 *      terugval, en slaagt mét terugval doordat alleen de ontbrekende tekens uit Inter komen; met
 *      Inter als rapportletter verandert er niets, ook niet als de terugval meegegeven wordt;
 *   C. het vaste setje van de keuzelijst *Lettertype*: elk bestand is er en is leesbaar, elke letter
 *      dekt zelf alle letters van de Latijnse en Cyrillische app-talen, en met elke letter maakt de
 *      echte pagineerder zonder fout een vector-PDF (Gantt, tabelrapport, Arabisch van rechts naar
 *      links), met die letter als F0/F1 en alleen een ontbrekend symbool uit Inter.
 *
 * Testletter: Noto Sans Arabic uit de repo, als "rapportletter" die alleen cijfers en leestekens
 * dekt — geen Latijnse letters, geen Cyrillisch, geen `≤`. Zo komt in één tekst een deel uit de
 * rapportletter en een deel uit Inter. (Space Grotesk uit `docs/branding/` kan niet: pdf-lib leest bij
 * volledig inbedden de breedte van élke glyph, en het lege laatste glyph van dat bestand laat de
 * fontkit-parser vastlopen. Elk lettertype dat de app meelevert, moet daarom die leestest doorstaan.)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PDFDocument, PDFDict, PDFName, PDFRawStream, PDFArray, PDFRef, decodePDFRawStream,
} from 'pdf-lib';
import {
  renderReport, measureTableColumnWidths, buildPrintRows, nameCellFont, tableTextFont, curveCellFont,
  type PrintOptions,
} from '@/services/print/printPreview';
import { makeSectionedRenderReport, makeTableRenderReport, type PdfSectionedReportSpec } from '@/services/pdf/pdfTable';
import { paginateVectorToPdfBytes, VectorUnsupportedError, type ReportFontBytes } from '@/services/print/paginateVector';
import fontkit from '@pdf-lib/fontkit';
import {
  DEFAULT_REPORT_FONT_ID, DEFAULT_REPORT_FONT_STACK, REPORT_FONT_IDS, REPORT_FONTS, reportFontStack,
} from '@/services/pdf/reportFont';
import { readIFC } from '@/services/ifc/ifcReader';
import type { Draw2D, TextAlign, TextBaseline } from '@/services/pdf/draw2d';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let failures = 0;
const fail = (msg: string) => { console.log(`   XX ${msg}`); failures++; };
const ok = (cond: boolean, msg: string) => { if (!cond) fail(msg); };

/** De stack zoals die vóór #770 letterlijk in `printPreview.ts` en `pdfTable.ts` stond. */
const OLD_STACK = 'InterPDF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const PROEF_STACK = '"ProefPDF", InterPDF, sans-serif';

// ── Opnemende Draw2D: legt per fillText de actieve `font` vast ─────────────────────────────────
function recorder(): { d2d: Draw2D; fonts: string[] } {
  const fonts: string[] = [];
  const st = { font: '10px x', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: 'left' as TextAlign, textBaseline: 'alphabetic' as TextBaseline };
  const d2d: Draw2D = {
    get font() { return st.font; }, set font(v) { st.font = v; },
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get textAlign() { return st.textAlign; }, set textAlign(v) { st.textAlign = v; },
    get textBaseline() { return st.textBaseline; }, set textBaseline(v) { st.textBaseline = v; },
    setLineDash() {}, fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    closePath() {}, fill() {}, stroke() {}, roundRect() {},
    fillText() { fonts.push(st.font); },
    measureText(t: string) { return { width: t.length * 6 }; },
  };
  return { d2d, fonts };
}

/** Elke opgenomen font-string is `[bold ]<n>px <stack>` met precies deze stack. */
function allOnStack(fonts: string[], stack: string): string | undefined {
  const re = /^(bold )?\d+(\.\d+)?px /;
  return fonts.find(f => !re.test(f) || f.replace(re, '') !== stack);
}

// ── Fixture: het echte voorbeeldproject ────────────────────────────────────────────────────────
const project = readIFC(readFileSync(join(ROOT, 'public/examples/03-kantoorgebouw-zuidas.ifc'), 'utf8'));
const baseOptions = (over: Partial<PrintOptions> = {}): PrintOptions => ({
  showCritical: true, showFloat: true, showDeps: true, showWeekends: true, showLegend: true,
  showTaskNames: true, showCompletion: true, autoFit: true, customZoom: 22,
  paperSize: 'A3', orientation: 'landscape', companyName: 'Bouwbedrijf',
  locale: 'nl', calendars: [project.calendar], resources: project.resources, assignments: project.assignments,
  projectStartDate: project.project.startDate, projectEndDate: project.project.endDate,
  ...over,
});
const renderGantt = (make: (w: number, h: number) => Draw2D, over: Partial<PrintOptions> = {}, footerLayoutWidth?: number) =>
  renderReport(make, project.tasks, project.sequences, project.calendar, project.project.name, baseOptions({ ...over, footerLayoutWidth }));

const sectioned = (title: string): PdfSectionedReportSpec => ({
  title,
  subtitle: 'Near-critical: totale speling ≤ 5 werkdagen',
  notes: ['Statusdatum ontbreekt'],
  summary: [{ label: 'Taken', value: String(project.tasks.length) }, { label: 'Kritiek', value: '4' }],
  kpis: [{ label: 'Gereed', value: '42%', detail: 'van het werk' }],
  sections: [{
    heading: 'Taken',
    columns: [
      { header: 'Naam', width: 200, align: 'left', text: (r: unknown) => (r as { n: string }).n },
      { header: 'Speling (wd)', width: 70, align: 'right', text: () => '0', bold: () => true },
    ],
    rows: project.tasks.slice(0, 12).map(t => ({ n: t.name })),
  }],
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('── A. fontstack als parameter');
{
  ok(DEFAULT_REPORT_FONT_STACK === OLD_STACK, `A0 standaardstack gewijzigd: ${DEFAULT_REPORT_FONT_STACK}`);

  const def = recorder();
  renderGantt(() => def.d2d);
  ok(def.fonts.length > 50, `A1 Gantt tekende te weinig tekst (${def.fonts.length})`);
  const offDef = allOnStack(def.fonts, OLD_STACK);
  ok(offDef === undefined, `A1 Gantt zonder optie tekent niet op de oude Inter-stack: ${offDef}`);

  const own = recorder();
  renderGantt(() => own.d2d, { fontFamily: PROEF_STACK });
  const offOwn = allOnStack(own.fonts, PROEF_STACK);
  ok(offOwn === undefined, `A2 Gantt met fontFamily tekent niet overal op die stack: ${offOwn}`);
  ok(own.fonts.length === def.fonts.length, `A2 Gantt met fontFamily tekent ander aantal teksten (${own.fonts.length} vs ${def.fonts.length})`);

  const measured: string[] = [];
  const measure = (text: string, font: string) => { measured.push(font); return text.length * 6; };
  const sec = recorder();
  makeSectionedRenderReport(sectioned('Kritiek pad'), measure, PROEF_STACK)(() => sec.d2d);
  ok(sec.fonts.length > 20, `A3 sectierapport tekende te weinig tekst (${sec.fonts.length})`);
  ok(allOnStack(sec.fonts, PROEF_STACK) === undefined, `A3 sectierapport tekent niet overal op de stack: ${allOnStack(sec.fonts, PROEF_STACK)}`);
  ok(measured.length > 0 && allOnStack(measured, PROEF_STACK) === undefined, `A3 kolomkoppen niet gemeten op de stack: ${allOnStack(measured, PROEF_STACK)}`);

  const secDef = recorder();
  makeSectionedRenderReport(sectioned('Kritiek pad'))(() => secDef.d2d);
  ok(allOnStack(secDef.fonts, OLD_STACK) === undefined, `A3 sectierapport zonder stack niet op Inter: ${allOnStack(secDef.fonts, OLD_STACK)}`);

  measured.length = 0;
  const tbl = recorder();
  const s = sectioned('x').sections[0];
  makeTableRenderReport({ title: 'Mijlpalen', columns: s.columns, rows: s.rows }, measure, PROEF_STACK)(() => tbl.d2d);
  ok(allOnStack(tbl.fonts, PROEF_STACK) === undefined, `A4 tabelrapport tekent niet overal op de stack: ${allOnStack(tbl.fonts, PROEF_STACK)}`);
  ok(measured.length > 0 && allOnStack(measured, PROEF_STACK) === undefined, `A4 tabelkoppen niet gemeten op de stack`);

  measured.length = 0;
  measureTableColumnWidths(buildPrintRows(project.tasks, undefined), { showCompletion: true, fontFamily: PROEF_STACK }, measure);
  ok(measured.length > 0 && allOnStack(measured, PROEF_STACK) === undefined, `A5 kolommeting niet op de stack: ${allOnStack(measured, PROEF_STACK)}`);
  measured.length = 0;
  measureTableColumnWidths(buildPrintRows(project.tasks, undefined), { showCompletion: true }, measure);
  ok(allOnStack(measured, OLD_STACK) === undefined, `A5 kolommeting zonder stack niet op Inter`);

  ok(nameCellFont(true) === `bold 9px ${OLD_STACK}` && nameCellFont(false, PROEF_STACK) === `9px ${PROEF_STACK}`, 'A6 nameCellFont');
  ok(tableTextFont(false) === `8px ${OLD_STACK}` && tableTextFont(true, PROEF_STACK) === `bold 9px ${PROEF_STACK}`, 'A6 tableTextFont');
  ok(curveCellFont(true, PROEF_STACK) === `bold 9px ${PROEF_STACK}`, 'A6 curveCellFont');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('── B. vector-pagineerder met een andere rapportletter');

const ttf = (rel: string) => new Uint8Array(readFileSync(join(ROOT, rel)));
const INTER: ReportFontBytes = { regular: ttf('src/services/pdf/fonts/Inter-Regular.ttf'), bold: ttf('src/services/pdf/fonts/Inter-Bold.ttf') };
const ARABIC: ReportFontBytes = { regular: ttf('src/services/pdf/fonts/NotoSansArabic-Regular.ttf'), bold: ttf('src/services/pdf/fonts/NotoSansArabic-Bold.ttf') };
/** De testletter (zie de kop): dekt cijfers, spatie en leestekens, geen letters. */
const SMAL = ARABIC;

/** Identiteits-subsetter: het volle font is een geldige "subset" met dezelfde glyph-id's. Telt de aanroepen. */
const subsetCalls: number[][] = [];
const subsetFont = async (bytes: Uint8Array, cps: Iterable<number>) => { subsetCalls.push([...cps]); return bytes; };

/** BaseFont-namen van de Type0-fonts in een PDF, plus de (gedecodeerde) content stream van pagina 1. */
async function inspect(pdf: Uint8Array): Promise<{ fonts: string[]; page1: string; pages: number }> {
  const doc = await PDFDocument.load(pdf);
  const fonts: string[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of('Subtype')) === PDFName.of('Type0')) {
      fonts.push(String(obj.get(PDFName.of('BaseFont'))));
    }
  }
  const contents = doc.getPage(0).node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [contents];
  let page1 = '';
  for (const r of refs) {
    const stream = r instanceof PDFRef ? doc.context.lookup(r) : r;
    if (stream instanceof PDFRawStream) page1 += Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
  }
  return { fonts: fonts.sort(), page1, pages: doc.getPageCount() };
}

const tableOpts = { paperSize: 'a4' as const, orientation: 'portrait' as const, mode: 'fit-width' as const, subsetFont };
const CYRILLIC_TITLE = 'Фундамент — график';

{
  // B1. Inter, geen terugval: zoals vóór #770 — vector, alleen de twee Inter-gewichten, geen subset.
  subsetCalls.length = 0;
  const pdf = await paginateVectorToPdfBytes(makeSectionedRenderReport(sectioned(CYRILLIC_TITLE)), tableOpts, INTER, ARABIC);
  const r = await inspect(pdf);
  ok(r.fonts.length === 2 && r.fonts.every(f => f.includes('Inter')), `B1 Inter-rapport heeft andere fonts: ${r.fonts.join(', ')}`);
  ok(subsetCalls.length === 0, `B1 Inter-rapport riep de subsetter aan (${subsetCalls.length}×)`);
}
{
  // B2. De smalle letter zonder terugval: letters en Cyrillisch zijn ongedekt ⇒ de hele PDF zou raster worden.
  let err: unknown;
  try {
    await paginateVectorToPdfBytes(makeSectionedRenderReport(sectioned(CYRILLIC_TITLE), undefined, PROEF_STACK), tableOpts, SMAL, ARABIC);
  } catch (e) { err = e; }
  ok(err instanceof VectorUnsupportedError, `B2 smalle letter zonder terugval gooide geen VectorUnsupportedError (${String(err)})`);
  if (err instanceof VectorUnsupportedError) {
    ok(err.codepoints.includes(0x0424) && err.codepoints.includes(0x2264), `B2 'Ф' of '≤' staat niet bij de ongedekte tekens: ${err.codepoints.join(',')}`);
  }
}
{
  // B3. De smalle letter mét terugval op Inter: vector; alleen de ontbrekende tekens komen uit Inter.
  subsetCalls.length = 0;
  const pdf = await paginateVectorToPdfBytes(
    makeSectionedRenderReport(sectioned(CYRILLIC_TITLE), undefined, PROEF_STACK),
    { ...tableOpts, fallbackFonts: [{ id: 'inter', bytes: INTER }] }, SMAL, ARABIC,
  );
  const r = await inspect(pdf);
  const smal = r.fonts.filter(f => f.includes('NotoSansArabic'));
  const inter = r.fonts.filter(f => f.includes('Inter'));
  ok(smal.length === 2 && inter.length === 2 && r.fonts.length === 4, `B3 verwachtte 2× de smalle letter + 2× Inter, kreeg: ${r.fonts.join(', ')}`);
  ok(subsetCalls.length === 2, `B3 subsetter ${subsetCalls.length}× aangeroepen, verwachtte 2 (regular + bold)`);
  const cps = new Set(subsetCalls[0] ?? []);
  ok(cps.has(0x0424) && cps.has(0x2264) && cps.has(0x61), `B3 'Ф', '≤' of 'a' ontbreekt in de Inter-subset: ${[...cps].join(',')}`);
  const ownChars = [...cps].filter(cp => cp === 0x20 || (cp >= 0x30 && cp <= 0x39));
  ok(ownChars.length === 0, `B3 spatie/cijfers in de Inter-subset (horen bij de rapportletter): ${ownChars.join(',')}`);
  ok(/\/F4 [\d.]+ Tf/.test(r.page1), 'B3 pagina 1 tekent niets met het terugvalfont F4');
  ok(/\/F0 [\d.]+ Tf/.test(r.page1), 'B3 pagina 1 tekent niets met de rapportletter F0');
}
{
  // B4. Inter mét (overbodige) terugval op Inter: niets verandert — geen extra font, geen subset.
  subsetCalls.length = 0;
  const pdf = await paginateVectorToPdfBytes(
    makeSectionedRenderReport(sectioned(CYRILLIC_TITLE)),
    { ...tableOpts, fallbackFonts: [{ id: 'inter', bytes: INTER }] }, INTER, ARABIC,
  );
  const r = await inspect(pdf);
  ok(r.fonts.length === 2 && r.fonts.every(f => f.includes('Inter')), `B4 Inter + terugval heeft andere fonts: ${r.fonts.join(', ')}`);
  ok(subsetCalls.length === 0, `B4 Inter + terugval riep de subsetter aan (${subsetCalls.length}×)`);
}
{
  // B5. De Gantt-afdruk van het voorbeeldproject: met de smalle letter + terugval blijft hij vector en
  // meerpagina, en tekent de render op de gegeven stack (dezelfde render als preview en raster).
  const pdf = await paginateVectorToPdfBytes(
    (make, footerLayoutWidth) => renderGantt(make, { fontFamily: PROEF_STACK }, footerLayoutWidth),
    { paperSize: 'a4', orientation: 'landscape', mode: 'fit-width', repeatHeader: true, repeatFooter: true, subsetFont,
      fallbackFonts: [{ id: 'inter', bytes: INTER }] },
    SMAL, ARABIC,
  );
  const r = await inspect(pdf);
  ok(r.pages >= 2, `B5 Gantt op A4 heeft maar ${r.pages} pagina('s)`);
  ok(r.fonts.filter(f => f.includes('NotoSansArabic')).length === 2 && r.fonts.filter(f => f.includes('Inter')).length === 2,
    `B5 Gantt heeft niet 2× de smalle letter + 2× Inter: ${r.fonts.join(', ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// C. Het vaste setje van de keuzelijst *Lettertype* (issue #770, besluit Ethan 7 november 2026): elke
// letter is een ongewijzigd upstreambestand in `src/services/pdf/fonts/`, onder de namen uit
// `REPORT_FONTS` — dezelfde namen die `fontLoader.ts` in de app ophaalt.
console.log('── C. elke letter uit het vaste setje');

/** De talen van de app met een Latijns of Cyrillisch schrift: daar draagt de rapportletter zelf de tekst.
 *  Arabisch/Perzisch (Noto Sans Arabic), CJK (fontproviders) en Lao lopen via de terugvalketen. */
const OWN_SCRIPT_LOCALES = ['nl', 'en', 'fr', 'de', 'es', 'it', 'pt', 'pl', 'tr', 'ru', 'uk', 'cs', 'sk', 'sr', 'hr', 'bg', 'hu', 'ro', 'sv', 'nb', 'da', 'fi'];
/** Alle LETTERS (Unicode-categorie L) in de teksten van die talen. Bewust alleen letters: een
 *  symbool (✓, ⌘) dat een vertaler toevoegt mag uit Inter komen, maar een woord in het Pools of
 *  Servisch mag nooit letters uit twee lettertypen mengen. */
const appLetters = (() => {
  const letters = new Map<number, string>();
  const walk = (v: unknown, loc: string) => {
    if (typeof v === 'string') { for (const ch of v) if (/\p{L}/u.test(ch)) letters.set(ch.codePointAt(0)!, loc); }
    else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x, loc);
  };
  for (const loc of OWN_SCRIPT_LOCALES) {
    for (const ns of ['common', 'task', 'report', 'menu']) {
      walk(JSON.parse(readFileSync(join(ROOT, `src/i18n/locales/${loc}/${ns}.json`), 'utf8')), loc);
    }
  }
  return letters;
})();
ok(appLetters.size > 150, `C0 te weinig letters uit de taalbestanden gelezen (${appLetters.size})`);

ok(REPORT_FONT_IDS[0] === DEFAULT_REPORT_FONT_ID && DEFAULT_REPORT_FONT_ID === 'inter', `C0 standaardletter is niet Inter: ${DEFAULT_REPORT_FONT_ID}`);
ok(reportFontStack('inter') === OLD_STACK, `C0 stack van 'inter' wijkt af van de oude stack: ${reportFontStack('inter')}`);
ok(new Set(REPORT_FONT_IDS.map(id => REPORT_FONTS[id].family)).size === REPORT_FONT_IDS.length, 'C0 twee letters delen een familienaam');
// Vraag van manuvarkey in #770: ook een letter met vaste breedte, voor rapporten met kolommen cijfers en codes.
const MONO_IDS = REPORT_FONT_IDS.filter(id => REPORT_FONTS[id].generic === 'monospace');
ok(MONO_IDS.length === 1, `C0 het setje heeft niet precies één letter met vaste breedte: ${MONO_IDS.join(', ') || 'geen'}`);
for (const id of MONO_IDS) {
  ok(reportFontStack(id).endsWith(', monospace'), `C0 ${id}: de stack eindigt niet op de generieke familie monospace: ${reportFontStack(id)}`);
}

/** Een Gantt met een taaknaam uit vijf talen plus een vinkje, dat geen van de drie nieuwe letters heeft. */
// Het vinkje vooraan: de naamkolom kapt een lange naam achteraan af.
const MIXED_NAME = '✓ Fundering ąęłńśźż ğış țș őű čřž Фундамент Ђурђевић';
const mixedTasks = project.tasks.map((t, i) => (i === 0 ? { ...t, name: MIXED_NAME } : t));
const ganttWith = (stack: string) => (make: (w: number, h: number) => Draw2D, footerLayoutWidth?: number) =>
  renderReport(make, mixedTasks, project.sequences, project.calendar, project.project.name, baseOptions({ fontFamily: stack, footerLayoutWidth }));
const arabicSpec: PdfSectionedReportSpec = {
  ...sectioned('مخطط المشروع — Kantoorgebouw'),
  sections: [{ ...sectioned('x').sections[0], rows: [{ n: 'أعمال الأساسات' }, { n: 'Fundering' }] }],
};

for (const id of REPORT_FONT_IDS) {
  const def = REPORT_FONTS[id];
  let bytes: ReportFontBytes;
  try {
    bytes = { regular: ttf(`src/services/pdf/fonts/${def.files.regular}`), bold: ttf(`src/services/pdf/fonts/${def.files.bold}`) };
  } catch (e) {
    fail(`C1 ${id}: fontbestand ontbreekt (${String(e)})`);
    continue;
  }
  // C1. fontkit leest beide gewichten, en de letter dekt zelf elke letter van de eigen-schrifttalen.
  const regularFk = fontkit.create(bytes.regular);
  const boldFk = fontkit.create(bytes.bold);
  for (const [weight, fk] of [['regular', regularFk], ['bold', boldFk]] as const) {
    const missing = [...appLetters].filter(([cp]) => !fk.hasGlyphForCodePoint(cp));
    ok(missing.length === 0, `C1 ${id} ${weight} mist letters uit de app-talen: ${missing.map(([cp, loc]) => `${String.fromCodePoint(cp)} (${loc})`).join(', ')}`);
  }
  if (def.generic === 'monospace') {
    // C1m. Vaste breedte: elke letter van de app-talen, elk cijfer en de spatie even breed, in beide gewichten.
    // Anders lopen de kolommen tekens in een rapport toch niet recht onder elkaar.
    const probe = [...appLetters.keys(), ...'0123456789 .,:-/%'].map(c => (typeof c === 'number' ? c : c.codePointAt(0)!));
    for (const [weight, fk] of [['regular', regularFk], ['bold', boldFk]] as const) {
      const widths = new Set(probe.filter(cp => fk.hasGlyphForCodePoint(cp)).map(cp => fk.glyphForCodePoint(cp).advanceWidth));
      ok(widths.size === 1, `C1m ${id} ${weight}: tekens hebben ${widths.size} verschillende breedtes (${[...widths].join(', ')})`);
    }
  }
  const stack = reportFontStack(id);
  ok(stack.startsWith(id === 'inter' ? 'InterPDF' : `"${def.family}", InterPDF`), `C1 ${id}: stack begint niet met de letter en dan Inter: ${stack}`);

  const fallbackFonts = id === 'inter' ? [] : [{ id: 'inter', bytes: INTER }];
  // pdf-lib noemt een ingebed font `/<PostScript-naam>-<getal>` (bv. `/Carlito-Regular-7098`). Inter heeft
  // voor beide gewichten dezelfde PostScript-naam (`InterVariable`), dus tel elk font één keer.
  const mainNames = [regularFk.postscriptName, boldFk.postscriptName].filter((ps): ps is string => ps !== null);
  const isMain = (f: string) => mainNames.some(ps => new RegExp(`^/${ps}-\\d+$`).test(f));
  const mainCount = (fonts: string[]) => fonts.filter(isMain).length;
  try {
    // C2. Gantt-afdruk: vector, meerpagina, F0/F1 is de gekozen letter, en het vinkje komt uit Inter.
    subsetCalls.length = 0;
    const gantt = await inspect(await paginateVectorToPdfBytes(
      ganttWith(stack),
      { paperSize: 'a4', orientation: 'landscape', mode: 'fit-width', repeatHeader: true, repeatFooter: true, subsetFont, fallbackFonts },
      bytes, ARABIC,
    ));
    ok(gantt.pages >= 2, `C2 ${id}: Gantt op A4 heeft maar ${gantt.pages} pagina('s)`);
    ok(mainCount(gantt.fonts) === 2, `C2 ${id}: Gantt bedt de letter niet in als regular + bold: ${gantt.fonts.join(', ')}`);
    ok(/\/F0 [\d.]+ Tf/.test(gantt.page1), `C2 ${id}: pagina 1 tekent niets met de rapportletter F0`);
    if (id === 'inter') {
      ok(gantt.fonts.length === 2 && subsetCalls.length === 0, `C2 inter: extra fonts of subsets: ${gantt.fonts.join(', ')} (${subsetCalls.length}× subset)`);
    } else {
      const fromInter = new Set(subsetCalls.flat());
      ok(gantt.fonts.length === 4 && fromInter.has(0x2713), `C2 ${id}: het vinkje komt niet uit Inter: ${gantt.fonts.join(', ')}; subset ${[...fromInter].map(cp => cp.toString(16)).join(',')}`);
      const ownLetters = [...fromInter].filter(cp => /\p{L}/u.test(String.fromCodePoint(cp)));
      ok(ownLetters.length === 0, `C2 ${id}: letters uit de taaknaam komen uit Inter in plaats van de rapportletter: ${ownLetters.map(cp => String.fromCodePoint(cp)).join('')}`);
    }

    // C3. Tabelrapport (Cyrillische titel, ≤ in de ondertitel) en een Arabisch rapport van rechts naar links.
    const table = await inspect(await paginateVectorToPdfBytes(
      makeSectionedRenderReport(sectioned(CYRILLIC_TITLE), undefined, stack), { ...tableOpts, fallbackFonts }, bytes, ARABIC,
    ));
    ok(mainCount(table.fonts) === 2, `C3 ${id}: tabelrapport bedt de letter niet in: ${table.fonts.join(', ')}`);
    const rtl = await inspect(await paginateVectorToPdfBytes(
      makeSectionedRenderReport(arabicSpec, undefined, stack), { ...tableOpts, baseDir: 'rtl', fallbackFonts }, bytes, ARABIC,
    ));
    ok(mainCount(rtl.fonts) === 2 && rtl.fonts.some(f => f.includes('NotoSansArabic')),
      `C3 ${id}: Arabisch rapport mist de letter of Noto Sans Arabic: ${rtl.fonts.join(', ')}`);
  } catch (e) {
    fail(`C2/C3 ${id}: de vector-PDF faalt: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (failures > 0) {
  console.log(`XX check-report-font: ${failures} fout(en)`);
  process.exit(1);
}
console.log('OK check-report-font: rapportletter als parameter + terugval op Inter');
