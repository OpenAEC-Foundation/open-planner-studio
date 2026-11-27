import type { Task } from '@/types/task';
import {
  CALIBRATION_RATIO,
  MIN_CALIBRATION_HITS,
  type DateOrder,
  type DateOrderDetection,
  type ProgressRow,
  type ProgressSheet,
  type RawDateCell,
} from './types';
import { shownStart, shownFinish } from '@/utils/taskDates';
import { decodeProgressExportState } from './exportState';

type DateValue = { kind: 'value'; iso: string } | { kind: 'unreadable'; raw: string };
type PercentValue = { kind: 'value'; value: number } | { kind: 'unreadable'; raw: string }
  | { kind: 'outOfRange'; raw: string };

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function buildIso(year: number, month: number, day: number, hour?: number, minute?: number, second?: number): string {
  const datePart = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  if (hour === undefined) return datePart;
  const timePart = second !== undefined
    ? `${pad2(hour)}:${pad2(minute ?? 0)}:${pad2(second)}`
    : `${pad2(hour)}:${pad2(minute ?? 0)}`;
  return `${datePart}T${timePart}`;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1000) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function isValidTime(hour: number, minute: number, second?: number): boolean {
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second !== undefined && (second < 0 || second > 59)) return false;
  return true;
}

const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NUMERIC_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

function toFullYear(raw: string): number {
  return raw.length === 2 ? 2000 + Number(raw) : Number(raw);
}

export function parseSheetDate(raw: string, order: DateOrder = 'dmy'): DateValue | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;

  const isoDateTime = ISO_DATETIME.exec(trimmed);
  if (isoDateTime) {
    const year = Number(isoDateTime[1]);
    const month = Number(isoDateTime[2]);
    const day = Number(isoDateTime[3]);
    const hour = Number(isoDateTime[4]);
    const minute = Number(isoDateTime[5]);
    const second = isoDateTime[6] !== undefined ? Number(isoDateTime[6]) : undefined;
    if (!isValidCalendarDate(year, month, day) || !isValidTime(hour, minute, second)) {
      return { kind: 'unreadable', raw };
    }
    return { kind: 'value', iso: buildIso(year, month, day, hour, minute, second) };
  }

  const isoDate = ISO_DATE.exec(trimmed);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    if (!isValidCalendarDate(year, month, day)) return { kind: 'unreadable', raw };
    return { kind: 'value', iso: buildIso(year, month, day) };
  }

  const numeric = NUMERIC_DATE.exec(trimmed);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    const year = toFullYear(numeric[3]);
    const day = order === 'mdy' ? b : a;
    const month = order === 'mdy' ? a : b;
    const hour = numeric[4] !== undefined ? Number(numeric[4]) : undefined;
    const minute = numeric[5] !== undefined ? Number(numeric[5]) : undefined;
    const second = numeric[6] !== undefined ? Number(numeric[6]) : undefined;
    if (!isValidCalendarDate(year, month, day)) return { kind: 'unreadable', raw };
    if (hour !== undefined && !isValidTime(hour, minute as number, second)) return { kind: 'unreadable', raw };
    return { kind: 'value', iso: buildIso(year, month, day, hour, minute, second) };
  }

  return { kind: 'unreadable', raw };
}

const PERCENT = /^\s*-?\d+(?:[.,]\d+)?\s*%?\s*$/;

export function parseSheetPercent(raw: string): PercentValue | undefined {
  if (raw.trim().length === 0) return undefined;
  if (!PERCENT.test(raw)) return { kind: 'unreadable', raw };
  const numeric = raw.replace(/%/g, '').replace(',', '.').trim();
  const value = Number(numeric);
  if (!Number.isFinite(value)) return { kind: 'unreadable', raw };
  if (value < 0 || value > 100) return { kind: 'outOfRange', raw };
  return { kind: 'value', value: value / 100 };
}

interface NumericTriple {
  a: number;
  b: number;
  year: number;
}

function extractNumericTriple(raw: string): NumericTriple | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = NUMERIC_DATE.exec(trimmed);
  if (!m) return null;
  return { a: Number(m[1]), b: Number(m[2]), year: toFullYear(m[3]) };
}

function formatAmbiguous(cell: RawDateCell, triple: NumericTriple): DateOrderDetection {
  return {
    order: 'ambiguous',
    sample: cell.raw,
    sampleAlternatives: [buildIso(triple.year, triple.b, triple.a), buildIso(triple.year, triple.a, triple.b)],
  };
}

