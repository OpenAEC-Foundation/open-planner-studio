import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { copyViaTextarea, useCopyFeedback } from '@/hooks/useCopyFeedback';
import './PromptBlock.css';

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
          {copiedKey === 'copied' ? <Icon id="status.success" size={14} /> : <Icon id="edit.copy" size={14} />}
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
