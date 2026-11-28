import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { useDialogKeys } from '@/hooks/useDialogKeys';
import { TOUR_STEPS } from './tourSteps';
import { TourSpotlight } from './TourSpotlight';
import { tourAnchorSelector } from './tourAnchor';
import { tourFinishPatch, type TourEnd } from '@/state/onboarding';

const CARD_WIDTH = 300;
const CARD_MARGIN = 12;
const CARD_HEIGHT_ESTIMATE = 160;

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
  const overlapTop = anchor.bottom - cardH - margin;
  const overlapLeft = anchor.left + (anchor.width - cardW) / 2;
  return { top: topFor(overlapTop), left: leftFor(overlapLeft) };
}

const ANCHOR_WAIT_MS = 3000;

export function TourOverlay() {
  const { t } = useTranslation('common');
  const setUI = useAppStore(s => s.setUI);
  const stepIndex = useAppStore(s => s.ui.tourStepIndex);
  const [measured, setMeasured] = useState<{ stepIndex: number; rect: DOMRect } | null>(null);
  const directionRef = useRef<'forward' | 'backward'>('forward');
  const [cardNode, setCardNode] = useState<HTMLDivElement | null>(null);
  const [cardSize, setCardSize] = useState<{ width: number; height: number }>({
    width: CARD_WIDTH,
    height: CARD_HEIGHT_ESTIMATE,
  });
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });

  const step = TOUR_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  useEffect(() => {
    if (useAppStore.getState().ui.tourSnapshot !== null) return;
    const ui = useAppStore.getState().ui;
    setUI({
      tourSnapshot: {
        activeRibbonTab: ui.activeRibbonTab,
        backstageSection: ui.backstageSection,
        showHistogram: ui.showHistogram,
        rightPanelCollapsed: ui.rightPanelCollapsed,
        showPropertiesPanel: ui.showPropertiesPanel,
      },
    });
  }, [setUI]);

  const finish = useCallback((end: TourEnd) => {
    setUI(tourFinishPatch(useAppStore.getState().ui, end));
  }, [setUI]);
  const abort = useCallback(() => finish('aborted'), [finish]);

  const goTo = useCallback((index: number, direction: 'forward' | 'backward') => {
    directionRef.current = direction;
    setUI({ tourStepIndex: index });
  }, [setUI]);

  useDialogKeys({ onCancel: abort });

  useEffect(() => {
    if (!step) { abort(); return; }
    step.prepare();
    const setRect = (rect: DOMRect) => setMeasured({ stepIndex, rect });

    let cancelled = false;
    let raf2 = 0;
    let observer: MutationObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const find = () => document.querySelector(tourAnchorSelector(step.anchor));
    const stopWaiting = () => {
      observer?.disconnect();
      observer = null;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const skip = () => {
      const dir = directionRef.current;
      if (dir === 'forward' && stepIndex < TOUR_STEPS.length - 1) goTo(stepIndex + 1, 'forward');
      else if (dir === 'backward' && stepIndex > 0) goTo(stepIndex - 1, 'backward');
      else abort();
    };
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (cancelled) return;
        const el = find();
        if (el) { setRect(el.getBoundingClientRect()); return; }
        observer = new MutationObserver(() => {
          const found = find();
          if (!found || cancelled) return;
          stopWaiting();
          requestAnimationFrame(() => { if (!cancelled) setRect(found.getBoundingClientRect()); });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        timer = setTimeout(() => {
          stopWaiting();
          if (cancelled) return;
          const found = find();
          if (found) setRect(found.getBoundingClientRect());
          else skip();
        }, ANCHOR_WAIT_MS);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      stopWaiting();
    };
  }, [step, stepIndex, abort, goTo]);

  useEffect(() => {
    if (!step) return;
    const reposition = () => {
      const el = document.querySelector(tourAnchorSelector(step.anchor));
      if (el) setMeasured({ stepIndex, rect: el.getBoundingClientRect() });
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, [step, stepIndex]);

  useLayoutEffect(() => {
    if (!cardNode) return;
    const measure = () => {
      const { width, height } = cardNode.getBoundingClientRect();
      setCardSize(prev => (
        prev.width === width && prev.height === height ? prev : { width, height }
      ));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cardNode);
    return () => observer.disconnect();
  }, [cardNode]);

  if (!step) return null;
  const rect = measured?.stepIndex === stepIndex ? measured.rect : null;
  if (!rect) {
    return <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 9997, pointerEvents: 'auto' }} />;
  }

  const { top: cardTop, left: cardLeft } = computeCardPosition(
    rect,
    cardSize.width,
    cardSize.height,
    viewport.w,
    viewport.h,
    CARD_MARGIN,
  );

  const handleNext = () => {
    if (isLast) finish('completed');
    else goTo(stepIndex + 1, 'forward');
  };
  const handlePrevious = () => {
    if (!isFirst) goTo(stepIndex - 1, 'backward');
  };

  return (
    <>
      <div
        aria-hidden
        style={{ position: 'fixed', inset: 0, zIndex: 9997, pointerEvents: 'auto' }}
      />

      <TourSpotlight rect={rect} dimOpacity={0.55} zIndex={9998} />

      <div
        ref={setCardNode}
        data-ops-tour-card
        className="bg-surface border border-border rounded-[14px] shadow-[var(--shadow-pop)] flex flex-col gap-3 p-4 text-body leading-5"
        style={{
          position: 'fixed',
          left: cardLeft,
          top: cardTop,
          width: CARD_WIDTH,
          zIndex: 9999,
        }}
      >
        <span className="font-semibold" style={{ fontFamily: 'var(--font-heading)' }}>
          {t(step.titleKey)}
        </span>
        <p className="text-text-secondary">{t(step.bodyKey)}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button onClick={abort} className="btn btn--sm">{t('tour.skip')}</button>
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
