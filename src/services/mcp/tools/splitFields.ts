// MCP-bridge — de gedeelde SPLITS-VELDLAAG: één implementatie van de notatie waarin de
// leestools onderbrekingen TONEN en `planner_set_task_splits` ze ACCEPTEERT. Zelfde precedent als
// `sequenceFields.ts`: de schrijfkant spreekt de leeskant — wat `interruptionsOf` produceert, moet
// `planTaskSplits` in dezelfde vorm terugnemen.
//
// De agentvorm staat op de WERK-as (zonder pauzes, zie `splitEdit.ts`): `afterWorkDays` = hoeveel
// werk er vóór de onderbreking ligt, gerekend vanaf de taakstart; `pauseDays` = de lengte van de
// onderbreking in werkdagen. Een uur-taak spreekt `afterWorkHours`/`pauseHours`. Rauwe
// `afterMinutes`/`gapMinutes` (de opslag-as, waar elk gat meetelt in de positie van het volgende) krijgt
// een agent nooit te zien als invoervorm — die rekenen al het rekenwerk hier via `splitEdit.ts` om.
import type { Task } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { durationMinutesOf, taskDurationUnit } from '@/engine/scheduler/duration';
import { isSummaryTask } from '@/engine/scheduler/relationRules';
import {
  canSplitTask, completedWorkMinutes, removeAllGaps, splitAt, splitUnitMinutes, toSplitPieces,
  type SplitPiece, type SplitEditRefusal, type SplitRefusal,
} from '@/engine/scheduler/splitEdit';
import { taskCalendarHoursPerDay } from '@/utils/taskDefaults';

/** Eén onderbreking in de leesbare agentvorm; precies één `after*`- en één `pause*`-sleutel. */
export interface Interruption {
  afterWorkDays?: number;
  afterWorkHours?: number;
  pauseDays?: number;
  pauseHours?: number;
}

/** Kalenderbron voor de werkdaglengte: dezelfde twee velden als elders in de toollaag. */
export interface SplitCalendars {
  calendars: WorkCalendar[];
  calendar: WorkCalendar;
}

const REFUSAL_TEXT: Record<SplitRefusal, string> = {
  milestone: 'a milestone has no duration and cannot be interrupted',
  summary: 'a summary task follows its children; interrupt the subtasks',
  hammock: 'a hammock/LOE task derives its duration and cannot be interrupted',
  elapsed: 'a task with elapsed time (ELAPSEDTIME) keeps running and cannot be interrupted',
  manual: 'a manually scheduled task is not calculated by the scheduler and cannot be interrupted',
  'too-short': 'the task is shorter than two units (working days, or hours for an hour task) and cannot be interrupted',
  'not-editable': 'the interruptions of this task come from an import and do not fit the editing model (read-only); only clearing them with an empty list is possible',
};

const EDIT_REFUSAL_TEXT: Record<SplitEditRefusal, string> = {
  'position-out-of-range': 'the position is not within the work of the task (it must lie after the start and before the finish)',
  'position-on-gap': 'the position coincides exactly with another interruption (two interruptions at the same spot)',
  'before-completed-work': 'the position lies in work already performed; only interrupt the remaining part',
  'work-too-short': 'the piece of work before or after it becomes shorter than one unit',
  'index-out-of-range': 'internal index error',
};

function hoursPerDayOf(task: Task, cals: SplitCalendars): number {
  return taskCalendarHoursPerDay(task, cals.calendars, cals.calendar);
}

/**
 * De leesbare vorm van `task.splitGaps`. `null` wanneer de taak geen onderbrekingen heeft of wanneer
 * de lijst niet wélgevormd is (een importsplit die het bewerkmodel niet kan dragen — dan blijft alleen
 * de rauwe `splitGaps` over, en weet de agent via `splitsEditable: false` dat hij hem niet kan zetten).
 */
export function interruptionsOf(task: Task, cals: SplitCalendars): { interruptions: Interruption[] | null; editable: boolean } {
  if (!task.splitGaps || task.splitGaps.length === 0) return { interruptions: null, editable: true };
  const hoursPerDay = hoursPerDayOf(task, cals);
  const hourUnit = taskDurationUnit(task) === 'hours';
  const pieces = toSplitPieces(task.splitGaps, durationMinutesOf(task, { isHourMode: hourUnit, hoursPerDay }));
  if (!pieces) return { interruptions: null, editable: false };
  const per = hourUnit ? 60 : Math.max(1, hoursPerDay * 60);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const out: Interruption[] = [];
  let work = 0;
  for (const p of pieces) {
    if (p.kind === 'work') { work += p.minutes; continue; }
    out.push(hourUnit
      ? { afterWorkHours: round(work / per), pauseHours: round(p.minutes / per) }
      : { afterWorkDays: round(work / per), pauseDays: round(p.minutes / per) });
  }
  return { interruptions: out, editable: true };
}

