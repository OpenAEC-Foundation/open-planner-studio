/**
 * Het BESLUIT achter `useExitRecordedDates` (issue #63), als pure functies.
 *
 * Bewust los van de hook: het predicaat zat eerst in de subscriber-closure en was daardoor niet
 * headless toetsbaar — precies de plek waar de twee subtiliteiten zitten die het gedrag bepalen
 * (documentwissel en bulk-transactie). Hier zijn ze wél te toetsen; de hook doet alleen nog
 * waarnemen en uitvoeren.
 *
 * Bladmodule: importeert niets uit `slices/` of `appStore`, dus geen cyclus-risico.
 */

/** Waarneming van de store waar het verlaat-besluit op stuurt. */
export interface RecordedDatesObservation {
  /** Het actieve document — de overgang telt alleen bínnen één document (zie hieronder). */
  documentId: string;
  /** Staat "datums zoals opgeslagen" aan? */
  inMode: boolean;
  /** Is de planning verouderd? */
  scheduleStale: boolean;
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
 * `scheduleStale` speelt hier bewust GEEN rol: op het moment van de overgang kan de bijbehorende
 * bulk-transactie nog lopen (zie `needsExitRecompute`). Of er écht gerekend moet worden, wordt pas
 * bij het uitvoeren beslist.
 */
export function leftRecordedDatesMode(
  prev: RecordedDatesObservation,
  next: RecordedDatesObservation,
): boolean {
  if (next.documentId !== prev.documentId) return false;
  return prev.inMode && !next.inMode;
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
