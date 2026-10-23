import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { B2Icon } from '@/components/common/B2Icon';
import { useAppStore } from '@/state/appStore';
import type { AppNotification } from '@/state/slices/types';
import { formatReportNumber } from '@/utils/reportNumber';
import { notificationDetailText } from '@/utils/notificationDetail';
import { subscribeDialogStack } from '@/hooks/useDialogKeys';
import { leaveBackstageGuarded } from '@/components/backstage/backstageLeaveGuard';
import { clearViewArrangement } from '@/state/viewArrangement';
import {
  measureToastPlacement, samePlacement, subscribeToastLayout, toastAvoidElements, type ToastPlacement,
} from './toastPlacement';

/**
 * Houdt de stapel weg van de knoppen van een open dialoog
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
 * NotificationHost — de gecentraliseerde gebruikersmeldingen.
 *
 * Leest `ui.notifications` uit de store en rendert één vaste toast-stapel onderaan het scherm,
 * onafhankelijk van welk ribbontabblad/Backstage-weergave actief is: de host staat buiten de
 * `activeTab === 'file'`-vertakking in App.tsx en wordt óók in de presentatiemodus gemount. Een
 * stille opslaafout is daarmee altijd zichtbaar — ook daar waar de canvas-component niet
 * gemonteerd is: Backstage, tabelweergave en rapport.
 *
 * Kernkeuze: een `error` plakt tot de gebruiker hem wegklikt (klik = dismissen); een `info`
 * verdwijnt na 5 s automatisch. Een fout die na 5 s zélf weggaat is nauwelijks beter dan géén
 * fout — de gebruiker is even weggelopen en komt terug bij een leeg scherm, zonder aanwijzing dat
 * het opslaan faalde. Herhalende fouten (bv. auto-save die elke 10 s opnieuw faalt) vouwen samen
 * tot één regel met een teller (`dedupeKey`), zie `notify` in uiSlice.
 */
/** `numberParams` in de notatie van de app-taal, op het moment van tonen (zie `AppNotification`). */
function localizedNumberParams(numbers: Record<string, number> | undefined, locale: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(numbers ?? {})) out[key] = formatReportNumber(value, locale);
  return out;
}

export function NotificationHost() {
  const notifications = useAppStore((s) => s.ui.notifications);
  const dismissNotification = useAppStore((s) => s.dismissNotification);
  const openHelpArticle = useAppStore((s) => s.openHelpArticle);
  const setUI = useAppStore((s) => s.setUI);
  // Alle meldingsleutels wonen in `common` (de default-namespace) — zie `NotificationMessageKey`
  // voor waarom dat een eis is en geen toeval.
  const { t, i18n } = useTranslation();
  const placement = useToastPlacement(notifications.length > 0);

  // Auto-dismiss uitsluitend voor `info`-meldingen (5 s, of `durationMs`); `error` en een `sticky`
  // info (openingsmelding met gewijzigde data, `state/openNoticeSticky.ts`) blijven staan tot de
  // gebruiker op het kruisje klikt.
  // Bekend en geaccepteerd neveneffect: bij elke lijstwijziging herstart dit effect álle lopende
  // info-timers — een nieuwe melding verlengt de zichtbaarheid van reeds zichtbare info's met 5 s.
  // Dat is bewust: meldingen zijn kort (max. 3 tegelijk) en zo voorkomen we dat een net verschenen
  // info halverwege verdwijnt doordat een oudere zijn timer liet aflopen.
  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications
      .filter((n) => n.severity === 'info' && !n.sticky)
      .map((n) => setTimeout(() => dismissNotification(n.id), n.durationMs ?? 5000));
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
        >
          {/* Sluiten alleen met het kruisje (eigenaarsbesluit 2026-10-12): een klik op de tekst doet
              niets, zodat je een melding kunt lezen of selecteren zonder dat hij verdwijnt. Info
              verdwijnt daarnaast vanzelf (timer hierboven); een fout blijft staan tot het kruisje.
              `inset-inline-end` in de CSS zet het kruisje in RTL (ar/fa) links. */}
          <button
            type="button"
            className="ops-toast-close"
            aria-label={t('notifications.dismiss')}
            title={t('notifications.dismiss')}
            data-ops-toast-close=""
            onClick={() => dismissNotification(n.id)}
          >
            <B2Icon name="ui.close" size={14} aria-hidden="true" />
          </button>
          <div className="ops-toast-message">
            {t(n.messageKey, { ...n.params, ...localizedNumberParams(n.numberParams, i18n.language) })}
            {n.count > 1 && <span className="ops-toast-count">{`×${n.count}`}</span>}
          </div>
          {/* Een vertaalbare reden (solverfout als code + parameters) gaat vóór de rauwe tekst. */}
          {n.detailKey
            ? <div className="ops-toast-detail">{t(n.detailKey, { ...n.detailParams })}</div>
            : n.detail && <div className="ops-toast-detail">{n.detail}</div>}
          {n.detailLines?.map((line, index) => (
            <div className="ops-toast-detail" key={`${line.messageKey}-${index}`} data-ops-toast-detail={line.messageKey}>
              {notificationDetailText(t, line)}
              {line.helpArticleId && (
                // Een regel met een eigen onderwerp krijgt een eigen gidslink.
                <button
                  type="button"
                  className="ops-textlink ops-toast-readmore"
                  data-ops-toast-detail-link={line.helpArticleId}
                  onClick={() => {
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
            // "Lees meer": hergebruikt de Backstage →
            // Help-navigatie (`openHelpArticle`), geen nieuw linkmechanisme. De melding blijft staan.
            <button
              type="button"
              className="ops-textlink ops-toast-readmore"
              onClick={() => {
                // Wegnavigeren uit Backstage → Projectinfo loopt via de bewaker (keuzedialoog
                // bij een niet-toegepaste draft), net als de zijbalk en het lint.
                const articleId = n.helpArticleId!;
                leaveBackstageGuarded(() => openHelpArticle(articleId));
              }}
            >
              {t('notifications.readMore')}
            </button>
          )}
          {n.action && (
            // De serialiseerbare actie uit de store (o.a. rekenprofielen, *Wissen* bij *Taak*); sluit
            // de melding na de actie.
            <button
              type="button"
              className="ops-textlink ops-toast-readmore"
              data-ops-notification-action={n.action.kind}
              onClick={() => {
                const action = n.action!;
                if (action.kind === 'clearViewArrangement') {
                  // *Wissen* (eigenaarsbesluit 2026-10-19 5a): filter, groepering en sortering van
                  // het actieve document uit. De melding hoort altijd bij dat document: een
                  // documentwissel wist weigeringen (`clearRefusals`, 5b).
                  clearViewArrangement(useAppStore.getState());
                  dismissNotification(n.id);
                  return;
                }
                const go = () => {
                  setUI({ activeRibbonTab: 'file', backstageSection: action.section });
                  dismissNotification(n.id);
                };
                // Ook deze actie verlaat de huidige Backstage-sectie — via de bewaker; staat de
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
