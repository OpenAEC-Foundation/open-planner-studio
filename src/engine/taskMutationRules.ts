import type { CustomFieldValue } from '@/types/structure';
import type { Task, TaskTime } from '@/types/task';
import { parseDate, parseInstant } from '@/utils/dateUtils';

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

/**
 * Werkelijk einde voor een taak op 100 % zonder `actualFinish`: de statusdatum, anders de EIGEN
 * geplande finish (berekend, anders gepland); de regel valt nooit terug op "vandaag" (H1,
 * `check-task-slice.ts`). Eén regel voor de store (`applyProgressInvariants`: grid, store-setters,
 * MCP-validatie) én voor elke lezer (`normalizeImportedProgress`: IFC/CSV/MSPDI/P6/MPP). Die tweede
 * kopie viel nog terug op vandaag, waardoor een bestand met 100 % zonder werkelijk einde bij elke
 * opening op de leesdatum voltooid werd en zijn opvolgers mee opschoof (import/export-audit,
 * bevinding 6; `tests/planning/check-import-progress-default.ts`). Bewust alleen de AF-default
 * gedeeld, niet de hele invariant: de import houdt zijn eigen STARTED-regel voor completion > 0
 * zonder actualStart (solver-vangnet §4.2 tak 2b).
 */
export function defaultActualFinish(
  time: Pick<TaskTime, 'earlyFinish' | 'scheduleFinish'>,
  statusDate: string | undefined,
): string {
  return statusDate || time.earlyFinish || time.scheduleFinish;
}

/**
 * Impliciete werkelijke start (§3.2, MSP-conventie "% invullen ⇒ gestart"): de eigen geplande start
 * (berekend, anders gepland). Eén regel voor de store-paden die voortgang zonder `actualStart` zetten
 * (`setTaskProgress`, de Tabel, MCP-validatie) én voor de lezers bij een VOLTOOIDE taak zonder
 * werkelijke start (`normalizeImportedProgress`). Zonder die gedeelde regel kreeg een ingelezen taak op
 * 100 % zonder actuals AS = AF en kromp de voltooide balk tot zijn laatste dag (import/export-audit,
 * vervolg op bevinding 6). Een LOPENDE taak zonder actualStart krijgt bij import bewust géén start
 * (solver-vangnet §4.2 tak 2b).
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
 * de tabel). Zonder deze klem gaf bv. 100% zetten met een statusdatum vóór de geplande start een
 * werkelijke start ná het werkelijke einde (= de statusdatum).
 *
 * "Het einde" is het al gezette `actualFinish`, of — staat de taak op 100% zonder einde — het einde
 * dat `applyProgressInvariants` daarna afleidt (`defaultActualFinish`). Roep dit dus aan NÁ het
 * vastleggen van `completion` en het wissen van een verouderd einde, en vóór de invarianten.
 * Vergelijken gaat met `isActualFinishBeforeStart` (instantprecisie): date-only waarden vallen op
 * UTC-middernacht, dus dagtaken vergelijken per dag en een uurtaak krijgt exact het einde-instant.
 *
 * Een aanwezige werkelijke start — door gebruiker of AI opgegeven, of eerder gezet — blijft altijd
 * ongemoeid; een ongeldig opgegeven paar hoort de aanroeper te weigeren, niet stil te klemmen.
 */
export function fillMissingActualStart(time: TaskTime, statusDate: string | undefined): void {
  if (time.actualStart) return;
  const start = defaultActualStart(time);
  const finish = time.actualFinish
    || (time.completion >= 1 ? defaultActualFinish(time, statusDate) : undefined);
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
    time.actualFinish = defaultActualFinish(time, statusDate);
    if (!time.actualStart) time.actualStart = time.actualFinish;
    task.status = 'COMPLETED';
  } else if (time.actualStart) {
    task.status = 'STARTED';
  } else {
    task.status = 'NOT_STARTED';
  }
  time.remainingTime = Math.round(time.scheduleDuration * (1 - time.completion));
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
