import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { formatLocalDateTime } from '@/utils/displayTime';
import { NoticeStrip } from './NoticeStrip';

/**
 * De balk bij een nieuwe versie van een bron (keuze 1, Ethan 2026-11-03; stap 1.5 in
 * `docs/relaties-tussen-projecten.md`): per bron van het actieve document één strook met de versie, de
 * auteur (als die er is) en het aantal koppelingen dat verandert. *Bekijken* opent het venster met de
 * gevolgen; *Later* haalt de strook weg tot er weer een nieuwe versie is. De app neemt niets vanzelf over.
 */
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
        const saved = formatLocalDateTime(new Date(update.version), i18n.language, notation);
        const params = { file: update.fileName, saved, count: update.changedLinks, author: update.author };
        return (
          <NoticeStrip
            key={update.path}
            icon="status.update-available"
            text={update.author ? t('externalLinks.newVersionAuthor', params) : t('externalLinks.newVersion', params)}
            actionLabel={t('externalLinks.review')}
            onAction={() => setUI({ externalSourceReview: update.path })}
            secondaryAction={{
              label: t('externalLinks.later'),
              onAction: () => dismiss(update.path),
              props: { 'data-ops-external-source-later': update.path },
            }}
            role="status"
            stripProps={{ 'data-ops-external-source-update': update.path }}
            actionProps={{ 'data-ops-external-source-review': update.path }}
          />
        );
      })}
    </>
  );
}
