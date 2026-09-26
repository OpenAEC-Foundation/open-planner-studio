import { produce } from 'immer';
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import type { ResourceAssignment } from '@/types/resource';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import {
  captureCalendarChange, settleCalendarChange, type CalendarCapture, type WorkRuleDeps,
} from '@/engine/work/workRuleApply';
import type { NotifyInput } from './slices/types';
import { notifyWorkRuleDurationsChanged } from './taskTypesNotice';
import { notifyTimephasedLoss } from './timephasedLossNotice';

type CalendarState = { tasks: Task[]; calendars: WorkCalendar[]; calendar: WorkCalendar; project: { calendarId: string } };

/**
 * De taken waarvan de EFFECTIEVE kalender `calendarId` is — dezelfde opzoeking als de motor
 * (`resolveCalendar`: eigen kalender, anders — óók bij een bungelende verwijzing — de
 * projectkalender). Gedeeld door
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
 * Een mutatie van de hele kalenderbibliotheek — de kalenderdialoog (`CalendarDialog` →
 * `resourceSlice.commitCalendarLibrary`, de enige plek in de UI waar je uren per dag wijzigt) en
 * `removeCalendar` — volgt dezelfde kalenderregel als `updateCalendar`/`setTaskCalendar`/
 * `setProjectCalendar`: de restduur in dagen blijft, de werkregel beslist per taak wat meebeweegt.
 *
 * Omdat zo'n mutatie élke taak kan raken (een andere projectkalender raakt ook de taken die erop
 * terugvallen, een verwijderde kalender laat zijn taken op de projectkalender vallen), neemt deze
 * momentopname ALLE taken vast — per taak met een voorgegroepeerde toewijzingenlijst, zodat het
 * O(taken + toewijzingen) blijft. `settleCalendarChange` doet daarna niets voor een taak waarvan de
 * slot gelijk bleef, en is verder de ENE definitie: contour-as, gestarte taak,
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

/** Wat een settle opleverde. De ids naast de tellers laten een SLAPEND document meerdere
 *  verversingen ophopen tot zijn ene melding bij activering, zonder een taak dubbel te tellen. */
export interface CalendarLibrarySettle {
  changed: number;
  lost: number;
  changedTaskIds: string[];
  lostTaskIds: string[];
}

/** Aanroepen NÁDAT bibliotheek, verwijzingen en de projectkalender-cache (`syncProjectCalendar`) zijn
 *  bijgewerkt. Retourneert hoeveel taken een andere duur kregen (⇒ `notifyWorkRuleDurationsChanged`)
 *  en hoeveel timephased-sturing verloren (⇒ `notifyTimephasedLoss`). */
export function settleCalendarLibraryChange(s: LibraryState, captured: CalendarLibraryCapture): CalendarLibrarySettle {
  const changedTaskIds: string[] = [];
  const lostTaskIds: string[] = [];
  for (const { task, before } of captured.entries) {
    const settled = settleCalendarChange(task, s.assignments, before, s);
    if (settled.durationChanged) changedTaskIds.push(task.id);
    if (settled.timephasedLost) lostTaskIds.push(task.id);
  }
  return { changed: changedTaskIds.length, lost: lostTaskIds.length, changedTaskIds, lostTaskIds };
}

export const NO_CALENDAR_LIBRARY_SETTLE: CalendarLibrarySettle = { changed: 0, lost: 0, changedTaskIds: [], lostTaskIds: [] };

/**
 * Zelfde regel als de dialoog: de bibliotheekroutes die
 * kalenderwaarden van een document vervangen (`applyCalendarUpdate` in `refreshAllDocumentsFromPool`,
 * `updateProjectCalendarFromLibrary`, `linkRecognizedItems`, `resolveDeviation('company')`) doen
 * capture → `mutate` → settle in één aanroep, zodat geen route de settle kan vergeten. `s` is een
 * Immer-draft (het actieve document óf een slapende payload binnen dezelfde `set()`); `mutate` vervangt
 * de kalenders en werkt de projectkalender-cache bij. Of de route undoable is en `isDirty` zet, beslist
 * de aanroeper — de settle hoort bij dezelfde stap als de kalenderwijziging, niet bij een eigen stap.
 */
export function applyCalendarLibraryChange<T extends LibraryState>(s: T, mutate: (s: T) => void): CalendarLibrarySettle {
  const captured = captureCalendarLibraryChange(s);
  mutate(s);
  return settleCalendarLibraryChange(s, captured);
}

/**
 * Dezelfde capture/settle op een PLAIN payload — de activatiegrens (`materializeBehindOnlyRefresh`:
 * openen, wisselen, herstel, bibliotheekimport), die buiten een store-producer rekent. `previous` is de
 * kalenderstand van VÓÓR de verversing, `payload` draagt de nieuwe al. Taken en toewijzingen gaan door
 * Immer: de payload bestaat uit (bevroren) store-objecten, en alleen werkelijk geraakte taken en
 * toewijzingen krijgen zo een nieuwe identiteit.
 */
export function settleCalendarLibraryChangeOnPayload(
  payload: LibraryState,
  previous: WorkRuleDeps,
): CalendarLibrarySettle {
  let settled = NO_CALENDAR_LIBRARY_SETTLE;
  const next = produce({ tasks: payload.tasks, assignments: payload.assignments }, (d) => {
    const captured = captureCalendarLibraryChange({ ...previous, tasks: d.tasks, assignments: d.assignments });
    settled = settleCalendarLibraryChange({ ...payload, tasks: d.tasks, assignments: d.assignments }, captured);
  });
  payload.tasks = next.tasks;
  payload.assignments = next.assignments;
  return settled;
}

/** Tel `b` bij `a` op per taak-id (een slapend document dat twee keer ververst werd, meldt een
 *  taak één keer). */
export function mergeCalendarLibrarySettle(a: CalendarLibrarySettle, b: CalendarLibrarySettle): CalendarLibrarySettle {
  const changedTaskIds = [...new Set([...a.changedTaskIds, ...b.changedTaskIds])];
  const lostTaskIds = [...new Set([...a.lostTaskIds, ...b.lostTaskIds])];
  return { changed: changedTaskIds.length, lost: lostTaskIds.length, changedTaskIds, lostTaskIds };
}

/** De melding van de kalenderdialoog (`commitCalendarLibrary`), één per document: "N taken
 *  aangepast" en — apart, met zijn eigen sessiepoort per document — het verlies van tijdgefaseerde
 *  sturing. */
export function notifyCalendarLibrarySettle(
  notify: (n: NotifyInput) => void,
  docId: string,
  settled: Pick<CalendarLibrarySettle, 'changed' | 'lost'>,
): void {
  notifyWorkRuleDurationsChanged(notify, settled.changed);
  notifyTimephasedLoss(notify, docId, settled.lost);
}
