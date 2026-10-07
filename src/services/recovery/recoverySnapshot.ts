import { writeIFC } from '@/services/ifc/ifcWriter';
import { buildWriteIFCInput, type IFCSaveSource } from '@/state/ifcSaveInput';
import { saveRecovery } from './recoveryStore';
import type { RecoveryDeltaTracker, RecoverySourceDocument } from './recoveryDelta';

/**
 * De IFC-tekst van één crashherstel-snapshot. Eigenaarsbesluit plan (9): het XER-bronarchief gaat
 * NIET mee in elke snapshot. De snapshot draagt alleen een verwijzing (lengte + SHA-256, pset-schema 3);
 * de bytes staan één keer als content-adressed blob in de crashherstelopslag (`recoveryStore`).
 * Daardoor raakt een auto-save-tick het archief niet aan: geen base64-codering, geen kopie, geen
 * schrijfactie van megabytes. Het echte opslaan (`buildWriteIFCInput` zonder deze optie) schrijft
 * het archief wél volledig; het IFC-projectbestand blijft de bron.
 */
export function serializeRecoverySnapshot(source: IFCSaveSource): string {
  return writeIFC({ ...buildWriteIFCInput(source), xerSourceArchiveStorage: 'recovery-reference' });
}

/**
 * Eén crashherstel-ronde: delta bepalen, gewijzigde documenten serialiseren, opslaan en pas daarna
 * de persistentiebasis verschuiven. `false` = er viel niets te schrijven. Fouten gaan naar de
 * aanroeper (de auto-save meldt ze); de basis blijft dan staan, zodat de volgende ronde het opnieuw
 * probeert.
 */
export async function runRecoveryTick(
  tracker: RecoveryDeltaTracker,
  activeDocumentId: string | null,
  documents: readonly RecoverySourceDocument[],
): Promise<boolean> {
  const save = tracker.prepare(activeDocumentId, documents, serializeRecoverySnapshot);
  if (!save) return false;
  await saveRecovery(save);
  tracker.commit(activeDocumentId, documents);
  return true;
}
