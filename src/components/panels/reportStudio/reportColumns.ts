// Kolommen van de Gantt-afdruk (issue #817 deel B): van een lijst registerkolom-id's naar de
// `PrintTableColumn`-lijst die de printlaag tekent. Puur, zodat de planningssuite het headless toetst.

import { taskColumnLabel } from '@/engine/taskGrid/taskColumnRegistry';
import { taskGridCellText, type TaskGridAdapterDomain } from '@/engine/taskGrid/taskGridAdapter';
import type { TaskColumnCategory, TaskColumnDescriptor, TaskColumnId } from '@/types/taskGrid';
import type { Task } from '@/types/task';
import type { BuiltinPrintColumnKey, PrintTableColumn } from '@/services/print/printPreview';
import { REPORT_DEFAULT_COLUMNS, REPORT_MAX_COLUMNS, REPORT_REQUIRED_COLUMN } from '@/utils/reportSettings';

/**
 * De registerkolommen die de afdruk al vóór #817 kende. Die houden op papier hun eigen tekenwijze
 * (dezelfde duurtekst, datums volgens B4, voltooiing als "75%"), zodat de standaardafdruk niet
 * verandert; alle andere kolommen nemen de celtekst van het taakraster over.
 */
export const BUILTIN_REPORT_COLUMNS: Readonly<Record<string, BuiltinPrintColumnKey>> = {
  'task.wbsCode': 'wbs',
  'task.name': 'name',
  'task.time.scheduleDuration': 'duration',
  'task.time.start': 'start',
  'task.time.finish': 'end',
  'task.time.completion': 'complete',
};

/** Celuitlijning op papier, zoals het taakraster: getallen en duren rechts, ja/nee midden, tekst links. */
export function reportColumnAlign(descriptor: Pick<TaskColumnDescriptor, 'valueKind'>): 'left' | 'right' | 'center' {
  if (descriptor.valueKind === 'number' || descriptor.valueKind === 'duration') return 'right';
  if (descriptor.valueKind === 'boolean') return 'center';
  return 'left';
}

/**
 * Breedte zonder meting en bovengrens (ongeschaalde px op papier). Het raster rekent in schermpixels
 * bij een grotere letter; papiertekst is 8 px, dus ongeveer de helft van de rasterbreedte. Vrije tekst
 * (notities, omschrijving) mag breder worden dan een getal, maar kapt daarna af.
 */
export function reportColumnWidthLimits(descriptor: Pick<TaskColumnDescriptor, 'valueKind' | 'defaultWidth'>): { fallback: number; max: number } {
  const fallback = Math.round(Math.min(140, Math.max(40, (descriptor.defaultWidth || 100) * 0.55)));
  const textLike = descriptor.valueKind === 'text' || descriptor.valueKind === 'tokens' || descriptor.valueKind === 'technical';
  return { fallback, max: textLike ? 220 : 120 };
}

export interface ResolvedReportColumns {
  /** De kolommen voor `PrintOptions.tableColumns`, in volgorde. */
  columns: PrintTableColumn[];
  /** Id's uit de lijst die in dit project niet bestaan (bijv. een eigen veld van een ander project). */
  missing: string[];
}

/**
 * Zet een lijst registerkolom-id's om in de kolommen van de afdruk. Een ingebouwde kolom krijgt alleen
 * haar soort; een registerkolom haar kop (dezelfde als in het raster), uitlijning, breedtegrenzen en de
 * celtekst per taak — die tekst komt uit `taskGridCellText`, dezelfde bron als de tabel op het scherm.
 */
export function resolveReportColumns(
  ids: readonly string[],
  domain: Pick<TaskGridAdapterDomain, 'descriptorsById' | 'context' | 'dateNotation' | 'labelForBoolean' | 'labelForText'> & Partial<TaskGridAdapterDomain>,
  tasks: readonly Task[],
  labelForColumn: (labelKey: string) => string,
): ResolvedReportColumns {
  const columns: PrintTableColumn[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const builtin = BUILTIN_REPORT_COLUMNS[id];
    if (builtin) { columns.push({ key: id, builtin }); continue; }
    const descriptor = domain.descriptorsById.get(id as TaskColumnId);
    if (!descriptor) { missing.push(id); continue; }
    const cells = new Map<string, string>();
    for (const task of tasks) {
      const text = taskGridCellText(domain as TaskGridAdapterDomain, descriptor, task);
      // Het raster toont "—" voor een lege waarde; op papier is een lege cel rustiger en leest hetzelfde.
      if (text && text !== '—') cells.set(task.id, text);
    }
    const { fallback, max } = reportColumnWidthLimits(descriptor);
    columns.push({
      key: id,
      header: taskColumnLabel(descriptor, labelForColumn),
      align: reportColumnAlign(descriptor),
      cells,
      fallbackWidth: fallback,
      maxWidth: max,
    });
  }
  return { columns, missing };
}

/** Kolom toevoegen (achteraan), zonder dubbele en binnen de bovengrens. */
export function addReportColumn(ids: readonly string[], id: string): string[] {
  if (ids.includes(id) || ids.length >= REPORT_MAX_COLUMNS) return [...ids];
  return [...ids, id];
}

/** Kolom weghalen; de taaknaam blijft altijd staan. */
export function removeReportColumn(ids: readonly string[], id: string): string[] {
  if (id === REPORT_REQUIRED_COLUMN) return [...ids];
  return ids.filter(item => item !== id);
}

/** Kolom een plek opschuiven (`delta` −1 = naar links/boven, +1 = naar rechts/onder). */
export function moveReportColumn(ids: readonly string[], id: string, delta: number): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** Kolom naar een plek slepen (`to` = index in de lijst ná het weghalen van de kolom). */
export function placeReportColumn(ids: readonly string[], id: string, to: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return [...ids];
  const next = ids.filter(item => item !== id);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
  return next;
}

/**
 * "Zoals de tabel": de zichtbare kolommen van het taakraster naast de Gantt, in die volgorde. Alleen
 * kolommen die in dit project bestaan; de taaknaam komt vooraan als het raster hem verbergt.
 */
export function reportColumnsFromGrid(gridColumnIds: readonly string[], available: ReadonlySet<string>): string[] {
  const ids: string[] = [];
  for (const id of gridColumnIds) {
    if ((available.has(id) || BUILTIN_REPORT_COLUMNS[id]) && !ids.includes(id)) ids.push(id);
    if (ids.length >= REPORT_MAX_COLUMNS) break;
  }
  if (!ids.includes(REPORT_REQUIRED_COLUMN)) ids.unshift(REPORT_REQUIRED_COLUMN);
  return ids.slice(0, REPORT_MAX_COLUMNS);
}

/** Staan de kolommen op de standaard (de vaste tabel van vóór #817)? */
export function isDefaultReportColumns(ids: readonly string[]): boolean {
  return ids.length === REPORT_DEFAULT_COLUMNS.length && ids.every((id, i) => id === REPORT_DEFAULT_COLUMNS[i]);
}

/** De categorieën in de kolomkiezer, in de volgorde van het raster; technische kolommen achteraan. */
export const REPORT_PICKER_CATEGORY_ORDER: readonly TaskColumnCategory[] = [
  'task', 'planning', 'progress', 'computed', 'constraints', 'resources', 'relations', 'baseline', 'custom', 'technical',
];
