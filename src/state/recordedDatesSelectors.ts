import type { RecordedDatesState, RecordedTime } from '@/engine/scheduler/recordedDates';
import type { Task } from '@/types/task';
import type { RecordedTaskAxis, RecordedTaskMark } from '@/types/taskGrid';

/**
 * "Datums zoals opgeslagen" — de PURE afgeleide over
 * bestaande documentstate (`recordedDates`/`datesAsRecorded`), gedeeld door de taaktabel-kolom
 * (`taskColumnRegistry.ts`, via `TaskColumnContext.recordedMark`/`recordedUnrecordedAxes`) en het
 * eigenschappenpaneel (`TaskRecordedDatesNotice.tsx`). Bladmodule: importeert alleen types, geen
 * nieuw `Task`-veld en geen `DOCUMENT_FIELDS`-wijziging — de informatie zit al in de state.
 *
 * Alles hier hangt aan de MODUS (`datesAsRecorded`). Er is geen aanbod-stand meer (eigenaar,
 * 2026-10-17, optie 1): buiten de modus is `recordedDates` `null`, en ook als een toekomstige
 * schrijver dat mist, zegt geen van deze functies daar iets.
 *
 * `RecordedTaskMark`/`RecordedTaskAxis` staan in `@/types/taskGrid.ts` (niet hier) omdat
 * `TaskColumnContext` ze nodig heeft en `types/` bewust geen afhankelijkheid richting `state/`
 * krijgt. Dit bestand hergebruikt ze als type-only import: het is de eigenaar van het GEDRAG, niet
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
 * Dezelfde vraag als `unrecordedAxes`, maar voor de UITGANGEN buiten de taaktabel (CSV-export en
 * de MCP-leestools) — daarom in `Task['time']`-veldnamen en mét `isCritical`, dat geen tabelkolom
 * met een "niet vastgelegd"-tekst heeft maar wél door dezelfde `?? false` naar buiten zou reizen.
 *
 * De modus staat standaard aan bij een import met restverschillen, dus de terugvallen
 * (`lateStart ?? rec.start`, `totalFloat ?? 0`, `isCritical ?? false`) zijn geen bewuste
 * gebruikerskeuze. Een verzonnen 0 of late datum mag dan niet stilzwijgend een CSV-export of een
 * AI-antwoord in — daar is geen strook of badge die de stand toelicht.
 */
export type UnrecordedExportField = 'lateStart' | 'lateFinish' | 'totalFloat' | 'freeFloat' | 'isCritical';

export function unrecordedExportFields(rec: RecordedTime | undefined): readonly UnrecordedExportField[] {
  if (!rec) return [];
  const fields: UnrecordedExportField[] = [];
  if (rec.lateStart === undefined) fields.push('lateStart');
  if (rec.lateFinish === undefined) fields.push('lateFinish');
  if (rec.totalFloat === undefined) fields.push('totalFloat');
  if (rec.freeFloat === undefined) fields.push('freeFloat');
  if (rec.isCritical === undefined) fields.push('isCritical');
  return fields;
}

/**
 * De poort voor die uitgangen: `undefined` zodra de modus UIT staat (dan staat er onze eigen,
 * echte berekening en valt er niets te verzwijgen) of het document geen vastlegging heeft. Zelfde
 * regel als `recordedGridBinding`, en bewust dezelfde vorm — één begrip, twee consumenten.
 */
export function unrecordedExportGate(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
): ((task: Task) => readonly UnrecordedExportField[]) | undefined {
  if (!recorded || !datesAsRecorded) return undefined;
  return task => unrecordedExportFields(recorded.times[task.id]);
}

/**
 * Markering voor de taaktabel-kolom `recorded.source` (categorie `computed`):
 * `'partly-unrecorded'` als de vastlegging van deze taak een of meer van de vier optionele assen
 * mist (`unrecordedAxes(rec).length > 0`), anders `undefined`. Alleen IN DE MODUS: de markering is
 * een uitspraak over WAT ER OP HET SCHERM STAAT. Geen vastlegging voor deze taak (bv. toegevoegd ná
 * het openen) ⇒ `undefined`.
 */
export function recordedTaskMark(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
  task: Task,
): RecordedTaskMark {
  const rec = datesAsRecorded ? recorded?.times[task.id] : undefined;
  if (!rec) return undefined;
  return unrecordedAxes(rec).length > 0 ? 'partly-unrecorded' : undefined;
}

/**
 * Het blok in het eigenschappenpaneel (`TaskRecordedDatesNotice.tsx`) — dezelfde bron als de
 * tabelkolom, zodat de twee oppervlakken over dezelfde taak nooit iets anders kunnen zeggen:
 * `'partly-unrecorded'` zodra de vastlegging assen mist, anders `'active'` ("deze taak toont de
 * datums uit het bestand"). Buiten de modus of zonder vastlegging voor deze taak: `undefined`.
 */
export function recordedNoticeState(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
  task: Task,
): 'active' | RecordedTaskMark {
  if (!datesAsRecorded || !recorded?.times[task.id]) return undefined;
  return recordedTaskMark(recorded, datesAsRecorded, task) ?? 'active';
}

/**
 * Verschuift deze taak bij herberekenen? `undefined` = onbekend: buiten de modus, of een slapend
 * hersteld document zonder meting (`RecordedDatesState.shiftedTaskIds` ontbreekt). Nooit verzonnen.
 */
export function recordedTaskWillShift(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
  taskId: string,
): boolean | undefined {
  if (!datesAsRecorded || !recorded?.shiftedTaskIds) return undefined;
  return recorded.shiftedTaskIds.includes(taskId);
}

/**
 * De naad tussen de documentstate en een taakgrid-`TaskColumnContext` — één plek, zodat elk
 * rasteroppervlak (`FullTaskGrid` voor Gantt-taakraster én het tabblad Tabel, en het schrijfpad in
 * `gridTransaction.ts`) dezelfde poort gebruikt.
 *
 * De poort is `datesAsRecorded`: buiten de modus staan er echte CPM-uitvoer in de late-/floatkolommen,
 * en `recordedAxisFormat` mag die nooit door "Niet vastgelegd" vervangen.
 */
export function recordedGridBinding(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
): {
  recordedMark: ((task: Task) => RecordedTaskMark) | undefined;
  recordedUnrecordedAxes: ((task: Task) => readonly RecordedTaskAxis[]) | undefined;
} {
  return {
    recordedMark: recorded && datesAsRecorded ? (task => recordedTaskMark(recorded, datesAsRecorded, task)) : undefined,
    recordedUnrecordedAxes: recorded && datesAsRecorded
      ? (task => unrecordedAxes(recorded.times[task.id]))
      : undefined,
  };
}
