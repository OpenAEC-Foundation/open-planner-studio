/** Eén maat voor de opgeslagen planning, gedeeld door de merge en zijn proeven (1107).
 * De bestaande canon uit ifcMergeKern: de gewone writer draagt alle planningsvelden en normaliseert
 * opnieuw afgeleide hulp-ids. Alleen de bestandskop en de klok van onze owner history tellen niet mee.
 * Baselineregels zonder bestaande taak tellen zonder dat taak-id, zoals voorheen (#886).
 * Alleen de bibliotheeklijst resourceCalendars telt op id; haar inhoud wordt ook zonder schrijfafronding vergeleken.
 */
import { writeIFC, type WriteIFCInput } from '../ifcWriter';
import { planningIdentities } from './planningIdentity';
import { orphanRowsWithoutId } from './sourceForm';

/** Alleen interne resource-/bibliotheekkalender-ids wisselen bij de eerste heropening.
 * Vergelijk ze op hun IFC-objectidentiteit, inclusief verwijzingen en de bestaande GUID-kaart.
 * Geen object, veld, dubbel voorkomen of arrayvolgorde wordt hierdoor weggelaten.
 */
function identityInput(input: WriteIFCInput): WriteIFCInput {
  const ids = planningIdentities(input);
  const resource = (id: string) => ids.resource.get(id) ?? id;
  const calendar = (id: string) => ids.calendar.get(id) ?? id;
  const leveling = input.project.schedulingOptions?.leveling;
  return {
    ...input,
    ifcGlobalIds: ids.guids,
    resources: input.resources.map(r => ({ ...r, id: resource(r.id),
      ...(r.parentId !== undefined ? { parentId: resource(r.parentId) } : {}),
      ...(r.calendarId !== undefined ? { calendarId: calendar(r.calendarId) } : {}),
    })),
    assignments: input.assignments.map(a => ({ ...a, resourceId: resource(a.resourceId) })),
    tasks: input.tasks.map(t => ({ ...t, resourceIds: t.resourceIds.map(resource),
      ...(t.calendarId !== undefined ? { calendarId: calendar(t.calendarId) } : {}),
      ...(t.timephasedContours ? { timephasedContours: t.timephasedContours.map(c => ({ ...c,
        ...(c.resourceId !== undefined ? { resourceId: resource(c.resourceId) } : {}),
      })) } : {}),
      ...(t.timephasedDurationWalks ? { timephasedDurationWalks: t.timephasedDurationWalks.map(w => ({ ...w, resourceCalendarId: calendar(w.resourceCalendarId) })) } : {}),
    })),
    ...(input.resourceCalendars ? { resourceCalendars: input.resourceCalendars.map(c => ({ ...c, id: calendar(c.id) })) } : {}),
    ...(input.ifcLiteralCalendarIds ? { ifcLiteralCalendarIds: input.ifcLiteralCalendarIds.map(calendar) } : {}),
    ...(leveling?.resources ? { project: { ...input.project, schedulingOptions: { ...input.project.schedulingOptions,
      leveling: { ...leveling, resources: leveling.resources.map(r => ({ ...r, resourceId: resource(r.resourceId) })) },
    } } } : {}),
  };
}

/** Alleen de bibliotheek is op id geordend. Een array blijft een array: dubbele ids verdwijnen niet. */
function calendarInput(input: WriteIFCInput): WriteIFCInput {
  return { ...input, resourceCalendars: [...(input.resourceCalendars ?? [])]
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) };
}

export function planningCanon(input: WriteIFCInput): string {
  const ordered = calendarInput(identityInput(input));
  const written = writeIFC(orphanRowsWithoutId(ordered)).split('\n')
    .filter(line => line.startsWith('#'))
    .map(line => line.includes('=IFCOWNERHISTORY(') ? line.replace(/,\d+\);$/, ',0);') : line).join('\n');
  // De writer kan kloktijden afronden of een optioneel veld niet schrijven. De bibliotheekinhoud telt hier exact,
  // zonder zo'n schrijfnormalisatie. Alleen object-sleutelvolgorde vervalt; alle geneste arrays blijven op volgorde.
  const exact = JSON.stringify(ordered.resourceCalendars, (_key, value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);
  return `${written}\nresourceCalendars=${exact}`;
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
  return first(calendarInput(a), calendarInput(b), 'planning') ?? 'de geschreven planning verschilt';
}
