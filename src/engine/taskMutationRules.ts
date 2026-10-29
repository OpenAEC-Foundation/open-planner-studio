import type { CustomFieldValue } from '@/types/structure';
import type { WorkCalendar } from '@/types/calendar';
import {
  blocksClock, dayEndInstant, dayStartInstant, ELAPSED_CLOCK, isDateOnly, isInstant, workdayOfInstant,
  type InstantSide,
} from '@/engine/calendar/workdayRules';
import { isElapsedTask, isZeroDurationMilestone } from '@/engine/scheduler/duration';
import type { Task, TaskTime } from '@/types/task';
import { formatDate, formatInstant, parseDate, parseInstant } from '@/utils/dateUtils';
import { taskDateLabel } from '@/utils/taskDateLabel';
import { shownStart } from '@/utils/taskDates';
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

/** De kant van een werkelijke datum: bij een taak die van het veld (start begin, einde eind). Een
 *  nulduur-mijlpaal heeft één moment voor beide actuals en dus één kant: de eindkant bij een
 *  FINISH-mijlpaal, anders de startkant (D7). Dezelfde kant als de tabel (`taskDateLabel`) en de
 *  statusregel (`isActualPastStatusDate`). */
export function actualDateSide(task: Task, field: 'actualStart' | 'actualFinish'): InstantSide {
  return isZeroDurationMilestone(task)
    ? task.milestoneKind === 'FINISH' ? 'end' : 'start'
    : field === 'actualFinish' ? 'end' : 'start';
}

/**
 * Een afgemelde mijlpaal houdt de klokketijd uit de planning. Besluit van Ethan, 2026-10-29 (vloot-wiki,
 * `besluiten/2026-10-29 afgemelde mijlpaal houdt de geplande tijd.md`): "Meld je een mijlpaal af met alleen
 * een datum, dan houdt hij de klokketijd die hij in de planning had. De dag komt van wat je typt, de tijd
 * uit de planning. Typ je zelf een tijd, dan geldt die." Het vervangt D7 (spec §4.2) voor afmelden, in
 * elk profiel en voor elke soort mijlpaal. Voorbeeld: "Oplevering" staat op ma 1 jun 16:00; 3-6-2026
 * wordt wo 3 jun 16:00.
 *
 * "De planning" is het moment dat de mijlpaal nu toont: {@link shownStart}. Voor een mijlpaal die nog
 * niet is afgemeld is dat de berekende `earlyStart` (vóór de eerste berekening het anker
 * `scheduleStart`); is hij al afgemeld, dan zijn werkelijke datum. Niet `scheduleStart` alleen: dat is
 * het ingevoerde anker en niet de uitkomst van de logica (een mijlpaal na een taak van 3 u staat om
 * 10:00, zijn anker om 07:00). Voor een mijlpaal zijn begin en einde hetzelfde moment, dus één veld
 * voor beide actuals.
 *
 * "De dag" is de dag die de tabel bij dat moment toont (B4, `taskDateLabel`); de tijd is de afstand tot
 * middernacht van die dag. Op een gewone kalender is dat de kloktijd (ma 16:00 geeft 16:00). Alleen bij
 * een blokeinde na middernacht wijkt het af: een FINISH-mijlpaal om di 00:00 (24:00-regel) toont "ma";
 * wie dan "wo" typt, krijgt do 00:00, en de tabel toont weer "wo".
 *
 * `null`: de mijlpaal heeft geen moment met tijd in de planning (geen berekening en een anker zonder
 * tijd); dan geldt D7.
 */
function plannedMilestoneActual(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  date: string,
  calendar: WorkCalendar,
): string | null {
  const planned = shownStart(task);
  if (!planned || !isInstant(planned)) return null;
  const at = parseInstant(planned).getTime();
  const typedDay = parseDate(date).getTime();
  if (Number.isNaN(at) || Number.isNaN(typedDay)) return null;
  const label = taskDateLabel(task, planned, actualDateSide(task, field), calendar);
  const plannedDay = parseDate(isDateOnly(label) ? label : formatDate(new Date(at))).getTime();
  return formatInstant(new Date(typedDay + (at - plannedDay)), 'hour');
}

function normalizeActualDateWith(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  value: string | undefined,
  statusDate: string | undefined,
  calendar: WorkCalendar | undefined,
  plannedClock: boolean,
): string | undefined {
  // F2 normaliseert elke kalenderdatum vóór validatie en waardevergelijking (D1/D2/D7),
  // ook buiten de statusdag en op een scalaire kalender.
  if (!value || !isDateOnly(value) || !calendar) return value;
  const clock = isElapsedTask(task) ? ELAPSED_CLOCK : blocksClock(calendar);
  const side = actualDateSide(task, field);
  const planned = plannedClock && isZeroDurationMilestone(task)
    ? plannedMilestoneActual(task, field, value, calendar)
    : null;
  const moment = planned ?? (side === 'end' ? dayEndInstant(clock, value) : dayStartInstant(clock, value)) ?? value;
  // Alleen een datumloze invoer op de statuswerkdag mag tot het expliciete statusmoment klemmen.
  if (statusDate?.includes('T') && value === workdayOfInstant(clock, statusDate, 'start')
    && parseInstant(moment) > parseInstant(statusDate)) return statusDate;
  return moment;
}

