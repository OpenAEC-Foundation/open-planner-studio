import { ELAPSED_CLOCK, isInstant } from '@/engine/calendar/workdayRules';
import { isZeroDurationMilestone } from '@/engine/scheduler/duration';
import type { WorkCalendar } from '@/types/calendar';
import type { Task } from '@/types/task';
import { diffDays, parseInstant } from '@/utils/dateUtils';
import { shownFinish, shownStart } from '@/utils/taskDates';
import { momentLabel, taskDateLabel } from '@/utils/taskDateLabel';

/**
 * Kalenderdagen van een taak (issue #817, besluit eigenaar 2026-11-07): het aantal kalenderdagen van de
 * GETOONDE startdag tot en met de GETOONDE einddag, weekenden en feestdagen inbegrepen. Inclusief tellen:
 * start en einde op dezelfde dag geeft 1. Voorbeeld: ma 2-11-2026 t/m vr 13-11-2026 geeft 12.
 *
 * De dagen zijn de datumdelen van wat de kolommen Start en Einde tonen (`taskDateLabel`, regel B4): een
 * einde op de dagrand (ook 24:00 of een nachtploeg) hoort bij zijn werkdag, een moment midden op de dag bij
 * zijn klokdatum. Zonder kalender telt de kalendertijd-klok, dus een einde om 00:00 hoort bij de vorige dag.
 *
 * - Een nulduur-mijlpaal en elke taak waarvan het eindmoment niet na het startmoment ligt: 0. Zo'n taak
 *   is een moment en telt geen dag, ook als ze niet als mijlpaal gemarkeerd is (een taak met duur 0, een
 *   fase met alleen een mijlpaal). Besluit eigenaar 2026-11-07, na review PR #834: 0 naast "Duur 0d", niet 1.
 * - Een verzameltaak telt haar getoonde span; die volgt al uit de kinderen.
 * - Geen start of geen einde: `undefined` (de cel toont dan "—").
 *
 * Eén bron voor de takentabel en later de afdruk. Dit is alleen een telling: het duurtype Kalendertijd
 * (`ELAPSEDTIME`) verandert hoe een taak gerekend wordt, deze functie niet.
 */
export function taskCalendarDaySpan(task: Task, calendar?: WorkCalendar): number | undefined {
  const start = shownStart(task);
  const finish = shownFinish(task);
  if (!start || !finish) return undefined;
  if (isZeroDurationMilestone(task)) return 0;
  if (isInstant(start) && isInstant(finish)) {
    const startMs = parseInstant(start).getTime();
    const finishMs = parseInstant(finish).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(finishMs)) return undefined;
    if (finishMs <= startMs) return 0;
  }
  const startDay = shownDay(task, start, 'start', calendar);
  const finishDay = shownDay(task, finish, 'end', calendar);
  const days = diffDays(startDay, finishDay);
  if (!Number.isFinite(days)) return undefined;
  return Math.max(0, days + 1);
}

function shownDay(task: Task, value: string, side: 'start' | 'end', calendar?: WorkCalendar): string {
  const label = calendar ? taskDateLabel(task, value, side, calendar) : momentLabel(ELAPSED_CLOCK, value, side);
  return label.slice(0, 10);
}
