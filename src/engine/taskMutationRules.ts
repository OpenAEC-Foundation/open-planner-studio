import type { CustomFieldValue } from '@/types/structure';
import type { WorkCalendar } from '@/types/calendar';
import {
  blocksClock, dayEndInstant, dayStartInstant, ELAPSED_CLOCK, isDateOnly, workdayOfInstant,
  type InstantSide,
} from '@/engine/calendar/workdayRules';
import { isElapsedTask, isZeroDurationMilestone } from '@/engine/scheduler/duration';
import type { Task, TaskTime } from '@/types/task';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { orderActualsAfterDerivedFinish } from '@/engine/actualDatesOrder';
import { taskDurationUnit } from '@/engine/scheduler/duration';

/**
 * De statusregel (§4.2): zonder tijd telt de werkdag van de taakkalender; met tijd het moment.
 * Bij een nachtblok kan een feit op donderdag bij de statuswerkdag woensdag horen.
 */
export function isActualPastStatusDate(
  dateIso: string,
  statusDateIso: string,
  calendar?: WorkCalendar,
  side: InstantSide = 'start',
): boolean {
  if (!statusDateIso.includes('T')) {
    const day = workdayOfInstant(calendar ? blocksClock(calendar) : ELAPSED_CLOCK, dateIso, side);
    return parseDate(day).getTime() > parseDate(statusDateIso).getTime();
  }
  return parseInstant(dateIso).getTime() > parseInstant(statusDateIso).getTime();
}

/** D7: een nulduur-mijlpaal gebruikt voor beide actuals dezelfde kant. */
export function actualDateSide(task: Task, field: 'actualStart' | 'actualFinish'): InstantSide {
  return isZeroDurationMilestone(task)
    ? task.milestoneKind === 'FINISH' ? 'end' : 'start'
    : field === 'actualFinish' ? 'end' : 'start';
}

/** D1/D2/D4/D6 op de statuswerkdag in het urenpad. Letterlijke tijden blijven rauw (N0).
 *  Algemene invoernormalisatie, ook vóór de statusdag, hoort bij F2. */
export function normalizeActualDate(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  value: string | undefined,
  statusDate: string | undefined,
  calendar: WorkCalendar | undefined,
): string | undefined {
  if (!value || !isDateOnly(value) || !statusDate || !calendar
    || (!calendar.workTime && taskDurationUnit(task) !== 'hours')) return value;
  const clock = isElapsedTask(task) ? ELAPSED_CLOCK : blocksClock(calendar);
  const statusDay = statusDate.includes('T') ? workdayOfInstant(clock, statusDate, 'start') : statusDate;
  if (value !== statusDay) return value;
  const side = actualDateSide(task, field);
  const moment = (side === 'end' ? dayEndInstant(clock, value) : dayStartInstant(clock, value)) ?? value;
  // Alleen een datumloze invoer op de statuswerkdag mag tot het expliciete statusmoment klemmen.
  if (statusDate?.includes('T') && value === workdayOfInstant(clock, statusDate, 'start')
    && parseInstant(moment) > parseInstant(statusDate)) return statusDate;
  return moment;
}

/**
 * Werkelijk einde voor een taak op 100 % zonder `actualFinish`: de statusdatum, anders de EIGEN
 * geplande finish (berekend, anders gepland); de regel valt nooit terug op "vandaag"
 * (`check-task-slice.ts`). Eén regel voor de store (`applyProgressInvariants`: grid, store-setters,
 * MCP-validatie) én voor elke lezer (`normalizeImportedProgress`: IFC/CSV/MSPDI/P6/MPP). Een
 * terugval op vandaag zou een bestand met 100 % zonder werkelijk einde bij elke opening op de
 * leesdatum voltooien en zijn opvolgers mee laten opschuiven
 * (`tests/planning/check-import-progress-default.ts`). Bewust alleen de AF-default gedeeld, niet de
 * hele invariant: de import houdt zijn eigen STARTED-regel voor completion > 0 zonder actualStart
 * (het solver-vangnet).
 */
export function defaultActualFinish(
  time: Pick<TaskTime, 'earlyFinish' | 'scheduleFinish'>,
  statusDate: string | undefined,
): string {
  return statusDate || time.earlyFinish || time.scheduleFinish;
}

