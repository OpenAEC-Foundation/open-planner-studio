import { useEffect, useRef, useState } from 'react';
import { holdAutoCalc } from '@/state/editHold';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { TaskDateTimeInput } from '@/components/common/TaskDateTimeInput';
import type { ActualStartQuestion, ProgressEntryResult } from '@/engine/progressEntry';
import { askActualStart } from '@/state/actualStartQuestion';
import { Field } from './shared';
import { durationSuffixesFrom, formatRemainingDurationText } from '@/utils/taskDuration';
import { isSummaryTask } from '@/utils/taskHierarchy';

let progressSeq = 0;

type EntryOpts = { coalesceKey?: string; actualStart?: string };
type EntryRefusal = 'afterStatusDate' | 'actualFinishBeforeStart';

export function TaskProgressFields({ task, onSetProgress, onSetActualStart, onSetActualFinish }: {
  task: Task;
  onSetProgress: (completion: number, opts?: EntryOpts) => ProgressEntryResult;
  onSetActualStart: (date: string | undefined, opts?: EntryOpts) => ProgressEntryResult;
  onSetActualFinish: (date: string | undefined, opts?: EntryOpts) => ProgressEntryResult;
}) {
  const { t, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const [actualError, setActualError] = useState<EntryRefusal | null>(null);
  const dragKey = useRef<string | undefined>(undefined);
  const derived = isSummaryTask(task);
  const releaseHold = useRef<(() => void) | null>(null);
  useEffect(() => () => { releaseHold.current?.(); }, []);
  const pendingQuestion = useRef<{ question: ActualStartQuestion; retry: (actualStart: string) => ProgressEntryResult } | null>(null);
  const [pendingPercent, setPendingPercent] = useState<number | null>(null);

  const clearPending = () => {
    pendingQuestion.current = null;
    setPendingPercent(null);
  };

  const ask = async (question: ActualStartQuestion, retry: (actualStart: string) => ProgressEntryResult) => {
    const answers = await askActualStart([{ ...question, taskName: task.name }]);
    const answer = answers?.[question.taskId];
    if (!answer) return;
    const result = retry(answer);
    setActualError(result.ok || result.reason === 'needsActualStart' || result.reason === 'summaryTask' ? null : result.reason);
  };

  const handle = (
    result: ProgressEntryResult,
    retry: (actualStart: string) => ProgressEntryResult,
    slidePercent?: number,
  ): false | undefined => {
    if (result.ok) {
      setActualError(null);
      if (slidePercent !== undefined) clearPending();
      return undefined;
    }
    if (result.reason !== 'needsActualStart') {
      setActualError(result.reason === 'summaryTask' ? null : result.reason);
      return false;
    }
    setActualError(null);
    if (slidePercent !== undefined && dragKey.current) {
      pendingQuestion.current = { question: result.question, retry };
      setPendingPercent(slidePercent);
      return false;
    }
    void ask(result.question, retry);
    return false;
  };

  const endDrag = () => {
    dragKey.current = undefined;
    releaseHold.current?.();
    releaseHold.current = null;
    const pending = pendingQuestion.current;
    clearPending();
    if (pending) void ask(pending.question, pending.retry);
  };
  const cancelDrag = () => {
    dragKey.current = undefined;
    releaseHold.current?.();
    releaseHold.current = null;
    clearPending();
  };

  return (
    <>
      {derived && (
        <span className="!text-small text-text-secondary" data-ops-summary-progress-note>
          {t('properties.progress.summaryDerived')}
        </span>
      )}
      <Field label={t('properties.completion')}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={pendingPercent ?? Math.round(task.time.completion * 100)}
            onPointerDown={() => {
              dragKey.current = `progress:${task.id}:${++progressSeq}`;
              releaseHold.current?.();
              releaseHold.current = holdAutoCalc();
            }}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
            onLostPointerCapture={() => { if (dragKey.current) endDrag(); }}
            onChange={e => {
              const percent = parseInt(e.target.value);
              const completion = percent / 100;
              handle(
                onSetProgress(completion, dragKey.current ? { coalesceKey: dragKey.current } : undefined),
                actualStart => onSetProgress(completion, { actualStart }),
                percent,
              );
            }}
            disabled={derived}
            data-ops-progress-slider
            className={`flex-1 accent-accent${derived ? ' opacity-60' : ''}`}
          />
          <span className="w-8 text-right">{pendingPercent ?? Math.round(task.time.completion * 100)}%</span>
        </div>
      </Field>

      {task.isMilestone ? (
        <Field label={t('properties.progress.actualDate')}>
          <TaskDateTimeInput
            task={task}
            side="end"
            dataAttribute="actual-date"
            className="input !text-small !leading-4 !px-2.5 !py-1.5"
            ariaLabel={t('properties.progress.actualDate')}
            value={task.time.actualFinish ?? ''}
            disabled={derived}
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
              <TaskDateTimeInput
                task={task}
                side="start"
                dataAttribute="actual-start"
                className="input !text-small !leading-4 !px-2.5 !py-1.5"
                ariaLabel={t('properties.progress.actualStart')}
                value={task.time.actualStart ?? ''}
                disabled={derived}
                onCommit={v => handle(
                  onSetActualStart(v || undefined, { coalesceKey: `actualStart:${task.id}` }),
                  () => onSetActualStart(v || undefined),
                )}
              />
            </Field>
            <Field label={t('properties.progress.actualFinish')}>
              <TaskDateTimeInput
                task={task}
                side="end"
                dataAttribute="actual-finish"
                className="input !text-small !leading-4 !px-2.5 !py-1.5"
                ariaLabel={t('properties.progress.actualFinish')}
                value={task.time.actualFinish ?? ''}
                disabled={derived}
                onCommit={v => handle(
                  onSetActualFinish(v || undefined, { coalesceKey: `actualFinish:${task.id}` }),
                  actualStart => onSetActualFinish(v || undefined, { actualStart }),
                )}
              />
            </Field>
          </div>
          <Field label={t('properties.progress.remaining')}>
            <input
              value={formatRemainingDurationText(task, { suffixes: durationSuffixesFrom(tCommon), locale: i18n.language })}
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
