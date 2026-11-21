import { readRecoverySourceCopy } from '@/services/recovery/recoverySourceCopies';
import { clearRecovery, holdRecoveryForLater } from '@/services/recovery/recoveryStore';
import { readIfcFromText } from '@/services/formatRegistry';
import { readBytesFromRef } from '@/services/fileAccess';
import type { ImportLabels } from '@/services/importTypes';
import type { LoadedRecoveryDoc } from '@/services/recovery/recoveryStore';
import type { RecoveryIfcSource } from '@/services/recovery/recoveryIfcSource';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { isTauri } from '@/utils/platform';
import { createAppStoreContext } from './appStoreFactory';
import { recoveryInputFromParsed, type RecoveryDocInput } from './documentContract';
import type { AppState } from './appStore';

/** De bron is te groot voor de bytes-route (knownbug 1936): het model kan niet terug, de herstelset moet blijven. */
class RecoverySourceTooLargeError extends Error {
  constructor(readonly limit: number) {
    super('Herstelbron is groter dan de grens voor een IFC-bestand met een gebouwmodel.');
    this.name = 'RecoverySourceTooLargeError';
  }
}

/** Bronbytes + planningstekst: dezelfde bytes-openroute als Bestand → Openen, daarna de
 * snapshot als bewerkte stand, los van bron-I/O. De MCP-backup is een apart onderdeel 9c.
 * Knownbug 1131 stap 1: ook de versie van een onderbroken vervanging (`pendingSha256`) is een bewezen bron; het
 * document krijgt dan de gevonden versie als bron.
 */
