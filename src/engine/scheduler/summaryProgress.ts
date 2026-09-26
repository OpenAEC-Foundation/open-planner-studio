import type { Task, TaskStatus } from '@/types/task';
import type { WorkCalendar } from '@/types/calendar';
import { effHoursPerDay, effectiveCalendarOf, taskDurationMinutes } from '@/utils/taskDuration';
import { isLeafTask, isSummaryTask } from '@/utils/taskHierarchy';
import { isManuallyScheduled } from '@/utils/manualScheduling';
import { latestFinish } from '@/utils/taskDates';

/**
 * Voortgang, status en werkelijke datums van een VERZAMELTAAK (fase), afgeleid uit haar bladtaken
 * — één definitie.
 *
 * De verzameltaak-rollup (`applyCpmResult`) én het WBS-samenvattingsrapport (`reports/wbsSummary.ts`)
 * roepen deze module aan, zodat tabel, Gantt-tooltip, PDF, MCP en rapport dezelfde fasevoortgang
 * tonen in plaats van de opgeslagen `completion`/`status` van de fase.
 *
 * De regels:
 * - alleen BLADnakomelingen tellen (een tussenliggende subfase telt niet als eigen werk), zonder
 *   hammocks — een LOE-taak volgt anderen en is zelf geen werk (zelfde filter als de rapporten);
 * - voortgang = Σ(werkdagen × completion) / Σ(werkdagen), werkdagen op de eigen taakkalender;
 * - zonder gewicht (alleen mijlpalen): het aandeel voltooide bladen.
 * De status volgt de voortgangsstaat van de bladen (`progressState`): alle bladen voltooid ⇒
 * `COMPLETED` (en dan ook precies 100%), minstens één gestart of voltooid ⇒ `STARTED`, anders
 * `NOT_STARTED`.
 *
 * De werkelijke datums van een fase komen uit dezelfde bladen, in dezelfde lus:
 * - werkelijke start = de vroegste werkelijke start van de bladen, zodra er één een werkelijke
 *   start heeft;
 * - werkelijk einde = het laatste werkelijke einde, alleen als ALLE bladen voltooid zijn (status
 *   `COMPLETED`). Zolang er nog één blad loopt, heeft de fase geen werkelijk einde.
 * Zo klopt de invariant van een blad ook op de fase: 100% ⇔ een werkelijk einde.
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
  /** 0..1, afgerond op 0,1 procentpunt. */
  completion: number;
  status: TaskStatus;
  /** Vroegste werkelijke start van de bladen; afwezig zolang geen blad er een heeft. */
  actualStart?: string;
  /** Laatste werkelijke einde van de bladen; alleen als alle bladen voltooid zijn. */
  actualFinish?: string;
}

/** De afgeleide voortgang, status en werkelijke datums over een set bladen. `workDaysOf` levert
 *  het gewicht. */
export function summaryProgressOf(leaves: readonly Task[], workDaysOf: (t: Task) => number): SummaryProgress {
  let weight = 0;
  let done = 0;
  let complete = 0;
  let started = 0;
  let actualStart: string | undefined;
  let actualFinish: string | undefined;
  for (const l of leaves) {
    const d = workDaysOf(l);
    weight += d;
    done += d * Math.min(1, Math.max(0, l.time.completion));
    const state = progressState(l);
    if (state === 'complete') complete++;
    else if (state === 'inProgress') started++;
    // De start als tekst vergeleken: de waarden zijn ISO-datum(tijd)en (`JJJJ-MM-DD` of
    // `JJJJ-MM-DDTHH:mm`); een dagwaarde sorteert vóór een uurwaarde op dezelfde dag, wat voor een
    // start klopt.
    const as = l.time.actualStart;
    if (as && (actualStart === undefined || as < actualStart)) actualStart = as;
    // Het einde als tijdstip (`latestFinish`): een dagwaarde telt als einde van die dag, zodat
    // gemengde dag- en uurkalenders het juiste laatste einde geven.
    const af = l.time.actualFinish;
    if (af) actualFinish = actualFinish === undefined ? af : latestFinish([actualFinish, af]);
  }
  const status: TaskStatus = leaves.length > 0 && complete === leaves.length
    ? 'COMPLETED'
    : complete + started > 0 ? 'STARTED' : 'NOT_STARTED';
  const raw = status === 'COMPLETED'
    ? 1
    : weight > 0 ? done / weight : leaves.length > 0 ? complete / leaves.length : 0;
  const out: SummaryProgress = { completion: Math.round(raw * 1000) / 1000, status };
  if (actualStart !== undefined) out.actualStart = actualStart;
  if (status === 'COMPLETED' && actualFinish !== undefined) out.actualFinish = actualFinish;
  return out;
}

/**
 * Schrijf een fasevoortgang (afgeleid, of in "datums zoals opgeslagen" de bestandswaarde) op de
 * verzameltaak: voortgang, status en werkelijke datums samen, zodat ze nooit uit elkaar lopen. Een
 * ontbrekende werkelijke datum wist het veld; een ongewijzigd veld wordt niet aangeraakt (op een
 * Immer-draft blijft de taak dan hetzelfde object).
 */
export function writeSummaryProgress(task: Task, progress: SummaryProgress): void {
  const time = task.time;
  time.completion = progress.completion;
  task.status = progress.status;
  if (time.actualStart !== progress.actualStart) time.actualStart = progress.actualStart;
  if (time.actualFinish !== progress.actualFinish) time.actualFinish = progress.actualFinish;
}

/**
 * Wordt de voortgang (en daarmee de status en de werkelijke datums) van deze verzameltaak afgeleid?
 * Nee voor een HANDMATIG geplande verzameltaak: die rolt in `applyCpmResult` ook haar datums niet op
 * maar houdt haar opgeslagen waarden (MS Project-conventie, `.mpp`-getrouwheid) — de voortgang volgt
 * exact dezelfde uitzondering. De tweede uitzondering, "datums zoals opgeslagen", is
 * een documenttoestand en geen taakeigenschap; die regelen `showRecordedDates` (herstel) en het
 * WBS-rapport (`datesAsRecorded`).
 */
export function isSummaryProgressDerived(task: Task): boolean {
  return isSummaryTask(task) && !isManuallyScheduled(task);
}
