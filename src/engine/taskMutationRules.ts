import type { CustomFieldValue } from '@/types/structure';
import type { Task, TaskTime } from '@/types/task';
import { parseDate, parseInstant } from '@/utils/dateUtils';
import { orderActualsAfterDerivedFinish } from '@/engine/actualDatesOrder';
import { taskDurationUnit } from '@/engine/scheduler/duration';
import { taskWorkMinutes } from '@/engine/contour/contourEngine';

/**
 * Vergelijkt een actual met de statusdatum op dezelfde precisie als de bestaande taaksetters.
 * Een statusdatum zonder tijd staat de hele kalenderdag toe; mét tijd geldt instantprecisie.
 */
export function isActualPastStatusDate(dateIso: string, statusDateIso: string): boolean {
  if (!statusDateIso.includes('T')) {
    return parseDate(dateIso).getTime() > parseDate(statusDateIso).getTime();
  }
  return parseInstant(dateIso).getTime() > parseInstant(statusDateIso).getTime();
}

/** Werkelijk einde vóór werkelijke start? Op instantprecisie (`parseInstant`), niet als ruwe
 *  string: een date-only waarde en een datetime op dezelfde dag vergelijken anders verkeerd. */
export function isActualFinishBeforeStart(time: Pick<TaskTime, 'actualStart' | 'actualFinish'>): boolean {
  return !!time.actualStart && !!time.actualFinish
    && parseInstant(time.actualFinish).getTime() < parseInstant(time.actualStart).getTime();
}

/** Het werkelijke einde dat `applyProgressInvariants` afleidt voor een 100%-taak zonder opgegeven
 *  einde: de statusdatum, anders de eigen geplande finish (nooit "vandaag", zie check-task-slice.ts).
 *  Eén bron, zodat `fillMissingActualStart` precies het einde voorspelt dat de invariant straks zet. */
function derivedActualFinish(time: TaskTime, statusDate: string | undefined): string {
  return statusDate || time.earlyFinish || time.scheduleFinish;
}

/**
 * Vult een ONTBREKENDE werkelijke start automatisch in met de getoonde start (`earlyStart`, anders
 * `scheduleStart` — dezelfde keuze als `shownStart`), maar nooit later dan het werkelijke einde:
 * ligt die start ná het einde, dan wordt de werkelijke start gelijk aan het einde. Dat is dezelfde
 * uitkomst als `applyProgressInvariants` bij een opgegeven einde zonder start (het enkele-celpad in
 * de tabel). Zonder deze klem gaf bv. 100% zetten met een statusdatum vóór de geplande start een
 * werkelijke start ná het werkelijke einde (= de statusdatum).
 *
 * "Het einde" is het al gezette `actualFinish`, of — staat de taak op 100% zonder einde — het einde
 * dat `applyProgressInvariants` daarna afleidt (`derivedActualFinish`). Roep dit dus aan NÁ het
 * vastleggen van `completion` en het wissen van een verouderd einde, en vóór de invarianten.
 * Vergelijken gaat met `isActualFinishBeforeStart` (instantprecisie): date-only waarden vallen op
 * UTC-middernacht, dus dagtaken vergelijken per dag en een uurtaak krijgt exact het einde-instant.
 *
 * Een aanwezige werkelijke start — door gebruiker of AI opgegeven, of eerder gezet — blijft altijd
 * ongemoeid; een ongeldig opgegeven paar hoort de aanroeper te weigeren, niet stil te klemmen.
 */
export function fillMissingActualStart(time: TaskTime, statusDate: string | undefined): void {
  if (time.actualStart) return;
  const start = time.earlyStart || time.scheduleStart;
  const finish = time.actualFinish
    || (time.completion >= 1 ? derivedActualFinish(time, statusDate) : undefined);
  time.actualStart = finish && isActualFinishBeforeStart({ actualStart: start, actualFinish: finish })
    ? finish
    : start;
}

/** Een nieuw voltooiingspercentage (0..1) zetten volgens de MSP-conventie: < 1 ⇒ een verouderd
 *  werkelijk einde vervalt, > 0 zonder werkelijke start ⇒ die afleiden (% ⇒ gestart, via
 *  `fillMissingActualStart`, dus nooit ná het werkelijke einde). In die volgorde: de klem moet het
 *  einde zien dat na deze bewerking overblijft. Daarna hoort de aanroeper `applyProgressInvariants`
 *  te draaien, met dezelfde `statusDate`. */
