import type { Task, TaskStatus } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { effHoursPerDay, effectiveCalendarOf, taskDurationMinutes } from '@/utils/taskDuration';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { isManuallyScheduled } from '@/utils/manualScheduling';

/**
 * Voortgang en status van een VERZAMELTAAK (fase), afgeleid uit haar bladtaken — één definitie.
 *
 * Waarom een eigen module. De formule stond alleen in het WBS-samenvattingsrapport
 * (`reports/wbsSummary.ts`), terwijl de verzameltaak-rollup (`applyCpmResult`) wel datums, speling
 * en duur oprolde maar geen voortgang. Tabel, Gantt-tooltip, PDF en MCP lazen daardoor de
 * OPGESLAGEN `completion`/`status` van een fase — 0% "Niet gestart", of een bevroren MSP-importwaarde
 * — terwijl het WBS-rapport op hetzelfde Rapport-tabblad 100% zei. Nu roepen de rollup én het rapport
 * deze module aan, dus kunnen ze niet meer uit elkaar lopen.
 *
 * De regels (die van het WBS-rapport, ongewijzigd):
 * - alleen BLADnakomelingen tellen (een tussenliggende subfase telt niet als eigen werk), zonder
 *   hammocks — een LOE-taak volgt anderen en is zelf geen werk (zelfde filter als de rapporten);
 * - voortgang = Σ(werkdagen × completion) / Σ(werkdagen), werkdagen op de eigen taakkalender;
 * - zonder gewicht (alleen mijlpalen): het aandeel voltooide bladen.
 * De status volgt de voortgangsstaat van de bladen (`progressState`): alle bladen voltooid ⇒
 * `COMPLETED` (en dan ook precies 100%), minstens één gestart of voltooid ⇒ `STARTED`, anders
 * `NOT_STARTED`.
 */

export type ProgressState = 'notStarted' | 'inProgress' | 'complete';

/**
 * Voortgangsstaat van een taak. Voltooid zodra completion 1, status COMPLETED of een werkelijk
 * einde; gestart zodra completion > 0, status STARTED of een werkelijke start. De volgorde is
 * bewust "meest afgeronde wint": een taak met actualFinish maar completion 0.9 (importruis) telt
 * als voltooid — het gezondheidsrapport meldt zo'n inconsistentie apart.
 */
export function progressState(t: Task): ProgressState {
  if (t.time.completion >= 1 || t.status === 'COMPLETED' || !!t.time.actualFinish) return 'complete';
  if (t.time.completion > 0 || t.status === 'STARTED' || !!t.time.actualStart) return 'inProgress';
  return 'notStarted';
}

/** Duur van een taak in werkdagen op haar eigen kalender (uur-taken: minuten ÷ uren per dag),
 *  afgerond op 0,1 dag — het gewicht van een blad in de gewogen voortgang. */
export function taskWorkDays(t: Task, projectCalendar: WorkCalendar, calendars: readonly WorkCalendar[]): number {
  const cal = effectiveCalendarOf(t, projectCalendar, calendars as WorkCalendar[]);
  const minPerDay = effHoursPerDay(cal) * 60;
  if (minPerDay <= 0) return t.time.scheduleDuration;
  return Math.round((taskDurationMinutes(t, cal) / minPerDay) * 10) / 10;
}

/**
 * De bladnakomelingen (zonder hammocks) van een taak; een blad levert zichzelf. Iteratief en
 * cyclusvast — een corrupte `childIds`-kring mag de stack niet opblazen — en zonder spread, zodat
 * ook 200k bladen onder één verzameltaak binnen de argumentlimiet blijven. Met `cache` gememoiseerd
 * per taak-id (de rollup en het rapport vragen dezelfde deelboom meermaals op).
 */
export function descendantLeaves(
  root: Task,
  byId: ReadonlyMap<string, Task>,
  cache?: Map<string, Task[]>,
): Task[] {
  const cached = cache?.get(root.id);
  if (cached) return cached;
  let out: Task[];
  if (isLeafTask(root)) {
    out = root.isHammock ? [] : [root];
  } else {
    out = [];
    const seen = new Set<string>([root.id]);
    const stack: Task[] = [root];
    while (stack.length) {
      const t = stack.pop()!;
      for (let i = t.childIds.length - 1; i >= 0; i--) {
        const c = byId.get(t.childIds[i]);
        if (!c || seen.has(c.id)) continue;
        seen.add(c.id);
        if (isLeafTask(c)) { if (!c.isHammock) out.push(c); } else stack.push(c);
      }
    }
  }
  cache?.set(root.id, out);
  return out;
}

export interface SummaryProgress {
  /** 0..1, afgerond op 0,1 procentpunt (zoals het WBS-rapport altijd deed). */
  completion: number;
  status: TaskStatus;
}

/** De afgeleide voortgang en status over een set bladen. `workDaysOf` levert het gewicht. */
export function summaryProgressOf(leaves: readonly Task[], workDaysOf: (t: Task) => number): SummaryProgress {
  let weight = 0;
  let done = 0;
  let complete = 0;
  let started = 0;
  for (const l of leaves) {
    const d = workDaysOf(l);
    weight += d;
    done += d * Math.min(1, Math.max(0, l.time.completion));
    const state = progressState(l);
    if (state === 'complete') complete++;
    else if (state === 'inProgress') started++;
  }
  const status: TaskStatus = leaves.length > 0 && complete === leaves.length
    ? 'COMPLETED'
    : complete + started > 0 ? 'STARTED' : 'NOT_STARTED';
  const raw = status === 'COMPLETED'
    ? 1
    : weight > 0 ? done / weight : leaves.length > 0 ? complete / leaves.length : 0;
  return { completion: Math.round(raw * 1000) / 1000, status };
}

/**
 * Wordt de voortgang van deze verzameltaak afgeleid? Nee voor een HANDMATIG geplande verzameltaak:
 * die rolt in `applyCpmResult` ook haar datums niet op maar houdt haar opgeslagen waarden (MS
 * Project-conventie, `.mpp`-getrouwheid) — de voortgang volgt exact dezelfde uitzondering. De
 * tweede uitzondering, "datums zoals opgeslagen" (issue #63), is een documenttoestand en geen
 * taakeigenschap; die regelen `showRecordedDates` (herstel) en het WBS-rapport (`datesAsRecorded`).
 */
export function isSummaryProgressDerived(task: Task): boolean {
  return isSummaryTask(task) && !isManuallyScheduled(task);
}