function findGenuineAmbiguousSample(
  candidates: readonly { cell: RawDateCell; triple: NumericTriple }[],
): { cell: RawDateCell; triple: NumericTriple } | undefined {
  return candidates.find(({ triple }) =>
    triple.a !== triple.b
    && isValidCalendarDate(triple.year, triple.b, triple.a)
    && isValidCalendarDate(triple.year, triple.a, triple.b),
  );
}

export function detectDateOrder(
  cells: readonly RawDateCell[],
  tasks: readonly Task[],
): DateOrderDetection {
  const ambiguous: { cell: RawDateCell; triple: NumericTriple }[] = [];
  for (const cell of cells) {
    const triple = extractNumericTriple(cell.raw);
    if (triple && triple.a !== triple.b) ambiguous.push({ cell, triple });
  }

  if (ambiguous.length === 0) {
    return { order: 'dmy', evidence: 'noAmbiguity' };
  }

  let votesDmy = false;
  let votesMdy = false;
  for (const { triple } of ambiguous) {
    const aOver = triple.a > 12;
    const bOver = triple.b > 12;
    if (aOver && bOver) continue;
    if (aOver) votesDmy = true;
    if (bOver) votesMdy = true;
  }
  if (votesDmy && votesMdy) {
    const genuine = findGenuineAmbiguousSample(ambiguous);
    return genuine ? formatAmbiguous(genuine.cell, genuine.triple) : { order: 'dmy', evidence: 'contradictoryNoSample' };
  }
  if (votesDmy) return { order: 'dmy', evidence: 'outOfRange' };
  if (votesMdy) return { order: 'mdy', evidence: 'outOfRange' };

  const taskById = new Map(tasks.map(t => [t.id, t] as const));
  let dmyHits = 0;
  let mdyHits = 0;
  for (const { cell, triple } of ambiguous) {
    if (cell.taskId === undefined) continue;
    if (cell.field !== 'start' && cell.field !== 'finish') continue;
    const task = taskById.get(cell.taskId);
    if (!task) continue;
    const plannedIso = cell.field === 'start'
      ? shownStart(task)
      : shownFinish(task);
    const plannedDatePart = plannedIso.slice(0, 10);

    if (isValidCalendarDate(triple.year, triple.b, triple.a)) {
      const dmyIso = buildIso(triple.year, triple.b, triple.a);
      if (dmyIso === plannedDatePart) dmyHits++;
    }
    if (isValidCalendarDate(triple.year, triple.a, triple.b)) {
      const mdyIso = buildIso(triple.year, triple.a, triple.b);
      if (mdyIso === plannedDatePart) mdyHits++;
    }
  }

  const winner = dmyHits >= mdyHits
    ? { order: 'dmy' as const, hits: dmyHits, loserHits: mdyHits }
    : { order: 'mdy' as const, hits: mdyHits, loserHits: dmyHits };
  if (winner.hits >= MIN_CALIBRATION_HITS && winner.hits >= CALIBRATION_RATIO * winner.loserHits) {
    return { order: winner.order, evidence: 'calibration' };
  }

  const genuine = findGenuineAmbiguousSample(ambiguous);
  return genuine ? formatAmbiguous(genuine.cell, genuine.triple) : { order: 'dmy', evidence: 'noAmbiguity' };
}

function isMarkerCell(raw: string): boolean {
  return raw.trimStart().startsWith('\u2014');
}

export function finalizeProgressRows(sheet: ProgressSheet, order: DateOrder): readonly ProgressRow[] {
  return sheet.rawRows.map((row): ProgressRow => {
    const completion = row.rawCompletion !== undefined && !isMarkerCell(row.rawCompletion)
      ? parseSheetPercent(row.rawCompletion) : undefined;
    const actualStart = row.rawActualStart !== undefined && !isMarkerCell(row.rawActualStart)
      ? parseSheetDate(row.rawActualStart, order) : undefined;
    const actualFinish = row.rawActualFinish !== undefined && !isMarkerCell(row.rawActualFinish)
      ? parseSheetDate(row.rawActualFinish, order) : undefined;
    const exportState = row.rawExportState !== undefined
      ? decodeProgressExportState(row.rawExportState) : undefined;
    return {
      rowNumber: row.rowNumber,
      ...(row.taskId !== undefined ? { taskId: row.taskId } : {}),
      ...(row.wbsCode !== undefined ? { wbsCode: row.wbsCode } : {}),
      ...(row.name !== undefined ? { name: row.name } : {}),
      ...(completion !== undefined ? { completion } : {}),
      ...(actualStart !== undefined ? { actualStart } : {}),
      ...(actualFinish !== undefined ? { actualFinish } : {}),
      ...(exportState !== undefined ? { exportState } : {}),
    };
  });
}
