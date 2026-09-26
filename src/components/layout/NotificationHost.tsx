import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import type { AppNotification } from '@/state/slices/types';
import { notificationDetailText } from '@/utils/notificationDetail';
import { subscribeDialogStack } from '@/hooks/useDialogKeys';
import { leaveBackstageGuarded } from '@/components/backstage/backstageLeaveGuard';
import {
  measureToastPlacement, samePlacement, subscribeToastLayout, toastAvoidElements, type ToastPlacement,
} from './toastPlacement';

/**
 * B5 (gebruikstest rekenprofielen 24-09): houdt de stapel weg van de knoppen van een open dialoog
 * en van plakkende actiebalken — zie `toastPlacement.ts` voor de regel. Meet alleen zolang er
 * meldingen zijn, en alleen op signalen — geen poll, geen store-brede subscribe:
 *  - synchroon bij het verschijnen van de stapel (vóór de eerste paint);
 *  - één frame na elke push/pop op de dialoogstapel (`subscribeDialogStack`; de dialoog is dan
 *    gecommit) en na het mounten/unmounten van een mijdbalk (`subscribeToastLayout`);
 *  - via een `ResizeObserver` op de gevonden dialoogpanelen en balken (na elke meting opnieuw
 *    gekoppeld als de set veranderde), bv. wanneer de balk het "niet toegepast"-blok krijgt;
 *  - bij `resize` en bij scrollen (capture: een plakkende balk verschuift mee met zijn scrollcontainer).
 * Meerdere signalen in één frame vallen samen tot één meting; nieuwe state alleen als de plaatsing
 * echt verandert.
 */
function useToastPlacement(active: boolean): ToastPlacement {
  const [placement, setPlacement] = useState<ToastPlacement>({ kind: 'default' });
  useLayoutEffect(() => {
    if (!active) return;
    let last: ToastPlacement | null = null;
    let frame = 0;
    let observed: HTMLElement[] = [];
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    const rebind = () => {
      if (!observer) return;
      const els = toastAvoidElements(document);
      if (els.length === observed.length && els.every((el, i) => el === observed[i])) return;
      observer.disconnect();
      for (const el of els) observer.observe(el);
      observed = els;
    };
    function measure() {
      frame = 0;
      const next = measureToastPlacement(document, window);
      if (!last || !samePlacement(last, next)) {
        last = next;
        setPlacement(next);
      }
      rebind();
    }
    measure(); // synchroon vóór de eerste paint van de stapel
    const offStack = subscribeDialogStack(schedule);
    const offLayout = subscribeToastLayout(schedule);
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      offStack();
      offLayout();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, true);
    };
  }, [active]);
  return placement;
}

function placementStyle(p: ToastPlacement): CSSProperties | undefined {
  switch (p.kind) {
    case 'side':
      // Zijstrook naast de dialoog: vaste linker- en rechtergrens, de meldingen passen zich aan.
      return { left: p.left, right: p.right, bottom: p.bottom, transform: 'none' };
    case 'above':
      return { bottom: p.bottom };
    case 'underModal':
      // Onder de dialoogbackdrop (`--z-modal-backdrop`, = Tailwind `z-50` van `Dialog`).
      return { zIndex: 'calc(var(--z-modal-backdrop) - 1)' };
    default:
      return undefined;
  }
}

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
  const setUI = useAppStore((s) => s.setUI);
  // Alle meldingsleutels wonen in `common` (de default-namespace) — zie `NotificationMessageKey`
  // voor waarom dat een eis is en geen toeval.
  const { t } = useTranslation();
  const placement = useToastPlacement(notifications.length > 0);

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
    <div className="ops-toast-stack" style={placementStyle(placement)} data-ops-toast-placement={placement.kind}>
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
            <div className="ops-toast-detail" key={`${line.messageKey}-${index}`} data-ops-toast-detail={line.messageKey}>
              {notificationDetailText(t, line)}
              {line.helpArticleId && (
                // Gebruikstest #170, G3: een regel met een eigen onderwerp krijgt een eigen gidslink.
                <button
                  type="button"
                  className="ops-textlink ops-toast-readmore"
                  data-ops-toast-detail-link={line.helpArticleId}
                  onClick={(e) => {
                    e.stopPropagation();
                    const articleId = line.helpArticleId!;
                    leaveBackstageGuarded(() => openHelpArticle(articleId));
                  }}
                >
                  {t(line.linkKey ?? 'notifications.readMore')}
                </button>
              )}
            </div>
          ))}
          {n.helpArticleId && (
            // mpp-nul-data-etappe, "lees meer"-eigenaarseis: hergebruikt de bestaande Backstage →
            // Help-navigatie (`openHelpArticle`), geen nieuw linkmechanisme. `stopPropagation` zodat
            // de klik niet OOK de toast se eigen wegklik-handler (op de omringende div) triggert.
            <button
              type="button"
              className="ops-textlink ops-toast-readmore"
              onClick={(e) => {
                e.stopPropagation();
                // B2: wegnavigeren uit Backstage → Projectinfo loopt via de bewaker (keuzedialoog
                // bij een niet-toegepaste draft), net als de zijbalk en het lint.
                const articleId = n.helpArticleId!;
                leaveBackstageGuarded(() => openHelpArticle(articleId));
              }}
            >
              {t('notifications.readMore')}
            </button>
          )}
          {n.action && (
            // Rekenprofielen (spec v3.1 §6): de serialiseerbare actie uit de store. `stopPropagation`
            // zodat de klik niet ook de wegklik-handler van de toast triggert (zelfde als "Lees meer").
            <button
              type="button"
              className="ops-textlink ops-toast-readmore"
              data-ops-notification-action={n.action.kind}
              onClick={(e) => {
                e.stopPropagation();
                const action = n.action!;
                const go = () => {
                  setUI({ activeRibbonTab: 'file', backstageSection: action.section });
                  dismissNotification(n.id);
                };
                // B2: ook deze actie verlaat de huidige Backstage-sectie — via de bewaker; staat de
                // gebruiker al op de doelsectie, dan valt er niets te verlaten.
                const { ui } = useAppStore.getState();
                if (ui.activeRibbonTab === 'file' && ui.backstageSection === action.section) go();
                else leaveBackstageGuarded(go);
              }}
            >
              {t(n.action.labelKey)}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
