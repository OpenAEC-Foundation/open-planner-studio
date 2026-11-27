import { taskColumnLabel } from '@/engine/taskGrid/taskColumnRegistry';
import { taskGridCellText, type TaskGridAdapterDomain } from '@/engine/taskGrid/taskGridAdapter';
import type { TaskColumnDescriptor, TaskColumnId } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import type { BuiltinPrintColumnKey, PrintTableColumn } from '@/services/print/printPreview';
import { REPORT_DEFAULT_COLUMNS, REPORT_MAX_COLUMNS, REPORT_REQUIRED_COLUMN } from '@/utils/reportSettings';

export const BUILTIN_REPORT_COLUMNS: Readonly<Record<string, BuiltinPrintColumnKey>> = {
  'task.wbsCode': 'wbs',
  'task.name': 'name',
  'task.time.scheduleDuration': 'duration',
  'task.time.start': 'start',
  'task.time.finish': 'end',
  'task.time.completion': 'complete',
};

export function reportColumnAlign(descriptor: Pick<TaskColumnDescriptor, 'valueKind'>): 'left' | 'right' | 'center' {
  if (descriptor.valueKind === 'number' || descriptor.valueKind === 'duration') return 'right';
  if (descriptor.valueKind === 'boolean') return 'center';
  return 'left';
}

export function reportColumnWidthLimits(descriptor: Pick<TaskColumnDescriptor, 'valueKind' | 'defaultWidth'>): { fallback: number; max: number } {
  const fallback = Math.round(Math.min(140, Math.max(40, (descriptor.defaultWidth || 100) * 0.55)));
  const textLike = descriptor.valueKind === 'text' || descriptor.valueKind === 'tokens' || descriptor.valueKind === 'technical';
  return { fallback, max: textLike ? 220 : 120 };
}

export interface ResolvedReportColumns {
  columns: PrintTableColumn[];
  missing: string[];
}

export function reportColumnsNeedBuild(
  ids: readonly string[],
  domain: Pick<TaskGridAdapterDomain, 'descriptorsById'>,
  cache: ReadonlyMap<string, PrintTableColumn>,
): boolean {
  return ids.some(id => !BUILTIN_REPORT_COLUMNS[id] && !cache.has(id) && domain.descriptorsById.has(id as TaskColumnId));
}

export function resolveReportColumns(
  ids: readonly string[],
  domain: Pick<TaskGridAdapterDomain, 'descriptorsById' | 'context' | 'dateNotation' | 'labelForBoolean' | 'labelForText'> & Partial<TaskGridAdapterDomain>,
  tasks: readonly Task[],
  labelForColumn: (labelKey: string) => string,
  cache?: Map<string, PrintTableColumn>,
): ResolvedReportColumns {
  const columns: PrintTableColumn[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const builtin = BUILTIN_REPORT_COLUMNS[id];
    if (builtin) { columns.push({ key: id, builtin }); continue; }
    const cached = cache?.get(id);
    if (cached) { columns.push(cached); continue; }
    const descriptor = domain.descriptorsById.get(id as TaskColumnId);
    if (!descriptor) { missing.push(id); continue; }
    const cells = new Map<string, string>();
    for (const task of tasks) {
      const text = taskGridCellText(domain as TaskGridAdapterDomain, descriptor, task);
      if (text && text !== '—') cells.set(task.id, text);
    }
    const { fallback, max } = reportColumnWidthLimits(descriptor);
    const column: PrintTableColumn = {
      key: id,
      header: taskColumnLabel(descriptor, labelForColumn),
      align: reportColumnAlign(descriptor),
      cells,
      fallbackWidth: fallback,
      maxWidth: max,
    };
    cache?.set(id, column);
    columns.push(column);
  }
  return { columns, missing };
}

export function addReportColumn(ids: readonly string[], id: string): string[] {
  if (ids.includes(id) || ids.length >= REPORT_MAX_COLUMNS) return [...ids];
  return [...ids, id];
}

export function removeReportColumn(ids: readonly string[], id: string): string[] {
  if (id === REPORT_REQUIRED_COLUMN) return [...ids];
  return ids.filter(item => item !== id);
}

export function moveReportColumn(ids: readonly string[], id: string, delta: number): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function placeReportColumn(ids: readonly string[], id: string, to: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return [...ids];
  const next = ids.filter(item => item !== id);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
  return next;
}

export function reportColumnsFromGrid(gridColumnIds: readonly string[], available: ReadonlySet<string>): string[] {
  const ids: string[] = [];
  for (const id of gridColumnIds) {
    if ((available.has(id) || BUILTIN_REPORT_COLUMNS[id]) && !ids.includes(id)) ids.push(id);
    if (ids.length >= REPORT_MAX_COLUMNS) break;
  }
  if (!ids.includes(REPORT_REQUIRED_COLUMN)) ids.unshift(REPORT_REQUIRED_COLUMN);
  return ids.slice(0, REPORT_MAX_COLUMNS);
}

export function isDefaultReportColumns(ids: readonly string[]): boolean {
  return ids.length === REPORT_DEFAULT_COLUMNS.length && ids.every((id, i) => id === REPORT_DEFAULT_COLUMNS[i]);
}
