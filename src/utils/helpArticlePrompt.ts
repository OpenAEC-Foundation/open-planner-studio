// De prompt van een Help-artikel buiten Help: het venster Verbindingsgegevens toont de setup-prompt
// uit `howto-ai-assistent-koppelen`. Het artikel is de enige bron van die tekst, in elke taal; zo kunnen
// Help en het venster niet uit elkaar lopen (bewaakt door check-help-manifest.ts en de browsertest
// ai-connection-copy.spec.ts).
import {
  articleLang, isHelpDocLang, isHelpSourceLang, resolveHelpDocLang, type HelpDocIndex, type HelpDocLang,
} from '@/utils/helpManifest';
import { promptBlocksOf } from '@/utils/miniMarkdown';
import { readLocal } from '@/utils/settingsStore';
import { fetchTextAsset } from '@/utils/textAsset';

/** De docstaal die de gebruiker in Help los van de UI-taal vastzette (localStorage). */
export const HELP_DOCS_LANG_KEY = 'ops-docs-locale';

async function docIndex(base: string, lang: HelpDocLang): Promise<HelpDocIndex | null> {
  try {
    const res = await fetch(`${base}docs/${lang}/index.json`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return data && typeof data === 'object' && !Array.isArray(data) ? data as HelpDocIndex : null;
  } catch {
    return null;
  }
}

const firstPrompt = async (base: string, id: string, lang: HelpDocLang): Promise<string | null> =>
  promptBlocksOf(await fetchTextAsset(`${base}docs/${lang}/${id}.md`))[0] ?? null;

/**
 * Het eerste promptblok van artikel `id`, in de taal waarin Help dat artikel toont: dezelfde keuze als
 * HelpPanel (de vastgezette docstaal, anders de UI-taal; een artikel buiten de index van die taal, of
 * dat niet laadt, leest Engels). Heeft die vertaling (nog) geen promptblok, dan de Engelse prompt.
 * `null` als ook die er niet is. `base` is de app-basis (`BASE_URL`); een test geeft hem zelf.
 */
export async function loadHelpArticlePrompt(
  id: string,
  uiLang: string,
  base: string = import.meta.env.BASE_URL,
): Promise<string | null> {
  const saved = readLocal(HELP_DOCS_LANG_KEY);
  const { lang } = resolveHelpDocLang(uiLang, isHelpDocLang(saved) ? saved : null);
  const want = isHelpSourceLang(lang) ? lang : articleLang(id, lang, await docIndex(base, lang)).lang;
  const shown = await firstPrompt(base, id, want).catch(() => undefined);
  if (shown) return shown;
  return want === 'en' ? null : firstPrompt(base, id, 'en');
}
