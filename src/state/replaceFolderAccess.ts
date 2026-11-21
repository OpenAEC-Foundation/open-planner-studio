// #804, knownbug 1762: vóór de vervanging van een bestaand bestand op de desktop (Ctrl+S op het eigen bestand met een
// vreemd deel, en Opslaan als over een bestaand bestand) eenmalig toegang tot de map van dat bestand, als de app daar
// geen hulpbestand mag zetten (buiten de thuismap). Zie `services/fileAccess/replaceFolderAccess.ts`. De vraag staat vóór
// de merge, binnen dezelfde opslagbeurt; alles wat daarna beslist (de doelcontrole, `refuseChangedDocumentWrite`,
// `stopBeforeWrite`, `refuseBeforePlace`) kijkt naar de stand van ná de vraag. Automatisch opslaan komt hier niet langs.
import { requestReplaceFolderAccess } from '@/services/fileAccess';
import { replaceFolder } from '@/services/fileAccess/replaceFolderAccess';
import { ifcForeignContentEnabled, type FeatureFlagValues } from '@/utils/featureFlags';
import { refusalNotice } from './refusalNotice';
import type { NotifyInput } from './slices/types';

/** Niet opgeslagen: de planner gaf de map niet vrij (geannuleerd, of een andere map gekozen). Eén zin voor Ctrl+S en
 *  Opslaan als (vraag P4 van de eigenaar, 21 november 2026). */
export const folderAccessMissingNotice = (path: string): NotifyInput => refusalNotice({
  messageKey: 'notifications.ifcForeignFolderAccessMissing', params: { folder: replaceFolder(path) },
  dedupeKey: 'ifc-foreign-folder-access-missing',
});

/** `true` = niet vervangen: de app heeft geen toegang tot de map van `path` en de planner gaf haar niet vrij (gemeld).
 *  Alleen met de flag `ifcForeignContent` aan; met de flag uit `false` zonder één aanroep aan de bestandsrand, zoals
 *  main. */
export async function refusedReplaceFolderAccess(
  flags: Readonly<FeatureFlagValues>, path: string, notify: (notice: NotifyInput) => void,
): Promise<boolean> {
  if (!ifcForeignContentEnabled(flags)) return false;
  if (await requestReplaceFolderAccess(path) === 'ok') return false;
  notify(folderAccessMissingNotice(path));
  return true;
}
