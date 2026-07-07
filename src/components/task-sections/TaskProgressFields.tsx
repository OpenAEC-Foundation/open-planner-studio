import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Task } from '@/types/task';
import { DateTextInput } from '@/components/common/DateTextInput';
import { Field } from './shared';

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
 * de eigen draft werken (zelfde §3.2-gedrag, maar pas gecommit op Save — zie `TaskDialog.tsx`).
 */
export function TaskProgressFields({ task, onSetProgress, onSetActualStart, onSetActualFinish }: {
  task: Task;
  onSetProgress: (completion: number) => void;
  onSetActualStart: (date: string | undefined) => boolean;
  onSetActualFinish: (date: string | undefined) => boolean;
}) {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const [actualError, setActualError] = useState(false);

  return (
    <>
      <Field label={t('properties.completion')}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(task.time.completion * 100)}
            onChange={e => onSetProgress(parseInt(e.target.value) / 100)}
            data-ops-progress-slider
            className="flex-1 accent-accent"
          />
          <span className="w-8 text-right">{Math.round(task.time.completion * 100)}%</span>
        </div>
      </Field>

      {/* Werkelijke datums (fase 2.6, §11.3): mijlpaal ⇒ één "Werkelijke datum"; anders start+einde.
          De acties dwingen de invarianten af en weigeren datums ná de statusdatum (toast). */}
      {task.isMilestone ? (
        <Field label={t('properties.progress.actualDate')}>
          <DateTextInput
            className="input !text-xs !px-2.5 !py-1.5"
            ariaLabel={t('properties.progress.actualDate')}
            value={task.time.actualFinish ?? ''}
            onCommit={v => { setActualError(!onSetActualFinish(v || undefined)); }}
          />
        </Field>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('properties.progress.actualStart')}>
              <DateTextInput
                className="input !text-xs !px-2.5 !py-1.5"
                ariaLabel={t('properties.progress.actualStart')}
                value={task.time.actualStart ?? ''}
                onCommit={v => { setActualError(!onSetActualStart(v || undefined)); }}
              />
            </Field>
            <Field label={t('properties.progress.actualFinish')}>
              <DateTextInput
                className="input !text-xs !px-2.5 !py-1.5"
                ariaLabel={t('properties.progress.actualFinish')}
                value={task.time.actualFinish ?? ''}
                onCommit={v => { setActualError(!onSetActualFinish(v || undefined)); }}
              />
            </Field>
          </div>
          <Field label={t('properties.progress.remaining')}>
            <input
              value={task.time.remainingTime ?? Math.round(task.time.scheduleDuration * (1 - task.time.completion))}
              disabled
              className="input !text-xs !px-2.5 !py-1.5 opacity-60"
            />
          </Field>
        </>
      )}
      {actualError && (
        <div className="text-[11px]" style={{ color: 'var(--error)' }}>
          {tCommon('progress.actualsAfterStatusDate')}
        </div>
      )}
    </>
  );
}
