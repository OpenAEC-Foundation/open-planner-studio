import type {
  ProgressFileIssue,
  ProgressImportLimits,
  ProgressSheet,
  RawDateCell,
  RawProgressRow,
} from './types';

export const PROGRESS_COLUMN_ALIASES: Record<string, readonly string[]> = {
  taskId: ['ops task id', 'ops taskid', 'task id'],
  wbs: ['wbs', 'wbs code', 'wbscode'],
  name: ['name', 'task name', 'naam', 'taak'],
  completion: ['completion', 'completion (%)', '% complete', 'percent', 'voltooiing'],
  actualStart: ['actual start', 'actualstart', 'werkelijke start'],
  actualFinish: ['actual finish', 'actualfinish', 'werkelijk einde', 'werkelijke einde'],
  start: ['start', 'start date', 'begin', 'startdatum'],
  finish: ['finish', 'finish date', 'end', 'end date', 'eind', 'einddatum'],
  exportState: ['ops export'],
};

export const HEADER_INSTRUCTION_MARKERS = [' — ', ' - ', '('];

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
  if (cut <= 0) return undefined;
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

function boundedTaskId(raw: string | undefined, maxChars: number): string | undefined {
  const trimmed = boundedCell(raw, maxChars);
  if (trimmed === undefined) return undefined;
  return hasControlChar(trimmed) ? undefined : trimmed;
}

export function refuseSheet(fileIssue: ProgressFileIssue): ProgressSheet {
  return { fileIssue, rawRows: [], detectionCells: [] };
}

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

export interface SheetRow {
  readonly rowNumber: number;
  readonly texts: readonly string[];
}

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
    const rawExportState = boundedCell(cell('exportState'), limits.maxCellChars);

    rawRows.push({
      rowNumber,
      ...(taskId !== undefined ? { taskId } : {}),
      ...(wbsCode !== undefined ? { wbsCode } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(rawCompletion !== undefined ? { rawCompletion } : {}),
      ...(rawActualStart !== undefined ? { rawActualStart } : {}),
      ...(rawActualFinish !== undefined ? { rawActualFinish } : {}),
      ...(rawExportState !== undefined ? { rawExportState } : {}),
    });

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
