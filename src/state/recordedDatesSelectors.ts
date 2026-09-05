import type { RecordedDatesState, RecordedTime } from '@/engine/scheduler/recordedDates';
import type { Task } from '@/types/task';
import type { RecordedTaskAxis, RecordedTaskMark } from '@/types/taskGrid';

/**
 * "Datums zoals opgeslagen" (issue #63, XER-etappeplan laag 3 §3.6) — de PURE afgeleide over
 * bestaande documentstate (`recordedDates`/`datesAsRecorded`), gedeeld door de taaktabel-kolom
 * (`taskColumnRegistry.ts`, via `TaskColumnContext.recordedMark`/`recordedUnrecordedAxes`) en het
 * eigenschappenpaneel (`TaskRecordedDatesNotice.tsx`). Bladmodule: importeert alleen types, geen
 * nieuw `Task`-veld en geen `DOCUMENT_FIELDS`-wijziging — de informatie zit al in de state.
 *
 * `RecordedTaskMark`/`RecordedTaskAxis` staan in `@/types/taskGrid.ts` (niet hier) omdat
 * `TaskColumnContext` ze nodig heeft en `types/` bewust geen afhankelijkheid richting `state/`
 * krijgt (elders in de codebase importeert niets uit `src/types/*.ts` van `@/state/*`) — dit
 * bestand hergebruikt ze als type-only import, dit bestand is de eigenaar van het GEDRAG, niet
 * van de typenaam.
 */
export type { RecordedTaskAxis, RecordedTaskMark };

/**
 * Welke van de vier OPTIONELE assen (laat-start/-einde, totale/vrije speling) het bestand niet
 * vastlegde voor deze taak. Start/einde staan hier bewust niet in: `RecordedTime.start`/`finish`
 * zijn verplicht (zie `recordedDates.ts`) — een taak zonder vroege datums landt nooit in
 * `RecordedDatesState.times`, dus deze functie krijgt zo'n taak nooit te zien.
 *
 * `undefined` als invoer (geen vastlegging voor deze taak) levert een lege lijst — hetzelfde als
 * "alle vier aanwezig" voor een aanroeper die alleen let op `.includes(...)`, maar de aanroepers
 * hieronder en in de kolomregistratie filteren altijd eerst op het bestaan van de vastlegging zelf
 * (`recordedMark`/de kolom se `available`-gate), dus dat onderscheid komt daar nooit verkeerd uit.
 */
export function unrecordedAxes(rec: RecordedTime | undefined): readonly RecordedTaskAxis[] {
  if (!rec) return [];
  const axes: RecordedTaskAxis[] = [];
  if (rec.lateStart === undefined) axes.push('ls');
  if (rec.lateFinish === undefined) axes.push('lf');
  if (rec.totalFloat === undefined) axes.push('tf');
  if (rec.freeFloat === undefined) axes.push('ff');
  return axes;
}

/**
 * Markering voor de taaktabel-kolom `recorded.source` (categorie `computed`). Twee gevallen, met
 * voorrang in deze volgorde:
 *
 *  1. `'deviates'` — de taak heeft een vastlegging (`recorded.times[task.id]`) waarvan de vroege
 *     start/einde AFWIJKT van wat er nu op het scherm staat (`task.time.earlyStart`/`earlyFinish`).
 *     Alleen betekenisvol BUITEN de modus (`!datesAsRecorded`): IN de modus staat het scherm per
 *     constructie gelijk aan de vastlegging (`applyRecordedTimesToTasks` schrijft `rec.start`/
 *     `rec.finish` rechtstreeks naar `task.time.early*`), dus "wijkt af" zou daar altijd `false`
 *     zijn — geen zinvol signaal, dus niet apart gemeld.
 *  2. `'partly-unrecorded'` — de vastlegging zelf is onvolledig (`unrecordedAxes(rec).length > 0`):
 *     één of meer van de vier optionele assen ontbreken. Dat is een eigenschap van het BESTAND,
 *     niet van de weergavestand, dus dit geldt zowel in als buiten de modus.
 *  3. `undefined` — geen vastlegging voor deze taak, of een volledige vastlegging die (buiten de
 *     modus) niet afwijkt van de herberekening.
 *
 * Geen vastlegging (`rec` ontbreekt) levert altijd `undefined`, ongeacht `datesAsRecorded` — een
 * taak die niet in het bestand stond (bv. toegevoegd ná het openen) heeft niets om over te melden.
 */
export function recordedTaskMark(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
  task: Task,
): RecordedTaskMark {
  const rec = recorded?.times[task.id];
  if (!rec) return undefined;
  if (!datesAsRecorded && (task.time.earlyStart !== rec.start || task.time.earlyFinish !== rec.finish)) {
    return 'deviates';
  }
  return unrecordedAxes(rec).length > 0 ? 'partly-unrecorded' : undefined;
}
