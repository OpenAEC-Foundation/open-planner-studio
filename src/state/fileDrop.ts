// Slepen en neerzetten (issue #771): wat er gebeurt met de bestanden die `fileAccess/fileDrop.ts`
// ontving. Er is geen eigen openroute: elk bestand gaat door `openOpenedFile`, net als Bestand →
// Openen. Dat geeft per bestand hetzelfde gedrag: een nieuw tabblad (of het lege, ongewijzigde
// actieve tabblad), het opslagdoel alleen voor IFC, de openingsmelding en de recente bestanden.
// Een geopend project met wijzigingen blijft dus ongemoeid in zijn eigen tabblad staan.
// Geen bestand verdwijnt zonder melding: een formaat dat de app niet opent en een neerzetting terwijl
// een dialoog openstaat krijgen elk één melding met de bestandsnamen.
import type { AppState } from '@/state/appStoreFactory';
import type { ImportLabels } from '@/services/importTypes';
import { droppedFilesFromPaths, splitDroppedFiles, type DroppedFile } from '@/services/fileAccess/fileDrop';
import { fileIdentityFs } from '@/services/fileAccess';
import type { TauriOpenIO } from '@/services/fileAccess/tauriBackend';
import type { FormatReadOptions } from '@/services/formatRegistry';
import { openFailureNotices } from '@/state/slices/fileSlice';
import { lookupOpenDocument, type OpenLookup } from '@/state/openDocumentFor';

/** De namen in de melding: hoogstens vijf, daarna "…", zodat een sleep met een hele map de melding
 *  niet over het scherm laat lopen. Bestandsnamen blijven zoals ze zijn (geen vertaling). */
export function fileNameList(names: readonly string[]): string {
  const MAX = 5;
  return names.length <= MAX ? names.join(', ') : `${names.slice(0, MAX).join(', ')}, …`;
}

interface FileDropStore {
  getState(): Pick<AppState, 'openOpenedFile' | 'notify' | 'ui' | 'getOpenDocumentPayloads'>;
}

/** Desktop: de gesleepte paden, elk met zijn pad als `target` (#804, knownbug 1957: de toets "staat al open" vóór het
 *  lezen). Het lezen zelf blijft `droppedFilesFromPaths`. */
export function desktopDroppedFiles(paths: readonly string[], io: TauriOpenIO, readOptions?: FormatReadOptions): DroppedFile[] {
  return droppedFilesFromPaths(paths, io, readOptions).map((file, index) => {
    const path = paths[index];
    return { ...file, target: async () => ({ kind: 'path' as const, path }) };
  });
}

/**
 * Open de neergezette bestanden, in de volgorde van neerzetten, één voor één door de gewone
 * openroute. `isBlocked` is dezelfde poort als Ctrl+O (een open dialoog, een wachtende vraag).
 *
 * - Bij het neerzetten: is de poort dicht, dan wordt niets gelezen en geeft de app één melding.
 *   Met `waitWhenBlocked` (een bestand dat bij het starten is meegegeven, issue #1091) weigert
 *   de app dan niet: het bestand wacht, net als hieronder, tot de poort open is.
 * - Vlak vóór het activeren van elk document: is de poort dan dicht, of staat de uitleg over het
 *   formaat van het vorige bestand nog klaar, dan wacht dit bestand tot die weg is. Zo gooit een
 *   documentwissel nooit de invoer weg van een dialoog die de planner tijdens het lezen opende, en
 *   krijgt elk bestand zijn eigen formaatuitleg (`pendingFormatNotice` heeft maar één plek).
 */
export async function openDroppedFiles(
  store: FileDropStore,
  files: readonly DroppedFile[],
  labels: ImportLabels,
  isBlocked: () => boolean,
  options: { waitWhenBlocked?: boolean; readOptions?: FormatReadOptions } = {},
): Promise<void> {
  if (files.length === 0) return;
  if (!options.waitWhenBlocked && isBlocked()) {
    store.getState().notify({
      severity: 'error',
      messageKey: 'notifications.fileDropBlocked',
      params: { names: fileNameList(files.map((f) => f.name)) },
      dedupeKey: 'file-drop-blocked',
      replaceOnDedupe: true,
    });
    return;
  }
  const { openable, refused } = splitDroppedFiles(files);
  // Vóór het openen: de melding staat er meteen, ook als het eerste bestand een uitlegvenster opent.
  if (refused.length > 0) {
    store.getState().notify({
      severity: 'error',
      messageKey: 'notifications.fileDropRefused',
      params: { names: fileNameList(refused) },
      helpArticleId: 'howto-bestand-openen-en-opslaan',
      dedupeKey: 'file-drop-refused',
      replaceOnDedupe: true,
    });
  }
  const waitWhile = () => isBlocked() || store.getState().ui.pendingFormatNotice !== null;
  // #804, knownbug 1957: met de flag (de leeskeuze van de neerzetting) de toets "staat al open" per bestand vóór het
  // lezen. Een startbestand geeft geen `readOptions` en geen `target` mee: dat houdt de toets van main.
  const readOptions = options.readOptions;
  for (const file of openable) {
    let lookup: OpenLookup | null = null;
    if (readOptions?.ifcBytes && file.target) {
      const target = await file.target().catch(() => null);
      if (target && target.kind !== 'site') lookup = await lookupOpenDocument(store.getState(), target, fileIdentityFs);
    }
    let opened;
    try {
      opened = await file.read();
    } catch (err) {
      console.error('Failed to read dropped file:', err);
      for (const notice of openFailureNotices(err)) store.getState().notify(notice);
      continue;
    }
    // `openOpenedFile` meldt een leesfout van het formaat zelf en gooit niet.
    await store.getState().openOpenedFile(opened, labels, {
      waitWhile, existingDocument: file.existingDocument, stale: file.stale,
      ...(readOptions?.ifcBytes ? { readOptions, lookup } : {}),
    });
  }
}
