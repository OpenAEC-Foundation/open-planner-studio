import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { useDialogKeys } from '@/hooks/useDialogKeys';
import { TOUR_STEPS } from './tourSteps';

const CARD_WIDTH = 300;
const CARD_MARGIN = 12;
// Redelijke schatting voor de kaarthoogte vóór de eerste meting (voorkomt een ongeklemde
// eerste-frame-flits) — wordt direct na mount overschreven door de echte gemeten hoogte
// (zie de meet-effect hieronder).
const CARD_HEIGHT_ESTIMATE = 160;

/**
 * Bepaalt een kaartpositie die GEGARANDEERD volledig binnen de viewport valt (geklemd op
 * `margin`), voor elke ankergrootte. Root-cause van de QA-bug (item 2): de oude logica koos
 * enkel boven/onder o.b.v. de bovenkant van het anker en klemde alleen de LINKER kant van de
 * kaart — de top/bottom-waarde zelf werd nooit tegen de kaart-HOOGTE geklemd. Bij een anker dat
 * bijna de volle viewport beslaat (het Gantt-paneel, tourstap 2) is `spaceBelow` klein maar
 * `rect.top` ook (net onder het lint), dus `placeBelow` werd `true` terwijl er in werkelijkheid
 * geen ruimte was: de kaart kreeg een `top` vlak boven de viewport-bodem en liep er met zijn
 * volledige hoogte overheen — de Volgende-knop viel letterlijk buiten het venster.
 *
 * Fix: probeer kandidaat-posities in volgorde (onder → boven → rechts → links van het anker) en
 * accepteer alleen een kandidaat die met de ECHTE kaartafmetingen past; lukt geen enkele (het
 * anker is te groot t.o.v. de viewport), overlap dan bewust met het anker (onderin gecentreerd)
 * — nog steeds volledig geklemd op de viewport. Werkt identiek in RTL: alle berekeningen zijn in
 * fysieke viewport-pixels (`getBoundingClientRect`), niet in logische/`dir`-afhankelijke eenheden.
 */
function computeCardPosition(
  anchor: DOMRect,
  cardW: number,
  cardH: number,
  viewportW: number,
  viewportH: number,
  margin: number,
): { top: number; left: number } {
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
  const leftFor = (l: number) => clamp(l, margin, viewportW - cardW - margin);
  const topFor = (t: number) => clamp(t, margin, viewportH - cardH - margin);

  const belowTop = anchor.bottom + margin;
  if (belowTop + cardH <= viewportH - margin) {
    return { top: belowTop, left: leftFor(anchor.left) };
  }
  const aboveTop = anchor.top - margin - cardH;
  if (aboveTop >= margin) {
    return { top: aboveTop, left: leftFor(anchor.left) };
  }
  const rightLeft = anchor.right + margin;
  if (rightLeft + cardW <= viewportW - margin) {
    return { top: topFor(anchor.top), left: rightLeft };
  }
  const leftLeft = anchor.left - margin - cardW;
  if (leftLeft >= margin) {
    return { top: topFor(anchor.top), left: leftLeft };
  }
  // Geen enkele kandidaat past (anker beslaat ~de hele viewport) — overlap bewust, onderin
  // gecentreerd over het anker, maar nog steeds volledig geklemd binnen de viewport.
  const overlapTop = anchor.bottom - cardH - margin;
  const overlapLeft = anchor.left + (anchor.width - cardW) / 2;
  return { top: topFor(overlapTop), left: leftFor(overlapLeft) };
}

