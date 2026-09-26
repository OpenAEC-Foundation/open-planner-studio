// DE ENIGE module van de voortgangsimport die van CSV weet — kopherkenning, delimiter, quoting,
// bestandsgrenzen. `sheetValues.ts`/`matchRows.ts`/`buildPlan.ts` blijven bestandsformaat-agnostisch
// tegen het `ProgressSheet`-contract (types.ts); `parseProgressXlsx.ts` levert hetzelfde returntype.
// Komt er ook maar één csv-woord, één delimiter of één `\r\n` voorbij de grens van dit bestand, dan
// is die naad kapot.

import { PROGRESS_IMPORT_LIMITS, type ProgressImportLimits, type ProgressSheet } from './types';
import { collectProgressRows, mapColumnIndex, progressHeaderIssue, refuseSheet } from './sheetColumns';

export type { ProgressImportLimits } from './types';

// Bewust een EIGEN kopie van csvReader.ts's detectDelimiter/parseCSVLine (zelfde vorm: simpele
// ;-vs-,-heuristiek op de kopregel, RFC4180-achtige quote-/verdubbelde-quote-afhandeling), niet
// geëxporteerd en hergebruikt: de gewone CSV-lezer mag niet stil meebewegen met wat déze lezer nodig
// heeft, en omgekeerd. Twee kopieën die toevallig gelijk zijn, is de prijs voor die ontkoppeling.
function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/)[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

interface LogicalRecord {
  readonly text: string;
  /** 1-gebaseerd FYSIEK regelnummer waarop dit record begint: lege regels tellen mee, en een gequote
   *  meerregelig record telt als de regel waarop het BEGINT — niet als een positie in een
   *  al-gefilterde lijst. */
  readonly startLine: number;
}

/**
 * Splitst tekst in logische CSV-records, quote-bewust: een `\n` BINNEN een open aanhalingsteken
 * hoort bij het veld en scheidt dus NOOIT een record. `writeCSV` quote't precies zo'n veld zodra
 * het een letterlijke regeleinde draagt (bv. een taaknaam of omschrijving met Alt+Enter) — RFC4180.
 *
 * Een simpele `split(/\r?\n/)` zou zo'n gequote veld middenin scheuren: de echte rij verliest alles
 * ná de scheuring en het restant wordt een losse rommelrij — ook bij een import van onze eigen,
 * geldige export. `"` toggelt hier een simpele inQuotes-vlag per teken; dat is consistent met
 * `parseCSVLine`s "verdubbeld-quote-is-géén-toggle"-regel, want een verdubbeld quote-paar (`""`)
 * bestaat altijd uit twee ONMIDDELLIJK opeenvolgende tekens — twee toggles na elkaar komen op
 * dezelfde staat neer als "sla het paar over".
 *
 * Blijft een aanhalingsteken aan het eind van de tekst open staan, dan is GEEN kolomgrens erna nog
 * te vertrouwen. De aanroeper weigert dan het HELE blad (`fileIssue: 'unreadable'`), nooit een
 * halfgelezen resultaat.
 */
function splitLogicalRecords(text: string): LogicalRecord[] | undefined {
  const physicalLines = text.split('\n');
  const records: LogicalRecord[] = [];
  let inQuotes = false;
  let currentText = '';
  let currentStartLine = 1;

  for (let i = 0; i < physicalLines.length; i++) {
    const physicalLineNumber = i + 1;
    const line = physicalLines[i];
    if (!inQuotes) {
      currentText = line;
      currentStartLine = physicalLineNumber;
    } else {
      currentText += `\n${line}`;
    }
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '"') inQuotes = !inQuotes;
    }
    if (!inQuotes) {
      records.push({ text: currentText, startLine: currentStartLine });
    }
  }

  if (inQuotes) return undefined; // nooit gesloten — het hele blad is onbetrouwbaar.
  return records;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Leest een voortgangsblad (CSV) rauw in: sleutels genormaliseerd, waarden nog ONGEPARSED (de
 * datumvolgorde is op dit moment nog niet bekend — dat doet `sheetValues.ts`). Weigeringen zijn
 * altijd bestandsbreed (`fileIssue`) en NOOIT een stille afkapping van rijen/cellen.
 */
export function parseProgressCsv(
  text: string,
  limits: ProgressImportLimits = PROGRESS_IMPORT_LIMITS,
): ProgressSheet {
  // Limieten VÓÓR allocaties: de bytegrens wordt getoetst vóórdat er ook maar één string bewerkt
  // wordt.
  if (text.length > limits.maxBytes) return refuseSheet('tooLarge');

  // Regeleinde normaliseren VÓÓR de quote-bewuste splitsing: CRLF/lone-CR worden allemaal LF, dus
  // `splitLogicalRecords` hoeft maar één scheidingsteken te kennen. Het enige wat telt is "zit deze
  // regelovergang in een open aanhalingsteken of niet".
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delimiter = detectDelimiter(clean);
  const records = splitLogicalRecords(clean);
  // Een niet-gesloten aanhalingsteken maakt GEEN kolomgrens in het bestand nog betrouwbaar — weiger
  // het complete blad, nooit een halfgelezen resultaat.
  if (records === undefined) return refuseSheet('unreadable');

  // Lege regels tellen niet als kop/datarij, maar hun regelnummer is al vastgelegd in de
  // ONGEFILTERDE `records`-lijst — filteren ná het splitsen behoudt dus de echte regelnummers.
  const nonBlankRecords = records.filter(record => record.text.trim().length > 0);
  if (nonBlankRecords.length === 0) return refuseSheet('noKeyColumn');

  const colMap = mapColumnIndex(parseCSVLine(nonBlankRecords[0].text, delimiter));
  const dataRecords = nonBlankRecords.slice(1);
  const headerIssue = progressHeaderIssue(colMap, dataRecords.length, limits);
  if (headerIssue) return refuseSheet(headerIssue);

  // Het ECHTE fysieke regelnummer waarop elk record begint, inclusief overgeslagen lege regels
  // en meegerekende vervolgregels van een gequote meerregelig veld.
  return collectProgressRows(
    dataRecords.map(record => ({ rowNumber: record.startLine, texts: parseCSVLine(record.text, delimiter) })),
    colMap,
    limits,
  );
}
