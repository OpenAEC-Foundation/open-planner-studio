import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { WorkCalendar } from '@/types/calendar';
import type { Resource, ResourceAssignment } from '@/types/resource';
import type { Task } from '@/types/task';
import { sameValue } from '@/utils/sameValue';

/**
 * Taaksleutels die de resourcebelasting (`computeResourceLoad`) NIET leest. Een bewerking die
 * alleen deze sleutels wijzigt, laat de belasting gelijk — de gridtransactie hergebruikt dan het
 * vorige resultaat (prestatiemeting rehab-2, 2026-10-07: 0,75 s per naamwijziging).
 *
 * Bewust een lijst van NEUTRALE sleutels en geen lijst van "belastingvelden": een nieuw taakveld
 * valt zo standaard in "herberekenen". `check-grid-resource-load-reuse.ts` pint de lijst exact en
 * bewijst met een proxy dat de motor geen van deze sleutels leest.
 */
export const RESOURCE_LOAD_NEUTRAL_TASK_KEYS: ReadonlySet<keyof Task> = new Set<keyof Task>([
  'name', 'description', 'wbsCode', 'color', 'activityCodes', 'customFields', 'notes', 'externalLinks', 'deadline', 'priority',
]);

/** De invoer van `computeReliableResourceLoad`. */
export interface ResourceLoadInputs {
  tasks: readonly Task[];
  assignments: readonly ResourceAssignment[];
  resources: readonly Resource[];
  calendar: WorkCalendar;
  calendars: readonly WorkCalendar[];
  cpmResult: CPMResult | null;
}

/**
 * Geeft de belasting op `after` hetzelfde resultaat als op `before`? Waar alleen als resources,
 * toewijzingen, kalenders en CPM-resultaat dezelfde objecten zijn, de takenlijst even lang is met
 * dezelfde id's op dezelfde plek, en elke gewijzigde taak alleen neutrale sleutels wijzigt. Per
 * sleutel eerst de referentie (Immer deelt ongewijzigde delen), dan structureel via `sameValue`:
 * de celbewerking schrijft `time` ook bij een naamwijziging opnieuw weg, met dezelfde inhoud.
 * Conservatief: bij twijfel `false`, dus herberekenen.
 */
export function resourceLoadInputsUnchanged(before: ResourceLoadInputs, after: ResourceLoadInputs): boolean {
  if (before.assignments !== after.assignments || before.resources !== after.resources
    || before.calendar !== after.calendar || before.calendars !== after.calendars
    || before.cpmResult !== after.cpmResult) return false;
  if (before.tasks === after.tasks) return true;
  if (before.tasks.length !== after.tasks.length) return false;
  for (let i = 0; i < after.tasks.length; i++) {
    const a = before.tasks[i];
    const b = after.tasks[i];
    if (a === b) continue;
    if (a.id !== b.id) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Task>;
    for (const key of keys) {
      if (a[key] === b[key] || RESOURCE_LOAD_NEUTRAL_TASK_KEYS.has(key)) continue;
      if (!sameValue(a[key], b[key])) return false;
    }
  }
  return true;
}
