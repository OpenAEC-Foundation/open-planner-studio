import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { AppNotification } from '@/state/slices/types';
import { notificationDetailText } from '@/utils/notificationDetail';

/**
 * NotificationHost — de gecentraliseerde gebruikersmeldingen (bevinding K8).
 *
 * Leest `ui.notifications` uit de store en rendert één vaste toast-stapel onderaan het scherm,
 * onafhankelijk van welk ribbontabblad/Backstage-weergave actief is: de host staat buiten de
 * `activeTab === 'file'`-vertakking in App.tsx en wordt óók in de presentatiemodus gemount. Een
 * stille opslaafout is daarmee altijd zichtbaar — ook daar waar de canvas-component (die vroeger
 * de énige toast bezat) niet gemonteerd is: Backstage, tabelweergave en rapport.
 *
 * Kernkeuze: een `error` plakt tot de gebruiker hem wegklikt (klik = dismissen); een `info`
 * verdwijnt na 5 s automatisch. Een fout die na 5 s zélf weggaat is nauwelijks beter dan géén
 * fout — de gebruiker is even weggelopen en komt terug bij een leeg scherm, zonder aanwijzing dat
 * het opslaan faalde. Herhalende fouten (bv. auto-save die elke 10 s opnieuw faalt) vouwen samen
 * tot één regel met een teller (`dedupeKey`), zie `notify` in uiSlice.
 */
export function NotificationHost() {
  const notifications = useAppStore((s) => s.ui.notifications);
  const dismissNotification = useAppStore((s) => s.dismissNotification);
  const openHelpArticle = useAppStore((s) => s.openHelpArticle);
  // Alle meldingsleutels wonen in `common` (de default-namespace) — zie `NotificationMessageKey`
  // voor waarom dat een eis is en geen toeval.
  const { t } = useTranslation();

  // Auto-dismiss uitsluitend voor `info`-meldingen (5 s); `error` blijft staan tot wegklikken.
  // Bekend en geaccepteerd neveneffect: bij elke lijstwijziging herstart dit effect álle lopende
  // info-timers — een nieuwe melding verlengt de zichtbaarheid van reeds zichtbare info's met 5 s.
  // Dat is bewust: meldingen zijn kort (max. 3 tegelijk) en zo voorkomen we dat een net verschenen
  // info halverwege verdwijnt doordat een oudere zijn timer liet aflopen.
  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications
      .filter((n) => n.severity === 'info')
      .map((n) => setTimeout(() => dismissNotification(n.id), 5000));
    return () => { for (const tm of timers) clearTimeout(tm); };
  }, [notifications, dismissNotification]);

  if (notifications.length === 0) return null;

  return (
    <div className="ops-toast-stack">
      {notifications.map((n: AppNotification) => (
        <div
          key={n.id}
          className={`ops-toast ${n.severity === 'error' ? 'toast-error' : 'toast-info'}`}
          role={n.severity === 'error' ? 'alert' : 'status'}
          onClick={() => dismissNotification(n.id)}
          title={t('notifications.dismiss')}
          style={{ cursor: 'pointer' }}
        >
          <div className="ops-toast-message">
            {t(n.messageKey, { ...n.params })}
            {n.count > 1 && <span className="ops-toast-count">{`×${n.count}`}</span>}
          </div>
          {n.detail && <div className="ops-toast-detail">{n.detail}</div>}
          {n.detailLines?.map((line, index) => (
            <div className="ops-toast-detail" key={`${line.messageKey}-${index}`}>
              {notificationDetailText(t, line)}
            </div>
          ))}
          {n.helpArticleId && (
            // mpp-nul-data-etappe, "lees meer"-eigenaarseis: hergebruikt de bestaande Backstage →
            // Help-navigatie (`openHelpArticle`), geen nieuw linkmechanisme. `stopPropagation` zodat
            // de klik niet OOK de toast se eigen wegklik-handler (op de omringende div) triggert.
            <button
              type="button"
              className="ops-textlink ops-toast-readmore"
              onClick={(e) => { e.stopPropagation(); openHelpArticle(n.helpArticleId!); }}
            >
              {t('notifications.readMore')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