export function applyCompletionEdit(time: TaskTime, completion: number, statusDate: string | undefined): void {
  time.completion = completion;
  if (completion < 1) time.actualFinish = undefined;
  if (completion > 0) fillMissingActualStart(time, statusDate);
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
): void {
  task.time[field] = date || undefined;
  if (field === 'actualFinish' && !date && task.time.completion >= 1) task.time.completion = 0;
  applyProgressInvariants(task, statusDate);
}

/** Centrale voortgangsinvarianten, gedeeld door grid, store-setters en MCP-validatie. */
export function applyProgressInvariants(task: Task, statusDate: string | undefined): void {
  const time = task.time;
  if (time.actualFinish) {
    time.completion = 1;
    if (!time.actualStart) time.actualStart = time.actualFinish;
    task.status = 'COMPLETED';
  } else if (time.completion >= 1) {
    time.actualFinish = derivedActualFinish(time, statusDate);
    if (!time.actualStart) time.actualStart = time.actualFinish;
    // Afgeleid einde vóór een (vaak zelf afgeleide) start: zelfde regel als de lezers.
    orderActualsAfterDerivedFinish(time, statusDate);
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
 *    ONafgeronde werkdagfractie, zoals `scheduleDuration` ({@link hourRemainingDays}). Vroeger kreeg
 *    ook een urentaak `Math.round` op hele dagen: 5 u op 40 % gaf restduur 0, zonder minuten, en
 *    MSPDI/P6 exporteerden die 0.
 * Eén regel voor de store (`applyProgressInvariants`) en de lezers (`normalizeImportedProgress`).
 * `keepRecordedMinutes` (alleen de lezers): een uit het bestand gelezen `remainingMinutes` blijft
 * staan — MSP's eigen exacte restduur bij een afgeronde voortgang (T9); de werkdagfractie volgt dan
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

/**
 * Wat een DUURWIJZIGING met de voortgang van een lopende taak doet — besluit eigenaar, "zoals MS
 * Project": het gedane werk (de werkelijke duur) blijft gelijk, de restduur wordt nieuwe duur − gedane
 * werk en het percentage past zich aan (10 d op 40 % → 12 d ⇒ nog 8 d, 33 %). Vóór dit besluit lag de
 * restduur sinds G4 vast bij de voortgangsinvoer, zodat een duurwijziging het einde van een lopende
 * taak niet verschoof.
 *
 * - LOPEND: gestart (werkelijke start of voortgang > 0 %) en nog niet voltooid. Ook een gestarte taak
 *   op 0 % telt mee: haar gedane werk is 0, dus haar restduur volgt gewoon de nieuwe duur.
 * - Alleen als de bewerking de voortgang zelf NIET wijzigt: geeft dezelfde bewerking ook een nieuw
 *   percentage of een nieuwe restduur op ("Taak bewerken" met duur én voortgang, een geplakte rij),
 *   dan wint die opgave.
 * - EXACT, zonder afrondingsdrift: de restduur wordt in de eigen eenheid van de taak verschoven met
 *   precies het duurverschil (dagtaak: `remainingTime` in werkdagen; urentaak: `remainingMinutes` in
 *   minuten, met de werkdagfractie van `hourRemainingDays`). Voor een restduur die volgens de gewone
 *   regel (`applyRemainingDuration`) uit het percentage kwam, is dat hetzelfde als die regel toepassen
 *   op het nieuwe percentage; een uit een bestand gelezen restduur (T9) blijft zo ook exact.
 *   Het percentage wordt NIET afgerond: `completion` = oud percentage × oude duur ÷ nieuwe duur, zodat
 *   percentage × duur (het gedane werk) gelijk blijft; de weergave rondt pas af. (De IFC-schrijver
 *   bewaart het percentage daarom verliesvrij, zie `ifcTaskSlots.ts`.)
 * - Een eenheidswissel (dagen ↔ uren) rekent via de werkminuten: het gedane werk blijft gelijk en de
 *   restduur volgt de gewone regel in de nieuwe eenheid.
 * - Nieuwe duur KORTER dan het gedane werk: geweigerd (`refused`), niets geraden. Precies gelijk ⇒
 *   100 %: de aanroeper laat de voortgangsinvarianten dan het werkelijke einde afleiden.
 *
 * `null` = de regel is niet van toepassing (geen lopende taak, geen duurwijziging, of de bewerking
 * gaf zelf voortgang op). `hoursPerDay` zoals de aanroeper de werkduur meet (`taskWorkMinutes`).
 */
export type RunningDurationChange =
  | { refused: true; done: number; unit: 'days' | 'hours' }
  | { refused: false; completion: number; remainingTime: number; remainingMinutes?: number };

export function runningDurationChange(before: TaskTime, after: TaskTime, hoursPerDay: number): RunningDurationChange | null {
  const running = (before.completion > 0 || !!before.actualStart) && before.completion < 1 && !before.actualFinish;
  if (!running) return null;
  const progressTouched = after.completion !== before.completion
    || after.remainingTime !== before.remainingTime || after.remainingMinutes !== before.remainingMinutes
    || after.actualStart !== before.actualStart || after.actualFinish !== before.actualFinish;
  if (progressTouched) return null;
  const unitBefore = timeDurationUnit(before);
  const unitAfter = timeDurationUnit(after);
  const oldWork = taskWorkMinutes(before, hoursPerDay);
  const newWork = taskWorkMinutes(after, hoursPerDay);
  if (unitBefore === unitAfter && Math.abs(newWork - oldWork) < 1e-9) return null;
  const c = before.completion;
  const doneDays = c * before.scheduleDuration;
  const doneMinutes = c * (before.durationMinutes ?? 0);
  const refusal: RunningDurationChange = unitBefore === 'hours'
    ? { refused: true, done: doneMinutes / 60, unit: 'hours' }
    : { refused: true, done: doneDays, unit: 'days' };
  if (newWork < c * oldWork - 1e-6) return refusal;
  const cap = (value: number) => (value >= 1 - 1e-12 ? 1 : value);

  if (unitBefore === 'days' && unitAfter === 'days') {
    const remaining = (before.remainingTime ?? Math.round(before.scheduleDuration * (1 - c)))
      + (after.scheduleDuration - before.scheduleDuration);
    if (remaining < 0) return refusal;
    const completion = after.scheduleDuration > 0 ? cap(doneDays / after.scheduleDuration) : c;
    return { refused: false, completion, remainingTime: remaining };
  }
  if (unitBefore === 'hours' && unitAfter === 'hours') {
    const oldMinutes = before.durationMinutes ?? 0;
    const newMinutes = after.durationMinutes ?? 0;
    const remainingMinutes = (before.remainingMinutes ?? Math.round(oldMinutes * (1 - c))) + (newMinutes - oldMinutes);
    if (remainingMinutes < 0) return refusal;
    const completion = newMinutes > 0 ? cap(doneMinutes / newMinutes) : c;
    return { refused: false, completion, remainingMinutes, remainingTime: hourRemainingDays(after, remainingMinutes) };
  }
  // Eenheidswissel: via de werkminuten; de restduur volgt de gewone regel in de nieuwe eenheid.
  const completion = newWork > 0 ? cap((c * oldWork) / newWork) : c;
  if (unitAfter === 'hours') {
    const remainingMinutes = Math.round((after.durationMinutes ?? 0) * (1 - completion));
    return { refused: false, completion, remainingMinutes, remainingTime: hourRemainingDays(after, remainingMinutes) };
  }
  return { refused: false, completion, remainingTime: Math.round(after.scheduleDuration * (1 - completion)) };
}

/**
 * Past {@link runningDurationChange} toe op `task` (muteert), ná de duurmutatie, met de tijd van
 * vóór de bewerking. Bereikt het gedane werk precies de nieuwe duur, dan is de taak voltooid en
 * leiden de voortgangsinvarianten het werkelijke einde af (`statusDate`). De weigering hoort de
 * aanroeper vóór de mutatie al te hebben afgehandeld; hier doet `refused` niets.
 * Retourneert de toegepaste uitkomst (voor de AI-koppeling, die de nieuwe restduur en het nieuwe
 * percentage terugmeldt), of `null`.
 */
export function applyRunningDurationChange(
  task: Task,
  before: TaskTime,
  hoursPerDay: number,
  statusDate: string | undefined,
): Extract<RunningDurationChange, { refused: false }> | null {
  const change = runningDurationChange(before, task.time, hoursPerDay);
  if (!change || change.refused) return null;
  task.time.completion = change.completion;
  task.time.remainingTime = change.remainingTime;
  if (change.remainingMinutes !== undefined) task.time.remainingMinutes = change.remainingMinutes;
  else delete task.time.remainingMinutes;
  if (change.completion >= 1) applyProgressInvariants(task, statusDate);
  return change;
}

function timeDurationUnit(time: TaskTime): 'days' | 'hours' {
  return taskDurationUnit({ time } as Task);
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
