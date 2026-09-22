// Issue #27 etappe 3 (T8, A9): DE ENIGE module van de voortgangsimport die van XLSX weet — precies
// zoals `parseProgressCsv.ts` de enige is die van CSV weet. `sheetValues.ts`/`matchRows.ts`/
// `buildPlan.ts` blijven bestandsformaat-agnostisch tegen het `ProgressSheet`-contract; deze lezer
// levert exact hetzelfde returntype en raakt hen niet aan. Komt er ook maar één woord over ZIP, XML
// of `numFmt` voorbij de grens van dit bestand, dan is die naad kapot.
//
// Wat deze laag toevoegt bovenop de generieke `readXlsxSheet`:
//  - **Kolomherkenning via de GEDEELDE `sheetColumns.ts`** — dezelfde aliassen en dezelfde
//    instructiemarker-regel als de CSV-lezer. Kopiëren zou betekenen dat de twee lezers stil uit de
//    pas lopen zodra er één alias bijkomt.
//  - **Datumcellen worden ISO.** Een `numFmt`-datum draagt in het bestand een SERIEEL GETAL; dat
//    wordt hier `YYYY-MM-DD` (met het `date1904`-stelsel van de werkmap). Daardoor geeft
//    `detectDateOrder` `noAmbiguity` terug en verschijnt de dag/maand-vraag bij een `.xlsx` nooit —
//    exact de belofte uit A9. Een serieel getal dat in het 1900-stelsel niet eenduidig leesbaar is
//    (< 61, de schrikkelbug) wordt NIET geraden: de rauwe tekst gaat door en de rij wordt zichtbaar
//    onleesbaar.
//  - **Percentage-opgemaakte cellen worden omgerekend.** Excel bewaart 45 % als `0.45` met een
//    percentage-`numFmt`; de kolom is bij ons altijd een percentage (E6/A5.6), dus zonder deze
//    omrekening zou "45 %" als 0,45 % binnenkomen.
//  - Dezelfde `boundedCell`/`hasControlChar`-begrenzing en dezelfde bestandsbrede weigeringen.
//
// `rowNumber` is hier LETTERLIJK het Excel-rijnummer (1-gebaseerd, kopregel inbegrepen) — het komt
// uit het `r`-attribuut en niet uit een teller, want het is de sleutel van de handmatige
// koppelingen (A11).

import {
  readXlsxSheet,
  XlsxReadError,
  XLSX_LIMITS,
  type XlsxCell,
  type XlsxReadIssue,
  type XlsxRow,
} from '@/services/xlsx/readXlsxSheet';
import { serialToIso } from '@/services/xlsx/serialDate';
import { boundedCell, hasControlChar, mapColumnIndex } from './sheetColumns';
import {
  PROGRESS_IMPORT_LIMITS,
  type ProgressFileIssue,
  type ProgressSheet,
  type RawDateCell,
  type RawProgressRow,
} from './types';
import type { ProgressImportLimits } from './parseProgressCsv';

/** Spiegelt `parseProgressCsv`'s `boundedTaskId`: een te lang id of een id met een stuurteken telt
 *  als AFWEZIG — nooit afgekapt, want een afgekapt id kan een andere taak matchen dan bedoeld. */
function boundedTaskId(raw: string | undefined, maxChars: number): string | undefined {
  const trimmed = boundedCell(raw, maxChars);
  if (trimmed === undefined) return undefined;
  return hasControlChar(trimmed) ? undefined : trimmed;
}

/** Elke leesfout van de generieke lezer krijgt de voortgangs-eigen naam. */
function fileIssueFor(issue: XlsxReadIssue): ProgressFileIssue {
  switch (issue) {
    case 'tooLarge': return 'tooLarge';
    case 'tooManyRows': return 'tooManyRows';
    case 'encrypted': return 'encrypted';
    // `notAZip`/`noSheet`/`malformed` zijn voor de gebruiker één en hetzelfde: dit bestand is geen
    // leesbaar voortgangsblad. Alleen `encrypted` verdient een eigen woord, want daar kán hij iets
    // aan doen (K8: geen nutteloze melding op een bestand dat gewoon een wachtwoord heeft).
    default: return 'unreadable';
  }
}

function refuse(fileIssue: ProgressFileIssue): ProgressSheet {
  return { fileIssue, rawRows: [], detectionCells: [] };
}

/**
 * De tekstwaarde van één cel, met de twee `numFmt`-afhankelijke omrekeningen. Geeft `undefined`
 * voor een cel die er niet is.
 */
