import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { formatLocalDateTime } from '@/utils/displayTime';
import { NoticeStrip } from './NoticeStrip';

/**
 * De balk bij een nieuwe versie van een bron (keuze 1, Ethan 2026-11-03; stap 1.5 in
 * `docs/relaties-tussen-projecten.md`): per bron van het actieve document één strook met de versie, de
 * auteur (als die er is) en het aantal koppelingen dat verandert. *Bekijken* opent het venster met de
 * gevolgen; *Later* haalt de strook weg tot er weer een nieuwe versie is. De app neemt niets vanzelf over.
 * Met het vinkje *Ankers uit geopende documenten halen* (stap 1.7) kan de strook ook uit een geopend brondocument
 * met niet-opgeslagen wijzigingen komen: dan zonder versie en auteur.
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
        // Op de site (stap 1.9) noemt de balk het versienummer; anders de wijzigingstijd van het bestand.
        const site = update.siteVersionLabel !== undefined;
        const saved = site ? '' : formatLocalDateTime(new Date(update.version), i18n.language, notation);
        const params = { file: update.fileName, saved, version: update.siteVersionLabel, count: update.changedLinks, author: update.author };
        // Stap 1.7, vinkje aan: de balk komt uit het geopende document met niet-opgeslagen wijzigingen (geen versie).
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