/**
 * Rondleiding-overlay (fase 2.10, onderdeel 3, §4/§6): stappenlijst-gedreven dim-laag +
 * highlight-ring rond het ankerelement + tooltip-kaart met Vorige/Volgende/Overslaan.
 * Geen externe library (zie ontwerpdocument §4 — geen bestaande portal-/popover-infra).
 *
 * Fix-golf (QA-bevinding, item 1): de highlight-ring is één klein element ter grootte van het
 * anker met een `box-shadow`-truc (`0 0 0 9999px …`) om de rest van het scherm visueel te dimmen.
 * GEVERIFIEERD: box-shadow dat buiten de elementgrenzen valt, telt NIET mee voor hit-testing/
 * pointer-events — een `pointer-events: auto` op alléén dat kleine element blokkeert dus enkel
 * klikken vlak bij het anker, niet de rest van de pagina (dat was de oorzaak van de
 * doorklik-corruptie: een klik op bv. de Report-ribbontab tijdens stap 2 bereikte de onderliggende
 * knop gewoon). De echte fix is een APARTE, onzichtbare volledige-pagina-laag (`pointerEvents:
 * 'auto'`, geen achtergrond) die WEL de volle viewport als hit-test-gebied heeft — inclusief het
 * "gat" boven het anker zelf (alleen de tooltip-kaart, met een hogere z-index, blijft klikbaar).
 * Een klik op die laag doet bewust niets (geen `onClick` — geen sluiten-per-ongeluk).
 *
 * Anker-guard (architect-eis): als `[data-tour-anchor="…"]` niet gevonden wordt (na de
 * `prepare()`-voorbereiding + een layout-pass), slaat de tour de stap automatisch over in de
 * richting waarin genavigeerd werd — nooit een crash, nooit een oneindige lus (begrensd door de
 * lengte van `TOUR_STEPS`).
 */
