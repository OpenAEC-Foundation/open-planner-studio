import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { elementLinkCounts, taskElementLinks, uncheckedModelLinks } from '@/state/taskElementLinks';

export function TaskElementLinksNotice({ taskId }: { taskId: string }) {
  const { t } = useTranslation('task');
  const links = useAppStore(s => taskElementLinks(s, taskId));
  const unchecked = useAppStore(uncheckedModelLinks);
  if (!links || links.length === 0) return null;
  const { elements, notFound } = elementLinkCounts(links);
  return (
    <div
      className="alert alert--neutral flex flex-col items-start gap-1 break-words"
      data-ops-task-element-links={elements}
      data-ops-task-element-links-not-found={unchecked ? undefined : notFound}
    >
      <span>{t('properties.elementLinks.linked', { count: elements })}</span>
      {unchecked ? <span>{t('properties.elementLinks.unchecked')}</span>
        : notFound > 0 && <span>{t('properties.elementLinks.notFound', { count: notFound })}</span>}
    </div>
  );
}
