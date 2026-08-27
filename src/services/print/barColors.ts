// Pure kleurengine voor scherm en rapport. De API ontvangt één app-globale selectie en
// een BarColorContext; geen renderer leest het oude Task.color-veld nog.
import { paletteColorForId, resourceDisplayColor } from '@/engine/renderer/resourcePalette';
import {
  effectiveBarColorSelection,
  resolveBarCategoryValues,
  type BarCategoryValue,
  type BarColorContext,
} from '@/services/print/barColorCategories';
import type { BarColorSelection } from '@/types/barColor';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';

export interface BarPalette {
  critical: string;
  normal: string;
  nearCritical: string;
  milestone: string;
  /** Neutrale kleur voor taken zonder waarde in de gekozen categorie. */
  uncategorized?: string;
}

export type BarFill =
  | { kind: 'solid'; fill: string; outline?: string }
  | { kind: 'segments'; segments: { color: string; weight: number }[]; outline?: string };

export const SEGMENT_MIN_PX = 12;
const DEFAULT_UNCATEGORIZED = '#94A3B8';

/** Critical-kleuring negeert bewust het oude Task.color-veld. */
function criticalFill(task: Task, palette: BarPalette): string {
  if (task.isMilestone) return palette.milestone;
  if (task.time.isCritical) return palette.critical;
  if (task.time.isNearCritical) return palette.nearCritical;
  return palette.normal;
}

/** Bestaande hulpfunctie voor Resource accent en categorie-resolutie. */
export function assignmentsFor(
  taskId: string,
  resources: ReadonlyArray<Resource>,
  assignments: ReadonlyArray<ResourceAssignment>,
): { color: string; unitsPerDay: number; resourceId: string; name: string }[] {
  const byId = new Map(resources.map(resource => [resource.id, resource]));
  const rows: { color: string; unitsPerDay: number; resourceId: string; name: string }[] = [];
  for (const assignment of assignments) {
    if (assignment.taskId !== taskId) continue;
    const resource = byId.get(assignment.resourceId);
    if (!resource) continue;
    rows.push({
      color: resourceDisplayColor(resource),
      unitsPerDay: assignment.unitsPerDay,
      resourceId: resource.id,
      name: resource.name,
    });
  }
  return rows;
}

export function barCategoryDisplayColor(value: BarCategoryValue, palette: BarPalette): string {
  if (value.isNone) return palette.uncategorized ?? DEFAULT_UNCATEGORIZED;
  return value.color ?? paletteColorForId(value.key);
}

function computeSelectionColors(
  task: Task,
  selection: BarColorSelection,
  context: BarColorContext,
  palette: BarPalette,
  barPx?: number,
): BarFill {
  if (selection.mode === 'critical') {
    return { kind: 'solid', fill: criticalFill(task, palette) };
  }

  const outline = task.time.isCritical ? palette.critical : undefined;
  if (selection.mode === 'auto') {
    return { kind: 'solid', fill: paletteColorForId(task.id), outline };
  }

  const effective = effectiveBarColorSelection(selection, context).effective;
  // De fallback van een onbeschikbaar veld is altijd category/taskType.
  if (effective.mode !== 'category') {
    return { kind: 'solid', fill: criticalFill(task, palette) };
  }
  const values = resolveBarCategoryValues(task, effective.field, context);
  const firstColor = barCategoryDisplayColor(values[0], palette);

  // Een mijlpaal is één ruit; één waarde en een smalle balk hebben evenmin leesbare segmenten.
  if (task.isMilestone || values.length === 1 || (barPx !== undefined && barPx < SEGMENT_MIN_PX)) {
    return { kind: 'solid', fill: firstColor, outline };
  }

  const total = values.reduce((sum, value) => sum + Math.max(0, value.weight), 0) || 1;
  return {
    kind: 'segments',
    segments: values.map(value => ({
      color: barCategoryDisplayColor(value, palette),
      weight: Math.max(0, value.weight) / total,
    })),
    outline,
  };
}

export function computeBarColors(
  task: Task,
  selection: BarColorSelection,
  context: BarColorContext,
  palette: BarPalette,
  barPx?: number,
): BarFill {
  return computeSelectionColors(task, selection, context, palette, barPx);
}

export type { BarCategoryValue, BarColorContext };
