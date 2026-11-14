import type { ImportResult } from '@/services/importTypes';
import { ifcGuid128, ifcObjectSeed } from '../ifcWriter';

/** Eén identiteitskoppeling voor canon en bronvormcontrole; alleen eenduidige resource-/bibliotheekkalender-ids.
 * Een botsende groep houdt haar interne ids en GUID-sleutels. Ook een bestaand id dat zelf zou verhuizen
 * blijft dan staan: geen doel mag een ander intern id overnemen, ook geen ongekoppelde verwijzing.
 */
export function planningIdentities(input: ImportResult) {
  const candidates = [
    ...input.resources.map(r => ({ kind: 'res' as const, id: r.id })),
    ...(input.resourceCalendars ?? []).filter(c => c.id !== input.project.calendarId).map(c => ({ kind: 'cal' as const, id: c.id })),
  ].map(c => {
    const guid = input.ifcGlobalIds?.[ifcObjectSeed(c.kind, c.id)] ?? ifcGuid128(ifcObjectSeed(c.kind, c.id));
    return { ...c, guid, target: `${c.kind === 'res' ? 'res' : 'rescal'}-ifc-${guid}` };
  });
  const occupied = new Set([
    input.project.id, input.project.calendarId, input.calendar.id,
    ...input.resources.flatMap(r => [r.id, r.parentId, r.calendarId]),
    ...input.assignments.flatMap(a => [a.id, a.taskId, a.resourceId]),
    ...input.tasks.flatMap(t => [t.id, t.parentId, ...t.childIds, ...t.resourceIds, t.calendarId,
      ...(t.timephasedContours ?? []).map(c => c.resourceId),
      ...(t.timephasedDurationWalks ?? []).map(w => w.resourceCalendarId)]),
    ...(input.project.schedulingOptions?.leveling?.resources ?? []).map(r => r.resourceId),
    ...(input.resourceCalendars ?? []).map(c => c.id), ...(input.ifcLiteralCalendarIds ?? []),
    ...input.sequences.flatMap(s => [s.id, s.predecessorId, s.successorId]),
    ...(input.baselines ?? []).flatMap(b => [b.id, ...b.tasks.map(t => t.taskId)]),
    ...(input.activityCodeTypes ?? []).flatMap(c => [c.id, ...c.values.map(v => v.id)]),
    ...(input.customFieldDefs ?? []).map(f => f.id), ...(input.customTaskTypes ?? []).map(t => t.id),
  ]);
  const counts = new Map<string, number>();
  for (const c of candidates) counts.set(c.target, (counts.get(c.target) ?? 0) + 1);
  const blocked = new Set<string>();
  for (const c of candidates) {
    if (counts.get(c.target)! > 1 || (c.target !== c.id && occupied.has(c.target))) {
      blocked.add(c.id);
      blocked.add(c.target);
    }
  }
  const resource = new Map<string, string>(), calendar = new Map<string, string>();
  const guids = { ...input.ifcGlobalIds };
  for (const c of candidates) {
    if (blocked.has(c.id)) continue;
    (c.kind === 'res' ? resource : calendar).set(c.id, c.target);
    delete guids[ifcObjectSeed(c.kind, c.id)];
    guids[ifcObjectSeed(c.kind, c.target)] = c.guid;
  }
  return { resource, calendar, guids };
}
