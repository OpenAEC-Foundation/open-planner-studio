// #804, knownbug 1131 stap 1: herstel in twee stappen. Vóór de app het eigen bestand van een document met een
// gebouwmodel vervangt, legt hij in het herstelmanifest vast welke versie er komt (`pendingSha256` bij de
// bronverwijzing, manifest v5). Een crash tussen het schrijven van de nieuwe versie en het bijwerken van het manifest
// laat het herstel dan zowel de oude (`sha256`) als de nieuwe versie als bron herkennen
// (`recoveryDocumentWithSource`).
//
// Alleen app-runtime, geen documentdata: de waarde leeft hier tot de vervanging klaar is en gaat via
// `recoverySourceDocument` mee in elke herstelronde. Stap 2 (Ctrl+S in de browser via de handle) en stap 5 (de
// desktop) roepen `replaceWithRecoveryPending` aan; in stap 1 doet nog geen route dat.
import { isProjectFileWriteBusy } from '@/services/fileAccess/writeCoordinator';
import { flushRecoveryNow } from './recoveryFlush';

interface PendingSource {
  readonly sha256: string;
  /** Staat deze waarde werkelijk in het laatst geschreven manifest? */
  recorded: boolean;
}

const pending = new Map<string, PendingSource>();

/** De versie die op het eigen doel van dit document komt, zolang de vervanging loopt. */
export function pendingIfcSourceSha256(documentId: string): string | undefined {
  return pending.get(documentId)?.sha256;
}

/** Een lopende vervanging vraagt een herstelronde, ook als nog geen document gewijzigd is. */
export function hasPendingIfcSource(): boolean {
  return pending.size > 0;
}

/**
 * Na elke herstelronde: welke waarden staan nu werkelijk in het manifest? `recorded(id)` geeft de `pendingSha256` uit
 * de gepersisteerde basis van die ronde (`RecoveryDeltaTracker.persistedIfcSource`), niet uit de invoer: een
 * overgeslagen of mislukte ronde bevestigt niets.
 */
export function confirmRecordedPending(recorded: (documentId: string) => string | undefined): void {
  for (const [id, entry] of pending) entry.recorded = recorded(id) === entry.sha256;
}

export type RecoveryPendingOutcome = 'replaced' | 'not-replaced' | 'not-recorded';

/**
 * Een vervanging van het eigen doel van `documentId` door de versie met `nextSha256`, in twee stappen voor het herstel:
 *
 * 1. `pendingSha256` vastleggen en wachten tot het manifest geschreven is. Lukt dat niet (opslag weigert, de
 *    herstelronde mag nog niet, het document heeft geen bronverwijzing), dan `'not-recorded'`: `replace` draait niet.
 * 2. `replace()` schrijft de nieuwe versie; `true` = die staat op het doel.
 * 3. Bij `true` eerst `commit()` (de store neemt de nieuwe versie als bron, dus de bronverwijzing in het manifest volgt),
 *    dan het veld wissen. Bij `false` of een fout alleen het veld wissen; een fout gaat door naar de aanroeper.
 *
 * Draait binnen dezelfde schrijfvolgorde als de documentopslag: de aanroeper zit al in `runProjectFileWrite` (die is
 * niet herintreedbaar, dus deze helper neemt hem niet zelf). Het manifest na het wissen schrijft de volgende ronde;
 * mislukt die, dan aanvaardt het herstel de nieuwe versie nog steeds via `pendingSha256`.
 */
export async function replaceWithRecoveryPending(
  documentId: string,
  nextSha256: string,
  steps: { replace: () => Promise<boolean>; commit: () => void },
): Promise<RecoveryPendingOutcome> {
  if (!isProjectFileWriteBusy()) throw new Error('replaceWithRecoveryPending hoort binnen runProjectFileWrite.');
  if (pending.has(documentId)) throw new Error('Er loopt al een vervanging voor dit document.');
  pending.set(documentId, { sha256: nextSha256, recorded: false });
  try {
    try { await flushRecoveryNow(); } catch { /* de herstelronde meldt zelf; hieronder telt alleen of het vastligt */ }
    if (!pending.get(documentId)?.recorded) return 'not-recorded';
    if (!(await steps.replace())) return 'not-replaced';
    steps.commit();
    return 'replaced';
  } finally {
    pending.delete(documentId);
    await flushRecoveryNow().catch(() => { /* zie hierboven */ });
  }
}
