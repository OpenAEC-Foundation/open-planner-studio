import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { copyViaTextarea, useCopyFeedback } from '@/hooks/useCopyFeedback';
import './PromptBlock.css';

/**
 * Een prompt om in een AI-assistent te plakken: de tekst zelf, selecteerbaar, en de knop
 * *Prompt kopiëren*. Help toont hem voor een ```prompt-blok (`renderMiniMarkdown`); het venster
 * Verbindingsgegevens toont dezelfde prompt uit hetzelfde Help-artikel (`loadHelpArticlePrompt`).
 *
 * Zonder klembord-API (de dev-server via http is geen secure context) kopieert de knop via een
 * verborgen textarea; lukt ook dat niet, dan zegt de melding dat de gebruiker zelf kopieert.
 */
export function PromptBlock({ text }: { text: string }) {
  const { t } = useTranslation('menu');
  const { copiedKey, copy, markCopied } = useCopyFeedback(4000);

  const onCopy = async () => {
    if (await copy(text)) return;
    markCopied(copyViaTextarea(text) ? 'copied' : 'failed');
  };

  return (
    <div className="help-prompt" data-help-prompt="">
      <div className="help-prompt-bar">
        <button type="button" className="btn btn--sm btn--primary help-prompt-copy" onClick={() => { void onCopy(); }}>
          {copiedKey === 'copied' ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {t('backstage.helpCopyPrompt')}
        </button>
        <span className="help-prompt-status" role="status">
          {copiedKey === 'copied' && t('backstage.helpPromptCopied')}
          {copiedKey === 'failed' && t('backstage.helpPromptCopyFailed')}
        </span>
      </div>
      <pre className="help-prompt-text">{text}</pre>
    </div>
  );
}
