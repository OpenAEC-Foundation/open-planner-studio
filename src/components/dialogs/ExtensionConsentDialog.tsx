import { useTranslation } from 'react-i18next';
import { ShieldAlert, HardDrive, Globe } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { Dialog } from '@/components/common/Dialog';
import type { ExtensionConsentRequest } from '@/extensions';
import { resolveExtensionConsent } from '@/extensions/consentBridge';

/**
 * De vertrouwensvraag bij het INSTALLEREN van een extensie (K-item 38).
 *
 * WAT HIER BEWUST NIET STAAT: een afvinklijst van permissies. Extensie-code draait in dezelfde
 * realm als de app, dus `ribbon`/`events`/`backstage`/`pdf-fonts` zijn poorten op de ONDERSTEUNDE
 * API en geen grens om wat de code kán. Een Android-achtige permissielijst zou lezen als "de
 * extensie is hiertoe beperkt" en daarmee een garantie suggereren die er niet is — erger dan geen
 * dialoog. De declaratie staat er wél, expliciet gelabeld als *voorgenomen* gebruik.
 *
 * De vraag gaat over één ding: dit is code van iemand anders, met dezelfde rechten als de app.
 * Daarom staan er drie dingen die je nodig hebt om te beslissen — wie het schreef, waar het vandaan
 * komt (en of die download geverifieerd is), en wat dat concreet betekent op dit platform.
 */
export function ExtensionConsentDialog() {
  const { t } = useTranslation('common');
  const pending = useAppStore((s) => s.ui.pendingExtensionConsent) as ExtensionConsentRequest | null;

  if (!pending) return null;

  // De resolver leeft in `extensions/consentBridge.ts` (module-state); de store draagt alleen de
  // vraag. Sluiten zonder antwoord bestaat niet: backdrop-klik en Escape zijn beide een WEIGERING.
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
        <ShieldAlert size={16} className="text-critical" />
        <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('extConsent.title')}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs">
        {/* Wie en wat */}
        <div className="bg-surface-hover rounded-[8px] p-3 flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{pending.name}</span>
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

        {/* Herkomst + verificatie — dit is de informatie waarop je de beslissing baseert. */}
        <div className="flex flex-col gap-1">
          <div className="font-semibold">{t('extConsent.originHeading')}</div>
          <div className="text-text-secondary">{bronLabel}</div>
          <div className={pending.verification === 'unverified' ? 'text-critical' : 'text-text-secondary'}>
            {verificatie}
          </div>
        </div>

        {/* De kern van de vraag. */}
        <div className="flex flex-col gap-2">
          <div className="font-semibold flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-critical" />
            {t('extConsent.riskHeading')}
          </div>
          <p className="text-text-secondary">{t('extConsent.riskBody')}</p>
          <p className="text-text-secondary flex items-start gap-1.5">
            {pending.isDesktop ? <HardDrive size={13} className="shrink-0 mt-0.5" /> : <Globe size={13} className="shrink-0 mt-0.5" />}
            <span>{pending.isDesktop ? t('extConsent.riskDesktop') : t('extConsent.riskBrowser')}</span>
          </p>
        </div>

        {/* De declaratie — expliciet als intentie, niet als grens. */}
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
