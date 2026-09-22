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
// De fixtures worden gebouwd met de ECHTE `writeZip` uit `@/services/zip` (sinds T14; daarvoor stond
// hier een tijdelijke, store-only kopie omdat baan A en baan C parallel liepen). Wat de lezer hier
// binnenkrijgt is dus byte-voor-byte wat de app schrijft — deflate en al. De round-trip-asserties
// gaan bovendien door de ECHTE `writeProgressSheetXLSX`: exporteren en meteen terugimporteren moet
// nul wijzigingen geven, en dat is alleen bewijs als de schrijver er zelf in zit.
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
import { parseZipEntries, writeZip } from '@/services/zip';
import { isoToSerial } from '@/services/xlsx/serialDate';
import { writeProgressSheetXLSX, type ProgressXlsxText } from '@/services/xlsx';
import { parseProgressXlsx } from '@/services/progressImport/parseProgressXlsx';
import { detectDateOrder, finalizeProgressRows } from '@/services/progressImport/sheetValues';
import { buildProgressImportPlan, type ProgressPlanDeps } from '@/services/progressImport/buildPlan';
import {
  PROGRESS_IMPORT_LIMITS,
  type DateOrderDetection,
  type ProgressSheet,
} from '@/services/progressImport/types';
import { createDefaultTaskTime } from '@/utils/taskDefaults';
import type { Task } from '@/types/task';
import type { CellEditIntent, CellValidationError, GridResult } from '@/types/taskGrid';
import type { PlannedTaskEdit } from '@/engine/taskGrid/taskEditPlan';

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
// Fixture-gereedschap: de ECHTE ZIP-schrijver
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// Sinds T14 bouwen deze fixtures met `writeZip` uit `@/services/zip` — dezelfde schrijver die het
// product gebruikt. De tijdelijke, store-only kopie die baan C nodig had zolang baan A nog liep is
// daarmee weg: wat hier de lezer in gaat is precies wat de app schrijft, deflate en al.

interface ZipInput { name: string; data: string | Uint8Array }

