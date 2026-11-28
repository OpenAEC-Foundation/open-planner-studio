import type { SaveOutcome } from '@/services/fileAccess';
import { BROWSER_SAVE_HELP_ARTICLE_ID } from '@/state/helpArticles';
import type { NotifyInput } from './slices/types';

let explainedThisSession = false;

export interface BrowserSaveContext {
  hadFile: boolean;
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
    durationMs: 15_000,
  };
}

export function resetBrowserSaveNoticeForTests(): void {
  explainedThisSession = false;
}
