import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { answerForeignChangesQuestion } from '@/state/foreignChangesQuestionBridge';
import type { ForeignChangesQuestion } from '@/services/ifc/foreignChangesQuestion';
import { Dialog, DialogHeader } from '@/components/common/Dialog';

const SAVE_IS_DEFAULT = false;

export function ForeignChangesQuestionDialog() {
  const question = useAppStore(s => s.ui.pendingForeignChangesQuestion);
  if (!question) return null;
  return <ForeignChangesQuestionBody question={question} />;
}

function ForeignChangesQuestionBody({ question }: { question: ForeignChangesQuestion }) {
  const { t } = useTranslation('common');
  const [asked, setAsked] = useState({ question, dontAskAgain: false });
  if (asked.question !== question) setAsked({ question, dontAskAgain: false });
  const dontAskAgain = asked.question === question && asked.dontAskAgain;
  const saveRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const focusDefault = useCallback(() => (SAVE_IS_DEFAULT ? saveRef : cancelRef).current, []);
  const save = () => answerForeignChangesQuestion({ save: true, dontAskAgain });
  const cancel = () => answerForeignChangesQuestion({ save: false, dontAskAgain: false });
  const newFile = question.file === null;
  const buttonClass = (isDefault: boolean) => `btn btn--sm ${isDefault ? 'btn--primary' : 'btn--secondary'}`;
  return (
    <Dialog
      onCancel={cancel}
      onConfirm={SAVE_IS_DEFAULT ? save : cancel}
      focusedButtonOwnsEnter
      initialFocus={focusDefault}
      overlayClassName="bg-black/60 z-[90]"
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[480px] max-w-[90vw] flex flex-col overflow-hidden"
      panelProps={{
        'data-ops-foreign-changes-question': newFile ? 'new' : 'own',
        'data-ops-foreign-changes-count': question.count,
        'aria-labelledby': 'foreign-changes-question-title',
      }}
    >
      <DialogHeader
        title={<span id="foreign-changes-question-title">
          {newFile ? t('foreignChangesQuestion.titleNew') : t('foreignChangesQuestion.title', { file: question.file })}
        </span>}
        onClose={cancel}
      />
      <div className="p-4 text-body leading-5">
        <p>{t(newFile ? 'foreignChangesQuestion.bodyNew' : 'foreignChangesQuestion.body', { count: question.count })}</p>
      </div>
      <div className="flex items-end justify-between gap-3 px-4 py-3 border-t border-border">
        <label className="flex flex-col gap-0.5 cursor-pointer select-none">
          <span className="inline-flex items-center gap-2 text-small leading-4">
            <input
              type="checkbox"
              checked={dontAskAgain}
              onChange={e => setAsked({ question, dontAskAgain: e.target.checked })}
              data-ops-foreign-changes-dont-ask
            />
            <span>{t('foreignChangesQuestion.dontAskAgain')}</span>
          </span>
          <span className="text-caption leading-4 text-text-muted pl-6">{t('foreignChangesQuestion.dontAskAgainHint')}</span>
        </label>
        <div className="flex gap-2 shrink-0">
          <button ref={saveRef} type="button" className={buttonClass(SAVE_IS_DEFAULT)} onClick={save} data-ops-foreign-changes-save>
            {t('save')}
          </button>
          <button ref={cancelRef} type="button" className={buttonClass(!SAVE_IS_DEFAULT)} onClick={cancel} data-ops-foreign-changes-cancel>
            {t('cancel')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
