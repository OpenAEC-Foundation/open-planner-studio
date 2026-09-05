import type { RecordedDatesState } from '@/engine/scheduler/recordedDates';

/**
 * Welke tekst hoort bij de MODUS-ACTIEF-stand van `RecordedDatesNotice`?
 *
 * De strook is GEDEELD: dezelfde state (`recordedDates`/`datesAsRecorded`) draagt zowel de
 * XER-route (Primavera legde zijn eigen rekenuitkomst vast) als de bestaande #63-route voor elk
 * ander formaat (IFC/CSV/MSPDI/MPP/P6XML), waar het bestand alleen datums draagt en niemand weet
 * uit welk pakket ze komen. "Zoals Primavera ze opsloeg" is daar dus een verkeerde bewering — en
 * juist bij #63 is de kans groot dat de gebruiker een IFC uit een héél ander pakket voor zich
 * heeft.
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
  return origin === 'xer' || origin === 'xer-archive'
    ? 'recordedDates.activeCount'
    : 'recordedDates.activeCountNeutral';
}
