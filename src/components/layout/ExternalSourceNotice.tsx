import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { formatLocalDateTime } from '@/utils/displayTime';
import { NoticeStrip } from './NoticeStrip';

export function ExternalSourceNotice() {
  const { t, i18n } = useTranslation('task');
  const activeDocumentId = useAppStore(s => s.activeDocumentId);
  const updates = useAppStore(s => s.ui.externalSourceUpdates);
  const notation = useAppStore(s => s.ui.timeNotation);
  const setUI = useAppStore(s => s.setUI);
  const dismiss = useAppStore(s => s.dismissExternalSourceUpdate);

  const own = updates.filter(u => u.documentId === activeDocumentId);
  if (own.length === 0) return null;
  return (
    <>
      {own.map(update => {
        const site = update.siteVersionLabel !== undefined;
        const saved = site || update.openDocumentId !== undefined ? '' : formatLocalDateTime(new Date(update.version), i18n.language, notation);
        const params = { file: update.fileName, saved, version: update.siteVersionLabel, count: update.changedLinks, author: update.author };
        const text = update.openDocumentId !== undefined
          ? t('externalLinks.newOpenDocument', { file: update.fileName })
          : site
          ? (update.author ? t('externalLinks.newVersionSiteAuthor', params) : t('externalLinks.newVersionSite', params))
          : (update.author ? t('externalLinks.newVersionAuthor', params) : t('externalLinks.newVersion', params));
        return (
          <NoticeStrip
            key={update.key}
            icon="status.update-available"
            text={text}
            actionLabel={t('externalLinks.review')}
            onAction={() => setUI({ externalSourceReview: update.key })}
            secondaryAction={{
              label: t('externalLinks.later'),
              onAction: () => dismiss(update.key),
              props: { 'data-ops-external-source-later': update.key },
            }}
            role="status"
            stripProps={{ 'data-ops-external-source-update': update.key }}
            actionProps={{ 'data-ops-external-source-review': update.key }}
          />
        );
      })}
    </>
  );
}
