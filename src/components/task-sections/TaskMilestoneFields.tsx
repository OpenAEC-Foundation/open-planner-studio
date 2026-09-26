import { useTranslation } from 'react-i18next';
import { Task, MilestoneKind } from '@/types/task';
import { Field } from './shared';
import { milestoneRefusal, taskMilestoneTransition } from '@/engine/taskMilestoneTransition';
import { useAppStore } from '@/state/appStore';
import { milestoneRefusalNotices } from '@/state/structuralTransition';

/**
 * Mijlpaal-checkbox + mijlpaal-soort + verplicht-vlag — sectie van
 * `TaskPropertiesPanel`. `{ task, onChange }`; alleen de "wordt mijlpaal"-regel
 * leest de toewijzingen uit de store en meldt een weigering via het ene meldingskanaal — zo weigeren
 * paneel én dialoog (die hier een concept doorgeeft) vóór er iets in de patch of het concept landt.
 */
export function TaskMilestoneFields({ task, onChange }: {
  task: Task;
  onChange: (patch: Partial<Task>) => void;
}) {
  const { t } = useTranslation('task');
  const hasAssignments = useAppStore(s => s.assignments.some(a => a.taskId === task.id));
  const notify = useAppStore(s => s.notify);

  return (
    <>
      <div className="flex gap-2">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={task.isMilestone}
            onChange={e => {
              // Wordt mijlpaal: een fase of een taak met toewijzingen weigert, net als
              // raster, MCP en store. Het vinkje is gecontroleerd en blijft dus gewoon uit.
              if (e.target.checked && !task.isMilestone) {
                const refusal = milestoneRefusal({ hasChildren: task.childIds.length > 0, hasAssignments });
                if (refusal) {
                  for (const notice of milestoneRefusalNotices([{ name: task.name, refusal }])) notify(notice);
                  return;
                }
              }
              onChange(taskMilestoneTransition(task, e.target.checked));
            }}
            className="accent-accent"
          />
          {t('properties.milestone')}
        </label>
      </div>

      {task.isMilestone && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('properties.milestoneKind')}>
            <select
              value={task.milestoneKind ?? 'AUTO'}
              onChange={e => {
                const v = e.target.value;
                onChange({ milestoneKind: v === 'AUTO' ? undefined : (v as MilestoneKind) });
              }}
              className="input !text-small !leading-4 !px-2.5 !py-1.5"
            >
              <option value="AUTO">{t('milestoneKind.AUTO')}</option>
              <option value="START">{t('milestoneKind.START')}</option>
              <option value="FINISH">{t('milestoneKind.FINISH')}</option>
            </select>
          </Field>
          <label className="flex items-center gap-1.5 self-end pb-1.5">
            <input
              type="checkbox"
              checked={!!task.mandatory}
              onChange={e => onChange({ mandatory: e.target.checked || undefined })}
              className="accent-accent"
            />
            {t('properties.mandatory')}
          </label>
        </div>
      )}
    </>
  );
}
