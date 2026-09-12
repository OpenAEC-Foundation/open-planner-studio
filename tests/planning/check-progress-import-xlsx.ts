// Voortgangsblad in `.xlsx` (issue #27, etappe 3 — baan C, taken T7 en T8).
//
// Deel 1 (T7) toetst de generieke lezer `readXlsxSheet`: de twee zip-passes, de rels-resolutie,
// sharedStrings, de `cellXfs`/`numFmt`-classificatie van datum- en percentagecellen, de celtypes en
// alle bestandsweigeringen. Deel 2 (T8) toetst `parseProgressXlsx`: kolomherkenning via de gedeelde
// `sheetColumns.ts`, ISO-datums (en dus `noAmbiguity` — nooit een dag/maand-vraag), de
// percentage-omrekening, de em-dash-verzamelmarkering en de bestandsgrenzen.
//
// Draait headless in Node zonder DOM-shim: er komt geen `DOMParser` aan te pas — de lezer heeft een
// eigen XML-scanner, precies omdat de shim geen attributen kent en juist de attributen (`r`, `t`,
// `s`, `numFmtId`, `date1904`) hier alle betekenis dragen.
//
// !!! TIJDELIJK (baan C draait parallel aan baan A en B) !!!
// De fixtures worden hieronder met een KLEINE, LOKALE store-only ZIP-schrijver gebouwd, zodat deze
// check niet op baan B's `writeProgressSheetXLSX` hoeft te wachten. Taak T14 vervangt de handgemaakte
// "ons eigen blad"-fixture door de ECHTE round-trip door de schrijver; deze helper mag daarbij weg.
//
// Exit 0 = alles groen. De tail van dit script kan "groen" tonen bij een gefaalde BUNDEL — alleen de
// exitcode telt.

import {
  readXlsxSheet,
  readXlsxSheetWith,
  XlsxReadError,
  XLSX_LIMITS,
  columnFromCellRef,
  type XlsxCell,
  type XlsxSheet,
  type XlsxZipReader,
} from '@/services/xlsx/readXlsxSheet';
import { parseZipEntries } from '@/services/zip/zipReader';
import { isoToSerial } from '@/services/xlsx/serialDate';

const diffs: string[] = [];
let checks = 0;
function eq(label: string, got: unknown, want: unknown): void {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
}
function ok(label: string, condition: boolean): void {
  checks++;
  if (!condition) diffs.push(label);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// TIJDELIJKE fixture-gereedschap: store-only ZIP-schrijver (T14 haalt dit weg)
// ════════════════════════════════════════════════════════════════════════════════════════════

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipInput { name: string; data: string | Uint8Array }

/** Minimale, ongecomprimeerde ZIP — genoeg om een OOXML-pakket na te bootsen. */
function storeZip(files: readonly ZipInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true); // store
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length;
  }
  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const chunk of [...locals, ...centrals, eocd]) { out.set(chunk, p); p += chunk.length; }
  return out;
}

// ── de vaste OOXML-omhulling ────────────────────────────────────────────────────────────────
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

function workbookXml(epoch1904 = false): string {
  const pr = epoch1904 ? '<workbookPr date1904="1"/>' : '<workbookPr/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${pr}<sheets><sheet name="Voortgang" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

// cellXfs-index → betekenis:
//   0 = general, 1 = ingebouwd datumformaat 14, 2 = ingebouwd percentage 9,
//   3 = custom datumformaat (164), 4 = custom percentage (165),
//   5 = custom formaat waarvan de y/m/d ALLEEN in een letterlijke tekst staat (166) — geen datum.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3">
<numFmt numFmtId="164" formatCode="dd\\-mm\\-yyyy"/>
<numFmt numFmtId="165" formatCode="0.0%"/>
<numFmt numFmtId="166" formatCode="&quot;dagen&quot;\\ 0"/>
</numFmts>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;

function sharedStringsXml(items: readonly string[]): string {
  const body = items.map(text => `<si><t>${text}</t></si>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${items.length}" uniqueCount="${items.length}">${body}</sst>`;
}

function worksheetXml(rowsXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
}

interface BookOptions {
  rows: string;
  shared?: readonly string[];
  epoch1904?: boolean;
  extra?: readonly ZipInput[];
}

function makeWorkbook(opts: BookOptions): Uint8Array {
  return storeZip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'xl/workbook.xml', data: workbookXml(opts.epoch1904 ?? false) },
    { name: 'xl/_rels/workbook.xml.rels', data: WORKBOOK_RELS },
    { name: 'xl/styles.xml', data: STYLES },
    { name: 'xl/sharedStrings.xml', data: sharedStringsXml(opts.shared ?? []) },
    { name: 'xl/worksheets/sheet1.xml', data: worksheetXml(opts.rows) },
    ...(opts.extra ?? []),
  ]);
}

