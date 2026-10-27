import { isElapsedTask } from '@/engine/scheduler/duration';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { DateTextInput } from '@/components/common/DateTextInput';
import { answerActualStartQuestion, type ActualStartAnswers } from '@/state/actualStartQuestion';
import { ACTUAL_START_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { resolveCalendar } from '@/engine/scheduler/resolveCalendar';
import { actualStartAnswerIssue } from '@/engine/progressEntry';
import { displayDate, displayDateTime } from '@/utils/displayDate';
import { statusDateAsUsed } from '@/utils/statusDateTime';
import { isHourModeCalendar } from '@/types/calendar';
import type { ActualStartQuestionItem, ActualStartQuestionRequest } from '@/state/slices/types';

/**
 * De startvraag (`engine/progressEntry.ts`). Voortgang op
 * een taak die volgens de planning pas NA de statusdatum begint, maar nog geen werkelijke start heeft:
 * de app verzint die datum niet, ze vraagt ernaar vóór de voortgang wordt toegepast.
 *
 *  - Eén regel per taak (het contextmenu of een plakactie kan er meerdere raken), met de
 *    statusdatum — of het opgegeven werkelijke einde — als voorstel. De gebruiker bevestigt zelf.
 *  - Een datum ná de statusdatum of ná het werkelijke einde bestaat niet: de regel toont waarom en
 *    Toepassen blijft uit (melden, niet raden). Dezelfde toets als de store (`actualStartAnswerIssue`).
 *  - Annuleren (knop, Escape) = er verandert niets. Een klik naast het paneel doet niets: de dialoog
 *    heeft invoervelden (backdrop-regel in `Dialog.tsx`).
 *
 * Stapelt boven "Taak bewerken" (`z-[60]`); de gedeelde dialoogstapel laat alleen de bovenste
 * dialoog op Escape/Enter reageren. Enter op de ?-knop opent Help, zonder te bevestigen.
 * Help verbergt de vraag tijdelijk, zoals bij het herstelvenster: de invoer en de resolver blijven
 * staan. Ook "Taak bewerken" verbergt zich zolang deze vraag vanuit Help wordt gelezen.
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
  const state = useAppStore.getState();
  const task = state.tasks.find(task => task.id === item.taskId);
  return actualStartAnswerIssue(value, item, task && isElapsedTask(task) ? undefined : resolveCalendar(task?.calendarId, state.calendars, state.calendar));
}

function ActualStartDialogBody({ request }: { request: ActualStartQuestionRequest }) {
  const { t } = useTranslation('common');
  const notation = useAppStore(s => s.ui.dateNotation);
  const helpOpen = useAppStore(s => s.ui.activeRibbonTab === 'file' && s.ui.backstageSection === 'help');
  const [inHelp, setInHelp] = useState(false);
  const hiddenForHelp = inHelp && helpOpen;
  // De statusdatum mét tijd als de solver die tijd gebruikt (uur-modus; besluit orkestrator 2026-10-19).
  const timeNotation = useAppStore(s => s.ui.timeNotation);
  const usesTime = useAppStore(s => isHourModeCalendar(s.calendar));
  const statusText = (iso: string) => displayDateTime(statusDateAsUsed(iso, usesTime), notation, timeNotation);
  const [answers, setAnswers] = useState<ActualStartAnswers>(() => Object.fromEntries(
    request.items.map(item => [item.taskId, item.latest.slice(0, 10)]),
  ));
  const bodyRef = useRef<HTMLDivElement>(null);

  const issues = request.items.map(item => issueOf(answers[item.taskId] ?? '', item));
  const valid = issues.every(issue => issue === null);
  const confirm = () => {
    // Een onbestaande datum blijft lokaal in DateTextInput: bevestig nooit de oudere geldige waarde.
    const invalid = bodyRef.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]');
    if (invalid) { invalid.focus(); return; }
    if (valid) answerActualStartQuestion({ ...answers });
  };
  const cancel = () => answerActualStartQuestion(null);

  // De focus-trap kiest dit veld bij openen én hervatten. Een los effect zou bij hervatten met
  // de opnieuw gemounte trap concurreren, die anders de ?-knop als eerste focusbare element kiest.
  const initialFocus = useCallback(() => bodyRef.current?.querySelector<HTMLInputElement>('input') ?? null, []);

  const first = request.items[0];
  const intro = request.items.length === 1
    ? t('actualStartQuestion.introOne', { name: first.taskName, statusDate: statusText(first.statusDate) })
    : t('actualStartQuestion.introMany', { statusDate: statusText(first.statusDate) });

  return (
    <Dialog
      suspended={hiddenForHelp}
      initialFocus={initialFocus}
      onCancel={cancel}
      onConfirm={confirm}
      focusedButtonOwnsEnter
      overlayClassName="bg-black/60 z-[60]"
      stopBackdropPropagation
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[460px] max-h-[85vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-actual-start-dialog': true }}
    >
      <DialogHeader
        title={t('actualStartQuestion.title')}
        onClose={cancel}
        help={{ articleId: ACTUAL_START_HELP_ARTICLE_ID, close: () => setInHelp(true) }}
      />
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
                      ? t('actualStartQuestion.afterStatusDate', { date: statusText(item.statusDate) })
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
