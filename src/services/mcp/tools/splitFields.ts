// MCP-bridge — de gedeelde SPLITS-VELDLAAG (issue #146): één implementatie van de notatie waarin de
// leestools onderbrekingen TONEN en `planner_set_task_splits` ze ACCEPTEERT. Zelfde precedent als
// `sequenceFields.ts`: de schrijfkant spreekt de leeskant — wat `interruptionsOf` produceert, moet
// `planTaskSplits` in dezelfde vorm terugnemen.
//
// De agentvorm staat op de WERK-as (zonder pauzes, zie `splitEdit.ts`): `afterWorkDays` = hoeveel
// werk er vóór de onderbreking ligt, gerekend vanaf de taakstart; `pauseDays` = de lengte van de
// onderbreking in werkdagen. Een uur-taak spreekt `afterWorkHours`/`pauseHours`. Rauwe
// `afterMinutes`/`gapMinutes` (de H1-as, waar elk gat meetelt in de positie van het volgende) krijgt
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
  milestone: 'een mijlpaal heeft geen duur en kan niet onderbroken worden',
  summary: 'een verzameltaak volgt zijn kinderen; onderbreek de deeltaken',
  hammock: 'een hammock/LOE-taak leidt zijn duur af en kan niet onderbroken worden',
  elapsed: 'een taak met verstreken tijd (ELAPSEDTIME) loopt door en kan niet onderbroken worden',
  manual: 'een handmatig geplande taak wordt niet door de planner gerekend en kan niet onderbroken worden',
  'too-short': 'de taak is korter dan twee eenheden (werkdagen, of uren bij een uur-taak) en kan niet onderbroken worden',
  'not-editable': 'de onderbrekingen van deze taak komen uit een import en passen niet in het bewerkmodel (alleen-lezen); alleen opheffen met een lege lijst kan',
};

const EDIT_REFUSAL_TEXT: Record<SplitEditRefusal, string> = {
  'position-out-of-range': 'de positie ligt niet binnen het werk van de taak (moet na de start en vóór het einde liggen)',
  'position-on-gap': 'de positie valt precies op een andere onderbreking (twee onderbrekingen op dezelfde plek)',
  'before-completed-work': 'de positie ligt in het al verrichte werk; onderbreek alleen het resterende deel',
  'work-too-short': 'het werkstuk ervoor of erna wordt korter dan één eenheid',
  'index-out-of-range': 'interne indexfout',
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
  if (!Array.isArray(interruptions)) return { ok: false, reason: '`interruptions` moet een array zijn (leeg = alle onderbrekingen opheffen)' };
  const hoursPerDay = hoursPerDayOf(task, cals);
  const refusal = canSplitTask(task, hoursPerDay, isSummaryTask(task));
  if (interruptions.length === 0) {
    // Opheffen mag ook op een alleen-lezen importsplit — dezelfde uitzondering als het paneel.
    if (refusal !== null && refusal !== 'not-editable') return { ok: false, reason: `taak '${task.id}': ${REFUSAL_TEXT[refusal]}` };
    return { ok: true, pieces: null };
  }
  if (refusal) return { ok: false, reason: `taak '${task.id}': ${REFUSAL_TEXT[refusal]}` };

  const hourUnit = taskDurationUnit(task) === 'hours';
  const afterKey = hourUnit ? 'afterWorkHours' : 'afterWorkDays';
  const pauseKey = hourUnit ? 'pauseHours' : 'pauseDays';
  const wrongKeys = hourUnit ? ['afterWorkDays', 'pauseDays'] : ['afterWorkHours', 'pauseHours'];
  const unitWord = hourUnit ? 'hele uren (uur-taak)' : 'hele werkdagen (dag-taak)';
  const unit = splitUnitMinutes(task, hoursPerDay);
  const per = hourUnit ? 60 : unit;

  const parsed: { index: number; after: number; pause: number }[] = [];
  for (let index = 0; index < interruptions.length; index++) {
    const item = interruptions[index] as Record<string, unknown> | null;
    const at = `interruptions[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, reason: `${at}: moet een object zijn` };
    const unknownKey = Object.keys(item).find(k => !['afterWorkDays', 'afterWorkHours', 'pauseDays', 'pauseHours'].includes(k));
    if (unknownKey) return { ok: false, reason: `${at}: onbekende sleutel '${unknownKey}'` };
    const mixed = wrongKeys.find(k => k in item);
    if (mixed) {
      return { ok: false, reason: `${at}: '${mixed}' past niet bij deze taak — de eenheid volgt de taak, gebruik ${afterKey}/${pauseKey} (${unitWord}); dag- en uursleutels mengen kan niet` };
    }
    const after = item[afterKey];
    const pause = item[pauseKey];
    if (typeof after !== 'number' || typeof pause !== 'number') return { ok: false, reason: `${at}: ${afterKey} en ${pauseKey} zijn allebei verplicht (getallen)` };
    if (!Number.isInteger(after) || !Number.isInteger(pause)) return { ok: false, reason: `${at}: gebruik ${unitWord} — er wordt niet stil afgerond` };
    if (!(pause > 0)) return { ok: false, reason: `${at}: ${pauseKey} moet minstens 1 zijn (een onderbreking van 0 bestaat niet)` };
    parsed.push({ index, after, pause });
  }

  const workMinutes = durationMinutesOf(task, { isHourMode: hourUnit, hoursPerDay });
  const current = toSplitPieces(task.splitGaps, workMinutes);
  if (!current) return { ok: false, reason: `taak '${task.id}': ${REFUSAL_TEXT['not-editable']}` };
  const minOffset = completedWorkMinutes(task, hoursPerDay);
  let pieces = removeAllGaps(current);
  for (const p of [...parsed].sort((a, b) => a.after - b.after || a.index - b.index)) {
    const res = splitAt(pieces, p.after * per, p.pause * per, unit, minOffset);
    if (!res.ok) return { ok: false, reason: `interruptions[${p.index}] (${afterKey}: ${p.after}): ${EDIT_REFUSAL_TEXT[res.reason]}` };
    pieces = res.pieces;
  }
  return { ok: true, pieces };
}
