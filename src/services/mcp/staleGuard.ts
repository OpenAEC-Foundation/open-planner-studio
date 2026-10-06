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
import { isAutoCalcHeld } from '@/state/editHold';
import { createFailedSolveGate, type FailedSolveGate } from '@/state/failedSolveGate';

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
  /** Gezet wanneer de gebruiker midden in een bewerking zit (`editHold.ts`): niet gerekend. */
  heldByEdit?: true;
  /** Gezet wanneer de laatste berekening faalde en de invoer sindsdien niet veranderde: niet opnieuw
   *  gerekend; `error` draagt de fout van toen. */
  failedSolveUnchanged?: true;
}

/** Per storecontext één rem, zoals `useAutoCalcCPM` er één per app heeft. */
const failedSolveGates = new WeakMap<AppStoreContext, FailedSolveGate>();

/**
 * Dezelfde rem als Automatisch berekenen (`failedSolveGate.ts`): na een mislukte berekening pas
 * opnieuw rekenen als de plannings-invoer echt veranderde. Zonder rem solvet elke leescall op een
 * planning met een kringverwijzing opnieuw (`runCPM` laat `scheduleStale` dan staan) en telt de
 * melding `cpm-error` op, ook nadat de gebruiker hem wegklikte.
 *
 * De rem moet ELKE storewijziging zien om te weten tegen welke invoer een rekenresultaat hoort; hij
 * abonneert zich daarom bij de eerste verouderde lezing op de store. Op dat moment is onbekend of een
 * al aanwezige fout nog bij de huidige invoer hoort (de gebruiker kan sindsdien iets gewijzigd
 * hebben), dus die eerste keer wordt er gewoon gerekend: hooguit één extra solve, nooit een te
 * vroege weigering.
 */
function failedSolveBlocks(app: AppStoreContext): boolean {
  const state = app.store.getState();
  const known = failedSolveGates.get(app);
  if (known) return known.blocks(state);
  const gate = createFailedSolveGate({
    cpmResult: null, tasks: state.tasks, sequences: state.sequences,
    calendar: state.calendar, calendars: state.calendars, project: state.project,
  });
  failedSolveGates.set(app, gate);
  app.store.subscribe((next) => { gate.blocks(next); });
  return false;
}

/**
 * De leestool-variant van `ensureFreshSchedule`. Rekent een verouderde of nooit berekende planning
 * door, met drie uitzonderingen:
 *
 * 1. "Datums zoals opgeslagen". Daar rekent een leestool NOOIT door: `runCPM` zou de modus verlaten,
 *    de opgeslagen datums vervangen en een undo-stap pushen (scheduleSlice.runCPM) — een stille
 *    wijziging door een tool die `readOnlyHint: true` draagt. De envelop meldt de modus
 *    (`datesAsRecorded` + `scheduleNote`, zie `buildEnvelope` in tools/runtime.ts). Volgens de kop is
 *    "modus aan én verouderd/nooit gerekend" onbereikbaar; deze tak maakt dat voor leestools
 *    afgedwongen in plaats van afgeleid.
 * 2. Een lopende bewerking (`isAutoCalcHeld`, editHold.ts): sleept of typt de gebruiker, dan zou een
 *    herberekening de balk onder de muis laten verspringen. Dezelfde rem als Automatisch berekenen;
 *    de envelop meldt dan eerlijk `scheduleStale: true`.
 * 3. Een mislukte berekening waarvan de invoer niet veranderde (`failedSolveBlocks`).
 *
 * Muterende tools (`level_resources`, `save_baseline`) houden `ensureFreshSchedule`: zij wijzigen
 * het document toch, en daar mag doorrekenen.
 */
export function ensureFreshScheduleForRead(app: AppStoreContext): ReadFreshResult {
  const state = app.store.getState();
  if (state.datesAsRecorded) return { recomputed: false, datesAsRecorded: true };
  if (!state.scheduleStale && state.cpmResult) return { recomputed: false };
  if (isAutoCalcHeld()) return { recomputed: false, heldByEdit: true };
  if (failedSolveBlocks(app)) {
    const error = state.cpmResult?.error;
    return error
      ? { recomputed: false, failedSolveUnchanged: true, error }
      : { recomputed: false, failedSolveUnchanged: true };
  }
  return ensureFreshSchedule(app);
}