function cellText(cell: XlsxCell | undefined, epoch1904: boolean): string | undefined {
  if (cell === undefined) return undefined;
  if (cell.num !== undefined) {
    if (cell.isDate === true) {
      const iso = serialToIso(cell.num, epoch1904);
      // Onleesbaar serieel getal ⇒ de rauwe tekst door, zodat de rij zichtbaar onleesbaar wordt.
      // Hier wordt NOOIT een datum geraden (hardening-checklist).
      return iso ?? cell.text;
    }
    if (cell.isPercent === true) {
      // 0.45 met een percentage-opmaak is 45 %. De afronding op vier decimalen haalt de binaire
      // ruis eruit (`0.45 * 100` is niet exact 45) zonder echte precisie te verliezen.
      return String(Math.round(cell.num * 1e6) / 1e4);
    }
  }
  return cell.text;
}

/** Rij → kolomindex-gebaseerde tekstlijst; ontbrekende (lege) cellen worden lege strings. */
function rowTexts(row: XlsxRow, epoch1904: boolean): string[] {
  const width = row.cells.reduce((max, cell) => Math.max(max, cell.col + 1), 0);
  const texts = new Array<string>(width).fill('');
  for (const cell of row.cells) {
    texts[cell.col] = cellText(cell, epoch1904) ?? '';
  }
  return texts;
}

/**
 * Leest een voortgangsblad (`.xlsx`) rauw in: sleutels genormaliseerd, waarden nog ONGEPARSED —
 * behalve de twee omrekeningen die alleen dít bestandsformaat kent (serieel→ISO, percentage-opmaak).
 * Weigeringen zijn altijd bestandsbreed (`fileIssue`) en NOOIT een stille afkapping van rijen.
 */
export async function parseProgressXlsx(
  bytes: Uint8Array,
  limits: ProgressImportLimits = PROGRESS_IMPORT_LIMITS,
): Promise<ProgressSheet> {
  // Grens vóór allocatie (hardening-checklist).
  if (bytes.byteLength > limits.maxBytes) return refuse('tooLarge');

  let sheet;
  try {
    sheet = await readXlsxSheet(bytes, {
      ...XLSX_LIMITS,
      maxBytes: limits.maxBytes,
      // +1 voor de kopregel: `limits.maxRows` telt DATArijen, de lezer telt bladrijen.
      maxRows: limits.maxRows + 1,
    });
  } catch (err) {
    return refuse(err instanceof XlsxReadError ? fileIssueFor(err.issue) : 'unreadable');
  }

  const nonEmpty = sheet.rows.filter(row => row.cells.length > 0);
  if (nonEmpty.length === 0) return refuse('noKeyColumn');

  const headerRow = nonEmpty[0]!;
  const colMap = mapColumnIndex(rowTexts(headerRow, sheet.epoch1904));

  const hasKeyColumn = colMap.taskId !== undefined || colMap.wbs !== undefined;
  if (!hasKeyColumn) return refuse('noKeyColumn');

  const hasProgressColumn = colMap.completion !== undefined
    || colMap.actualStart !== undefined || colMap.actualFinish !== undefined;
  if (!hasProgressColumn) return refuse('noProgressColumns');

  const dataRows = nonEmpty.slice(1);
  // Rij-aantal getoetst vóórdat er ook maar één datarij geparsed wordt.
  if (dataRows.length > limits.maxRows) return refuse('tooManyRows');

  const rawRows: RawProgressRow[] = [];
  const detectionCells: RawDateCell[] = [];

  for (const row of dataRows) {
    const rowNumber = row.rowNumber;
    const texts = rowTexts(row, sheet.epoch1904);
    const at = (key: string): string | undefined => {
      const idx = colMap[key];
      return idx === undefined ? undefined : texts[idx];
    };

    const taskId = boundedTaskId(at('taskId'), limits.maxIdChars);
    const wbsCode = boundedCell(at('wbs'), limits.maxWbsChars);
    const name = boundedCell(at('name'), limits.maxCellChars);
    const rawCompletion = boundedCell(at('completion'), limits.maxCellChars);
    const rawActualStart = boundedCell(at('actualStart'), limits.maxCellChars);
    const rawActualFinish = boundedCell(at('actualFinish'), limits.maxCellChars);
    const startCell = boundedCell(at('start'), limits.maxCellChars);
    const finishCell = boundedCell(at('finish'), limits.maxCellChars);

    rawRows.push({
      rowNumber,
      ...(taskId !== undefined ? { taskId } : {}),
      ...(wbsCode !== undefined ? { wbsCode } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(rawCompletion !== undefined ? { rawCompletion } : {}),
      ...(rawActualStart !== undefined ? { rawActualStart } : {}),
      ...(rawActualFinish !== undefined ? { rawActualFinish } : {}),
    });

    // A5.2/A5.4: `taskId` op een detectiecel alleen bij een harde id-treffer van DEZE rij.
    // `start`/`finish` landen UITSLUITEND hier — er bestaat geen veld in `RawProgressRow` dat ze
    // zou kunnen dragen, en dat is de structurele garantie dat ze nooit geschreven worden.
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
