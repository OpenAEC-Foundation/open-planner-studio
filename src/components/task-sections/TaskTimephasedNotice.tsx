import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { taskHasActiveTimephasedSteering, taskHasTimephasedContours } from '@/utils/taskDefaults';
import { MPP_TIMEPHASED_HELP_ARTICLE_ID } from '@/state/helpArticles';

export function TaskTimephasedNotice({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const task = useAppStore(s => s.tasks.find(x => x.id === taskId));
  const openHelpArticle = useAppStore(s => s.openHelpArticle);

  if (!task) return null;
  const active = taskHasActiveTimephasedSteering(task);
  const hasContours = taskHasTimephasedContours(task);
  if (!active && !hasContours) return null;

  const mspOrigin = (task.timephasedContours ?? []).some(c => c.resourceUid !== null);
  const state: 'active' | 'lost' | 'contoured' = active ? 'active' : mspOrigin ? 'lost' : 'contoured';
  const label = state === 'active'
    ? t('properties.timephasedActive')
    : state === 'lost' ? t('properties.timephasedLost') : t('properties.timephasedContoured');

  return (
    <div className={`alert ${state === 'active' ? 'alert--info' : 'alert--neutral'} flex flex-col items-start gap-1 break-words`} data-ops-task-timephased={state}>
      <span>{label}</span>
      <button
        type="button"
        className="ops-textlink !text-body"
        onClick={() => openHelpArticle(MPP_TIMEPHASED_HELP_ARTICLE_ID)}
      >
        {tCommon('notifications.readMore')}
      </button>
    </div>
  );
}