export async function recoveryDocumentWithSource(
  bytes: Uint8Array, snapshot: RecoveryDocInput, reference: RecoveryIfcSource, labels?: ImportLabels,
): Promise<RecoveryDocInput> {
  const mismatch = () => new Error('Herstelbron wijkt af van de vastgelegde sha256 of grootte.');
  // Zonder vervanging precies als vóór 1131: een andere grootte wordt niet eens gehasht.
  if (bytes.length !== reference.byteLength && reference.pendingSha256 === undefined) throw mismatch();
  const sha256 = await precomputeSha256(bytes);
  const known = (bytes.length === reference.byteLength && sha256 === reference.sha256)
    || (reference.pendingSha256 !== undefined && sha256 === reference.pendingSha256);
  if (!known) throw mismatch();
  const { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await store.getState().openOpenedFile({ name: 'herstelbron.ifc', content: '', bytes, ref: null }, labels);
  // De open-route kiest de reden van een weigering (`importErrorMessageKey`) en meldt die in deze tijdelijke store.
  const tooLarge = store.getState().ui.notifications.find(n => n.messageKey === 'notifications.ifcForeignOpenTooLarge');
  if (tooLarge) throw new RecoverySourceTooLargeError(Number(tooLarge.params?.limit));
  const source = store.getState().ifcSource;
  if (!source?.foreign || !source.opened) throw new Error('Herstelbron kon niet als volledig IFC worden geopend.');
  return { ...snapshot, ifcSource: source, sourceRestored: true,
    filePath: snapshot.foreignSource?.filePath ?? null,
    fileHandle: reference.handle ?? null,
    siteFileId: snapshot.foreignSource?.siteFileId ?? null,
    siteFileVersion: snapshot.foreignSource?.siteFileId ? snapshot.siteFileVersion ?? null : null,
  };
}

/** De hook gebruikt precies deze lezing; een ontbrekende/gewijzigde bron bewaart de planning. */
export async function readRecoveryDocument(
  document: LoadedRecoveryDoc, archives: ReadonlyMap<string, Uint8Array>, enabled: boolean, labels?: ImportLabels,
): Promise<RecoveryDocInput> {
  const parsed = await readIfcFromText(document.ifc, labels, {
    ifcBytes: enabled, resolveXerArchiveReference: sha => archives.get(sha),
  });
  const snapshot = recoveryInputFromParsed(parsed, {
    id: document.id, filePath: document.filePath, siteFileId: document.siteFileId ?? null,
    siteFileVersion: document.siteFileVersion ?? null, foreignSource: document.foreignSource ?? null,
    isDirty: document.isDirty, datesAsRecorded: document.datesAsRecorded,
  });
  if (!enabled) return snapshot;
  if (!document.ifcSource) {
    // De planningstekst is geen bewezen actuele schijfbron (1555).
    if (!snapshot.recoveryForeignSource) delete snapshot.ifcSource;
    return snapshot;
  }
  // Het manifest geeft een vreemd document nooit een schrijfdoel. Alleen na bewezen bronherstel
  // krijgt deze versie het doel terug; sitebasis komt uitsluitend uit de bijpassende kopie.
  snapshot.filePath = null; snapshot.siteFileId = null; snapshot.siteFileVersion = null;
  // De manifesthash is actueel, ook als de planningstekst sinds een broncommit niet opnieuw
  // geserialiseerd is. De bytes van die planningstekst zijn zelf nooit de volledige bron.
  snapshot.recoveryForeignSource = { sha256: document.ifcSource.sha256, byteLength: document.ifcSource.byteLength };
  delete snapshot.ifcSource;
  try {
    const reference = document.ifcSource;
    const path = document.foreignSource?.filePath;
    const ref = document.foreignSource?.siteFileId ? null : reference.handle
      ? { kind: 'handle' as const, handle: reference.handle }
      : isTauri() && path ? { kind: 'path' as const, path } : null;
    if (ref) {
      try {
        const bytes = await readBytesFromRef(ref);
        if (bytes) return await recoveryDocumentWithSource(bytes, snapshot, reference, labels);
      }
      catch (error) {
        if (error instanceof RecoverySourceTooLargeError) throw error;
        /* Geen leesrecht of andere bron: probeer de bewaarde kopie, als die bestaat. */
      }
    }
    if (isTauri() || !document.sourceCopyDocumentKey) return snapshot;
    const copy = await readRecoverySourceCopy(document.sourceCopyDocumentKey, reference.sha256);
    if (!copy) return snapshot;
    const siteFileId = snapshot.foreignSource?.siteFileId;
    const withSite = { ...snapshot, siteFileVersion: siteFileId && copy.siteFileId === siteFileId ? copy.siteFileVersion : null };
    return await recoveryDocumentWithSource(copy.bytes, withSite, reference, labels);
  } catch (error) {
    // Knownbug 1936: een bron boven de grens geeft alleen de planning terug, met een eigen uitkomst. Herstellen meldt
    // het en houdt de herstelset vast (`restoreRecoveredDocuments`). Andere weigeringen: knownbug 2046.
    return error instanceof RecoverySourceTooLargeError ? { ...snapshot, sourceNotRestored: { limit: error.limit } } : snapshot;
  }
}

/**
 * *Herstellen* in de herstelvraag (`useRecoveryRestore`): de documenten in de store, een melding per document waarvan
 * het gebouwmodel niet terugkwam, en opruimen alleen als alles volledig is meegenomen. Anders blijft de herstelset
 * staan tot de planner haar verwerpt (`holdRecoveryForLater`), ook de bronkopie in de browser. Een document zonder
 * model krijgt op de desktop geen vrijgave voor opruimen. `onRestored` draait vóór de opruimactie. Gooit bij een fout
 * van de opslag; de hook meldt die.
 */
export async function restoreRecoveredDocuments(
  store: { getState(): Pick<AppState, 'restoreDocuments' | 'notify'> },
  restored: readonly RecoveryDocInput[], activeDocumentId: string | null, failed: number,
  titles: ReadonlyMap<string, string>, onRestored: () => void = () => {},
): Promise<void> {
  const skipped = restored.length > 0 ? store.getState().restoreDocuments([...restored], activeDocumentId).skippedIds : [];
  const withoutModel = restored.filter(doc => doc.sourceNotRestored && !skipped.includes(doc.id));
  for (const doc of withoutModel) {
    store.getState().notify({
      severity: 'error', sticky: true, messageKey: 'notifications.recoveryModelNotRestored',
      params: { name: titles.get(doc.id) ?? doc.project.name, limit: doc.sourceNotRestored!.limit },
    });
  }
  // Het herstel zelf is klaar: de hook sluit de dialoog vóór de opruimactie (bestands-I/O).
  onRestored();
  if (failed === 0 && skipped.length === 0 && withoutModel.length === 0) await clearRecovery();
  else await holdRecoveryForLater(restored.filter(doc => !skipped.includes(doc.id) && !doc.sourceNotRestored).map(doc => doc.id));
}
