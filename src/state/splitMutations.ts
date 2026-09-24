// Gedeeld muteerlichaam voor gebruikerssplits (issue #146): `taskSlice.setTaskSplits` én de
// MCP-draft (`runtime/createMcpTransactions.ts`).
//
// Zelfde verdeling als `assignmentMutations.ts`: het LICHAAM is gedeeld, wat per pad verschilt
// blijft bij de aanroeper:
//  - de guards — onbekend id: de slice geeft `'not-editable'` terug, de draft GOOIT; de
//    inhoudelijke weigering (`taskSplitRefusal`) delen ze wél, want die is voor beide een antwoord
//    aan de aanroeper (UI: gekleurd blok, MCP: VALIDATION), geen stille no-op;
//  - undo/`isDirty`/`scheduleStale` — de slice via `beginUndoable`/`finishMutation`, de draft zet
//    alleen `isDirty` (de transactie bezit snapshot en eindherberekening);
//  - het verlies van MSP-sturing (laag 3/4) — de slice meldt zelf, de draft registreert de taak op
//    de MCP-lease, zodat de envelop `timephasedGuidanceLost` draagt en de transactie één keer meldt,
//    alleen als hij slaagt. Daarom geeft `applyTaskSplits` het verlies terug, niet een melding.
//
// Werkt op Immer-drafts: de functies MUTEREN `task`, doen geen snapshot en geen guard.
import type { Task, TaskSplitGap } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import {
  adoptLevelingGaps, canSplitTask, fromSplitPieces, splitScheduleFinish,
  type SplitPiece, type SplitRefusal,
} from '@/engine/scheduler/splitEdit';
import { buildEditedContourPeriods, contourDaySlots } from '@/engine/contour/contourEdit';
import { CalendarEngine } from '@/engine/scheduler/CalendarEngine';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { calendarForEngine } from '@/utils/effectiveWorkTime';
import { isSummaryTask } from '@/engine/scheduler/relationRules';
import { invalidateForTimeBaseChange, rescaleTaskContours, taskWorkMinutesOf } from '@/utils/taskDefaults';

/** Minimale state-vorm (subset van AppState) — vermijdt een import van de volledige storetype. */
interface SplitState {
  calendars: WorkCalendar[];
  calendar: WorkCalendar;
}

/** Stap (1): de weigering, vóór élke draftmutatie. `null` (alle onderbrekingen opheffen) mag altijd,
 *  óók op een niet-wélgevormde importsplit. */
export function taskSplitRefusal(task: Task, pieces: SplitPiece[] | null, hoursPerDay: number): SplitRefusal | null {
  return pieces === null ? null : canSplitTask(task, hoursPerDay, isSummaryTask(task));
}

/**
 * Stappen (3)–(7) van de splitbewerking op één taak. Aanroepen NA `taskSplitRefusal` (en, in de
 * slice, na `beginUndoable`). `hoursPerDay` is die van de taakkalender (`taskCalendarHoursPerDay`).
 * Retourneert `true` als de taak aantoonbaar MS Project-timephased-sturing (laag 3/4) verloor.
 */
export function applyTaskSplits(
  s: SplitState,
  task: Task,
  pieces: SplitPiece[] | null,
  hoursPerDay: number,
): boolean {
  // (3) De oude werkduur — nodig vóór de duur eronder verschuift.
  const oldWorkMinutes = taskWorkMinutesOf(task, hoursPerDay);
  const slotMinutes = Math.max(1, hoursPerDay * 60);

  // (4) Nieuwe gaten + werkduur uit het stukkenmodel. `adoptLevelingGaps` is stap 5 van spec §2
  // (adoptieregel): wat de gebruiker na zijn bewerking op het scherm ziet staan, blijft staan —
  // "Nivellering wissen" haalt niets meer weg van een taak die hij zelf heeft ingedeeld.
  const { gaps, totalWorkMinutes } = pieces === null
    ? { gaps: [] as TaskSplitGap[], totalWorkMinutes: oldWorkMinutes }
    : fromSplitPieces(adoptLevelingGaps(pieces), task.splitGaps);
  if (Math.abs(totalWorkMinutes - oldWorkMinutes) > 1e-6) {
    task.time.scheduleDuration = totalWorkMinutes / slotMinutes;
    if (taskDurationUnit(task) === 'hours') task.time.durationMinutes = totalWorkMinutes;
    // `keepGaps`: de gatenlijst hierboven is al op de NIEUWE werkduur gerekend — nog een keer
    // laten schalen zou dubbel zijn (spec §2 stap 3).
    rescaleTaskContours(task, oldWorkMinutes, hoursPerDay, { keepGaps: true });
  }

  // (5) Contour meeverhuizen: dagslots lezen met de OUDE gaten (de as waarop het profiel nu
  // staat), terugschrijven met de NIEUWE — zo blijft het werk per WERKdag ongewijzigd terwijl de
  // pauzedagen verschuiven. Verricht werk (`kind: 'actual'`) blijft ongemoeid; dat regelt
  // `buildEditedContourPeriods` zelf.
  const oldSlots = (task.timephasedContours ?? [])
    .map(contour => contourDaySlots(contour.periods, task.splitGaps, slotMinutes).remaining);
  task.splitGaps = gaps.length > 0 ? gaps : undefined;
  if (task.timephasedContours && task.timephasedContours.length > 0) {
    task.timephasedContours = task.timephasedContours.map((contour, index) => ({
      ...contour,
      periods: buildEditedContourPeriods(
        contour.periods, oldSlots[index] ?? [], task.splitGaps, slotMinutes,
      ),
    }));
  }

  // (6) Tijdbasis-gevolgen (bevinding 1): een splitbewerking IS een tijdbasis-bewerking, óók
  // zonder duurwijziging — anders overschrijft het gelezen Z8-venster de nieuwe spanne gewoon en
  // beweegt er geen datum. Zelfde vorm als `updateTask`/`setTaskCalendar`.
  const lostTimephasedGuidance = invalidateForTimeBaseChange(task);

  // (7) Eigen finish bijwerken zodat de balk direct klopt; de echte datums komen bij F5/auto-calc,
  // zoals bij elke duurwijziging. `earlyFinish` gaat mee omdat de renderer die als eerste leest
  // (`earlyFinish || scheduleFinish`) — dezelfde tweeslag als `useBarDrag`s dag-resize.
  const engine = new CalendarEngine(calendarForEngine(
    resolveCalendar(task.calendarId, s.calendars, s.calendar),
  ));
  const finish = splitScheduleFinish(task, engine);
  task.time.scheduleFinish = finish;
  task.time.earlyFinish = finish;

  return lostTimephasedGuidance;
}
