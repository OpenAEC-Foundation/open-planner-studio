/**
 * Het BESLUIT achter `useExitRecordedDates`, als pure functies.
 *
 * Bewust los van de hook, zodat de twee subtiliteiten die het gedrag bepalen (documentwissel en
 * bulk-transactie) headless toetsbaar zijn; de hook doet alleen waarnemen en uitvoeren.
 *
 * Bladmodule: importeert niets uit `slices/` of `appStore`, dus geen cyclus-risico.
 */

/** Het deel van een sessie-event dat het verlaat-besluit leest (structureel, zodat dit een bladmodule
 *  blijft; `SessionHistoryEvent` past erop). */
export interface HistoryEventStatus {
  id: string;
  state: 'applied' | 'undone';
}

/** Waarneming van de store waar het verlaat-besluit op stuurt. */
export interface RecordedDatesObservation {
  /** Het actieve document — de overgang telt alleen bínnen één document (zie hieronder). */
  documentId: string;
  /** Staat "datums zoals opgeslagen" aan? */
  inMode: boolean;
  /** Is de planning verouderd? */
  scheduleStale: boolean;
  /** De sessiehistorie (`historyEvents`, dezelfde referentie als in de store). */
  history: readonly HistoryEventStatus[];
}

/**
 * Was de stap tussen twee waarnemingen een HISTORIEHERSTEL (undo of redo)?
 *
 * Alleen een herstel wisselt de status van een bestaand event (`applyHistoryEvent` in
 * `historySlice.ts`, en de terugdraai van een bibliotheekverdeling in `librarySlice.ts`). Een
 * bewerking voegt een event toe of ruimt undone events op, maar wisselt nooit een status. Dezelfde
 * array (geen historiewijziging) is dus nooit een herstel.
 */
export function restoredFromHistory(
  prev: readonly HistoryEventStatus[],
  next: readonly HistoryEventStatus[],
): boolean {
  if (prev === next) return false;
  const before = new Map(prev.map(event => [event.id, event.state]));
  return next.some(event => {
    const state = before.get(event.id);
    return state !== undefined && state !== event.state;
  });
}

/**
 * Is de modus zojuist via een BEWERKING verlaten (en moet er dus een herberekening ingepland
 * worden)?
 *
 * DOCUMENTWISSEL. `datesAsRecorded` is documentdata (het staat in `DOCUMENT_FIELDS`), dus hij
 * verandert óók bij `switchDocument`/`closeDocument`/een load — zonder dat er iets bewerkt is. Een
 * overstap van een document mét de modus naar een document zonder ziet er in een naïeve
 * store-subscriber precies zo uit als "de modus is zojuist verlaten", en zou dan de planning van
 * dat ándere document ongevraagd doorrekenen: een stille F5 op werk waar de gebruiker niets aan
 * deed. Vandaar dat de overgang alleen telt wanneer het document hetzelfde bleef.
 *
 * HISTORIEHERSTEL. Een undo of redo kan de modus ook uitzetten zonder bewerking: de B5-overgang
 * zet een document in de modus als vóór-toestand, en een tweede Ctrl+Z gaat daar voorbij naar de
 * toestand van vóór een eerdere bewerking (verouderd, modus uit; spec §5.2, regressiegeval 6). Die
 * toestand is precies wat de historie vastlegde. Rekenen zou de opgeslagen datums overschrijven en de
 * vlag "omzetting open" wissen. Een stap die de historie herstelt, telt daarom niet als verlaten
 * (`restoredFromHistory`).
 *
 * `scheduleStale` speelt hier bewust GEEN rol: op het moment van de overgang kan de bijbehorende
 * bulk-transactie nog lopen (zie `needsExitRecompute`). Of er écht gerekend moet worden, wordt pas
 * bij het uitvoeren beslist.
 */
export function leftRecordedDatesMode(
  prev: RecordedDatesObservation,
  next: RecordedDatesObservation,
): boolean {
  if (next.documentId !== prev.documentId) return false;
  if (!prev.inMode || next.inMode) return false;
  return !restoredFromHistory(prev.history, next.history);
}

/**
 * Moet de ingeplande herberekening op het moment van uitvoeren nog écht draaien?
 *
 * Het besluit wordt UITGESTELD genomen (de hook plant met een timer van 0 ms), en dat is de kern
 * van de correctheid — niet een prestatie-truc:
 *
 *  - BULK-TRANSACTIES. `withTransaction` (bv. `deleteTasksBulk` bij ≥2 taken) verlaat de modus bij
 *    de eerste mutatie en muteert dan nog door. Direct rekenen zou een solve onder de nog lopende
 *    mutators door draaien, waarna de resterende mutaties `scheduleStale` weer aanzetten en de bulk
 *    alsnog onberekend eindigt. Uitgesteld draait de solve één keer, ná de hele bulk.
 *  - ACTIES DIE ZELF HERREKENEN. `moveProject`/`applyLeveling`/`clearLeveling` en de MCP-transactie
 *    roepen zélf `runCPM` aan vlak ná hun mutatie. Tegen de tijd dat de timer afgaat is
 *    `scheduleStale` alweer `false` en is er niets te doen — geen dubbele solve.
 *  - UNDO. Een Ctrl+Z vlak ná de bewerking zet de modus terug aan; dan mag er niet alsnog gerekend
 *    worden, want dat zou de zojuist herstelde opgeslagen datums meteen weer overschrijven.
 *  - DOCUMENTWISSEL TUSSENDOOR. Rekenen op een ánder document dan waarvoor werd ingepland is nooit
 *    de bedoeling (zelfde reden als bij `leftRecordedDatesMode`).
 */
export function needsExitRecompute(
  scheduledForDocumentId: string,
  now: RecordedDatesObservation,
): boolean {
  if (now.documentId !== scheduledForDocumentId) return false;
  if (now.inMode) return false;
  return now.scheduleStale;
}
