import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { ResourceAssignment } from '@/types/resource';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import {
  captureCalendarChange, settleCalendarChange, type CalendarCapture, type WorkRuleDeps,
} from '@/engine/work/workRuleApply';

type CalendarState = { tasks: Task[]; calendars: WorkCalendar[]; calendar: WorkCalendar; project: { calendarId: string } };

/**
 * K2 (eigenaarsbesluit 2026-09-05): de taken waarvan de EFFECTIEVE kalender `calendarId` is —
 * dezelfde opzoeking als de motor (`resolveCalendar`: eigen kalender, anders — óók bij een
 * bungelende verwijzing, reviewbevinding F9 — de projectkalender). Gedeeld door
 * `resourceSlice.updateCalendar` en de MCP-tweeling `draft.updateCalendar`.
 */
export function tasksOnCalendar(s: CalendarState, calendarId: string): Task[] {
  return s.tasks.filter((t) => resolveCalendar(t.calendarId, s.calendars, s.calendar).id === calendarId);
}

/**
 * De taken die de PROJECTkalender volgen: geen eigen kalender, of een verwijzing naar een kalender
 * die niet (meer) in de bibliotheek staat. Dat zijn precies de taken die meebewegen bij
 * `projectSlice.setProjectCalendar` — een taak die de oude projectkalender expliciet als eigen
 * kalender heeft, houdt die en hoort hier dus niet bij.
 */
export function tasksFollowingProjectCalendar(s: Pick<CalendarState, 'tasks' | 'calendars'>): Task[] {
  return s.tasks.filter((t) => t.calendarId === undefined || !s.calendars.some((c) => c.id === t.calendarId));
}

/**
 * Fable-critreview PR #170, bevinding 2: een mutatie van de hele kalenderbibliotheek — de
 * kalenderdialoog (`CalendarDialog` → `resourceSlice.commitCalendarLibrary`, de enige plek in de UI
 * waar je uren per dag wijzigt) en `removeCalendar` — moet door dezelfde K2-route als
 * `updateCalendar`/`setTaskCalendar`/`setProjectCalendar` (eigenaarsbesluit 2026-09-05, spec §6.4):
 * de restduur in dagen blijft, de werkregel beslist per taak wat meebeweegt.
 *
 * Omdat zo'n mutatie élke taak kan raken (een andere projectkalender raakt ook de taken die erop
 * terugvallen, een verwijderde kalender laat zijn taken op de projectkalender vallen), neemt deze
 * momentopname ALLE taken vast — per taak met een voorgegroepeerde toewijzingenlijst, zodat het
 * O(taken + toewijzingen) blijft. `settleCalendarChange` doet daarna niets voor een taak waarvan de
 * slot gelijk bleef (byte-identiek), en is verder de ENE definitie (F3): contour-as, gestarte taak,
 * nazorg en melding komen dezelfde weg als op de andere zes paden.
 */
type LibraryState = WorkRuleDeps & { tasks: Task[]; assignments: ResourceAssignment[] };

export interface CalendarLibraryCapture {
  entries: Array<{ task: Task; before: CalendarCapture }>;
}

/** Momentopname VÓÓR de bibliotheekmutatie. */
export function captureCalendarLibraryChange(s: LibraryState): CalendarLibraryCapture {
  const byTask = new Map<string, ResourceAssignment[]>();
  for (const a of s.assignments) {
    let list = byTask.get(a.taskId);
    if (!list) { list = []; byTask.set(a.taskId, list); }
    list.push(a);
  }
  return { entries: s.tasks.map((task) => ({ task, before: captureCalendarChange(task, byTask.get(task.id) ?? [], s) })) };
}

/** Aanroepen NÁDAT bibliotheek, verwijzingen en de projectkalender-cache (`syncProjectCalendar`) zijn
 *  bijgewerkt. Retourneert hoeveel taken een andere duur kregen (⇒ `notifyWorkRuleDurationsChanged`)
 *  en hoeveel timephased-sturing verloren (⇒ `notifyTimephasedLoss`). */
export function settleCalendarLibraryChange(s: LibraryState, captured: CalendarLibraryCapture): { changed: number; lost: number } {
  let changed = 0;
  let lost = 0;
  for (const { task, before } of captured.entries) {
    const settled = settleCalendarChange(task, s.assignments, before, s);
    if (settled.durationChanged) changed++;
    if (settled.timephasedLost) lost++;
  }
  return { changed, lost };
}
