/**
 * Eigen lettertype in rapporten (issue #770, besluit Ethan 14 november 2026) — de kern zonder scherm.
 *
 * Een planner kiest een lettertype van de computer of een lettertypebestand. Deze check bewaakt wat de app
 * met de bytes doet, met de meegeleverde letters als echte bestanden en gemuteerde kopieën voor de randen:
 *   A. lezen: familie, stijl, PostScript-naam, gewicht, cursief, uit `.ttf` en uit een collectie (`.ttc`),
 *      ook met een lezer die alleen stukken leest (zo leest de desktopapp de lettertypemappen);
 *   B. weigeren met reden: inbedden verboden (OS/2 fsType), variabel lettertype (fvar), geen contouren,
 *      PostScript-contouren (CFF, die pdf-lib 1.17 niet goed inbedt);
 *      geen lettertypebestand ⇒ een fout;
 *   C. kiezen per familie: gewoon en vet, cursief telt niet mee, zonder vet ⇒ geen vet (besluit 3a),
 *      een geweigerde vette variant valt weg, een geweigerde gewone variant weigert de familie;
 *   D. één face uit een collectie halen: een los bestand dat fontkit leest, met dezelfde letter;
 *   E. de vector-PDF met een eigen letter zonder vet: vet tekent in de gewone letter, de PDF blijft vector;
 *   F. de rapportinstelling: 'custom' alleen met een opgeslagen eigen lettertype, anders Inter;
 *   G. GSUB-vervangingen (issue #1050): echt Noto Sans Coptic (een regel van type 8) en Carlito ("ti") geven een
 *      vector-PDF waarin de vervangen glyphs hun eigen breedte hebben en de tekst trouw uit te lezen is.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fontkit } from '@/services/pdf/fontkit';
import {
  PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, decodePDFRawStream,
} from 'pdf-lib';
import {
  bytesReader, extractFace, faceRefusal, groupFontFamilies, readFontFaces, type ByteReader, type FontFaceInfo,
} from '@/services/pdf/customReportFont';
import { reportFontStack } from '@/services/pdf/reportFont';
import { makeSectionedRenderReport } from '@/services/pdf/pdfTable';
import { paginateVectorToPdfBytes } from '@/services/print/paginateVector';
import { parseReportFontChoice } from '@/utils/reportSettings';
import { assembleReportMeasureFonts, measureReportText, type ReportFontkitFont } from '@/services/pdf/reportTextMeasure';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const font = (file: string) => new Uint8Array(readFileSync(join(ROOT, 'src/services/pdf/fonts', file)));

let failures = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { console.log(`   XX ${msg}`); failures++; } };
const rejects = async (p: Promise<unknown>) => { try { await p; return false; } catch { return true; } };

const SANS = font('LiberationSans-Regular.ttf');
const SANS_BOLD = font('LiberationSans-Bold.ttf');
const MONO = font('LiberationMono-Regular.ttf');
const INTER = { regular: font('Inter-Regular.ttf'), bold: font('Inter-Bold.ttf') };
const ARABIC = { regular: font('NotoSansArabic-Regular.ttf'), bold: font('NotoSansArabic-Bold.ttf') };

// ── Hulp om bytes te muteren: tabellen vinden en aanpassen ────────────────────────────────────────
const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
function tableOffset(b: Uint8Array, tag: string, dirOffset = 0): number {
  const v = view(b);
  const n = v.getUint16(dirOffset + 4);
  for (let i = 0; i < n; i++) {
    const rec = dirOffset + 12 + i * 16;
    if (String.fromCharCode(...b.subarray(rec, rec + 4)) === tag) return v.getUint32(rec + 8);
  }
  throw new Error(`tabel ${tag} ontbreekt`);
}
function withFsType(src: Uint8Array, fsType: number): Uint8Array {
  const b = src.slice();
  view(b).setUint16(tableOffset(b, 'OS/2') + 8, fsType);
  return b;
}
/** Hernoem een tabel in de directory (de inhoud blijft): zo krijgt een letter een `fvar` of verliest hij `glyf`. */
function renameTable(src: Uint8Array, from: string, to: string): Uint8Array {
  const b = src.slice();
  const n = view(b).getUint16(4);
  for (let i = 0; i < n; i++) {
    const rec = 12 + i * 16;
    if (String.fromCharCode(...b.subarray(rec, rec + 4)) === from) b.set([...to].map(c => c.charCodeAt(0)), rec);
  }
  return b;
}
/** Een collectie (`ttcf`) uit losse bestanden, met hun tabellen ongewijzigd erachter. */
function buildCollection(files: Uint8Array[]): Uint8Array {
  const headerLen = 12 + 4 * files.length;
  const dirLens = files.map(f => 12 + 16 * view(f).getUint16(4));
  let pos = headerLen + dirLens.reduce((a, b) => a + b, 0);
  const tablePlans = files.map(f => {
    const n = view(f).getUint16(4);
    return Array.from({ length: n }, (_, i) => {
      const rec = 12 + i * 16;
      const off = view(f).getUint32(rec + 8);
      const len = view(f).getUint32(rec + 12);
      const at = pos;
      pos += (len + 3) & ~3;
      return { rec, off, len, at };
    });
  });
  const out = new Uint8Array(pos);
  const ov = view(out);
  out.set([0x74, 0x74, 0x63, 0x66]); // 'ttcf'
  ov.setUint32(4, 0x00010000);
  ov.setUint32(8, files.length);
  let dirAt = headerLen;
  files.forEach((f, fi) => {
    ov.setUint32(12 + 4 * fi, dirAt);
    out.set(f.subarray(0, 12), dirAt);
    for (const t of tablePlans[fi]) {
      const recOut = dirAt + t.rec;
      out.set(f.subarray(t.rec, t.rec + 16), recOut);
      ov.setUint32(recOut + 8, t.at);
      out.set(f.subarray(t.off, t.off + t.len), t.at);
    }
    dirAt += dirLens[fi];
  });
  return out;
}
/** Een lezer die telt hoeveel bytes er gelezen zijn, zoals de desktopapp met een bestandshandle leest. */
function countingReader(b: Uint8Array): { read: ByteReader; bytesRead: () => number } {
  let total = 0;
  const inner = bytesReader(b);
  return { read: async (off, len) => { total += len; return inner(off, len); }, bytesRead: () => total };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('── A. lezen');
const [sans] = await readFontFaces(bytesReader(SANS));
ok(sans?.family === 'Liberation Sans' && sans.subfamily === 'Regular' && sans.postscriptName === 'LiberationSans',
  `A1 Liberation Sans gelezen als ${JSON.stringify(sans)}`);
ok(sans?.weight === 400 && !sans.italic && sans.outlines === 'glyf' && !sans.variable && sans.fsType === 0,
  `A1 gewicht/cursief/contouren/fsType van Liberation Sans: ${JSON.stringify(sans)}`);
const [sansBold] = await readFontFaces(bytesReader(SANS_BOLD));
ok(sansBold?.weight === 700 && sansBold.subfamily === 'Bold', `A2 Liberation Sans Bold: ${JSON.stringify(sansBold)}`);
const ttc = buildCollection([SANS, SANS_BOLD]);
const counting = countingReader(ttc);
const ttcFaces = await readFontFaces(counting.read);
ok(ttcFaces.length === 2 && ttcFaces[0].postscriptName === 'LiberationSans' && ttcFaces[1].postscriptName === 'LiberationSans-Bold',
  `A3 collectie: ${ttcFaces.map(f => f.postscriptName).join(', ')}`);
ok(counting.bytesRead() < ttc.length / 10, `A4 de lezer las ${counting.bytesRead()} van ${ttc.length} bytes; alleen kop, naam en OS/2 zijn nodig`);
ok(await rejects(readFontFaces(bytesReader(new TextEncoder().encode('geen lettertype, wel tekst')))), 'A5 tekst gaf geen fout');
ok(await rejects(readFontFaces(bytesReader(SANS.subarray(0, 40)))), 'A5 een afgekapt bestand gaf geen fout');

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('── B. weigeren met reden');
const faceOf = async (b: Uint8Array) => (await readFontFaces(bytesReader(b)))[0];
ok(faceRefusal(sans) === null, 'B1 Liberation Sans geweigerd');
ok(faceRefusal(await faceOf(withFsType(SANS, 0x0002))) === 'embeddingRestricted', 'B2 fsType 2 (inbedden verboden) niet geweigerd');
ok(faceRefusal(await faceOf(withFsType(SANS, 0x0200 | 0x0004))) === 'embeddingRestricted', 'B3 fsType 0x0200 (alleen bitmaps) niet geweigerd');
ok(faceRefusal(await faceOf(withFsType(SANS, 0x0004))) === null, 'B4 fsType 4 (afdrukken en bekijken) geweigerd');
ok(faceRefusal(await faceOf(withFsType(SANS, 0x0008))) === null, 'B4 fsType 8 (bewerkbaar) geweigerd');
ok(faceRefusal(await faceOf(renameTable(SANS, 'kern', 'fvar'))) === 'variable', 'B5 variabel lettertype niet geweigerd');
ok(faceRefusal(await faceOf(renameTable(SANS, 'glyf', 'xxxx'))) === 'noOutlines', 'B6 lettertype zonder contouren niet geweigerd');
// PostScript-contouren (CFF, veel `.otf`): met @pdf-lib/fontkit schreef pdf-lib 1.17 ze als TrueType-letter in; Poppler
// meldde dan "Mismatch between font type and embedded font file". Met fontkit 3 niet getoetst (knownbug 1942).
ok(faceRefusal(await faceOf(renameTable(SANS, 'glyf', 'CFF '))) === 'postscriptOutlines', 'B7 lettertype met CFF-contouren niet geweigerd');

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('── C. kiezen per familie');
const italic: FontFaceInfo = { ...sans, postscriptName: 'LiberationSans-Italic', subfamily: 'Italic', italic: true };
const black: FontFaceInfo = { ...sans, postscriptName: 'LiberationSans-Black', subfamily: 'Black', weight: 900 };
const medium: FontFaceInfo = { ...sans, postscriptName: 'LiberationSans-Medium', subfamily: 'Medium', weight: 500 };
const semibold: FontFaceInfo = { ...sans, postscriptName: 'LiberationSans-Semibold', subfamily: 'Semibold', weight: 600 };
const pick = (faces: FontFaceInfo[]) => groupFontFamilies(faces);
{
  const [g, ...rest] = pick([italic, sansBold, sans, black]);
  ok(rest.length === 0 && g.family === 'Liberation Sans', `C1 één familie verwacht: ${[g, ...rest].map(x => x.family).join(', ')}`);
  ok(g.regular?.postscriptName === 'LiberationSans' && g.bold?.postscriptName === 'LiberationSans-Bold' && g.refusal === null,
    `C1 gewoon + vet: ${g.regular?.postscriptName} + ${g.bold?.postscriptName}`);
}
{
  const [g] = pick([sans, italic]);
  ok(g.regular?.postscriptName === 'LiberationSans' && g.bold === null, `C2 zonder vet: vet ${g.bold?.postscriptName}`);
}
{
  const [g] = pick([medium, black]);
  ok(g.regular?.postscriptName === 'LiberationSans-Medium' && g.bold?.postscriptName === 'LiberationSans-Black', `C3 Medium + Black: ${g.regular?.postscriptName} + ${g.bold?.postscriptName}`);
  const [h] = pick([sans, semibold, sansBold]);
  ok(h.bold?.postscriptName === 'LiberationSans-Bold', `C3 Bold gaat voor Semibold: ${h.bold?.postscriptName}`);
  const [k] = pick([black]);
  ok(k.regular?.postscriptName === 'LiberationSans-Black' && k.bold === null, `C3 één gewicht ⇒ dat is de gewone letter: ${k.regular?.postscriptName}`);
}
{
  const [g] = pick([italic]);
  ok(g.regular === null && g.refusal === 'noRegular', `C4 alleen cursief ⇒ geweigerd: ${g.refusal}`);
}
{
  const [g] = pick([sans, { ...sansBold, fsType: 0x0002 }]);
  ok(g.regular?.postscriptName === 'LiberationSans' && g.bold === null && g.refusal === null, `C5 geweigerde vette variant valt weg: ${g.bold?.postscriptName}`);
  const [h] = pick([{ ...sans, fsType: 0x0002 }, sansBold]);
  ok(h.refusal === 'embeddingRestricted', `C5 geweigerde gewone variant ⇒ familie geweigerd: ${h.refusal}`);
}
{
  const groups = pick([sans, { ...sans, family: 'Liberation Mono', postscriptName: 'LiberationMono' }]);
  ok(groups.length === 2 && groups[0].family === 'Liberation Mono', `C6 twee families op naam gesorteerd: ${groups.map(g => g.family).join(', ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('── D. één face uit een collectie');
{
  const bold = await extractFace(bytesReader(ttc), ttcFaces[1]);
  const fk = fontkit.create(bold);
  ok(fk.postscriptName === 'LiberationSans-Bold', `D1 uitgehaalde face heet ${fk.postscriptName}`);
  const ref = fontkit.create(SANS_BOLD);
  ok(fk.numGlyphs === ref.numGlyphs && fk.glyphForCodePoint(0x41).advanceWidth === ref.glyphForCodePoint(0x41).advanceWidth,
    `D1 uitgehaalde face wijkt af: ${fk.numGlyphs} tegen ${ref.numGlyphs} glyphs`);
  const [again] = await readFontFaces(bytesReader(bold));
  ok(again?.postscriptName === 'LiberationSans-Bold' && again.weight === 700, `D2 uitgehaalde face leest terug als ${JSON.stringify(again)}`);
  const single = await extractFace(bytesReader(MONO), (await readFontFaces(bytesReader(MONO)))[0]);
  ok(single.length === MONO.length && single.every((x, i) => x === MONO[i]), 'D3 een los bestand komt ongewijzigd terug');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('── E. vector-PDF met een eigen letter zonder vet');
{
  // Zonder vet krijgt de pagineerder de gewone letter ook als vet (besluit 3a): de kopjes staan in de gewone letter.
  const spec = {
    title: 'Planning ✓ Фундамент', subtitle: 'Eigen lettertype', notes: [], summary: [], kpis: [],
    sections: [{ heading: 'Taken', columns: [
      { header: 'Naam', width: 200, align: 'left' as const, text: (r: unknown) => (r as { n: string }).n },
      { header: 'Duur', width: 60, align: 'right' as const, text: () => '5', bold: () => true },
    ], rows: [{ n: 'Fundering' }, { n: 'Ruwbouw' }] }],
  };
  const pdfBytes = await paginateVectorToPdfBytes(
    makeSectionedRenderReport(spec, undefined, reportFontStack('custom')),
    { paperSize: 'a4', orientation: 'portrait', mode: 'fit-width', subsetFont: async (ttf: Uint8Array) => ttf,
      fallbackFonts: [{ id: 'inter', bytes: INTER }] },
    { regular: SANS, bold: SANS }, ARABIC,
  );
  const doc = await PDFDocument.load(pdfBytes);
  const fonts: string[] = [];
  let images = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of('Subtype')) === PDFName.of('Type0')) fonts.push(String(obj.get(PDFName.of('BaseFont'))));
    if (obj instanceof PDFDict && obj.get(PDFName.of('Subtype')) === PDFName.of('Image')) images++;
  }
  ok(fonts.filter(f => /^\/LiberationSans-\d+$/.test(f)).length === 2 && !fonts.some(f => f.includes('Bold')),
    `E1 de PDF bedt niet twee keer de gewone letter in: ${fonts.join(', ')}`);
  ok(images === 0, `E1 de PDF bevat ${images} beeld(en); verwacht vector`);
  ok(reportFontStack('custom').startsWith('"OpsReportCustom", InterPDF'), `E2 stack van het eigen lettertype: ${reportFontStack('custom')}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('── F. de rapportinstelling');
{
  const custom = { name: 'Arial', rev: 3 };
  ok(parseReportFontChoice('custom', custom) === 'custom', 'F1 custom mét opgeslagen lettertype ⇒ custom');
  ok(parseReportFontChoice('custom', null) === 'inter', 'F2 custom zonder opgeslagen lettertype ⇒ Inter');
  ok(parseReportFontChoice('carlito', custom) === 'carlito', 'F3 een vaste letter blijft staan');
  ok(parseReportFontChoice('Arial', custom) === 'inter', 'F4 onbekende waarde ⇒ Inter');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('── G. GSUB en GPOS in de PDF: Koptisch met een regel van type 8, Carlito "ti" (issue #1050)');
{
  // `@pdf-lib/fontkit` 1.1.1 liep stuk op een GSUB-regel van type 8 (reverse chaining), zoals in Noto Sans Coptic:
  // dan viel elke PDF met dat eigen lettertype terug op raster. fontkit 3 voert die regel uit. pdf-lib gaf een glyph
  // die GSUB koos geen breedte en geen tekst (een gat, `bouwlogis ek` bij uitlezen), ook bij het meegeleverde Carlito,
  // en één `Tj` per tekst liet de GPOS-verschuiving van de bovenstreep weg. Deze proef leest tekst, breedtes en de
  // plaats van elke glyph terug uit de PDF. Noto Sans Coptic heeft geen cijfers: het paginanummer moet toch leesbaar
  // terugkomen.
  const COPTIC = new Uint8Array(readFileSync(join(ROOT, 'tests/planning/fixtures/fonts/NotoSansCoptic-Regular.ttf')));
  const CARLITO = font('Carlito-Regular.ttf');
  const ABBREVIATION = 'Ⲁ̅ⲁ̅';
  const coptic = fontkit.create(COPTIC);
  const laidOut = coptic.layout(ABBREVIATION);
  ok(laidOut.glyphs.map(g => g.id).join(',') === '33,196,34,199',
    `G1 de bovenstreep volgt de upstream-proef (glyph 196 en 199): ${laidOut.glyphs.map(g => g.id).join(',')}`);

  const report = (rows: string[]) => makeSectionedRenderReport({
    title: 'Planning', subtitle: 'Eigen lettertype', notes: [], summary: [], kpis: [],
    sections: [{ heading: 'Taken', columns: [
      { header: 'Naam', width: 300, align: 'left' as const, text: (r: unknown) => (r as { n: string }).n },
    ], rows: rows.map(n => ({ n })) }],
  }, undefined, reportFontStack('custom'));
  const opts = { paperSize: 'a4' as const, orientation: 'portrait' as const, mode: 'actual' as const,
    subsetFont: async (ttf: Uint8Array) => ttf, fallbackFonts: [{ id: 'inter', bytes: INTER }] };

  for (const [name, bytes, row] of [['Koptisch', COPTIC, ABBREVIATION], ['Carlito', CARLITO, 'bouwlogistiek']] as const) {
    // De glyphs die GSUB koos en die niet rechtstreeks in de cmap staan (Koptisch 196 en 199, Carlito de ligatuur "ti").
    const fk = fontkit.create(bytes);
    const direct = new Set([...row].map(c => fk.glyphForCodePoint(c.codePointAt(0)!).id));
    const run = fk.layout(row);
    const glyphs = run.glyphs.map(g => g.id).filter(id => !direct.has(id));
    let pdf: Uint8Array | null = null;
    try {
      pdf = await paginateVectorToPdfBytes(report([row]), opts, { regular: bytes, bold: bytes }, ARABIC);
    } catch (err) {
      ok(false, `G2 ${name}: de vector-PDF loopt stuk: ${String(err)}`);
    }
    if (!pdf) continue;
    const read = await readPdf(pdf);
    ok(read.images === 0, `G2 ${name}: de PDF bevat ${read.images} beeld(en); verwacht vector`);
    ok(read.text.includes(row), `G2 ${name}: "${row}" is niet als tekst uit te lezen; gelezen: ${JSON.stringify(read.text.slice(0, 200))}`);
    ok(read.text.endsWith('1 / 1'), `G5 ${name}: het paginanummer komt niet leesbaar terug; gelezen: ${JSON.stringify(read.text.slice(-40))}`);
    const fontWidths = [...read.widths.values()].find(w => glyphs.every(id => w.has(id)));
    ok(glyphs.length > 0 && fontWidths !== undefined
      && glyphs.every(id => Math.abs(fontWidths.get(id)! - fk.getGlyph(id).advanceWidth * 1000 / fk.unitsPerEm) < 0.01),
      `G3 ${name}: de vervangen glyph(s) ${glyphs.join(',')} missen hun eigen breedte in /W (dan staat er een gat)`);

    // G6: elke glyph op zijn plaats. In de PDF staat de pen van de tekst op de breedtes uit /W; een glyph met een
    // GPOS-verschuiving (de bovenstreep: −319 en −291 eenheden) staat op die pen plus zijn verschuiving.
    const start = read.draws.findIndex((_, i) => run.glyphs.every((g, j) => read.draws[i + j]?.gid === g.id));
    const scale = (start >= 0 ? read.draws[start].size : 0) / fk.unitsPerEm;
    let pen = 0;
    const misplaced = start < 0 ? ['niet gevonden'] : run.glyphs.flatMap((g, j) => {
      const dx = read.draws[start + j].x - read.draws[start].x;
      const want = (pen + run.positions[j].xOffset) * scale;
      pen += g.advanceWidth;
      return Math.abs(dx - want) < 0.01 ? [] : [`glyph ${g.id} op ${dx.toFixed(2)} in plaats van ${want.toFixed(2)}`];
    });
    ok(misplaced.length === 0, `G6 ${name}: de glyphs van "${row}" staan niet op hun plaats: ${misplaced.join('; ')}`);
  }

  // De meting van papier en paneel leest dezelfde letter, ook met de shaping van rechts naar links.
  const create = (b: Uint8Array) => fontkit.create(b) as unknown as ReportFontkitFont;
  let width = NaN;
  try {
    width = measureReportText(assembleReportMeasureFonts(create, { regular: COPTIC, bold: COPTIC }, { arabic: ARABIC, baseDir: 'rtl' }),
      `مرحبا ${ABBREVIATION}`, false, 10);
  } catch (err) { ok(false, `G4 de meting loopt stuk op Noto Sans Coptic: ${String(err)}`); }
  ok(width > 0, `G4 de meting geeft ${width}`);
}

/**
 * Een PDF zoals een lezer hem ziet: de tekst van alle pagina's (ToUnicode bij een CID-letter, WinAnsi bij een
 * standaardletter; `Tj` in volgorde), de breedtetabel (`/W`) per CID-letter, het aantal beelden, en per getekende
 * glyph zijn x in tekstruimte: de x van de tekstmatrix plus de `/W`-breedtes van de glyphs ervoor in dezelfde `Tj`,
 * zoals een PDF-lezer hem neerzet.
 */
async function readPdf(pdf: Uint8Array): Promise<{
  text: string; widths: Map<string, Map<number, number>>; images: number;
  draws: { gid: number; x: number; size: number }[];
}> {
  const doc = await PDFDocument.load(pdf);
  const streamText = (obj: unknown) => (obj instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(obj).decode()).toString('latin1') : '');
  const chunks = (hex: string, n: number) => hex.toUpperCase().match(new RegExp(`.{${n}}`, 'g')) ?? [];
  const widths = new Map<string, Map<number, number>>();
  let images = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of('Subtype')) === PDFName.of('Image')) images++;
  }
  let text = '';
  const draws: { gid: number; x: number; size: number }[] = [];
  for (const page of doc.getPages()) {
    const fonts = page.node.Resources()?.lookupMaybe(PDFName.of('Font'), PDFDict);
    const decoders = new Map<string, { w?: Map<number, number>; decode: (hex: string) => string }>();
    for (const [key, ref] of fonts?.entries() ?? []) {
      const dict = doc.context.lookup(ref, PDFDict);
      if (dict.get(PDFName.of('Subtype')) !== PDFName.of('Type0')) {
        decoders.set(key.asString(), { decode: hex => chunks(hex, 2).map(c => String.fromCharCode(parseInt(c, 16))).join('') });
        continue;
      }
      const map = new Map<string, string>();
      for (const m of streamText(doc.context.lookup(dict.get(PDFName.of('ToUnicode')))).matchAll(/<([0-9A-Fa-f]{4})> <([0-9A-Fa-f]*)>/g)) {
        map.set(m[1].toUpperCase(), String.fromCharCode(...chunks(m[2], 4).map(h => parseInt(h, 16))));
      }
      const cid = doc.context.lookup(dict.get(PDFName.of('DescendantFonts')), PDFArray).lookup(0, PDFDict);
      const w = new Map<number, number>();
      const list = cid.lookup(PDFName.of('W'), PDFArray).asArray();
      for (let i = 0; i + 1 < list.length; i += 2) {
        const first = (list[i] as PDFNumber).asNumber();
        (list[i + 1] as PDFArray).asArray().forEach((n, j) => w.set(first + j, (n as PDFNumber).asNumber()));
      }
      widths.set(String(dict.get(PDFName.of('BaseFont'))), w);
      decoders.set(key.asString(), { w, decode: hex => chunks(hex, 4).map(gid => map.get(gid) ?? '�').join('') });
    }
    const contents = page.node.Contents();
    const parts = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
    let current: { w?: Map<number, number>; decode: (hex: string) => string } | undefined;
    let size = 0;
    let x = NaN;
    for (const part of parts) {
      const ops = streamText(part instanceof PDFRef ? doc.context.lookup(part) : part)
        .matchAll(/(\/\S+) (-?[\d.]+) Tf|1 0 0 1 (-?[\d.]+) -?[\d.]+ Tm|<([0-9A-Fa-f]*)> Tj/g);
      for (const m of ops) {
        if (m[1]) { current = decoders.get(m[1]); size = Number(m[2]); } else if (m[3]) x = Number(m[3]);
        else {
          text += current?.decode(m[4]) ?? '�';
          const w = current?.w;
          if (w) {
            let pen = x;
            for (const gid of chunks(m[4], 4).map(h => parseInt(h, 16))) {
              draws.push({ gid, x: pen, size });
              pen += (w.get(gid) ?? 1000) / 1000 * size; // zonder /W-regel de standaardbreedte (/DW 1000)
            }
          }
        }
      }
    }
  }
  return { text, widths, images, draws };
}

if (failures > 0) {
  console.log(`XX check-custom-report-font: ${failures} fout(en)`);
  process.exit(1);
}
console.log('OK check-custom-report-font: eigen lettertype lezen, weigeren, kiezen en inbedden');