// ── kleine leeshulpjes ──────────────────────────────────────────────────────────────────────
function cell(sheet: XlsxSheet, rowNumber: number, column: string): XlsxCell | undefined {
  const col = columnFromCellRef(column);
  return sheet.rows.find(r => r.rowNumber === rowNumber)?.cells.find(c => c.col === col);
}

async function issueOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'geen fout';
  } catch (err) {
    return err instanceof XlsxReadError ? err.issue : `andere fout: ${String(err)}`;
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel 1 (T7) — de generieke lezer
// ════════════════════════════════════════════════════════════════════════════════════════════

const SERIAL_2026_06_09 = isoToSerial('2026-06-09')!;
const SERIAL_2026_07_01 = isoToSerial('2026-07-01')!;

{
  // Rij 1 kopregel (gedeelde strings), rij 2 een volledige datarij, rij 3 een inlineStr,
  // rij 4 een custom-datumformaat, rij 5 een foutcel, rij 6 een boolean en een `str`.
  const rows = [
    '<row r="1">'
      + '<c r="A1" t="s"><v>0</v></c>'
      + '<c r="B1" t="s"><v>1</v></c>'
      + '<c r="C1" t="s"><v>2</v></c>'
      + '</row>',
    '<row r="2">'
      + '<c r="A2" t="s"><v>3</v></c>'
      + `<c r="D2" s="1"><v>${SERIAL_2026_06_09}</v></c>`
      + '<c r="F2" s="2"><v>0.45</v></c>'
      + '</row>',
    '<row r="3">'
      + '<c r="A3" t="inlineStr"><is><t>Ruwbouw</t></is></c>'
      + '<c r="F3" s="4"><v>0.5</v></c>'
      + '</row>',
    `<row r="4"><c r="D4" s="3"><v>${SERIAL_2026_07_01}</v></c><c r="E4" s="5"><v>7</v></c></row>`,
    '<row r="5"><c r="F5" t="e"><v>#DIV/0!</v></c></row>',
    '<row r="6"><c r="A6" t="b"><v>1</v></c><c r="B6" t="str"><v>=A1</v></c></row>',
  ].join('');
  const bytes = makeWorkbook({ rows, shared: ['Kop A', 'Kop B', 'Kop C', 'Fundering'] });
  const sheet = await readXlsxSheet(bytes);

  eq('sharedString wordt opgelost', cell(sheet, 2, 'A')?.text, 'Fundering');
  eq('…ook in de kopregel', cell(sheet, 1, 'C')?.text, 'Kop C');
  eq('inlineStr ook', cell(sheet, 3, 'A')?.text, 'Ruwbouw');
  eq('datumcel herkend via cellXfs', cell(sheet, 2, 'D')?.isDate, true);
  eq('…en draagt zijn seriële waarde', cell(sheet, 2, 'D')?.num, SERIAL_2026_06_09);
  eq('percentagecel herkend', cell(sheet, 2, 'F')?.isPercent, true);
  eq('…en is géén datum', cell(sheet, 2, 'F')?.isDate, undefined);
  eq('custom numFmt met y/m/d telt als datum', cell(sheet, 4, 'D')?.isDate, true);
  eq('custom percentageformaat telt als percentage', cell(sheet, 3, 'F')?.isPercent, true);
  eq('y/m/d BINNEN een letterlijke tekst telt niet als datum', cell(sheet, 4, 'E')?.isDate, undefined);
  eq('foutcel levert de fouttekst', cell(sheet, 5, 'F')?.text, '#DIV/0!');
  eq('boolean leest als TRUE', cell(sheet, 6, 'A')?.text, 'TRUE');
  eq('formuleresultaat (str) leest als tekst', cell(sheet, 6, 'B')?.text, '=A1');
  eq('een gewone getalcel is geen datum en geen percentage',
    [cell(sheet, 4, 'E')?.isDate, cell(sheet, 4, 'E')?.isPercent], [undefined, undefined]);
  eq('1900-stelsel tenzij anders vermeld', sheet.epoch1904, false);
}

{
  // Sparse blad: alleen rij 1 en rij 7 bestaan, en rij 7 heeft alleen een C-cel. Zowel het
  // rijnummer als de kolomindex moeten uit het `r`-attribuut komen, niet uit een teller.
  const rows = '<row r="1"><c r="A1" t="s"><v>0</v></c></row>'
    + '<row r="7"><c r="C7" t="s"><v>1</v></c></row>';
  const sheet = await readXlsxSheet(makeWorkbook({ rows, shared: ['eerste', 'derde'] }));

  eq('twee rijen in het blad', sheet.rows.length, 2);
  eq('rijnummer komt uit r=', sheet.rows[1]?.rowNumber, 7);
  eq('kolom uit r=, niet uit volgorde', cell(sheet, 7, 'C')?.text, 'derde');
  eq('…en die kolomindex is 2', sheet.rows[1]?.cells[0]?.col, 2);
}

{
  const sheet1904 = await readXlsxSheet(makeWorkbook({
    rows: '<row r="1"><c r="A1" s="1"><v>1</v></c></row>',
    epoch1904: true,
  }));
  eq('date1904 wordt gelezen', sheet1904.epoch1904, true);
}

{
  // Alleen de zes metadata-parts en het bladpart mogen door de ZIP-laag heen komen; een
  // afbeelding, een tweede blad en een thumbnail zijn onnodige inflatie.
  const opened: string[] = [];
  const spy: XlsxZipReader = (buffer, limits, select) =>
    parseZipEntries(buffer, limits, name => {
      const take = select(name);
      if (take) opened.push(name);
      return take;
    });
  const bytes = makeWorkbook({
    rows: '<row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c></row>',
    extra: [
      { name: 'xl/media/image1.png', data: 'niet-uitpakken' },
      { name: 'xl/worksheets/sheet2.xml', data: worksheetXml('') },
      { name: 'docProps/thumbnail.jpeg', data: 'ook-niet' },
    ],
  });
  await readXlsxSheetWith(spy, bytes);

  const NEEDED = new Set([
    '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels',
    'xl/styles.xml', 'xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml',
  ]);
  ok('alleen de benodigde parts worden uitgepakt', opened.length > 0 && opened.every(n => NEEDED.has(n)));
  ok('het gekozen bladpart zit erbij', opened.includes('xl/worksheets/sheet1.xml'));
  ok('het tweede blad niet', !opened.includes('xl/worksheets/sheet2.xml'));
}

{
  // ── weigeringen ───────────────────────────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  eq('geen zip ⇒ notAZip', await issueOf(readXlsxSheet(encoder.encode('hallo daar'))), 'notAZip');

  const cfb = new Uint8Array(64);
  cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  eq('CFB-magic ⇒ encrypted', await issueOf(readXlsxSheet(cfb)), 'encrypted');

  const small = makeWorkbook({ rows: '<row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c></row>' });
  eq('te groot ⇒ tooLarge',
    await issueOf(readXlsxSheet(small, { ...XLSX_LIMITS, maxBytes: 10 })), 'tooLarge');
  eq('de standaardgrens staat op 16 MiB', XLSX_LIMITS.maxBytes, 16 * 1024 * 1024);

  const manyRows = makeWorkbook({
    rows: Array.from({ length: 5 }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}"><v>1</v></c></row>`).join(''),
  });
  eq('te veel rijen ⇒ tooManyRows',
    await issueOf(readXlsxSheet(manyRows, { ...XLSX_LIMITS, maxRows: 3 })), 'tooManyRows');

  const billionLaughs = makeWorkbook({ rows: '<row r="1"/>' });
  const evilSheet = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&lol;</t></is></c></row></sheetData></worksheet>';
  const evil = storeZip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'xl/workbook.xml', data: workbookXml() },
    { name: 'xl/_rels/workbook.xml.rels', data: WORKBOOK_RELS },
    { name: 'xl/styles.xml', data: STYLES },
    { name: 'xl/sharedStrings.xml', data: sharedStringsXml([]) },
    { name: 'xl/worksheets/sheet1.xml', data: evilSheet },
  ]);
  ok('de goedaardige variant leest gewoon', (await readXlsxSheet(billionLaughs)).rows.length === 1);
  eq('DTD wordt geweigerd', await issueOf(readXlsxSheet(evil)), 'malformed');

  const noSheet = storeZip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'xl/workbook.xml', data: workbookXml() },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
  ]);
  eq('werkmap zonder blad ⇒ noSheet', await issueOf(readXlsxSheet(noSheet)), 'noSheet');

  const notOoxml = storeZip([{ name: 'hoi.txt', data: 'geen werkmap' }]);
  eq('zip zonder [Content_Types].xml ⇒ notAZip', await issueOf(readXlsxSheet(notOoxml)), 'notAZip');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Uitkomst
// ════════════════════════════════════════════════════════════════════════════════════════════
if (diffs.length) {
  for (const d of diffs) console.log(`   XX ${d}`);
  console.log(`XX voortgangsimport xlsx (#27): ${diffs.length} afwijking(en) van ${checks} checks`);
  process.exit(1);
}
console.log(`OK voortgangsimport xlsx (#27): ${checks} checks groen`);
