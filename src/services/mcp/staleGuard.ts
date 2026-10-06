// Versheids-guard-helper. Puur een helper: geen tool, geen envelop, geen store-uitbreiding.
// Gebruikt door `save_baseline` en de losse `level_resources` (muterend), en via
// `ensureFreshScheduleForRead` door elke leestool die berekende waarden teruggeeft — allemaal tools
// die vóór hun werk een verse planning nodig hebben maar geen extra undo-stap mogen achterlaten.
//
// De invariant die dit veilig maakt: `runCPM` pusht geen undo-snapshot (het schrijft alleen
// berekende velden terug via Immer; zie scheduleSlice.runCPM en transaction.ts — géén
// `beginUndoable`). Daarom kan deze helper stil herrekenen zonder de undo-stack te raken.
// ÉÉN UITZONDERING OP DIE INVARIANT: staat het document in "datums zoals opgeslagen"
// (`datesAsRecorded`), dan verlaat `runCPM` die modus en pusht daarvoor wél één snapshot — dan
// overschrijft de herberekening immers de opgeslagen datums, en dat hoort ongedaan te kunnen.
//
// DEZE HELPER RAAKT DIE UITZONDERING NIET, en dat is afgedwongen in plaats van gehoopt: hij doet
// alleen iets bij `scheduleStale` of `cpmResult === null`, en in de modus is `scheduleStale` altijd
// `false` (`showRecordedDates` zet hem zo, `markScheduleStale` in transaction.ts houdt hem zo) én
// `cpmResult` altijd gevuld (de reconstructie uit het bestand). "Modus aan én verouderd" is dus
// onbereikbaar — vastgelegd in tests/planning/check-recorded-dates.ts. Dat is precies
// wat `readOnlyHint: true` op `get_resource_histogram` overeind houdt.
import { appStoreContext, type AppStoreContext } from '@/state/appStore';

/** Uitkomst van `ensureFreshSchedule`. */
export interface FreshResult {
  /** True wanneer de planning stale was en opnieuw is doorgerekend; false wanneer al vers. */
  recomputed: boolean;
  /** Gezet wanneer de herrekening in `cpmResult.error` eindigde (bv. kringverwijzing). De
   *  aanroepende tool beslist wat daarmee gebeurt (blokkeren, doorgeven, ...). */
  error?: string;
}

/**
 * Herrekent de planning wanneer die stale is OF nog nooit gedraaid heeft.
 *
 * - `scheduleStale === false` ÉN `cpmResult !== null` ⇒ `{ recomputed: false }` en er wordt NIETS
 *   aangeraakt (geen onnodige recompute, `cpmResult`-referentie blijft ongewijzigd).
 * - `scheduleStale === true` ⇒ `runCPM()` wordt aangeroepen; daarna wordt `cpmResult.error`
 *   (indien gezet) als `error`-string teruggegeven. `runCPM` vangt kringverwijzingen zelf af en
 *   gooit niet — deze helper gooit dus evenmin.
 *
 * NOOIT-BEREKEND IS OOK NIET-VERS. De begintoestand van een document is
 * `scheduleStale: false` ÉN `cpmResult: null` (scheduleSlice), en precies die combinatie ontstaat
 * ook bij crash-herstel / `applyLoadedProject({ recompute: false })` — `listDocuments` beschrijft
 * hem expliciet als "notCalculated". Alleen op `scheduleStale` sturen laat zo'n document als "vers"
 * passeren: `save_baseline` zou dan een baseline vastleggen op de ONOPGELOSTE `scheduleStart`-fallback.
 * Vandaar de extra `cpmResult`-voorwaarde. `runCPM` op een leeg/klein document is goedkoop en
 * zet `isDirty` niet, dus dit kost hooguit rekenwerk.
 *
 * Pusht geen undo-snapshot: de ene uitzondering op de runCPM-invariant (het verlaten van "datums
 * zoals opgeslagen") is via deze helper onbereikbaar — zie de kop hierboven.
 */
export function ensureFreshSchedule(app: AppStoreContext = appStoreContext): FreshResult {
  const state = app.store.getState();
  if (!state.scheduleStale && state.cpmResult) {
    return { recomputed: false };
  }
  state.runCPM();
  // Verse referentie ná de recompute ophalen — runCPM heeft een nieuwe cpmResult gezet.
  const error = app.store.getState().cpmResult?.error;
  return error ? { recomputed: true, error } : { recomputed: true };
}

/** Uitkomst van `ensureFreshScheduleForRead`. */
export interface ReadFreshResult extends FreshResult {
  /** Gezet wanneer het document in "datums zoals opgeslagen" staat: er is bewust NIET gerekend. */
  datesAsRecorded?: true;
}

/**
 * De leestool-variant: herrekent precies zoals `ensureFreshSchedule`, behalve in "datums zoals
 * opgeslagen". Daar rekent een leestool NOOIT door: `runCPM` zou de modus verlaten, de opgeslagen
 * datums vervangen en een undo-stap pushen (scheduleSlice.runCPM) — een stille wijziging door een
 * tool die `readOnlyHint: true` draagt. De leestool geeft dan de opgeslagen datums terug; de envelop
 * meldt de modus (`datesAsRecorded` + `scheduleNote`, zie `buildEnvelope` in tools/runtime.ts).
 *
 * Volgens de kop is "modus aan én verouderd/nooit gerekend" onbereikbaar, dus `ensureFreshSchedule`
 * zou in de modus ook al niets doen. Deze expliciete tak maakt dat voor leestools afgedwongen in
 * plaats van afgeleid: breekt die invariant ooit, dan verlaat een leestool de modus nog steeds niet.
 * Muterende tools (`level_resources`, `save_baseline`) houden `ensureFreshSchedule`: zij wijzigen
 * het document toch, en daar mag doorrekenen.
 */
export function ensureFreshScheduleForRead(app: AppStoreContext): ReadFreshResult {
  if (app.store.getState().datesAsRecorded) return { recomputed: false, datesAsRecorded: true };
  return ensureFreshSchedule(app);
}
