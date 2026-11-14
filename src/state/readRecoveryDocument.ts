import { readRecoverySourceCopy } from '@/services/recovery/recoverySourceCopies';
import { readIfcFromText } from '@/services/formatRegistry';
import { readBytesFromRef } from '@/services/fileAccess';
import type { ImportLabels } from '@/services/importTypes';
import type { LoadedRecoveryDoc } from '@/services/recovery/recoveryStore';
import type { RecoveryIfcSource } from '@/services/recovery/recoveryIfcSource';
import { precomputeSha256 } from '@/services/xerSourceArchive';
import { isTauri } from '@/utils/platform';
import { createAppStoreContext } from './appStoreFactory';
import { recoveryInputFromParsed, type RecoveryDocInput } from './documentContract';

/** Bronbytes + planningstekst: dezelfde bytes-openroute als Bestand → Openen, daarna de
 * snapshot als bewerkte stand, los van bron-I/O. De MCP-backup is een apart onderdeel 9c.
 */
export async function recoveryDocumentWithSource(
  bytes: Uint8Array, snapshot: RecoveryDocInput, reference: RecoveryIfcSource, labels?: ImportLabels,
): Promise<RecoveryDocInput> {
  if (bytes.length !== reference.byteLength || await precomputeSha256(bytes) !== reference.sha256) {
    throw new Error('Herstelbron wijkt af van de vastgelegde sha256 of grootte.');
  }
  const { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await store.getState().openOpenedFile({ name: 'herstelbron.ifc', content: '', bytes, ref: null }, labels);
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
      catch { /* Geen leesrecht of andere bron: probeer de bewaarde kopie, als die bestaat. */ }
    }
    if (isTauri() || !document.sourceCopyDocumentKey) return snapshot;
    const copy = await readRecoverySourceCopy(document.sourceCopyDocumentKey, reference.sha256);
    if (!copy) return snapshot;
    const siteFileId = snapshot.foreignSource?.siteFileId;
    const withSite = { ...snapshot, siteFileVersion: siteFileId && copy.siteFileId === siteFileId ? copy.siteFileVersion : null };
    return await recoveryDocumentWithSource(copy.bytes, withSite, reference, labels);
  } catch {
    return snapshot;
  }
}