/**
 * Impliciete werkelijke start (MSP-conventie "% invullen ⇒ gestart"): de eigen geplande start
 * (berekend, anders gepland). Eén regel voor de store-paden die voortgang zonder `actualStart` zetten
 * (`setTaskProgress`, de Tabel, MCP-validatie) én voor de lezers bij een VOLTOOIDE taak zonder
 * werkelijke start (`normalizeImportedProgress`). Zonder die gedeelde regel krijgt een ingelezen taak op
 * 100 % zonder actuals AS = AF en krimpt de voltooide balk tot zijn laatste dag. Een LOPENDE taak
 * zonder actualStart krijgt bij import bewust géén start (het solver-vangnet).
 */
export function defaultActualStart(time: Pick<TaskTime, 'earlyStart' | 'scheduleStart'>): string {
  return time.earlyStart || time.scheduleStart;
}

/** Werkelijk einde vóór werkelijke start? Op instantprecisie (`parseInstant`), niet als ruwe
 *  string: een date-only waarde en een datetime op dezelfde dag vergelijken anders verkeerd. */
export function isActualFinishBeforeStart(time: Pick<TaskTime, 'actualStart' | 'actualFinish'>): boolean {
  return !!time.actualStart && !!time.actualFinish
    && parseInstant(time.actualFinish).getTime() < parseInstant(time.actualStart).getTime();
}

/**
 * Vult een ONTBREKENDE werkelijke start automatisch in met de getoonde start (`earlyStart`, anders
 * `scheduleStart` — dezelfde keuze als `shownStart`), maar nooit later dan het werkelijke einde:
 * ligt die start ná het einde, dan wordt de werkelijke start gelijk aan het einde. Dat is dezelfde
 * uitkomst als `applyProgressInvariants` bij een opgegeven einde zonder start (het enkele-celpad in
 * de tabel). Zonder deze klem geeft bv. 100% zetten met een statusdatum vóór de geplande start een
 * werkelijke start ná het werkelijke einde (= de statusdatum).
 *
 * "Het einde" is het al gezette `actualFinish`, of — staat de taak op 100% zonder einde — het einde
 * dat `applyProgressInvariants` daarna afleidt (`defaultActualFinish`). Roep dit dus aan NÁ het
 * vastleggen van `completion` en het wissen van een verouderd einde, en vóór de invarianten.
 * Eerst D1/D6 op de afgeleide datums, dan vergelijken met `isActualFinishBeforeStart`
 * (instantprecisie). Zo blijft een start om 10:00 vóór een afgeleid einde om 16:00.
 *
 * Een aanwezige werkelijke start — door gebruiker of AI opgegeven, of eerder gezet — blijft altijd
 * ongemoeid; een ongeldig opgegeven paar hoort de aanroeper te weigeren, niet stil te klemmen.
 */
export function fillMissingActualStart(task: Task, statusDate: string | undefined, calendar?: WorkCalendar): void {
  const time = task.time;
  if (time.actualStart) return;
  const start = normalizeActualDate(task, 'actualStart', defaultActualStart(time), statusDate, calendar)!;
  const finish = time.actualFinish
    || (time.completion >= 1
      ? normalizeActualDate(task, 'actualFinish', defaultActualFinish(time, statusDate), statusDate, calendar)
      : undefined);
  time.actualStart = finish && isActualFinishBeforeStart({ actualStart: start, actualFinish: finish })
    ? finish
    : start;
}

/** Een nieuw voltooiingspercentage (0..1) zetten volgens de MSP-conventie: < 1 ⇒ een verouderd
 *  werkelijk einde vervalt, > 0 zonder werkelijke start ⇒ die afleiden (% ⇒ gestart, via
 *  `fillMissingActualStart`, dus nooit ná het werkelijke einde). In die volgorde: de klem moet het
 *  einde zien dat na deze bewerking overblijft. Daarna hoort de aanroeper `applyProgressInvariants`
 *  te draaien, met dezelfde `statusDate`. */
export function applyCompletionEdit(task: Task, completion: number, statusDate: string | undefined, calendar?: WorkCalendar): void {
  const time = task.time;
  time.completion = completion;
  if (completion < 1) time.actualFinish = undefined;
  if (completion > 0) fillMissingActualStart(task, statusDate, calendar);
}

/** Een werkelijke start of einde zetten (`undefined` = wissen) en daarna de voortgangsinvarianten
 *  draaien — de gedeelde kern van `setActualStart`/`setActualFinish` (paneel) en de velden in
 *  "Taak bewerken". Het einde wissen terwijl de taak op 100% stond ⇒ terug naar in-uitvoering
 *  (anders zet de invariant meteen een nieuw einde en is wissen onmogelijk). Een datum ná de
 *  statusdatum weigeren (`isActualPastStatusDate`) doet de aanroeper, vóór deze aanroep. */
