import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { answerIfcSchemaQuestion } from '@/state/ifcSchemaQuestionBridge';
import { ifcSchemaDisplayName, type IfcSchemaQuestion } from '@/services/ifc/ifcSchemaQuestion';
import type { IfcSchemaId } from '@/types/project';

export function IfcSchemaQuestionDialog() {
  const pending = useAppStore((s) => s.ui.pendingIfcSchemaQuestion);
  if (!pending) return null;
  return <IfcSchemaQuestionDialogBody question={pending} />;
}

function IfcSchemaQuestionDialogBody({ question }: { question: IfcSchemaQuestion }) {
  const { t } = useTranslation('common');
  const { t: tMenu } = useTranslation('menu');
  const schema = ifcSchemaDisplayName(question.fileSchema);
  const cancel = () => answerIfcSchemaQuestion(null);
  const choose = (choice: IfcSchemaId) => answerIfcSchemaQuestion(choice);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { primaryRef.current?.focus(); }, []);

  const stopFileShortcuts = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['s', 'o'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <Dialog
      onCancel={cancel}
      overlayClassName="bg-black/60 z-[90]"
      focusedButtonOwnsEnter
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] flex flex-col overflow-hidden"
      panelProps={{
        'data-ops-ifc-schema-question': true,
        'data-file-schema': question.fileSchema,
        onKeyDown: stopFileShortcuts,
      }}
    >
      <DialogHeader title={t('ifcSchemaQuestion.title')} onClose={cancel} />

      <div className="p-4 text-small leading-5">
        <p>
          {question.keep
            ? t('ifcSchemaQuestion.body', { schema })
            : t('ifcSchemaQuestion.bodyUnwritable', { schema })}
        </p>
      </div>

      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
        {question.keep ? (
          <>
            <button
              className="btn btn--sm btn--secondary"
              onClick={() => choose('IFC4X3_ADD2')}
              data-ops-ifc-schema-choice="IFC4X3_ADD2"
            >
              {t('ifcSchemaQuestion.toDefault')}
            </button>
            <button
              ref={primaryRef}
              className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]"
              onClick={() => choose(question.keep!)}
              data-ops-ifc-schema-choice={question.keep}
            >
              {t('ifcSchemaQuestion.keep', { schema })}
            </button>
          </>
        ) : (
          <>
            <button
              ref={primaryRef}
              className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]"
              onClick={() => choose('IFC4X3_ADD2')}
              data-ops-ifc-schema-choice="IFC4X3_ADD2"
            >
              {tMenu('projectInfo.ifcSchema.optionIfc4x3Add2')}
            </button>
            <button
              className="btn btn--sm btn--secondary"
              onClick={() => choose('IFC4X3')}
              data-ops-ifc-schema-choice="IFC4X3"
            >
              {tMenu('projectInfo.ifcSchema.optionIfc4x3')}
            </button>
            <button
              className="btn btn--sm btn--secondary"
              onClick={() => choose('IFC4')}
              data-ops-ifc-schema-choice="IFC4"
            >
              {tMenu('projectInfo.ifcSchema.optionIfc4')}
            </button>
          </>
        )}
      </div>
    </Dialog>
  );
}
