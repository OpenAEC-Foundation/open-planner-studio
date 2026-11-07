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

/** Hoe vaak het wachten vóór het activeren kijkt of de poort weer open is. De poort leest ook de
 *  dialoogstapel buiten de store (`isAnyDialogOpen`), dus een abonnement op de store is niet genoeg. */
export const GATE_POLL_MS = 200;

/** De namen in de melding: hoogstens vijf, daarna "…", zodat een sleep met een hele map de melding
 *  niet over het scherm laat lopen. Bestandsnamen blijven zoals ze zijn (geen vertaling). */
export function fileNameList(names: readonly string[]): string {
  const MAX = 5;
  return names.length <= MAX ? names.join(', ') : `${names.slice(0, MAX).join(', ')}, …`;
}

interface FileDropStore {
  getState(): Pick<AppState, 'openOpenedFile' | 'notify' | 'ui'>;
}

/**
 * Open de neergezette bestanden, in de volgorde van neerzetten, één voor één door de gewone
 * openroute. `isBlocked` is dezelfde poort als Ctrl+O (een open dialoog, een wachtende vraag).
 *
 * - Bij het neerzetten: is de poort dicht, dan wordt niets gelezen en geeft de app één melding.
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
): Promise<void> {
  if (files.length === 0) return;
  if (isBlocked()) {
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
  const mustWait = () => isBlocked() || store.getState().ui.pendingFormatNotice !== null;
  const beforeActivate = async () => {
    while (mustWait()) await new Promise((resolve) => setTimeout(resolve, GATE_POLL_MS));
  };
  for (const file of openable) {
    let opened;
    try {
      opened = await file.read();
    } catch (err) {
      console.error('Failed to read dropped file:', err);
      store.getState().notify(importFailureNotice(err, saveErrorDetail(err)));
      continue;
    }
    // `openOpenedFile` meldt een leesfout van het formaat zelf en gooit niet.
    await store.getState().openOpenedFile(opened, labels, { beforeActivate });
  }
}
