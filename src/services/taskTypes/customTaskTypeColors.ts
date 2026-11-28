import { BUILTIN_TASK_TYPE_COLORS, CUSTOM_TASK_TYPE_COLOR_ORDER, hslToHex } from '@/engine/renderer/resourcePalette';
import type { CustomTaskType, CustomTaskTypeDraft } from '@/types/taskType';

export function isTaskTypeColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function freeTaskTypeColor(taken: Iterable<string>): string {
  const used = new Set([...BUILTIN_TASK_TYPE_COLORS, ...taken].map(color => color.toUpperCase()));
  const fixed = CUSTOM_TASK_TYPE_COLOR_ORDER.find(color => !used.has(color));
  if (fixed) return fixed;
  for (let i = 0; i < GENERATED_COLORS; i++) {
    const color = generatedColor(i);
    if (color && !used.has(color)) return color;
  }
  return CUSTOM_TASK_TYPE_COLOR_ORDER[0];
}

const GENERATED_COLORS = 4096;

function generatedColor(i: number): string | undefined {
  const hue = (25 + i * 137.508) % 360;
  if (hue < 15 || hue > 345) return undefined;
  return hslToHex(hue, 0.65, [0.42, 0.55, 0.32][i % 3]).toUpperCase();
}

export function enteringDocument(draft: CustomTaskTypeDraft, document: readonly CustomTaskType[]): CustomTaskType {
  const used = new Set(document.map(type => type.color.toUpperCase()));
  const color = isTaskTypeColor(draft.color) && !used.has(draft.color.toUpperCase()) ? draft.color : undefined;
  return withTaskTypeColors([{ id: draft.id, name: draft.name, color }], document)[0];
}

export function withTaskTypeColors(
  drafts: readonly CustomTaskTypeDraft[],
  context: readonly CustomTaskType[] = [],
): CustomTaskType[] {
  const taken = [...context, ...drafts].map(type => type.color).filter(isTaskTypeColor);
  const assigned = new Map<string, string>();
  for (const draft of [...drafts].filter(type => !isTaskTypeColor(type.color)).sort((a, b) => compareIds(a.id, b.id))) {
    const color = freeTaskTypeColor(taken);
    taken.push(color);
    assigned.set(draft.id, color);
  }
  return drafts.map(({ id, name, color }) => ({ id, name, color: isTaskTypeColor(color) ? color : assigned.get(id)! }));
}

export function withOpenedColors(definitions: unknown, opened: readonly CustomTaskType[]): unknown {
  if (!Array.isArray(definitions)) return definitions;
  const color = new Map(opened.map(type => [type.id, type.color]));
  return definitions.map((definition: unknown) => {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition) || 'color' in definition) return definition;
    const id = (definition as { id?: unknown }).id;
    const added = typeof id === 'string' ? color.get(id.trim()) : undefined;
    return added ? { ...definition, color: added } : definition;
  });
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