export function applyActualDateEdit(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  date: string | undefined,
  statusDate: string | undefined,
  calendar?: WorkCalendar,
): void {
  task.time[field] = date || undefined;
  if (field === 'actualFinish' && !date && task.time.completion >= 1) task.time.completion = 0;
  applyProgressInvariants(task, statusDate, calendar);
}

/** Centrale voortgangsinvarianten, gedeeld door grid, store-setters en MCP-validatie. */
export function applyProgressInvariants(task: Task, statusDate: string | undefined, calendar?: WorkCalendar): void {
  const time = task.time;
  if (time.actualFinish) {
    time.completion = 1;
    if (!time.actualStart) time.actualStart = time.actualFinish;
    task.status = 'COMPLETED';
  } else if (time.completion >= 1) {
    // Eerst D6, dan pas de volgorde: een vastgelegde start om 10:00 blijft vóór het einde om 16:00.
    time.actualFinish = normalizeActualDate(task, 'actualFinish', defaultActualFinish(time, statusDate), statusDate, calendar);
    const startWasDerived = !time.actualStart;
    if (startWasDerived) time.actualStart = time.actualFinish;
    // Een aanwezige start blijft staan; alleen het afgeleide einde mag dan opschuiven.
    orderActualsAfterDerivedFinish(time, statusDate, startWasDerived);
    task.status = 'COMPLETED';
  } else if (time.actualStart) {
    task.status = 'STARTED';
  } else {
    task.status = 'NOT_STARTED';
  }
  applyRemainingDuration(task);
}

/**
 * Restduur afgeleid uit `completion`, in dezelfde eenheid en vorm als de duur van de taak:
 *  - dagtaak: `remainingTime` in hele werkdagen, zoals `scheduleDuration`;
 *  - urentaak: `remainingMinutes` in hele minuten, zoals `durationMinutes`, met `remainingTime` als
 *    ONafgeronde werkdagfractie, zoals `scheduleDuration` ({@link hourRemainingDays}). Nooit
 *    `Math.round` op hele dagen voor een urentaak: 5 u op 40 % zou dan restduur 0 geven.
 * Eén regel voor de store (`applyProgressInvariants`) en de lezers (`normalizeImportedProgress`).
 * `keepRecordedMinutes` (alleen de lezers): een uit het bestand gelezen `remainingMinutes` blijft
 * staan — MSP's eigen exacte restduur bij een afgeronde voortgang; de werkdagfractie volgt dan
 * die minuten.
 */
export function applyRemainingDuration(task: Task, keepRecordedMinutes = false): void {
  const time = task.time;
  if (taskDurationUnit(task) !== 'hours') {
    time.remainingTime = Math.round(time.scheduleDuration * (1 - time.completion));
    return;
  }
  const minutes = keepRecordedMinutes && time.remainingMinutes != null
    ? time.remainingMinutes
    : Math.round((time.durationMinutes ?? 0) * (1 - time.completion));
  time.remainingMinutes = minutes;
  time.remainingTime = hourRemainingDays(time, minutes);
}

/**
 * Werkdagfractie bij `minutes` restduur van een urentaak, in de vorm van haar `scheduleDuration`
 * (minuten ÷ (uren per dag × 60)). De factor komt uit de duur zelf (`scheduleDuration` ÷
 * `durationMinutes`), zodat store en lezers hier geen kalender voor nodig hebben; eerst
 * vermenigvuldigen houdt de uitkomst vrij van deelruis (6 × 1728 / 2880 = 3,6, niet 3,5999…).
 */
export function hourRemainingDays(time: Pick<TaskTime, 'scheduleDuration' | 'durationMinutes'>, minutes: number): number {
  const totalMinutes = time.durationMinutes ?? 0;
  return totalMinutes > 0 ? (time.scheduleDuration * minutes) / totalMinutes : 0;
}

/** Verliesloze toewijzing op een taak of geïsoleerde taakdraft. */
export function assignTaskActivityCode(
  task: Task,
  typeId: string,
  valueId: string | undefined,
): void {
  if (valueId === undefined) {
    if (task.activityCodes) delete task.activityCodes[typeId];
  } else {
    task.activityCodes = { ...(task.activityCodes ?? {}), [typeId]: valueId };
  }
}

/** Verliesloze toewijzing op een taak of geïsoleerde taakdraft. */
export function assignTaskCustomField(
  task: Task,
  defId: string,
  value: CustomFieldValue | undefined,
): void {
  if (value === undefined) {
    if (task.customFields) delete task.customFields[defId];
  } else {
    task.customFields = { ...(task.customFields ?? {}), [defId]: value };
  }
}
