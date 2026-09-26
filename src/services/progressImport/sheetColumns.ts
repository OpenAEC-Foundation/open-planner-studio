// De kolomherkenning van het voortgangsblad, formaat-AGNOSTISCH. Zowel de CSV- als de XLSX-lezer
// gebruikt deze ene tabel en deze ene matchregel; een kopie zou stil uit de pas lopen zodra er een
// alias bijkomt. Niets in dit bestand weet van CSV, delimiters, ZIP of XML.

import type {
  ProgressFileIssue,
  ProgressImportLimits,
  ProgressSheet,
  RawDateCell,
  RawProgressRow,
} from './types';

// Detectie-only kolommen (start/finish) staan bewust in dezelfde tabel: ze worden hieronder
// herkend als elke andere kolom, maar landen NOOIT in `RawProgressRow` — alleen in
// `detectionCells`. Dat is een structurele garantie: er bestaat geen veld in het rij-contract dat een
// Start/Finish-waarde zou kunnen dragen.
export const PROGRESS_COLUMN_ALIASES: Record<string, readonly string[]> = {
  taskId: ['ops task id', 'ops taskid', 'task id'],
  wbs: ['wbs', 'wbs code', 'wbscode'],
  name: ['name', 'task name', 'naam', 'taak'],
  completion: ['completion', 'completion (%)', '% complete', 'percent', 'voltooiing'],
  actualStart: ['actual start', 'actualstart', 'werkelijke start'],
  actualFinish: ['actual finish', 'actualfinish', 'werkelijk einde', 'werkelijke einde'],
  start: ['start', 'start date', 'begin', 'startdatum'],
  finish: ['finish', 'finish date', 'end', 'end date', 'eind', 'einddatum'],
};

// Het geëxporteerde voortgangsblad (`writeProgressSheetCSV`) draagt per kolom een invulinstructie NA
// de sleutel, gescheiden door ` — ` (`<sleutel> — <instructie>`). De vroegste van deze drie markers
// snijdt de instructie van de sleutel af.
export const HEADER_INSTRUCTION_MARKERS = [' — ', ' - ', '('];

/**
 * Matcht één kopcel op zijn kolomsleutel. Eerst EXACT tegen `PROGRESS_COLUMN_ALIASES` (dekt zowel
 * oude bladen als de volledige CSV-export). Lukt dat niet, dan is de terugval het PREFIX vóór de
 * vroegste instructiemarker: dat vangt `OPS Task ID — niet wijzigen` op, en ook
 * `Completion (%) — invullen: …` — het haakje van "(%)" ligt vóór de "—", dus de afgesneden prefix
 * wordt "completion", een bestaande alias. Geen van beide treft ⇒ geen kolom.
 */
export function matchColumnKey(header: string): string | undefined {
  const h = header.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(PROGRESS_COLUMN_ALIASES)) {
    if (aliases.includes(h)) return key;
  }
  let cut = -1;
  for (const marker of HEADER_INSTRUCTION_MARKERS) {
    const idx = h.indexOf(marker);
    if (idx >= 0 && (cut === -1 || idx < cut)) cut = idx;
  }
  if (cut <= 0) return undefined; // geen marker, of de sleutel zelf zou leeg zijn.
  const prefix = h.slice(0, cut).trim();
  for (const [key, aliases] of Object.entries(PROGRESS_COLUMN_ALIASES)) {
    if (aliases.includes(prefix)) return key;
  }
  return undefined;
}

export function mapColumnIndex(headers: readonly string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < headers.length; i++) {
    const key = matchColumnKey(headers[i]);
    if (key !== undefined) map[key] = i;
  }
  return map;
}

/** Trimt en begrenst een rauwe celwaarde. Overschrijding is een WEIGERING (het veld wordt
 *  afwezig — "telt als leeg"), NOOIT een stille afkapping: een afgekapt id/waarde kan per ongeluk
 *  een andere taak matchen dan de gebruiker bedoelde. */
export function boundedCell(raw: string | undefined, maxChars: number): string | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > maxChars) return undefined;
  return trimmed;
}

export function hasControlChar(value: string): boolean {
  return Array.from(value).some(ch => {
    const code = ch.codePointAt(0) ?? 0;
    return code <= 31 || code === 127;
  });
}

/** Spiegelt `isValidPersistedIfcId` (ifcReader.ts): een te lang id of een id met een stuurteken telt
 *  als AFWEZIG — nooit afgekapt, want een afgekapt id kan een andere taak matchen dan bedoeld. */
function boundedTaskId(raw: string | undefined, maxChars: number): string | undefined {
  const trimmed = boundedCell(raw, maxChars);
  if (trimmed === undefined) return undefined;
  return hasControlChar(trimmed) ? undefined : trimmed;
}

/** Een bestandsbrede weigering: nooit een halfgelezen resultaat. */
export function refuseSheet(fileIssue: ProgressFileIssue): ProgressSheet {
  return { fileIssue, rawRows: [], detectionCells: [] };
}

/**
 * De bestandsbrede kopcontrole, in vaste volgorde: een sleutelkolom (id of WBS), minstens één
 * voortgangskolom, en een rij-aantal binnen de grens — dat laatste getoetst vóórdat er ook maar één
 * datarij geparsed wordt (een te groot blad wordt geweigerd, nooit stil afgeknipt).
 */
export function progressHeaderIssue(
  colMap: Record<string, number>,
  dataRowCount: number,
  limits: ProgressImportLimits,
): ProgressFileIssue | undefined {
  if (colMap.taskId === undefined && colMap.wbs === undefined) return 'noKeyColumn';
  if (colMap.completion === undefined && colMap.actualStart === undefined && colMap.actualFinish === undefined) {
    return 'noProgressColumns';
  }
  if (dataRowCount > limits.maxRows) return 'tooManyRows';
  return undefined;
}

/** Eén datarij van het blad: het rijnummer in het bronbestand en de celteksten per kolomindex. */
export interface SheetRow {
  readonly rowNumber: number;
  readonly texts: readonly string[];
}

/**
 * Datarijen → het `ProgressSheet`-contract: begrensde, getrimde celwaarden per herkende kolom, nog
 * ONGEPARSED. `start`/`finish` landen UITSLUITEND in `detectionCells` — er bestaat geen veld in
 * `RawProgressRow` dat ze zou kunnen dragen, en dat is de structurele garantie dat ze nooit
 * geschreven worden.
 */
export function collectProgressRows(
  rows: Iterable<SheetRow>,
  colMap: Record<string, number>,
  limits: ProgressImportLimits,
): ProgressSheet {
  const rawRows: RawProgressRow[] = [];
  const detectionCells: RawDateCell[] = [];

  for (const { rowNumber, texts } of rows) {
    const cell = (key: string): string | undefined => {
      const idx = colMap[key];
      return idx === undefined ? undefined : texts[idx];
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

    // `taskId` op een detectiecel alleen bij een harde id-treffer VAN DEZE RIJ — de ijkpuntregel
    // (kalibratie) gebruikt niets zwakkers.
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
