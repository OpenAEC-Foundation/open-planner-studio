/** Eén maat voor de opgeslagen planning, gedeeld door de merge en zijn proeven (1107).
 * De bestaande canon uit ifcMergeKern: de gewone writer draagt alle planningsvelden en normaliseert
 * opnieuw afgeleide hulp-ids. Alleen de bestandskop en de klok van onze owner history tellen niet mee.
 * Baselineregels zonder bestaande taak tellen zonder dat taak-id, zoals voorheen (#886).
 */
import { writeIFC, type WriteIFCInput } from '../ifcWriter';
import { orphanRowsWithoutId } from './sourceForm';

export function planningCanon(input: WriteIFCInput): string {
  return writeIFC(orphanRowsWithoutId(input)).split('\n')
    .filter(line => line.startsWith('#'))
    .map(line => line.includes('=IFCOWNERHISTORY(') ? line.replace(/,\d+\);$/, ',0);') : line).join('\n');
}

/** Benoem het eerste verschil met domeinpad en taak-id; de canon bepaalt óf er een verschil is. */
export function planningDifference(a: WriteIFCInput, b: WriteIFCInput): string {
  function first(x: unknown, y: unknown, path: string): string | undefined {
    if (Object.is(x, y)) return;
    if (x && y && typeof x === 'object' && typeof y === 'object') {
      const left = x as Record<string, unknown>, right = y as Record<string, unknown>;
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        const found = first(left[key], right[key], `${path}.${key}`);
        if (found) return found;
      }
      return;
    }
    return `${path}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`;
  }
  for (const task of a.tasks) {
    const other = b.tasks.find(t => t.id === task.id);
    const diff = first(task, other, `taak ${task.id}`);
    if (diff) return diff;
  }
  return first(a, b, 'planning') ?? 'de geschreven planning verschilt';
}
