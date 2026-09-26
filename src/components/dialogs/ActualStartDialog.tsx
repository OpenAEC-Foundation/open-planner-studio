import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { DateTextInput } from '@/components/common/DateTextInput';
import { answerActualStartQuestion, type ActualStartAnswers } from '@/state/actualStartQuestion';
import { actualStartAnswerIssue } from '@/engine/progressEntry';
import { displayDate } from '@/utils/displayDate';
import type { ActualStartQuestionItem, ActualStartQuestionRequest } from '@/state/slices/types';

/**
 * De vraag naar de werkelijke start (Z1b, besluit eigenaar — `engine/progressEntry.ts`). Voortgang op
 * een taak die volgens de planning pas NA de statusdatum begint, maar nog geen werkelijke start heeft:
 * de app verzint die datum niet, ze vraagt ernaar vóór de voortgang wordt toegepast.
 *
 *  - Eén regel per taak (het contextmenu of een plakactie kan er meerdere raken), met de
 *    statusdatum — of het opgegeven werkelijke einde — als voorstel. De gebruiker bevestigt zelf.
 *  - Een datum ná de statusdatum of ná het werkelijke einde bestaat niet: de regel toont waarom en
 *    Toepassen blijft uit (melden, niet raden). Dezelfde toets als de store (`actualStartAnswerIssue`).
 *  - Annuleren (knop, Escape) = er verandert niets. Een klik naast het paneel doet niets: de dialoog
 *    heeft invoervelden (regel uit issue #158).
 *
 * Stapelt boven "Taak bewerken" (`z-[60]`), daarom eigen Escape/Enter-afhandeling in de capture-fase
 * (zoals `ConfirmDialog`): anders zou Enter hier óók het Opslaan van de dialoog eronder triggeren.
 */
export function ActualStartDialog() {
  const pending = useAppStore(s => s.ui.pendingActualStartQuestion);
  if (!pending) return null;
  // Nieuwe vraag ⇒ verse invoerstaat.
  return <ActualStartDialogBody key={pending.items.map(item => item.taskId).join('|')} request={pending} />;
}

type Issue = 'required' | 'afterStatusDate' | 'actualFinishBeforeStart';

function issueOf(value: string, item: ActualStartQuestionItem): Issue | null {
  if (!value) return 'required';
  return actualStartAnswerIssue(value, item);
}

function ActualStartDialogBody({ request }: { request: ActualStartQuestionRequest }) {
  const { t } = useTranslation('common');
  const notation = useAppStore(s => s.ui.dateNotation);
  const [answers, setAnswers] = useState<ActualStartAnswers>(() => Object.fromEntries(
    request.items.map(item => [item.taskId, item.latest.slice(0, 10)]),
  ));
  const bodyRef = useRef<HTMLDivElement>(null);

  const issues = request.items.map(item => issueOf(answers[item.taskId] ?? '', item));
  const valid = issues.every(issue => issue === null);
  const confirm = () => { if (valid) answerActualStartQuestion({ ...answers }); };
  const cancel = () => answerActualStartQuestion(null);

  // Capture-fase: zie de docstring (stapeling boven "Taak bewerken").
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); answerActualStartQuestion(null); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); confirmRef.current(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  // Focus op het eerste datumveld, zodat de gebruiker meteen kan typen of bevestigen.
  useEffect(() => {
    bodyRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, []);

  const first = request.items[0];
  const intro = request.items.length === 1
    ? t('actualStartQuestion.introOne', { name: first.taskName, statusDate: displayDate(first.statusDate, notation) })
    : t('actualStartQuestion.introMany', { statusDate: displayDate(first.statusDate, notation) });

  return (
    <Dialog
      overlayClassName="bg-black/60 z-[60]"
      stopBackdropPropagation
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] max-h-[85vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-actual-start-dialog': true }}
    >
      <DialogHeader title={t('actualStartQuestion.title')} onClose={cancel} />
      <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-small leading-4">
        <p className="text-text-secondary">{intro}</p>
        {request.items.map((item, index) => {
          const issue = issues[index];
          const latest = displayDate(item.latest, notation);
          return (
            <div key={item.taskId} className="flex flex-col gap-1" data-ops-actual-start-row={item.taskId}>
              <span className="font-semibold text-text-primary">{item.taskName}</span>
              <DateTextInput
                value={answers[item.taskId] ?? ''}
                // Lokale invoerstaat mét live foutmelding: `live` is hier de bedoelde modus.
                commitMode="live"
                onCommit={value => setAnswers(current => ({ ...current, [item.taskId]: value }))}
                ariaLabel={t('actualStartQuestion.fieldLabel', { name: item.taskName })}
                className="input !text-small !leading-4 !px-2.5 !py-1.5"
              />
              {issue === null && (
                <span className="text-text-secondary">{t('actualStartQuestion.latest', { date: latest })}</span>
              )}
              {issue !== null && (
                <span role="alert" style={{ color: 'var(--error)' }}>
                  {issue === 'required'
                    ? t('actualStartQuestion.required')
                    : issue === 'afterStatusDate'
                      ? t('actualStartQuestion.afterStatusDate', { date: displayDate(item.statusDate, notation) })
                      : t('actualStartQuestion.afterActualFinish', { date: latest })}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-3 px-4 py-3 border-t border-border">
        <button onClick={cancel} className="btn btn--sm btn--secondary" data-ops-actual-start-cancel>
          {t('cancel')}
        </button>
        <button
          onClick={confirm}
          disabled={!valid}
          className="btn btn--sm btn--primary shadow-[var(--shadow-glow)]"
          data-ops-actual-start-confirm
        >
          {t('actualStartQuestion.confirm')}
        </button>
      </div>
    </Dialog>
  );
}
