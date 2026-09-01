// Issue #27 etappe 2 (T4, A2/A9): DE ENIGE module van de voortgangsimport die van CSV weet — kop-
// herkenning, delimiter, quoting, bestandsgrenzen. `sheetValues.ts`/`matchRows.ts`/`buildPlan.ts`
// blijven bestandsformaat-agnostisch tegen het `ProgressSheet`-contract (types.ts); een latere
// `parseProgressXlsx.ts` (A9) levert hetzelfde returntype en raakt hen niet. Komt er ook maar één
// csv-woord, één delimiter of één `\r\n` voorbij de grens van dit bestand, dan is die naad kapot.

import { PROGRESS_IMPORT_LIMITS, type ProgressSheet, type RawDateCell, type RawProgressRow } from './types';

/**
 * Widened vorm van `PROGRESS_IMPORT_LIMITS` (die `as const` is — sommige velden dragen daardoor
 * een literal-type, bv. `256` i.p.v. `number`). Losse limieten (tests, een toekomstige instelling)
 * moeten een AFWIJKENDE waarde kunnen meegeven; `typeof PROGRESS_IMPORT_LIMITS` zou dat afdwingen
 * tot exact de standaardwaarde.
 */
export interface ProgressImportLimits {
  readonly maxBytes: number;
  readonly maxRows: number;
  readonly maxCellChars: number;
  readonly maxIdChars: number;
  readonly maxWbsChars: number;
}

// Bewust een EIGEN kopie van csvReader.ts's detectDelimiter/parseCSVLine (zelfde vorm: simpele
// ;-vs-,-heuristiek op de kopregel, RFC4180-achtige quote-/verdubbelde-quote-afhandeling) —
// NIET geëxporteerd uit csvReader.ts en hierheen hergebruikt. De vervang-lezer (csvReader.ts,
// buiten dit plan) mag niet stilzwijgend meebewegen met wat déze lezer later nodig heeft (bv. een
// striktere quote-regel voor een latere XLSX-naad), en omgekeerd mag een wijziging aan de
// vervang-lezer dit importpad niet raken. Twee kopieën die toevallig gelijk zijn, is de prijs voor
// die ontkoppeling.
function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/)[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

interface LogicalRecord {
  readonly text: string;
  /** 1-gebaseerd FYSIEK regelnummer waarop dit record begint (fixronde-bevinding 9: lege regels
   *  tellen mee in de telling, en een gequote meerregelig record telt als de regel waarop het
   *  BEGINT — niet als een positie in een al-gefilterde lijst). */
  readonly startLine: number;
}

/**
 * Splitst tekst in logische CSV-records, quote-bewust: een `\n` BINNEN een open aanhalingsteken
 * hoort bij het veld en scheidt dus NOOIT een record. `writeCSV` quote't precies zo'n veld zodra
 * het een letterlijke regeleinde draagt (bv. een taaknaam of omschrijving met Alt+Enter) — RFC4180.
 *
 * Fixronde-bevinding 3: vóór deze fix scheurde een simpele `split(/\r?\n/)` zo'n gequote veld
 * middenin. De ECHTE rij verloor daardoor alles ná de scheuring (bv. de Completion-kolom, met
 * `refused`/`noProgressColumns` tot gevolg) en het afgescheurde restant werd een losse rommelrij
 * die als `unmatched` in de koppelsectie belandde — een import van onze EIGEN, geldige export kon
 * zo alsnog rijen verminken. `"` toggelt hier een simpele inQuotes-vlag per teken; dat is
 * bewijsbaar consistent met `parseCSVLine`s subtielere "verdubbeld-quote-is-géén-toggle"-regel,
 * want een verdubbeld quote-paar (`""`) bestaat altijd uit twee ONMIDDELLIJK opeenvolgende tekens
 * — nooit met een `\n` ertussen — dus twee toggles na elkaar (netto: geen wijziging) komt op
 * exact hetzelfde staat-op-elk-moment neer als parseCSVLine's "sla het paar over, toggle niet".
 *
 * Blijft een aanhalingsteken aan het eind van de tekst open staan, dan is het bestand structureel
 * onbetrouwbaar — GEEN kolomgrens erna is dan nog te vertrouwen. De aanroeper weigert dan het HELE
 * blad (`fileIssue: 'unreadable'`), nooit een halfgelezen resultaat (bevinding 3b).
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

// Detectie-only kolommen (start/finish) staan bewust in dezelfde tabel: ze worden hieronder
// herkend als elke andere kolom, maar landen NOOIT in `RawProgressRow` — alleen in
// `detectionCells` (A5.4). Dat is een structurele garantie: er bestaat geen veld in het
// rij-contract dat een Start/Finish-waarde zou kunnen dragen.
const COLUMN_ALIASES: Record<string, readonly string[]> = {
  taskId: ['ops task id', 'ops taskid', 'task id'],
  wbs: ['wbs', 'wbs code', 'wbscode'],
  name: ['name', 'task name', 'naam', 'taak'],
  completion: ['completion', 'completion (%)', '% complete', 'percent', 'voltooiing'],
  actualStart: ['actual start', 'actualstart', 'werkelijke start'],
  actualFinish: ['actual finish', 'actualfinish', 'werkelijk einde', 'werkelijke einde'],
  start: ['start', 'start date', 'begin', 'startdatum'],
  finish: ['finish', 'finish date', 'end', 'end date', 'eind', 'einddatum'],
};

function mapColumnIndex(headers: readonly string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase().trim();
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(h)) {
        map[key] = i;
        break;
      }
    }
  }
  return map;
}

/** Trimt en begrenst een rauwe celwaarde. Overschrijding is een WEIGERING (het veld wordt
 *  afwezig — "telt als leeg"), NOOIT een stille afkapping: een afgekapt id/waarde kan per ongeluk
 *  een andere taak matchen dan de gebruiker bedoelde (hardening-checklist). */
function boundedCell(raw: string | undefined, maxChars: number): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > maxChars) return undefined;
  return trimmed;
}

