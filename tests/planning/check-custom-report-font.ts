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
 *   F. de rapportinstelling: 'custom' alleen met een opgeslagen eigen lettertype, anders Inter.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFDict, PDFName } from 'pdf-lib';
import {
  bytesReader, extractFace, faceRefusal, groupFontFamilies, readFontFaces, type ByteReader, type FontFaceInfo,
} from '@/services/pdf/customReportFont';
import { reportFontStack } from '@/services/pdf/reportFont';
import { makeSectionedRenderReport } from '@/services/pdf/pdfTable';
import { paginateVectorToPdfBytes } from '@/services/print/paginateVector';
import { parseReportFontChoice } from '@/utils/reportSettings';

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
// PostScript-contouren (CFF, veel `.otf`): pdf-lib 1.17 herkent ze niet (`font.cff` bestaat niet in @pdf-lib/fontkit)
// en schrijft ze als TrueType-letter in; Poppler meldt dan "Mismatch between font type and embedded font file".
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

if (failures > 0) {
  console.log(`XX check-custom-report-font: ${failures} fout(en)`);
  process.exit(1);
}
console.log('OK check-custom-report-font: eigen lettertype lezen, weigeren, kiezen en inbedden');