export function TourOverlay() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const stepIndex = useAppStore(s => s.ui.tourStepIndex);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const directionRef = useRef<'forward' | 'backward'>('forward');
  const cardRef = useRef<HTMLDivElement>(null);
  // Werkelijke kaartafmetingen (fix-golf, QA-item 2 — zie `computeCardPosition` hierboven voor de
  // root-cause). De breedte staat vast op CARD_WIDTH; de hoogte is contentafhankelijk (varieert per
  // stap én per taal/RTL) en wordt dus na elke render echt gemeten i.p.v. geraden.
  const [cardSize, setCardSize] = useState<{ width: number; height: number }>({
    width: CARD_WIDTH,
    height: CARD_HEIGHT_ESTIMATE,
  });
  // Losse viewport-tracking (i.p.v. alleen `window.innerWidth/Height` in de render-body lezen):
  // garandeert een herbereking bij een pure window-resize, ook als die toevallig het ankerelement
  // zelf niet van grootte doet veranderen (de bestaande `rect`-resize-listener hieronder dekt het
  // gangbare geval al, dit is de expliciete achtervang).
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  const step = TOUR_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  // Snapshot bij tour-START (fix-golf, item 6): vastgelegd in de STORE (niet in component-state/
  // een ref) omdat `TourOverlay` unmount/remount tijdens een F11-presentatiemodus-cyclus (App.tsx
  // rendert in presentatiemodus een compleet andere boom zonder TourOverlay) — component-state zou
  // dat niet overleven, `ui.tourSnapshot` in de store wel. De guard (`=== null`) zorgt dat zo'n
  // remount NIET opnieuw snapshot (dat zou de al-vervuilde tour-stand vastleggen i.p.v. de
  // oorspronkelijke); alleen een echte tour-start (waar `finish()` hem eerder op `null` zette)
  // triggert een nieuwe capture.
  useEffect(() => {
    if (useAppStore.getState().ui.tourSnapshot !== null) return;
    const ui = useAppStore.getState().ui;
    setUI({
      tourSnapshot: {
        activeRibbonTab: ui.activeRibbonTab,
        backstageSection: ui.backstageSection,
        showHistogram: ui.showHistogram,
        rightPanelCollapsed: ui.rightPanelCollapsed,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opruiming (spec §6, fix-golf item 6): elke sluitroute (Overslaan/Sluiten/Escape/auto-skip)
  // zet de door de tour aangeraakte UI-velden terug naar de stand van vóór tour-start (het
  // snapshot hierboven) i.p.v. altijd een vaste default — voorkomt dat de gebruiker een expliciet
  // ingeklapt paneel of uitgeschakeld histogram na de tour "aan" terugkrijgt.
  const finish = useCallback(() => {
    const snapshot = useAppStore.getState().ui.tourSnapshot;
    setUI({
      ...(snapshot ?? { activeRibbonTab: 'start' }),
      tourSnapshot: null,
      showTourOverlay: false,
    });
  }, [setUI]);

  const goTo = useCallback((index: number, direction: 'forward' | 'backward') => {
    directionRef.current = direction;
    setUI({ tourStepIndex: index });
  }, [setUI]);

  useDialogKeys({ onCancel: finish });

  // Voorbereiden + meten. Twee geneste rAF's: de eerste geeft React de kans de state-update uit
  // `prepare()` (tab-wissel, paneel uitklappen, …) te renderen; pas in de tweede meten we het
  // daadwerkelijke anker, anders vangen we een stale rect van vóór de layout-wijziging.
  useEffect(() => {
    if (!step) { finish(); return; }
    step.prepare();

    let cancelled = false;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        const el = document.querySelector(`[data-tour-anchor="${step.anchor}"]`);
        if (!el) {
          const dir = directionRef.current;
          if (dir === 'forward' && stepIndex < TOUR_STEPS.length - 1) goTo(stepIndex + 1, 'forward');
          else if (dir === 'backward' && stepIndex > 0) goTo(stepIndex - 1, 'backward');
          else finish();
          return;
        }
        setRect(el.getBoundingClientRect());
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Herpositioneren bij window-resize (bv. presentatie-fullscreen togglen tijdens de tour), plus
  // de expliciete viewport-tracking hierboven (dekt ook resizes die het anker zelf niet raken).
  useEffect(() => {
    if (!step) return;
    const reposition = () => {
      const el = document.querySelector(`[data-tour-anchor="${step.anchor}"]`);
      if (el) setRect(el.getBoundingClientRect());
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, [step]);

  // Kaart-hoogte écht meten na elke render (i.p.v. gokken) — dit is wat de root-cause-fix
  // mogelijk maakt: `computeCardPosition` kan pas correct klemmen als het de werkelijke hoogte
  // kent. Geen oneindige lus: de vergelijking hieronder zorgt dat `setCardSize` alleen vuurt als
  // de gemeten afmeting daadwerkelijk verandert (nieuwe stap/taal ⇒ andere content ⇒ andere
  // hoogte), dus het convergeert na hoogstens één extra render per stap.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setCardSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
  });

  if (!step || !rect) return null;

  const { top: cardTop, left: cardLeft } = computeCardPosition(
    rect,
    cardSize.width,
    cardSize.height,
    viewport.w,
    viewport.h,
    CARD_MARGIN,
  );

  const handleNext = () => {
    if (isLast) finish();
    else goTo(stepIndex + 1, 'forward');
  };
  const handlePrevious = () => {
    if (!isFirst) goTo(stepIndex - 1, 'backward');
  };

  return (
    <>
      {/* Volledige-pagina klik-onderscheppende laag (fix-golf, item 1) — écht modaal: onzichtbaar
          (geen achtergrond, de visuele dim komt van de highlight-ring hieronder), maar beslaat de
          volle viewport zodat GEEN klik de onderliggende UI bereikt, ook niet boven het anker zelf.
          Geen `onClick` — een klik hier doet bewust niets (geen sluiten-per-ongeluk). */}
      <div
        aria-hidden
        style={{ position: 'fixed', inset: 0, zIndex: 9997, pointerEvents: 'auto' }}
      />

      {/* Highlight-ring (spotlight-box-shadow-truc) — puur visueel, `pointer-events: none`: de
          laag hierboven regelt de klik-blokkering (box-shadow buiten de elementgrenzen telt sowieso
          niet mee voor hit-testing, zie de bestandskop). */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: rect.left - 6,
          top: rect.top - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          borderRadius: 10,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 2px var(--accent, #D97706)',
          pointerEvents: 'none',
          zIndex: 9998,
          transition: 'left 0.15s ease, top 0.15s ease, width 0.15s ease, height 0.15s ease',
        }}
      />

      {/* Tooltip-kaart — enige interactieve deel van de overlay. Positie volledig geklemd op de
          viewport door `computeCardPosition` (zie bestandskop) — top/left zijn hier altijd al
          een geldige, volledig-zichtbare plek, dus geen aparte `placeBelow`-tak/`bottom`-CSS meer
          nodig zoals in de oude (bugfixte) versie. */}
      <div
        ref={cardRef}
        data-ops-tour-card
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] flex flex-col gap-3 p-4 text-sm"
        style={{
          position: 'fixed',
          left: cardLeft,
          top: cardTop,
          width: CARD_WIDTH,
          zIndex: 9999,
        }}
      >
        <span className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {t(step.titleKey as 'tour.step1Title')}
        </span>
        <p className="text-text-secondary">{t(step.bodyKey as 'tour.step1Body')}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button onClick={finish} className="btn btn--sm">{t('tour.skip')}</button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button onClick={handlePrevious} className="btn btn--sm">{t('tour.previous')}</button>
            )}
            <button onClick={handleNext} className="btn btn--sm btn--primary">
              {isLast ? t('tour.finish') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
