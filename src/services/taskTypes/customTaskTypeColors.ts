// Kleur van een eigen werksoort (issue #856, besluit Ethan 21 november 2026): een werksoort krijgt één
// keer een kleur die nog niet in gebruik is, en die kleur blijft bij haar (bibliotheek, IFC-bestand).
// Puur, zonder opslag.
//
// Een definitie zonder geldige kleur (een oud bestand, een andere schrijver, een import, een oude
// bibliotheek) krijgt de eerste vrije kleur. De ontbrekende kleuren gaan op volgorde van id, dus
// hetzelfde bestand geeft bij elk openen dezelfde kleuren, ongeacht de volgorde van de catalogus.
import { CUSTOM_TASK_TYPE_COLOR_ORDER } from '@/engine/renderer/resourcePalette';
import type { CustomTaskType, CustomTaskTypeDraft } from '@/types/taskType';

/** Een bewaarde werksoortkleur is `#RRGGBB`. Iets anders telt als geen kleur. */
export function isTaskTypeColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

/** De eerste kleur die nog niet in gebruik is; zijn ze alle in gebruik, dan de minst gebruikte. */
export function freeTaskTypeColor(taken: Iterable<string>): string {
  const uses = new Map<string, number>();
  for (const color of taken) uses.set(color.toUpperCase(), (uses.get(color.toUpperCase()) ?? 0) + 1);
  let best = CUSTOM_TASK_TYPE_COLOR_ORDER[0];
  let bestUses = Infinity;
  for (const color of CUSTOM_TASK_TYPE_COLOR_ORDER) {
    const count = uses.get(color) ?? 0;
    if (count < bestUses) { best = color; bestUses = count; }
  }
  return best;
}

/** `drafts` met een kleur per definitie. Een geldige kleur blijft precies zoals ze is; een ontbrekende
 *  wordt de eerste vrije kleur naast de kleuren in `drafts` en in `context`. Volgorde blijft gelijk. */
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

/** De definities zoals het IFC-bestand ze draagt (`OPS_TaskTypes`). Geeft het lezen (`withTaskTypeColors` op de definities
 *  zonder kleur) precies deze kleuren, dan blijft het veld weg: dan staat er hetzelfde als in een bestand van vóór het
 *  veld, en leest elk openen dezelfde kleuren terug. Anders staat bij elke definitie haar kleur, precies zoals ze is.
 *  Zo verandert opslaan een oud bestand niet zolang de werksoorten gelijk blijven, en gaat er nooit een kleur verloren. */
export function taskTypeDefinitionsForFile(types: readonly CustomTaskType[]): CustomTaskTypeDraft[] {
  const bare = types.map(({ id, name }) => ({ id, name }));
  const derived = withTaskTypeColors(bare);
  return derived.every((type, i) => type.color === types[i].color) ? bare : types.map(({ id, name, color }) => ({ id, name, color }));
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
