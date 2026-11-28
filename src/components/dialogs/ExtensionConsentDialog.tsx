import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { Dialog } from '@/components/common/Dialog';
import type { ExtensionConsentRequest } from '@/extensions';
import { resolveExtensionConsent } from '@/extensions/consentBridge';

export function ExtensionConsentDialog() {
  const { t } = useTranslation('common');
  const pending = useAppStore((s) => s.ui.pendingExtensionConsent) as ExtensionConsentRequest | null;

  if (!pending) return null;

  const answer = resolveExtensionConsent;

  const bronLabel =
    pending.source === 'catalog' ? t('extConsent.sourceCatalog')
      : pending.source === 'js' ? t('extConsent.sourceJs')
        : t('extConsent.sourceZip');

  const verificatie =
    pending.verification === 'checksum' ? t('extConsent.verifiedChecksum')
      : pending.verification === 'unverified' ? t('extConsent.verifiedNone')
        : t('extConsent.verifiedLocal');

  return (
    <Dialog
      onBackdropClick={() => answer(false)}
      onCancel={() => answer(false)}
      panelClassName="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] w-[560px] max-h-[88vh] flex flex-col overflow-hidden"
      panelProps={{ 'data-ops-ext-consent': true }}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon id="status.warning" size={16} className="text-critical" />
        <span className="text-body leading-5 font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('extConsent.title')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-small leading-4">
        <div className="bg-surface-hover rounded-[8px] p-3 flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-body leading-5 font-semibold">{pending.name}</span>
            <span className="text-text-secondary">v{pending.version}</span>
          </div>
          <div className="text-text-secondary">{pending.description}</div>
          <div className="text-text-secondary">
            {t('extConsent.author')}: <span className="text-text-primary">{pending.author}</span>
          </div>
          {pending.repository && (
            <div className="text-text-secondary break-all">
              {t('extConsent.repository')}: <span className="text-text-primary">{pending.repository}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="font-semibold">{t('extConsent.originHeading')}</div>
          <div className="text-text-secondary">{bronLabel}</div>
          <div className={pending.verification === 'unverified' ? 'text-critical' : 'text-text-secondary'}>
            {verificatie}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="font-semibold flex items-center gap-1.5">
            <Icon id="status.warning" size={13} className="text-critical" />
            {t('extConsent.riskHeading')}
          </div>
          <p className="text-text-secondary">{t('extConsent.riskBody')}</p>
          <p className="text-text-secondary flex items-start gap-1.5">
            {pending.isDesktop ? <Icon id="extension.runtime-desktop" size={13} className="shrink-0 mt-0.5" /> : <Icon id="extension.runtime-browser" size={13} className="shrink-0 mt-0.5" />}
            <span>{pending.isDesktop ? t('extConsent.riskDesktop') : t('extConsent.riskBrowser')}</span>
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <div className="font-semibold">{t('extConsent.declaredHeading')}</div>
          <p className="text-text-secondary">{t('extConsent.declaredNote')}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {pending.declared.length === 0 && (
              <span className="text-text-secondary">{t('extConsent.declaredNone')}</span>
            )}
            {pending.declared.map((p) => (
              <span key={p} className="px-2 py-0.5 rounded-[6px] bg-surface-hover border border-border">
                {p}
              </span>
            ))}
          </div>
          {pending.declared.includes('importSource') && (
            <p className="text-text-secondary mt-1" data-ops-ext-consent-import-source>
              {t('extConsent.permImportSource')}
            </p>
          )}
          {pending.declared.includes('help') && (
            <p className="text-text-secondary mt-1" data-ops-ext-consent-help>
              {t('extConsent.permHelp')}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
        <button className="btn btn--sm btn--secondary" onClick={() => answer(false)} data-ops-ext-consent-cancel>
          {t('extConsent.cancel')}
        </button>
        <button className="btn btn--sm btn--primary" onClick={() => answer(true)} data-ops-ext-consent-confirm>
          {t('extConsent.confirm')}
        </button>
      </div>
    </Dialog>
  );
}