function hasControlChar(value: string): boolean {
  return Array.from(value).some(ch => {
    const code = ch.codePointAt(0) ?? 0;
    return code <= 31 || code === 127;
  });
}

/** Spiegelt `isValidPersistedIfcId` (ifcReader.ts): een id met een stuurteken telt als afwezig,
 *  net als een te lang id — geen van beide wordt afgekapt, ze verdwijnen gewoon uit de rij. */
function boundedTaskId(raw: string | undefined, maxChars: number): string | undefined {
  const trimmed = boundedCell(raw, maxChars);
  if (trimmed === undefined) return undefined;
  return hasControlChar(trimmed) ? undefined : trimmed;
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
  // Limieten VÓÓR allocaties (hardening-checklist): de bytegrens wordt getoetst vóórdat er ook
  // maar één string bewerkt wordt.
  if (text.length > limits.maxBytes) {
    return { fileIssue: 'tooLarge', rawRows: [], detectionCells: [] };
  }

  // Regeleinde normaliseren VÓÓR de quote-bewuste splitsing: CRLF/lone-CR worden allemaal LF, dus
  // `splitLogicalRecords` hoeft maar één scheidingsteken te kennen. Dit raakt geen betekenis — het
  // enige wat telt is "zit deze regelovergang in een open aanhalingsteken of niet" (bevinding 3).
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const delimiter = detectDelimiter(clean);
  const records = splitLogicalRecords(clean);
  if (records === undefined) {
    // Bevinding 3b: een niet-gesloten aanhalingsteken maakt GEEN kolomgrens in het bestand nog
    // betrouwbaar — weiger het complete blad, nooit een halfgelezen resultaat.
    return { fileIssue: 'unreadable', rawRows: [], detectionCells: [] };
  }

  // Lege regels tellen niet als kop/datarij, maar hun regelnummer is al vastgelegd in de
  // ONGEFILTERDE `records`-lijst — filteren ná het splitsen behoudt dus de echte regelnummers
  // (fixronde-bevinding 9), i.p.v. ze te herberekenen op een positie in een al-gefilterde lijst.
  const nonBlankRecords = records.filter(record => record.text.trim().length > 0);

  if (nonBlankRecords.length === 0) {
    return { fileIssue: 'noKeyColumn', rawRows: [], detectionCells: [] };
  }

  const headerFields = parseCSVLine(nonBlankRecords[0].text, delimiter);
  const colMap = mapColumnIndex(headerFields);

  const hasKeyColumn = colMap.taskId !== undefined || colMap.wbs !== undefined;
  if (!hasKeyColumn) {
    return { fileIssue: 'noKeyColumn', rawRows: [], detectionCells: [] };
  }

  const hasProgressColumn =
    colMap.completion !== undefined || colMap.actualStart !== undefined || colMap.actualFinish !== undefined;
  if (!hasProgressColumn) {
    return { fileIssue: 'noProgressColumns', rawRows: [], detectionCells: [] };
  }

  const dataRecords = nonBlankRecords.slice(1);

  // Rij-aantal getoetst vóórdat er ook maar één datarij geparsed wordt — een te groot blad wordt
  // geweigerd, nooit stil afgeknipt (hardening-checklist).
  if (dataRecords.length > limits.maxRows) {
    return { fileIssue: 'tooManyRows', rawRows: [], detectionCells: [] };
  }

  const rawRows: RawProgressRow[] = [];
  const detectionCells: RawDateCell[] = [];

  for (const record of dataRecords) {
    // Het ECHTE fysieke regelnummer waarop dit record begint, inclusief overgeslagen lege regels
    // en meegerekende vervolgregels van een gequote meerregelig veld (bevinding 3/9).
    const rowNumber = record.startLine;
    const fields = parseCSVLine(record.text, delimiter);
    const cell = (key: string): string | undefined => {
      const idx = colMap[key];
      return idx === undefined ? undefined : fields[idx];
    };

    const taskId = boundedTaskId(cell('taskId'), limits.maxIdChars);
    const wbsCode = boundedCell(cell('wbs'), limits.maxWbsChars);
    const name = boundedCell(cell('name'), limits.maxCellChars);
    const rawCompletion = boundedCell(cell('completion'), limits.maxCellChars);
    const rawActualStart = boundedCell(cell('actualStart'), limits.maxCellChars);
    const rawActualFinish = boundedCell(cell('actualFinish'), limits.maxCellChars);
    const startCell = boundedCell(cell('start'), limits.maxCellChars);
    const finishCell = boundedCell(cell('finish'), limits.maxCellChars);

    rawRows.push({
      rowNumber,
      ...(taskId !== undefined ? { taskId } : {}),
      ...(wbsCode !== undefined ? { wbsCode } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(rawCompletion !== undefined ? { rawCompletion } : {}),
      ...(rawActualStart !== undefined ? { rawActualStart } : {}),
      ...(rawActualFinish !== undefined ? { rawActualFinish } : {}),
    });

    // A5.2/A5.4: `taskId` op een detectiecel alleen gezet bij een harde id-treffer VAN DEZE RIJ —
    // de ijkpuntregel (kalibratie) gebruikt niets zwakkers dan dat.
    const detectionTaskId = taskId !== undefined ? { taskId } : {};
    if (rawActualStart !== undefined) {
      detectionCells.push({ rowNumber, field: 'actualStart', raw: rawActualStart, ...detectionTaskId });
    }
    if (rawActualFinish !== undefined) {
      detectionCells.push({ rowNumber, field: 'actualFinish', raw: rawActualFinish, ...detectionTaskId });
    }
    if (startCell !== undefined) {
      detectionCells.push({ rowNumber, field: 'start', raw: startCell, ...detectionTaskId });
    }
    if (finishCell !== undefined) {
      detectionCells.push({ rowNumber, field: 'finish', raw: finishCell, ...detectionTaskId });
    }
  }

  return { rawRows, detectionCells };
}
