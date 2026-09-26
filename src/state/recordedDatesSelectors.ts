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
 *     één of meer van de vier optionele assen ontbreken. UITSLUITEND IN DE MODUS: de markering is
 *     een uitspraak over WAT ER OP HET SCHERM STAAT, niet over het bestand. Buiten de modus staat
 *     onze eigen, zojuist berekende late-/spelinguitvoer in die kolommen — daar is niets "niet
 *     vastgelegd" aan, en de badge zou de gebruiker een echt getal laten wantrouwen (of, via
 *     `recordedUnrecordedAxes`, zelfs verbergen).
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
  if (!datesAsRecorded) {
    return task.time.earlyStart !== rec.start || task.time.earlyFinish !== rec.finish
      ? 'deviates'
      : undefined;
  }
  return unrecordedAxes(rec).length > 0 ? 'partly-unrecorded' : undefined;
}

/**
 * De badge in het eigenschappenpaneel (`TaskRecordedDatesNotice.tsx`) — dezelfde bron als de
 * tabelkolom, zodat de twee oppervlakken over dezelfde taak nooit iets anders kunnen zeggen.
 *
 *  - buiten de modus: precies `recordedTaskMark` (dus `'deviates'` of niets);
 *  - in de modus: `'partly-unrecorded'` zodra de vastlegging assen mist — dát is daar het
 *    informatieve signaal, en het is exact wat de kolom `recorded.source` dan óók toont — anders
 *    `'active'` ("deze taak toont de datums uit het bestand").
 */
export function recordedNoticeState(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
  task: Task,
): 'active' | RecordedTaskMark {
  const mark = recordedTaskMark(recorded, datesAsRecorded, task);
  if (!datesAsRecorded) return mark;
  return recorded?.times[task.id] ? (mark ?? 'active') : undefined;
}

/**
 * De naad tussen de documentstate en een taakgrid-`TaskColumnContext` — één plek, zodat elk
 * rasteroppervlak (`FullTaskGrid` voor Gantt-taakraster én het tabblad Tabel, en het schrijfpad in
 * `gridTransaction.ts`) dezelfde poort gebruikt.
 *
 * De poort is `datesAsRecorded`, NIET `recordedDates !== null`. `recordedDates !== null
 * && !datesAsRecorded` is de AANBOD-stand: er is gewoon gesolved, `task.time.lateStart` en de
 * floats zijn echte CPM-uitvoer, en `recordedAxisFormat` zou ze door "Niet vastgelegd" vervangen —
 * permanent, want `runCPM` wist de vastlegging alleen bij het VERLATEN van de modus, dus ook F5
 * haalt het niet weg. Een IFC vult zelden `LateStart`/`TotalFloat`, dus dat zou vrijwel elk
 * document met een aanbod raken.
 *
 * `recordedMark` hangt bewust wél aan `recordedDates` alleen: "wijkt af" is juist buiten de modus
 * het zinvolle signaal, en die kolom vervangt geen enkele berekende waarde — hij zet er een
 * markering náást.
 */
export function recordedGridBinding(
  recorded: RecordedDatesState | null,
  datesAsRecorded: boolean,
): {
  recordedMark: ((task: Task) => RecordedTaskMark) | undefined;
  recordedUnrecordedAxes: ((task: Task) => readonly RecordedTaskAxis[]) | undefined;
} {
  return {
    recordedMark: recorded ? (task => recordedTaskMark(recorded, datesAsRecorded, task)) : undefined,
    recordedUnrecordedAxes: recorded && datesAsRecorded
      ? (task => unrecordedAxes(recorded.times[task.id]))
      : undefined,
  };
}