async function zipOf(files: readonly ZipInput[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  return writeZip(files.map(file => ({
    name: file.name,
    data: typeof file.data === 'string' ? encoder.encode(file.data) : file.data,
  })));
}
/**
 * Laat de central directory LIEGEN over de omvang van één part: de gecomprimeerde én de
 * ongecomprimeerde maat gaan naar een absurde waarde. Een lezer die die getallen op hun woord
 * gelooft, alloceert of leest buiten het bestand; een lezer die ze tegen `buffer.byteLength` en zijn
 * eigen limieten toetst, weigert. Dat laatste is wat de hardening-checklist eist.
 */
function inflateHeaderLie(bytes: Uint8Array, partName: string): Uint8Array {
  const out = bytes.slice();
  const view = new DataView(out.buffer);
  const decoder = new TextDecoder();

  // De central directory wordt via de EOCD gevonden, niet met een naïeve scan op de signatuur: nu
  // de fixtures door de ECHTE schrijver gaan is de payload gedeflate, en dan kan `50 4b 01 02`
  // toevallig ergens ín de gecomprimeerde bytes staan. Via de EOCD-offset lopen we gegarandeerd de
  // echte directory af.
  let eocd = -1;
  for (let p = out.length - 22; p >= 0; p--) {
    if (view.getUint32(p, true) === 0x06054b50) { eocd = p; break; }
  }
  if (eocd < 0) throw new Error('testfixture: geen EOCD gevonden');

  const total = view.getUint16(eocd + 10, true);
  let cd = view.getUint32(eocd + 16, true);
  for (let i = 0; i < total; i++) {
    if (view.getUint32(cd, true) !== 0x02014b50) break;
    const nameLen = view.getUint16(cd + 28, true);
    const extraLen = view.getUint16(cd + 30, true);
    const commentLen = view.getUint16(cd + 32, true);
    if (decoder.decode(out.subarray(cd + 46, cd + 46 + nameLen)) === partName) {
      view.setUint32(cd + 20, 0x7fffff00, true); // compSize
      view.setUint32(cd + 24, 0x7fffff00, true); // uncompressedSize
      return out;
    }
    cd += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`testfixture: part ${partName} niet gevonden in de central directory`);
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
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="22" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
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

function makeWorkbook(opts: BookOptions): Promise<Uint8Array> {
  return zipOf([
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
  const bytes = await makeWorkbook({ rows, shared: ['Kop A', 'Kop B', 'Kop C', 'Fundering'] });
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
  const sheet = await readXlsxSheet(await makeWorkbook({ rows, shared: ['eerste', 'derde'] }));

  eq('twee rijen in het blad', sheet.rows.length, 2);
  eq('rijnummer komt uit r=', sheet.rows[1]?.rowNumber, 7);
  eq('kolom uit r=, niet uit volgorde', cell(sheet, 7, 'C')?.text, 'derde');
  eq('…en die kolomindex is 2', sheet.rows[1]?.cells[0]?.col, 2);
}

{
  // ── dubbel of dalend `r` is een WEIGERING, geen interpretatie (fixronde eindreview) ────────
  // `rowNumber` is de sleutel van `buildPlan`'s rijmap en van de handmatige koppelingen (A11).
  // Twee rijen met hetzelfde `r` betekent dat de tweede de eerste daar stil overschrijft: de
  // invuller krijgt een toepassing op een taak die hij niet bewerkte, zonder ook maar één
  // weigering. Hetzelfde geldt een niveau lager voor twee cellen met dezelfde kolom.
  const dubbel = await makeWorkbook({
    rows: '<row r="2"><c r="A2" t="inlineStr"><is><t>eerste</t></is></c></row>'
      + '<row r="2"><c r="A2" t="inlineStr"><is><t>tweede</t></is></c></row>',
  });
  eq('dubbel rijnummer ⇒ malformed', await issueOf(readXlsxSheet(dubbel)), 'malformed');

  const dalend = await makeWorkbook({
    rows: '<row r="5"><c r="A5" t="inlineStr"><is><t>vijf</t></is></c></row>'
      + '<row r="3"><c r="A3" t="inlineStr"><is><t>drie</t></is></c></row>',
  });
  eq('dalend rijnummer ⇒ malformed', await issueOf(readXlsxSheet(dalend)), 'malformed');

  const dubbeleCel = await makeWorkbook({
    rows: '<row r="2">'
      + '<c r="A2" t="inlineStr"><is><t>eerste</t></is></c>'
      + '<c r="A2" t="inlineStr"><is><t>tweede</t></is></c>'
      + '</row>',
  });
  eq('dubbele celkolom ⇒ malformed', await issueOf(readXlsxSheet(dubbeleCel)), 'malformed');

  const dalendeCel = await makeWorkbook({
    rows: '<row r="2">'
      + '<c r="C2" t="inlineStr"><is><t>drie</t></is></c>'
      + '<c r="B2" t="inlineStr"><is><t>twee</t></is></c>'
      + '</row>',
  });
  eq('dalende celkolom ⇒ malformed', await issueOf(readXlsxSheet(dalendeCel)), 'malformed');

  // Overgeslagen rijen en kolommen blijven gewoon geldig — de eis is OPLOPEND, niet aaneengesloten.
  const sprong = await readXlsxSheet(await makeWorkbook({
    rows: '<row r="2"><c r="A2" t="inlineStr"><is><t>a</t></is></c>'
      + '<c r="D2" t="inlineStr"><is><t>d</t></is></c></row>'
      + '<row r="9"><c r="B9" t="inlineStr"><is><t>b</t></is></c></row>',
  }));
  eq('gaten in rijen en kolommen blijven geldig',
    [sprong.rows.length, cell(sprong, 2, 'D')?.text, cell(sprong, 9, 'B')?.text],
    [2, 'd', 'b']);

  // Een `.xlsx` waarin de kop dubbel staat is voor de VOORTGANGSIMPORT een bestandsbrede
  // weigering, niet een half toegepast blad.
  const dubbelBlad = await makeWorkbook({
    rows: '<row r="1"><c r="A1" t="inlineStr"><is><t>OPS Task ID</t></is></c>'
      + '<c r="B1" t="inlineStr"><is><t>Completion (%)</t></is></c></row>'
      + '<row r="2"><c r="A2" t="inlineStr"><is><t>task-a</t></is></c>'
      + '<c r="B2"><v>10</v></c></row>'
      + '<row r="2"><c r="A2" t="inlineStr"><is><t>task-b</t></is></c>'
      + '<c r="B2"><v>90</v></c></row>',
  });
  eq('…en de voortgangsimport maakt er een net fileIssue van',
    (await parseProgressXlsx(dubbelBlad)).fileIssue, 'unreadable');
}

{
  const sheet1904 = await readXlsxSheet(await makeWorkbook({
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
  const bytes = await makeWorkbook({
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

  const small = await makeWorkbook({ rows: '<row r="1"><c r="A1" t="inlineStr"><is><t>x</t></is></c></row>' });
  eq('te groot ⇒ tooLarge',
    await issueOf(readXlsxSheet(small, { ...XLSX_LIMITS, maxBytes: 10 })), 'tooLarge');
  eq('de standaardgrens staat op 16 MiB', XLSX_LIMITS.maxBytes, 16 * 1024 * 1024);

  const manyRows = await makeWorkbook({
    rows: Array.from({ length: 5 }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}"><v>1</v></c></row>`).join(''),
  });
  eq('te veel rijen ⇒ tooManyRows',
    await issueOf(readXlsxSheet(manyRows, { ...XLSX_LIMITS, maxRows: 3 })), 'tooManyRows');

  const billionLaughs = await makeWorkbook({ rows: '<row r="1"/>' });
  const evilSheet = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&lol;</t></is></c></row></sheetData></worksheet>';
  const evil = await zipOf([
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

  const noSheet = await zipOf([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'xl/workbook.xml', data: workbookXml() },
    { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>' },
  ]);
  eq('werkmap zonder blad ⇒ noSheet', await issueOf(readXlsxSheet(noSheet)), 'noSheet');

  const notOoxml = await zipOf([{ name: 'hoi.txt', data: 'geen werkmap' }]);
  eq('zip zonder [Content_Types].xml ⇒ notAZip', await issueOf(readXlsxSheet(notOoxml)), 'notAZip');

  // Omgeving zonder `DecompressionStream` (fixronde eindreview): het BESTAND mankeert niets, dus
  // `notAZip` zou de gebruiker naar een probleem laten zoeken dat er niet is. Geinjecteerd via de
  // ZIP-naad, niet door de omgeving te vervalsen — zelfde vorm als `writeZip`'s `deflate: null`.
  const zonderInflater: XlsxZipReader = (buffer, zipLimits, select) =>
    parseZipEntries(buffer, zipLimits, select, { inflate: null });
  eq('geen inflater ⇒ unsupported, niet notAZip',
    await issueOf(readXlsxSheetWith(zonderInflater, small)), 'unsupported');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Deel 2 (T8) — `parseProgressXlsx` en de round-trip
// ════════════════════════════════════════════════════════════════════════════════════════════

// De ROUND-TRIP-asserties hieronder draaien op de echte `writeProgressSheetXLSX`; zie het blok
// "DE ECHTE ROUND-TRIP". De handgebouwde bladen in dit deel dienen een ander doel: ze bootsen na wat
// EXCEL zelf produceert en onze schrijver juist niet doet — een percentage als fractie met een
// percentage-`numFmt`, gedeelde strings, een foutcel — plus de rode paden (geen sleutelkolom, geen
// voortgangskolommen, de grenzen). Die mogen dus met de hand blijven; ze toetsen de LEZER tegen de
// buitenwereld, niet de schrijver tegen zichzelf.
//
// De tekst die de app bij het exporteren meegeeft (`fileSlice.exportAs` → `progressHeaderNotes.ts`)
// staat hier als VASTE strings. Deze suite draait headless zonder i18n-initialisatie, en de
// round-trip mag ook niet aan een vertaalsleutel hangen; wat telt is dat er ECHTE kopinstructies en
// een ECHTE em-dash-verzamelmarkering doorheen lopen — precies de twee dingen die een naieve lezer
// als data zou aanzien.

const EXPORT_TEXT: ProgressXlsxText = {
  headerNotes: {
    'OPS Task ID': 'niet wijzigen',
    WBS: 'niet wijzigen',
    Name: 'niet wijzigen',
    Start: 'geplande datum, niet wijzigen',
    Finish: 'geplande datum, niet wijzigen',
    'Completion (%)': 'invullen: 0 t/m 100',
    'Actual Start': 'invullen: werkelijke startdatum (jjjj-mm-dd)',
    'Actual Finish': 'invullen: werkelijke einddatum (jjjj-mm-dd)',
  },
  // MOET met een em-dash beginnen: dat is het teken waarop `isMarkerCell` de cel als afwezig telt.
  summaryNote: '\u2014 verzameltaak: vul hier niets in',
  sheetName: 'Voortgang',
  validation: {
    percentTitle: 'Ongeldig percentage',
    percentError: 'Vul een getal van 0 tot en met 100 in.',
    dateTitle: 'Ongeldige datum',
    dateError: 'Vul een geldige datum in (jjjj-mm-dd).',
  },
};

/** Het blad zoals de app het exporteert — de ENE bron van de round-trip-asserties. */
function exportSheet(tasks: readonly Task[]): Promise<Uint8Array> {
  return writeProgressSheetXLSX(tasks, EXPORT_TEXT);
}

const SHEET_HEADERS = [
  'OPS Task ID — niet wijzigen',
  'WBS — niet wijzigen',
  'Name — niet wijzigen',
  'Start — niet wijzigen',
  'Finish — niet wijzigen',
  'Completion (%) — invullen: 0 t/m 100',
  'Actual Start — invullen: datum',
  'Actual Finish — invullen: datum',
];

const MARKER = '—'; // em-dash: "hier valt niets in te vullen"

/** Kolomletter uit een 0-gebaseerde index (A…H is ruim genoeg voor dit blad). */
const COLUMN_LETTERS = 'ABCDEFGH';

interface SheetRowInput {
  taskId?: string;
  wbs?: string;
  name?: string;
  start?: string;
  finish?: string;
  /** Fractie (0.335 = 33,5 %) als getal, of letterlijke celtekst (bv. de em-dash-markering). */
  completion?: number | string;
  actualStart?: string;
  actualFinish?: string;
}

function inlineCell(ref: string, text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<c r="${ref}" t="inlineStr"><is><t>${escaped}</t></is></c>`;
}

/** Datumcel: serieel getal + de datum-`numFmt`. Met een tijddeel gaat hij naar stijl 6 (numFmt 22). */
function dateCell(ref: string, iso: string): string {
  const serial = isoToSerial(iso);
  if (serial === undefined) throw new Error(`testfixture: onleesbare datum ${iso}`);
  const style = iso.length > 10 ? 6 : 1;
  return `<c r="${ref}" s="${style}"><v>${serial}</v></c>`;
}

function progressRowXml(rowNumber: number, input: SheetRowInput): string {
  const ref = (col: number): string => `${COLUMN_LETTERS[col]}${rowNumber}`;
  const cells: string[] = [];
  if (input.taskId !== undefined) cells.push(inlineCell(ref(0), input.taskId));
  if (input.wbs !== undefined) cells.push(inlineCell(ref(1), input.wbs));
  if (input.name !== undefined) cells.push(inlineCell(ref(2), input.name));
  if (input.start !== undefined) cells.push(dateCell(ref(3), input.start));
  if (input.finish !== undefined) cells.push(dateCell(ref(4), input.finish));
  if (typeof input.completion === 'number') {
    cells.push(`<c r="${ref(5)}" s="4"><v>${input.completion}</v></c>`);
  } else if (input.completion !== undefined) {
    cells.push(inlineCell(ref(5), input.completion));
  }
  for (const [col, value] of [[6, input.actualStart], [7, input.actualFinish]] as const) {
    if (value === undefined) continue;
    cells.push(value === MARKER ? inlineCell(ref(col), value) : dateCell(ref(col), value));
  }
  return `<row r="${rowNumber}">${cells.join('')}</row>`;
}

function progressSheetBytes(
  rows: readonly SheetRowInput[],
  headers: readonly string[] = SHEET_HEADERS,
): Promise<Uint8Array> {
  const headerXml = `<row r="1">${headers.map((h, i) => inlineCell(`${COLUMN_LETTERS[i]}1`, h)).join('')}</row>`;
  const body = rows.map((row, i) => progressRowXml(i + 2, row)).join('');
  return makeWorkbook({ rows: headerXml + body });
}

// ── taken + de STUB-planner (zelfde vorm als check-progress-import-csv.ts) ───────────────────
let taskSeq = 0;
function baseTask(id: string, start: string, durationDays: number): Task {
  taskSeq++;
  return {
    id,
    name: `Taak ${taskSeq}`,
    description: '',
    wbsCode: String(taskSeq),
    taskType: 'CONSTRUCTION',
    status: 'NOT_STARTED',
    isMilestone: false,
    priority: 0,
    parentId: null,
    childIds: [],
    time: createDefaultTaskTime(start, durationDays),
    resourceIds: [],
  };
}

function stubPlanEdits(
  task: Task,
  edits: readonly CellEditIntent[],
): GridResult<PlannedTaskEdit, readonly CellValidationError[]> {
  const next: Task = { ...task, time: { ...task.time } };
  for (const edit of edits) {
    const id = String(edit.columnId);
    if (id === 'task.time.completion') next.time.completion = edit.value as number;
    else if (id === 'task.time.actualStart') next.time.actualStart = edit.value as string;
    else if (id === 'task.time.actualFinish') next.time.actualFinish = edit.value as string;
  }
  return { ok: true, value: { task: next, changed: true, timephasedGuidanceLost: false, scheduleStale: true } };
}
const stubDeps: ProgressPlanDeps = { planEdits: stubPlanEdits };

/** Het bewijslabel van de detectie — `ambiguous` heeft geen `evidence`, dat IS zijn uitkomst. */
function evidenceOf(detection: DateOrderDetection): string {
  return detection.order === 'ambiguous' ? 'ambiguous' : detection.evidence;
}

function planFor(sheet: ProgressSheet, tasks: readonly Task[]) {
  const detection = detectDateOrder(sheet.detectionCells, tasks);
  const order = detection.order === 'ambiguous' ? 'dmy' : detection.order;
  return buildProgressImportPlan(finalizeProgressRows(sheet, order), tasks, stubDeps);
}

{
  // ── DE ECHTE ROUND-TRIP ────────────────────────────────────────────────────────────────────
  // Exporteren en meteen terugimporteren moet NUL wijzigingen opleveren. Deze asserties draaien
  // daarom op de volle keten die het product ook loopt:
  //
  //     writeProgressSheetXLSX  ->  parseProgressXlsx (parseZipEntries + readXlsxSheet)
  //                             ->  detectDateOrder  ->  finalizeProgressRows
  //                             ->  buildProgressImportPlan
  //
  // Een met de hand nagebouwd blad zou hier precies het verkeerde bewaken: het toetst dan of de
  // TEST de schrijver goed nadoet. De vorige versie deed dat en zat er ook echt naast — hij
  // schreef het percentage als fractie met een percentage-`numFmt`, terwijl de schrijver een heel
  // percentage met `numFmt` 166 schrijft. Handgebouwde bladen blijven hieronder wel staan voor de
  // Excel-realisme-cases (sharedStrings, `t="e"`, percentage-`numFmt`, `date1904`): daar is de
  // vraag juist of de LEZER omgaat met wat Excel zelf produceert.
  //
  // Mutatiebewijs: laat de schrijver het percentage als fractie wegschrijven en deze asserties
  // slaan om van "nul toepassingen" naar een toepassing per taak.
  //
  // Vijf taken, zodat elke valstrik uit de contour van dit blad erin zit: een verzameltaak (de
  // em-dash-markering), 1/3 (een breuk die geen mooie decimaal is), 0 en 0,999 (de randen), en een
  // werkelijke start op de MINUUT (uur-modus: een gebroken serieel getal).
  const parent = baseTask('task-parent', '2026-06-01', 20);
  parent.wbsCode = '1';
  parent.name = 'Fundering';
  parent.childIds = ['task-derde', 'task-uur', 'task-nul', 'task-bijna'];

  const derde = baseTask('task-derde', '2026-06-01', 5);
  derde.parentId = parent.id;
  derde.wbsCode = '1.1';
  derde.time.completion = 1 / 3;

  const uur = baseTask('task-uur', '2026-06-09', 3);
  uur.parentId = parent.id;
  uur.wbsCode = '1.2';
  uur.time.completion = 1;
  uur.time.actualStart = '2026-06-09T08:30';
  uur.time.actualFinish = '2026-06-11';

  const nul = baseTask('task-nul', '2026-06-15', 4);
  nul.parentId = parent.id;
  nul.wbsCode = '1.3';
  nul.time.completion = 0;

  const bijna = baseTask('task-bijna', '2026-06-22', 4);
  bijna.parentId = parent.id;
  bijna.wbsCode = '1.4';
  bijna.time.completion = 0.999;
  bijna.time.actualStart = '2026-06-22';

  const tasks = [parent, derde, uur, nul, bijna];

  const sheet = await parseProgressXlsx(await exportSheet(tasks));
  eq('geen bestandsprobleem', sheet.fileIssue, undefined);
  const plan = planFor(sheet, tasks);

  eq('nul toepassingen', plan.appliedCount, 0);
  eq('nul weigeringen', plan.refusedCount, 0);
  eq('alles ongewijzigd', plan.noopCount, tasks.length);
  eq('geen rij wacht op koppeling', plan.needsLinkCount, 0);
  eq('elke rij matcht op id', plan.rows.every(r => r.match === 'id'), true);
  eq('verzameltaken geven geen weigering', plan.rows.filter(r => r.reason === 'summaryTask').length, 0);

  // De em-dash-markering die de schrijver zelf op de drie invulcellen zet, moet door de lezer
  // ongewijzigd doorgegeven worden: `isMarkerCell` laat de rij dan als "niets ingevuld" landen.
  const parentRow = plan.rows.find(r => r.taskId === parent.id);
  eq('de verzameltaakrij is een no-op, geen weigering',
    [parentRow?.outcome, parentRow?.reason], ['noop', undefined]);
  eq('...en de markering van de schrijver komt letterlijk door',
    sheet.rawRows[0]?.rawCompletion, EXPORT_TEXT.summaryNote);

  // A9: een `.xlsx` levert ISO-datums, dus de dag/maand-vraag kan niet ontstaan.
  eq('geen datumvraag', evidenceOf(detectDateOrder(sheet.detectionCells, tasks)), 'noAmbiguity');

  // De vier randgevallen ook los, zodat een falende round-trip meteen wijst waar het misgaat.
  for (const solo of [derde, uur, nul, bijna]) {
    const soloPlan = planFor(await parseProgressXlsx(await exportSheet([solo])), [solo]);
    eq(`${solo.wbsCode} los: ongewijzigd`, [soloPlan.noopCount, soloPlan.appliedCount], [1, 0]);
  }

  // Rijnummers zijn ECHTE Excel-rijnummers (de kop is rij 1), en Start/Finish bereiken `rawRows`
  // nooit — ze bestaan uitsluitend als detectiemateriaal.
  eq('rijnummer = Excel-rijnummer', sheet.rawRows[0]?.rowNumber, 2);
  eq('elke taak levert een rij', sheet.rawRows.length, tasks.length);
  eq('de kop met instructies wordt als kop herkend',
    sheet.rawRows.every(r => r.taskId !== undefined), true);
  eq('Start/Finish blijven detectie-only',
    Object.keys(sheet.rawRows[0] ?? {}).some(k => /start|finish/i.test(k) && !/actual/i.test(k)),
    false);
  ok('...maar ze zijn er wel als detectiemateriaal',
    sheet.detectionCells.some(c => c.field === 'start') && sheet.detectionCells.some(c => c.field === 'finish'));

  // Een echt gewijzigde cel = een toepassing, op precies die taak. Ook dat loopt door de ECHTE
  // schrijver: het blad wordt geexporteerd uit een gewijzigde takenlijst en tegen de originele
  // takenlijst geimporteerd — precies wat er gebeurt als de invuller de cel aanpast.
  const gewijzigd = tasks.map(task => task.id !== uur.id
    ? task
    : { ...task, time: { ...task.time, completion: 0.5 } });
  const mutated = planFor(await parseProgressXlsx(await exportSheet(gewijzigd)), tasks);
  eq('een wijziging, een apply', mutated.appliedCount, 1);
  eq('...op de juiste taak', mutated.rows.find(r => r.outcome === 'apply')?.taskId, uur.id);

  // Een gewijzigde Start-kolom is per constructie betekenisloos: hij is detectie-only.
  const verschovenStart = tasks.map(task => task.id !== derde.id
    ? task
    : { ...task, time: { ...task.time, scheduleStart: '2030-03-03', earlyStart: '2030-03-03',
        scheduleFinish: '2030-03-09', earlyFinish: '2030-03-09' } });
  eq('een gewijzigde Start-kolom verandert niets',
    planFor(await parseProgressXlsx(await exportSheet(verschovenStart)), tasks).appliedCount, 0);
}

{
  // Excel-realisme: 45 % staat in het bestand als 0.45 met een percentage-`numFmt`.
  const task = baseTask('task-pct', '2026-02-02', 4);
  const sheet = await parseProgressXlsx(await progressSheetBytes([
    { taskId: task.id, wbs: task.wbsCode, name: task.name, completion: 0.45 },
  ]));
  eq('45% als percentagecel leest als 45', sheet.rawRows[0]?.rawCompletion, '45');
  const rows = finalizeProgressRows(sheet, 'dmy');
  eq('…en wordt de fractie 0,45', rows[0]?.completion, { kind: 'value', value: 0.45 });
}

{
  // Grenzen op de rijwaarden: te lang, en met een stuurteken. Beide tellen als AFWEZIG, nooit
  // afgekapt — een afgekapt id kan een andere taak matchen dan de invuller bedoelde.
  const longId = 'x'.repeat(PROGRESS_IMPORT_LIMITS.maxIdChars + 1);
  const longSheet = await parseProgressXlsx(await progressSheetBytes([
    { taskId: longId, wbs: '1', name: 'Lang', completion: 0.5 },
  ]));
  eq('te lang id telt als afwezig', longSheet.rawRows[0]?.taskId, undefined);
  ok('…maar de rij zelf blijft bestaan', longSheet.rawRows.length === 1);

  const ctrlSheet = await parseProgressXlsx(await progressSheetBytes([
    // `_x0001_` is de OOXML-notatie voor een stuurteken (ST_Xstring); de lezer zet hem
    // terug naar U+0001, precies zoals Excel doet - dit is dus een ECHT stuurteken.
    { taskId: 'task_x0001_a', wbs: '1', name: 'Stuur', completion: 0.5 },
  ]));
  eq('id met stuurteken telt niet', ctrlSheet.rawRows[0]?.taskId, undefined);
}

{
  // Bestandsbrede weigeringen — elke `catch` heeft hier zijn eigen rode-pad-fixture.
  const noKey = await progressSheetBytes(
    [{ name: 'Zonder sleutel', completion: 0.5 }],
    ['Name', 'Completion (%)'],
  );
  eq('blad zonder sleutelkolom', (await parseProgressXlsx(noKey)).fileIssue, 'noKeyColumn');

  const noProgress = await progressSheetBytes([{ taskId: 'task-x', name: 'Zonder voortgang' }], ['OPS Task ID', 'Name']);
  eq('blad zonder voortgangskolommen', (await parseProgressXlsx(noProgress)).fileIssue, 'noProgressColumns');

  const cfb = new Uint8Array(64);
  cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  eq('wachtwoordbestand', (await parseProgressXlsx(cfb)).fileIssue, 'encrypted');

  // Zip-bom: de central directory LIEGT over de omvang van een van de parts. Een lengte uit een
  // bestandsheader is een leugen tot het tegendeel blijkt (hardening-checklist).
  const bomb = inflateHeaderLie(
    await progressSheetBytes([{ taskId: 'task-x', wbs: '1', name: 'Bom', completion: 0.5 }]),
    'xl/worksheets/sheet1.xml',
  );
  eq('zip-bom', (await parseProgressXlsx(bomb)).fileIssue, 'unreadable');

  eq('rommelbytes', (await parseProgressXlsx(new TextEncoder().encode('geen werkmap'))).fileIssue, 'unreadable');
  eq('te groot ⇒ tooLarge',
    (await parseProgressXlsx(await progressSheetBytes([{ taskId: 'a', wbs: '1', completion: 0.5 }]),
      { ...PROGRESS_IMPORT_LIMITS, maxBytes: 10 })).fileIssue,
    'tooLarge');
  eq('te veel rijen ⇒ tooManyRows',
    (await parseProgressXlsx(
      await progressSheetBytes([
        { taskId: 'a', wbs: '1', completion: 0.5 },
        { taskId: 'b', wbs: '2', completion: 0.5 },
      ]),
      { ...PROGRESS_IMPORT_LIMITS, maxRows: 1 },
    )).fileIssue,
    'tooManyRows');
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
