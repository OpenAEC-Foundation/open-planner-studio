import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { formatExternalLagShort } from '@/engine/taskGrid/relationFormat';
import { parseableHourSuffix } from '@/utils/durationFormat';
import { localizeDecimalPoint } from '@/utils/reportNumber';

function anchorText(anchor: string): string {
  return anchor.replace('T', ' ');
}

export function TaskDependentsSection({ taskId }: { taskId: string }) {
  const { t, i18n } = useTranslation('task');
  const { t: tCommon } = useTranslation('common');
  const links = useAppStore(s => {
    const result = s.ui.dependentProjects.find(r => r.documentId === s.activeDocumentId);
    return result && result.projectId === s.project.id ? result.links : undefined;
  });
  const own = links?.filter(l => l.ownTaskId === taskId) ?? [];
  if (own.length === 0) return null;
  const hourSuffix = parseableHourSuffix(tCommon('duration.suffixHour'));
  return (
    <>
      <div className="h-px" style={{ background: 'var(--theme-border-light)' }} />
      <span className="ui-card-header !text-small !leading-4">{t('dependents.title')}</span>
      <ul className="flex flex-col gap-1" data-ops-dependents>
        {own.map(link => {
          const lag = localizeDecimalPoint(formatExternalLagShort(link, hourSuffix), i18n.language);
          const role = link.direction === 'predecessor' ? 'successor' : 'predecessor';
          return (
            <li
              key={`${link.projectId}:${link.taskId}:${link.linkId}`}
              className="text-small leading-4"
              data-ops-dependent-link={link.linkId}
            >
              <div className="truncate" title={link.fileName ?? link.projectName}>
                <b>{link.projectName}</b>: {link.taskName}
              </div>
              <div className="text-text-muted">
                {t(`dependents.${role}`)} · {link.relType}{lag} · {t('dependents.anchor', { date: anchorText(link.anchorDate) })}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