/**
 * Een ingevoerde werkelijke datum vóór validatie en vergelijking, op elke kalender: D1/D2/D4/D6, en bij
 * een nulduur-mijlpaal de klokketijd uit de planning ({@link plannedMilestoneActual}, besluit
 * 2026-10-29; zonder bruikbaar gepland moment D7). Letterlijke tijden blijven rauw (N0). Elke
 * invoerroute gebruikt deze functie: tabel en plakken, voortgangsimport, eigenschappenpaneel,
 * contextmenu, Taak bewerken en MCP, en de afgeleide datums bij 100 % (`applyProgressInvariants`).
 * `task` is de taak zoals ze vóór deze invoer staat: haar getoonde moment is "de planning".
 */
export function normalizeActualDate(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  value: string | undefined,
  statusDate: string | undefined,
  calendar: WorkCalendar | undefined,
): string | undefined {
  return normalizeActualDateWith(task, field, value, statusDate, calendar, true);
}

/** De laadgrens (`normalizeImportedProgress`): D1/D2/D4/D6/D7 zoals in spec §4.2. Het besluit van
 *  2026-10-29 geldt daar niet; een bestand bepaalt zelf zijn tijden. */
export function normalizeLoadedActualDate(
  task: Task,
  field: 'actualStart' | 'actualFinish',
  value: string | undefined,
  statusDate: string | undefined,
  calendar: WorkCalendar | undefined,
): string | undefined {
  return normalizeActualDateWith(task, field, value, statusDate, calendar, false);
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
    const finish = time.actualFinish!;
    if (!startWasDerived && isDateOnly(finish)) {
      // Zonder kalender blijft het afgeleide einde een datum; de store zet hem bij het schrijven om
      // (D2/D6, `normalizeTaskDates`). Zo'n datum is de hele werkdag. Als 00:00 gelezen lag hij vóór
      // een start om 07:00 op dezelfde dag, en werd het einde die start. Vergelijk daarom op dagniveau.
      if (time.actualStart!.slice(0, 10) > finish) time.actualFinish = time.actualStart;
    } else {
      // Een aanwezige start blijft staan; alleen het afgeleide einde mag dan opschuiven.
      orderActualsAfterDerivedFinish(time, statusDate, startWasDerived);
    }
    task.status = 'COMPLETED';
  } else if (time.actualStart) {
    task.status = 'STARTED';
  } else {
    task.status = 'NOT_STARTED';
  }
  applyRemainingDuration(task);
}

/**
 * Restduur afgeleid uit `completion`, in dezelfde maat en vorm als de duur van de taak. Exact, in elke
 * maat (spec "alleen uren" §3.5, besluit B3): nooit `Math.round` op hele werkdagen.
 *  - dagenmaat: `remainingTime` in werkdagen, een breuk mag (5 d op 32 % ⇒ 3,4 d). Alleen de ruis van
 *    de drijvende komma gaat eraf ({@link exactWorkdays}): 4 × (1 − 0,9) is anders 0,3999…;
 *  - urenmaat: `remainingMinutes` in hele minuten, zoals `durationMinutes`, met `remainingTime` als
 *    ONafgeronde werkdagfractie, zoals `scheduleDuration` ({@link hourRemainingDays}).
 * Eén regel voor de store (`applyProgressInvariants`) en de lezers (`normalizeImportedProgress`).
 * `keepRecordedRest` (alleen de lezers): de restduur die het bestand van een LOPENDE taak vastlegt,
 * blijft staan: `remainingMinutes` van een urentaak (de werkdagfractie volgt die minuten) en
 * `remainingTime` van een dagtaak. De regel leidt alleen af als de bron geen rest draagt. Het
 * percentage is in de bron vaak afgerond (MSP 33 % bij 4 van 6 d) of staat los van de rest (P6
 * fysiek %), dus de afleiding zou de rest verzetten. Een voltooide taak krijgt altijd rest 0, ook als
 * het bestand nog een rest noemt. Een voortgangsbewerking in de app (store) geeft de vlag niet mee en
 * leidt de rest dus af (B3).
 */
export function applyRemainingDuration(task: Task, keepRecordedRest = false): void {
  const time = task.time;
  const keep = keepRecordedRest && time.completion < 1;
  if (taskDurationUnit(task) !== 'hours') {
    const recorded = time.remainingTime;
    if (keep && recorded != null && Number.isFinite(recorded)) return;
    time.remainingTime = exactWorkdays(time.scheduleDuration * (1 - time.completion));
    return;
  }
  const minutes = keep && time.remainingMinutes != null
    ? time.remainingMinutes
    : Math.round((time.durationMinutes ?? 0) * (1 - time.completion));
  time.remainingMinutes = minutes;
  time.remainingTime = hourRemainingDays(time, minutes);
}

/**
 * Een aantal werkdagen zonder de ruis van de drijvende komma: 15 significante cijfers. Een echte breuk
 * (3,4 of 2,5) blijft staan; 0,3999999999999999 wordt 0,4. Zo geeft 10 % van 4 d bij inzet 7 precies
 * 0,4 × 7 × 480 = 1344 werkminuten.
 */
export function exactWorkdays(days: number): number {
  return Number.isFinite(days) ? Number(days.toPrecision(15)) : days;
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
