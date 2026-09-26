import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { DateTextInput } from '@/components/common/DateTextInput';
import type { ActualStartQuestion, ProgressEntryResult } from '@/engine/progressEntry';
import { askActualStart } from '@/state/actualStartQuestion';
import { Field } from './shared';

// Uniek per slider-gebaar: coalesceKey per pointer-sleep ⇒ één undo-stap i.p.v. één per stap.
let progressSeq = 0;

/**
 * Voortgang/completion + werkelijke start/finish + resterend (fase 2.6, §11.3) — sectie 7 uit
 * `TaskPropertiesPanel` (fase 2.10, item 2).
 *
 * AFWIJKING van het pure `{ task, onChange }`-CalendarForm-patroon: het paneel roept vandaag NIET
 * de generieke patch-actie aan, maar drie dedicated store-acties (`setTaskProgress`/
 * `setActualStart`/`setActualFinish`) die §3.2-invarianten afdwingen (auto-actualStart bij
 * completion>0, actualFinish laten vallen bij terugdraaien, en — belangrijkst — actuals ná de
 * statusdatum WEIGEREN met een boolean-retourwaarde). Die invariant-logica zit in de store
 * (taskSlice.ts, `applyProgressInvariants`) en mag niet gedupliceerd worden. Om
 * `TaskPropertiesPanel`'s gedrag exact te behouden (harde eis, item 2) krijgt deze sectie daarom
 * drie EXPLICIETE setter-props i.p.v. de generieke `onChange`: het paneel geeft de echte
 * store-acties door (instant-apply, ongewijzigd); de dialoog geeft lokale equivalenten door die op
 * de eigen draft werken (dezelfde §3.2-functies, maar pas gecommit op Save — zie
 * `state/taskDialogSave.ts`).
 *
 * Voortgang INVULLEN (`engine/progressEntry.ts`): elke setter geeft een `ProgressEntryResult` terug.
 * Een weigering toont deze sectie zelf; `needsActualStart` (Z1b: een taak die pas na de statusdatum
 * zou beginnen, nog zonder werkelijke start) beantwoordt ze met de ene vraagdialoog
 * (`askActualStart`) en roept de setter opnieuw aan met het antwoord — annuleren verandert niets.
 * Tijdens een sleep met de schuif wordt pas bij het loslaten gevraagd; tot dan toont de schuif de
 * gesleepte waarde zonder iets toe te passen.
 */
type EntryOpts = { coalesceKey?: string; actualStart?: string };
type EntryRefusal = 'afterStatusDate' | 'actualFinishBeforeStart';

