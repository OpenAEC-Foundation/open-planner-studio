import type { SaveOutcome } from '@/services/fileAccess';
import { BROWSER_SAVE_HELP_ARTICLE_ID } from '@/state/helpArticles';
import type { NotifyInput } from './slices/types';

/**
 * Uitleg voor browsergebruikers bij *Opslaan* (review 2026-10-06, punt 4). Kan de browser niet
 * terugschrijven naar het bestand van het project, dan geeft elke Ctrl+S opnieuw een
 * opslaanvenster of een download — en dat voelt als "Opslaan als". De gebruiker krijgt dan één keer
 * per sessie uitleg waarom, met een link naar de handleiding. Daarna niet meer: de uitleg mag geen
 * ruis worden. De eerste keer opslaan van een nieuw project via een venster is gewoon normaal en
 * krijgt geen uitleg; een download wel, want die landt ongevraagd in de downloadmap.
 *
 * Alleen voor de browser: op de desktop schrijft *Opslaan* altijd terug.
 */
let explainedThisSession = false;

export interface BrowserSaveContext {
  /** Had het project al een bestand (een handle of een naam) vóór deze opslag? */
  hadFile: boolean;
  /** Naam van het bestaande bestand, voor in de uitleg. */
  existingName: string | null;
  outcome: SaveOutcome;
}

export function browserSaveNotice({ hadFile, existingName, outcome }: BrowserSaveContext): NotifyInput | null {
  if (explainedThisSession) return null;
  if (!outcome.viaDownload && !hadFile) return null;
  explainedThisSession = true;
  return {
    severity: 'info',
    messageKey: outcome.viaDownload ? 'notifications.browserSavesAsDownload' : 'notifications.browserCannotOverwrite',
    params: { name: outcome.viaDownload ? outcome.name : (existingName ?? outcome.name) },
    helpArticleId: BROWSER_SAVE_HELP_ARTICLE_ID,
    // Drie zinnen uitleg plus een link: 5 s is te kort om te lezen (review 2026-10-06).
    durationMs: 15_000,
  };
}

/** Alleen voor tests: begin alsof de pagina net geladen is. */
export function resetBrowserSaveNoticeForTests(): void {
  explainedThisSession = false;
}
