import { useCallback, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { answerFolderAccessQuestion } from '@/state/folderAccessQuestionBridge';
import { Dialog, DialogHeader } from '@/components/common/Dialog';

export function FolderAccessQuestionDialog() {
  const folder = useAppStore(s => s.ui.pendingFolderAccessQuestion);
  const { t } = useTranslation('common');
  const chooseRef = useRef<HTMLButtonElement>(null);
  const focusChoose = useCallback(() => chooseRef.current, []);
  if (folder === null) return null;
  const cancel = () => answerFolderAccessQuestion(false);
  const stopFileShortcuts = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['s', 'o'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  return (
    <Dialog
      onCancel={cancel}
      focusedButtonOwnsEnter
      initialFocus={focusChoose}
      overlayClassName="bg-black/60 z-[90]"
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] max-w-[90vw] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-folder-access-question': true, 'aria-labelledby': 'folder-access-question-title', onKeyDown: stopFileShortcuts }}
    >
      <DialogHeader title={<span id="folder-access-question-title">{t('folderAccessQuestion.title')}</span>} onClose={cancel} />
      <div className="p-4 text-body leading-5"><p className="[overflow-wrap:anywhere]">{t('folderAccessQuestion.body', { folder })}</p></div>
      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
        <button type="button" className="btn btn--sm btn--secondary" onClick={cancel}>
          {t('folderAccessQuestion.cancel')}
        </button>
        <button ref={chooseRef} type="button" className="btn btn--sm btn--primary" onClick={() => answerFolderAccessQuestion(true)}>
          {t('folderAccessQuestion.choose')}
        </button>
      </div>
    </Dialog>
  );
}