export type SplitPlan =
  | { ok: true; pieces: SplitPiece[] | null }
  | { ok: false; reason: string };

/**
 * Vertaal de agentvorm naar het stukkenmodel (`null` = alle onderbrekingen opheffen). Alles-of-niets:
 * de eerste afwijzing geeft een reden MET de index van het item, en er wordt niets geschreven.
 * Nooit stil normaliseren: een niet-hele eenheid, een pauze van 0 of gemengde dag-/uursleutels zijn
 * een weigering, geen afronding.
 */
export function planTaskSplits(task: Task, interruptions: unknown, cals: SplitCalendars): SplitPlan {
  if (!Array.isArray(interruptions)) return { ok: false, reason: '`interruptions` must be an array (empty = clear all interruptions)' };
  const hoursPerDay = hoursPerDayOf(task, cals);
  const refusal = canSplitTask(task, hoursPerDay, isSummaryTask(task));
  if (interruptions.length === 0) {
    // Opheffen mag ook op een alleen-lezen importsplit — dezelfde uitzondering als het paneel.
    if (refusal !== null && refusal !== 'not-editable') return { ok: false, reason: `task '${task.id}': ${REFUSAL_TEXT[refusal]}` };
    return { ok: true, pieces: null };
  }
  if (refusal) return { ok: false, reason: `task '${task.id}': ${REFUSAL_TEXT[refusal]}` };

  const hourUnit = taskDurationUnit(task) === 'hours';
  const afterKey = hourUnit ? 'afterWorkHours' : 'afterWorkDays';
  const pauseKey = hourUnit ? 'pauseHours' : 'pauseDays';
  const wrongKeys = hourUnit ? ['afterWorkDays', 'pauseDays'] : ['afterWorkHours', 'pauseHours'];
  const unitWord = hourUnit ? 'whole hours (hour task)' : 'whole working days (day task)';
  const unit = splitUnitMinutes(task, hoursPerDay);
  const per = hourUnit ? 60 : unit;

  const parsed: { index: number; after: number; pause: number }[] = [];
  for (let index = 0; index < interruptions.length; index++) {
    const item = interruptions[index] as Record<string, unknown> | null;
    const at = `interruptions[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, reason: `${at}: must be an object` };
    const unknownKey = Object.keys(item).find(k => !['afterWorkDays', 'afterWorkHours', 'pauseDays', 'pauseHours'].includes(k));
    if (unknownKey) return { ok: false, reason: `${at}: unknown key '${unknownKey}'` };
    const mixed = wrongKeys.find(k => k in item);
    if (mixed) {
      return { ok: false, reason: `${at}: '${mixed}' does not fit this task — the unit follows the task, use ${afterKey}/${pauseKey} (${unitWord}); day and hour keys cannot be mixed` };
    }
    const after = item[afterKey];
    const pause = item[pauseKey];
    if (typeof after !== 'number' || typeof pause !== 'number') return { ok: false, reason: `${at}: ${afterKey} and ${pauseKey} are both required (numbers)` };
    if (!Number.isInteger(after) || !Number.isInteger(pause)) return { ok: false, reason: `${at}: use ${unitWord} — nothing is silently rounded` };
    if (!(pause > 0)) return { ok: false, reason: `${at}: ${pauseKey} must be at least 1 (an interruption of 0 does not exist)` };
    parsed.push({ index, after, pause });
  }

  const workMinutes = durationMinutesOf(task, { isHourMode: hourUnit, hoursPerDay });
  const current = toSplitPieces(task.splitGaps, workMinutes);
  if (!current) return { ok: false, reason: `task '${task.id}': ${REFUSAL_TEXT['not-editable']}` };
  const minOffset = completedWorkMinutes(task, hoursPerDay);
  let pieces = removeAllGaps(current);
  for (const p of [...parsed].sort((a, b) => a.after - b.after || a.index - b.index)) {
    const res = splitAt(pieces, p.after * per, p.pause * per, unit, minOffset);
    if (!res.ok) return { ok: false, reason: `interruptions[${p.index}] (${afterKey}: ${p.after}): ${EDIT_REFUSAL_TEXT[res.reason]}` };
    pieces = res.pieces;
  }
  return { ok: true, pieces };
}
