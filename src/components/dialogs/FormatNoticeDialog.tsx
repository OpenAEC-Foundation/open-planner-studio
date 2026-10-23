import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { B2Icon } from '@/components/common/B2Icon';
import { useAppStore } from '@/state/appStore';
import { Dialog, DialogHeader } from '@/components/common/Dialog';
import { openHelpArticleGuarded } from '@/components/common/HelpButton';
import { applySetting } from '@/components/settings/applySetting';
import { saveFormatNoticeHidden } from '@/utils/settingsStore';
import { withFormatNoticeShown, type FormatNoticeKind } from '@/services/formatNoticeKinds';
import {
  FORMAT_NOTICE_CSV_HELP_ARTICLE_ID,
  FORMAT_NOTICE_MSPDI_HELP_ARTICLE_ID,
  FORMAT_NOTICE_P6XML_HELP_ARTICLE_ID,
  MPP_TIMEPHASED_HELP_ARTICLE_ID,
  XER_IMPORT_HELP_ARTICLE_ID,
} from '@/state/helpArticles';

/** "Lees meer" per formaat: de eigen gids voor .xer en .mpp, anders het kopje in de formatenreferentie. */
const HELP_ARTICLE: Record<FormatNoticeKind, string> = {
  xer: XER_IMPORT_HELP_ARTICLE_ID,
  mpp: MPP_TIMEPHASED_HELP_ARTICLE_ID,
  mspdi: FORMAT_NOTICE_MSPDI_HELP_ARTICLE_ID,
  p6xml: FORMAT_NOTICE_P6XML_HELP_ARTICLE_ID,
  csv: FORMAT_NOTICE_CSV_HELP_ARTICLE_ID,
};

/**
 * Uitleg na het openen van een ander formaat dan IFC (eigenaarsbesluit 2026-10-12): wat de app
 * overnam (groen), wat niet of beperkt (amber) en hoe opslaan en terugschrijven werken (blauw), met
 * "Lees meer" en "Niet meer tonen voor <formaat>". Rendert op `ui.pendingFormatNotice`; App mount hem
 * met `key={kind}`, zodat het vinkje bij elke nieuwe uitleg leeg begint. Het project staat er al
 * achter: sluiten (knop, kruisje of Escape) zet alleen het vinkje door. Geen backdrop-sluiten: het
 * vinkje is invoer (regel in `Dialog.tsx`, `check-dialog-backdrop.ts`).
 */
export function FormatNoticeDialog({ kind }: { kind: FormatNoticeKind }) {
  const { t } = useTranslation('common');
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const format = t(`formatNotice.formats.${kind}.name`);

  const close = () => {
    if (dontShowAgain) {
      const hidden = useAppStore.getState().ui.formatNoticeHidden;
      applySetting('formatNoticeHidden', withFormatNoticeShown(hidden, kind, false), saveFormatNoticeHidden);
    }
    useAppStore.getState().setUI({ pendingFormatNotice: null });
  };
  // Eerst sluiten, dan Help openen: anders opent Help áchter de dialoog.
  const readMore = () => { close(); openHelpArticleGuarded(HELP_ARTICLE[kind]); };

  return (
    <Dialog
      onCancel={close}
      onConfirm={close}
      focusedButtonOwnsEnter
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[min(520px,calc(100vw-2rem))] max-h-[90vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-format-notice': kind }}
    >
      <DialogHeader title={t('formatNotice.title', { format })} onClose={close} />

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2 flex flex-col">
        <div className="ops-note ops-note--success !text-body text-text-primary" data-ops-format-notice-kept>
          <B2Icon name="status.success" size={14} aria-hidden />
          <span>{t(`formatNotice.formats.${kind}.kept`)}</span>
        </div>
        <div className="ops-note ops-note--warning !text-body text-text-primary" data-ops-format-notice-limited>
          <B2Icon name="status.warning" size={14} aria-hidden />
          <span>{t(`formatNotice.formats.${kind}.limited`)}</span>
        </div>
        <div className="ops-note ops-note--info !text-body text-text-primary" data-ops-format-notice-save>
          <B2Icon name="status.info" size={14} aria-hidden />
          <span>{t(`formatNotice.formats.${kind}.save`)}</span>
        </div>
        <button
          type="button"
          onClick={readMore}
          className="mt-3 self-start inline-flex items-center gap-1 text-small leading-4 text-accent hover:underline"
          data-ops-format-notice-read-more
        >
          <B2Icon name="ui.help" size={13} aria-hidden />
          {t('formatNotice.readMore')}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
        <label className="inline-flex items-center gap-2 text-small leading-4 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={e => setDontShowAgain(e.target.checked)}
            data-ops-format-notice-dont-show
          />
          <span>{t('formatNotice.dontShowAgain', { format })}</span>
        </label>
        <button type="button" onClick={close} className="btn btn--sm btn--primary" data-ops-format-notice-close>
          {t('formatNotice.close')}
        </button>
      </div>
    </Dialog>
  );
}
