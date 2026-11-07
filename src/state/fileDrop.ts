// Slepen en neerzetten (issue #771): wat er gebeurt met de bestanden die `fileAccess/fileDrop.ts`
// ontving. Er is geen eigen openroute: elk bestand gaat door `openOpenedFile`, net als Bestand →
// Openen. Dat geeft per bestand hetzelfde gedrag: een nieuw tabblad (of het lege, ongewijzigde
// actieve tabblad), het opslagdoel alleen voor IFC, de openingsmelding en de recente bestanden.
// Een geopend project met wijzigingen blijft dus ongemoeid in zijn eigen tabblad staan.
// Geen bestand verdwijnt zonder melding: een formaat dat de app niet opent en een neerzetting terwijl
// een dialoog openstaat krijgen elk één melding met de bestandsnamen.
import type { AppState } from '@/state/appStoreFactory';
import type { ImportLabels } from '@/services/importTypes';
import { splitDroppedFiles, type DroppedFile } from '@/services/fileAccess/fileDrop';
import { importFailureNotice, saveErrorDetail } from '@/state/slices/fileSlice';

/** Uitkomst van één keer neerzetten; voor de zichtbare kant (melding) en de test. */
export interface FileDropOutcome {
  /** Er stond een dialoog of vraag open: niets gelezen, niets geopend. */
  blocked: boolean;
  /** Namen van de bestanden die door de openroute gingen, in volgorde van neerzetten. */
  opened: string[];
  /** Namen van de bestanden die niet te lezen waren (de fout is al gemeld). */
  unreadable: string[];
  /** Namen van de bestanden met een formaat dat de app niet opent (gemeld met één melding). */
  refused: string[];
}

/** De namen in de melding: hoogstens vijf, daarna "…", zodat een sleep met een hele map de melding
 *  niet over het scherm laat lopen. Bestandsnamen blijven zoals ze zijn (geen vertaling). */
export function fileNameList(names: readonly string[]): string {
  const MAX = 5;
  return names.length <= MAX ? names.join(', ') : `${names.slice(0, MAX).join(', ')}, …`;
}

interface FileDropStore {
  getState(): Pick<AppState, 'openOpenedFile' | 'notify'>;
}

/**
 * Open de neergezette bestanden, in de volgorde van neerzetten, één voor één door de gewone
 * openroute. `isBlocked` is dezelfde poort als Ctrl+O (een open dialoog, een wachtende vraag): staat
 * die dicht, dan gebeurt er niets. De poort wordt alleen vóór het eerste bestand gevraagd: het openen
 * zelf kan een uitlegvenster over het formaat zetten, en dat mag de volgende bestanden niet tegenhouden.
 */
export async function openDroppedFiles(
  store: FileDropStore,
  files: readonly DroppedFile[],
  labels: ImportLabels,
  isBlocked: () => boolean,
): Promise<FileDropOutcome> {
  const outcome: FileDropOutcome = { blocked: false, opened: [], unreadable: [], refused: [] };
  if (files.length === 0) return outcome;
  if (isBlocked()) {
    store.getState().notify({
      severity: 'error',
      messageKey: 'notifications.fileDropBlocked',
      params: { names: fileNameList(files.map((f) => f.name)) },
      dedupeKey: 'file-drop-blocked',
      replaceOnDedupe: true,
    });
    return { ...outcome, blocked: true };
  }
  const { openable, refused } = splitDroppedFiles(files);
  outcome.refused = refused;
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
  for (const file of openable) {
    let opened;
    try {
      opened = await file.read();
    } catch (err) {
      console.error('Failed to read dropped file:', err);
      store.getState().notify(importFailureNotice(err, saveErrorDetail(err)));
      outcome.unreadable.push(file.name);
      continue;
    }
    // `openOpenedFile` meldt een leesfout van het formaat zelf en gooit niet.
    await store.getState().openOpenedFile(opened, labels);
    outcome.opened.push(file.name);
  }
  return outcome;
}