export function TaskProgressFields({ task, onSetProgress, onSetActualStart, onSetActualFinish }: {
  task: Task;
  onSetProgress: (completion: number, opts?: EntryOpts) => ProgressEntryResult;
  onSetActualStart: (date: string | undefined, opts?: EntryOpts) => ProgressEntryResult;
  onSetActualFinish: (date: string | undefined, opts?: EntryOpts) => ProgressEntryResult;
}) {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const [actualError, setActualError] = useState<EntryRefusal | null>(null);
  const dragKey = useRef<string | undefined>(undefined);
  // Z1b tijdens een sleep: de vraag wacht tot het loslaten; de schuif toont zolang de gesleepte waarde.
  const pendingQuestion = useRef<{ question: ActualStartQuestion; retry: (actualStart: string) => ProgressEntryResult } | null>(null);
  const [pendingPercent, setPendingPercent] = useState<number | null>(null);

  const clearPending = () => {
    pendingQuestion.current = null;
    setPendingPercent(null);
  };

  const ask = async (question: ActualStartQuestion, retry: (actualStart: string) => ProgressEntryResult) => {
    const answers = await askActualStart([{ ...question, taskName: task.name }]);
    const answer = answers?.[question.taskId];
    if (!answer) return; // Annuleren: er verandert niets.
    const result = retry(answer);
    setActualError(result.ok || result.reason === 'needsActualStart' ? null : result.reason);
  };

  /** Verwerk de uitkomst van een setter. `slidePercent`: de aanroep kwam van de schuif. */
  const handle = (
    result: ProgressEntryResult,
    retry: (actualStart: string) => ProgressEntryResult,
    slidePercent?: number,
  ) => {
    if (result.ok) {
      setActualError(null);
      if (slidePercent !== undefined) clearPending();
      return;
    }
    if (result.reason !== 'needsActualStart') {
      setActualError(result.reason);
      return;
    }
    setActualError(null);
    if (slidePercent !== undefined && dragKey.current) {
      pendingQuestion.current = { question: result.question, retry };
      setPendingPercent(slidePercent);
      return;
    }
    void ask(result.question, retry);
  };

  const endDrag = () => {
    dragKey.current = undefined;
    const pending = pendingQuestion.current;
    clearPending();
    if (pending) void ask(pending.question, pending.retry);
  };

  return (
    <>
      <Field label={t('properties.completion')}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={pendingPercent ?? Math.round(task.time.completion * 100)}
            onPointerDown={() => { dragKey.current = `progress:${task.id}:${++progressSeq}`; }}
            onPointerUp={endDrag}
            onPointerCancel={() => { dragKey.current = undefined; clearPending(); }}
            onChange={e => {
              const percent = parseInt(e.target.value);
              const completion = percent / 100;
              handle(
                onSetProgress(completion, dragKey.current ? { coalesceKey: dragKey.current } : undefined),
                actualStart => onSetProgress(completion, { actualStart }),
                percent,
              );
            }}
            data-ops-progress-slider
            className="flex-1 accent-accent"
          />
          <span className="w-8 text-right">{pendingPercent ?? Math.round(task.time.completion * 100)}%</span>
        </div>
      </Field>

      {/* Werkelijke datums (fase 2.6, §11.3): mijlpaal ⇒ één "Werkelijke datum"; anders start+einde.
          De acties dwingen de invarianten af en weigeren datums ná de statusdatum (toast). */}
      {task.isMilestone ? (
        <Field label={t('properties.progress.actualDate')}>
          <DateTextInput
            className="input !text-small !leading-4 !px-2.5 !py-1.5"
            ariaLabel={t('properties.progress.actualDate')}
            value={task.time.actualFinish ?? ''}
            onCommit={v => handle(
              onSetActualFinish(v || undefined, { coalesceKey: `actualFinish:${task.id}` }),
              actualStart => onSetActualFinish(v || undefined, { actualStart }),
            )}
          />
        </Field>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('properties.progress.actualStart')}>
              <DateTextInput
                className="input !text-small !leading-4 !px-2.5 !py-1.5"
                ariaLabel={t('properties.progress.actualStart')}
                value={task.time.actualStart ?? ''}
                onCommit={v => handle(
                  onSetActualStart(v || undefined, { coalesceKey: `actualStart:${task.id}` }),
                  () => onSetActualStart(v || undefined),
                )}
              />
            </Field>
            <Field label={t('properties.progress.actualFinish')}>
              <DateTextInput
                className="input !text-small !leading-4 !px-2.5 !py-1.5"
                ariaLabel={t('properties.progress.actualFinish')}
                value={task.time.actualFinish ?? ''}
                onCommit={v => handle(
                  onSetActualFinish(v || undefined, { coalesceKey: `actualFinish:${task.id}` }),
                  actualStart => onSetActualFinish(v || undefined, { actualStart }),
                )}
              />
            </Field>
          </div>
          <Field label={t('properties.progress.remaining')}>
            <input
              value={task.time.remainingTime ?? Math.round(task.time.scheduleDuration * (1 - task.time.completion))}
              disabled
              className="input !text-small !leading-4 !px-2.5 !py-1.5 opacity-60"
            />
          </Field>
        </>
      )}
      {actualError && (
        <div className="!text-body" style={{ color: 'var(--error)' }}>
          {actualError === 'afterStatusDate'
            ? tCommon('progress.actualsAfterStatusDate')
            : tCommon('progress.actualStartAfterFinish')}
        </div>
      )}
    </>
  );
}
