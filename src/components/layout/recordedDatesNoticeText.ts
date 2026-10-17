import type { RecordedDatesState } from '@/engine/scheduler/recordedDates';

/**
 * Welke tekst hoort bij de MODUS-ACTIEF-stand van `RecordedDatesNotice`?
 *
 * De strook is GEDEELD: dezelfde state (`recordedDates`/`datesAsRecorded`) draagt zowel de
 * XER-route (Primavera legde zijn eigen rekenuitkomst vast) als de algemene route voor elk
 * ander formaat (IFC/CSV/MSPDI/MPP/P6XML), waar het bestand alleen datums draagt en niemand weet
 * uit welk pakket ze komen. "Zoals Primavera ze opsloeg" is daar dus een verkeerde bewering.
 *
 * Bewust een aparte, React-vrije module en geen inline ternary in de component: zo is de keuze
 * headless te testen (`check-recorded-dates.ts` sectie 14) in plaats van alleen met het oog te
 * beoordelen.
 *
 * `origin` komt uit `RecordedDatesState.origin`, dat op zijn beurt `ImportResult.recordedTimesOrigin`
 * spiegelt. Beide XER-herkomsten tellen mee: `'xer'` (verse import) en `'xer-archive'` (een
 * heropende IFC met XER-bronarchief) dragen allebei ECHT Primavera's vastlegging — ze verschillen
 * alleen in het heropen-beleid (wel/niet automatisch aan), niet in wie de datums opschreef.
 */
export type RecordedDatesActiveKey = 'recordedDates.activeCount' | 'recordedDates.activeCountNeutral';

/** Het retourtype is bewust de LITERALE unie en niet `string`: `t(...)` is in dit project getypeerd
 *  op de bestaande sleutels, dus een sleutel die niet bestaat geeft hier een compile-fout in plaats
 *  van een lege melding in de app. */
export function recordedDatesActiveKey(origin: RecordedDatesState['origin']): RecordedDatesActiveKey {
  return isPrimaveraRecordedOrigin(origin)
    ? 'recordedDates.activeCount'
    : 'recordedDates.activeCountNeutral';
}

/** Dezelfde vraag voor het per-taak-blok in het eigenschappenpaneel (`TaskRecordedDatesNotice.tsx`,
 *  namespace `task`): ook dat mag niet op élk document "Primavera" zeggen. Eén beslisregel, twee
 *  sleutels per tekst (teksten: eigenaar, 2026-10-17). */
export type RecordedDatesTaskShownKey = 'properties.recordedDatesShown' | 'properties.recordedDatesShownNeutral';
export type RecordedDatesTaskMissingKey = 'properties.recordedDatesMissing' | 'properties.recordedDatesMissingNeutral';

export function recordedDatesTaskShownKey(origin: RecordedDatesState['origin']): RecordedDatesTaskShownKey {
  return isPrimaveraRecordedOrigin(origin)
    ? 'properties.recordedDatesShown'
    : 'properties.recordedDatesShownNeutral';
}

export function recordedDatesTaskMissingKey(origin: RecordedDatesState['origin']): RecordedDatesTaskMissingKey {
  return isPrimaveraRecordedOrigin(origin)
    ? 'properties.recordedDatesMissing'
    : 'properties.recordedDatesMissingNeutral';
}

export function isPrimaveraRecordedOrigin(origin: RecordedDatesState['origin']): boolean {
  return origin === 'xer' || origin === 'xer-archive' || origin === 'p6xml';
}
