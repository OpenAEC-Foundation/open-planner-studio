import {
  readXlsxSheet,
  XlsxReadError,
  XLSX_LIMITS,
  type XlsxCell,
  type XlsxReadIssue,
  type XlsxRow,
} from '@/services/xlsx/readXlsxSheet';
import { serialToIso } from '@/services/xlsx/serialDate';
import { collectProgressRows, mapColumnIndex, progressHeaderIssue, refuseSheet } from './sheetColumns';
import {
  PROGRESS_IMPORT_LIMITS,
  type ProgressFileIssue,
  type ProgressImportLimits,
  type ProgressSheet,
} from './types';

function fileIssueFor(issue: XlsxReadIssue): ProgressFileIssue {
  switch (issue) {
    case 'tooLarge': return 'tooLarge';
    case 'tooManyRows': return 'tooManyRows';
    case 'encrypted': return 'encrypted';
    default: return 'unreadable';
  }
}

function cellText(cell: XlsxCell | undefined, epoch1904: boolean): string | undefined {
  if (cell === undefined) return undefined;
  if (cell.num !== undefined) {
    if (cell.isDate === true) {
      const iso = serialToIso(cell.num, epoch1904, cell.hasTime === true);
      return iso ?? cell.text;
    }
    if (cell.isPercent === true) {
      return String(Math.round(cell.num * 1e6) / 1e4);
    }
  }
  return cell.text;
}

function rowTexts(row: XlsxRow, epoch1904: boolean): string[] {
  const width = row.cells.reduce((max, cell) => Math.max(max, cell.col + 1), 0);
  const texts = new Array<string>(width).fill('');
  for (const cell of row.cells) {
    texts[cell.col] = cellText(cell, epoch1904) ?? '';
  }
  return texts;
}

export async function parseProgressXlsx(
  bytes: Uint8Array,
  limits: ProgressImportLimits = PROGRESS_IMPORT_LIMITS,
): Promise<ProgressSheet> {
  if (bytes.byteLength > limits.maxBytes) return refuseSheet('tooLarge');

  let sheet;
  try {
    sheet = await readXlsxSheet(bytes, {
      ...XLSX_LIMITS,
      maxBytes: limits.maxBytes,
      maxRows: limits.maxRows + 1,
    });
  } catch (err) {
    return refuseSheet(err instanceof XlsxReadError ? fileIssueFor(err.issue) : 'unreadable');
  }

  const nonEmpty = sheet.rows.filter(row => row.cells.length > 0);
  if (nonEmpty.length === 0) return refuseSheet('noKeyColumn');

  const colMap = mapColumnIndex(rowTexts(nonEmpty[0]!, sheet.epoch1904));
  const dataRows = nonEmpty.slice(1);
  const headerIssue = progressHeaderIssue(colMap, dataRows.length, limits);
  if (headerIssue) return refuseSheet(headerIssue);

  return collectProgressRows(
    dataRows.map(row => ({ rowNumber: row.rowNumber, texts: rowTexts(row, sheet.epoch1904) })),
    colMap,
    limits,
  );
}
