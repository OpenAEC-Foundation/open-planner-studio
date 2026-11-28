import type { ImportResult } from '@/services/importTypes';
import { ifcGuid128, ifcObjectSeed } from '../ifcWriter';

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

export function planningIdentityInput<T extends ImportResult>(input: T): T {
  const ids = planningIdentities(input);
  return withRenamedPlanningIds(input, {
    resource: id => ids.resource.get(id) ?? id,
    calendar: id => ids.calendar.get(id) ?? id,
    ifcGlobalIds: ids.guids,
  });
}

export interface PlanningIdRenames {
  readonly resource: (id: string) => string;
  readonly calendar: (id: string) => string;
  readonly ifcGlobalIds: Readonly<Record<string, string>>;
}

export function withRenamedPlanningIds<T extends ImportResult>(input: T, { resource, calendar, ifcGlobalIds }: PlanningIdRenames): T {
  const leveling = input.project.schedulingOptions?.leveling;
  return {
    ...input,
    ifcGlobalIds,
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
