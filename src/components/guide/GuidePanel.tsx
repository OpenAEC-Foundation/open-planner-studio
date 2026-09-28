/**
 * Het begeleidingspaneel: de app tekent de stappen die een extensie via `api.help.startGuide`
 * aanlevert (contract 1.4.0). De looptijd (welke stap, gedaan of niet, controles) woont in
 * `extensions/guideRuntime.ts`; dit component leest alleen de momentopname en stuurt de knoppen door.
 *
 * WAAR HET PANEEL STAAT, EN WAAROM. Zwevend rechtsonder (logisch: aan de eindkant, dus links in
 * ar/fa), boven de statusbalk — niet in de rechterrail. De rail bestaat alleen zolang er een
 * railpaneel aan staat en wordt in de volledige werkruimtes (Tabel/IFC/Rapport/Resources) en in
 * Backstage niet gerenderd; een tutorial loopt juist dóór die weergaven heen. Een stap die de
 * rail zelf aanwijst (`properties-panel`, `rail:…`) zou bovendien naast zijn eigen instructie staan
 * te wringen om ruimte. Zwevend blijft het paneel in elke weergave op dezelfde plek. Overlapt het
 * gemarkeerde anker het paneel, dan wijkt het paneel uit naar de andere kant.
 *
 * NIET MODAAL. De markering (`TourSpotlight`, dezelfde stijl als de rondleiding) is puur visueel en
 * laat klikken door: de gebruiker moet het aangewezen element zelf kunnen bedienen. Het paneel ligt
 * boven dialogen (een stap kan over een dialoog gaan) maar onder de meldingen.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { renderMiniMarkdown } from '@/utils/miniMarkdown';
import { helpImageLang, resolveHelpImagePath } from '@/utils/helpManifest';
import { splitGuideBody } from '@/extensions/guideModel';
import {
  getGuideView, guideNext, guideOpenProject, guidePrevious, guideReset, guideResolveImage, guideShowMe,
  stopGuideSession, subscribeGuideView,
} from '@/extensions/guideRuntime';
import { TourSpotlight } from '@/components/tour/TourSpotlight';
import { findTourAnchorRect, ribbonTabFallback } from '@/components/tour/tourAnchor';
import '@/components/backstage/HelpPanel.css';
import './GuidePanel.css';

/** Hoe vaak het anker opnieuw gemeten wordt: het kan verschijnen (tabwissel), verschuiven of weg zijn. */
const ANCHOR_POLL_MS = 250;
/** Lichter dan de rondleiding (0,55): de gebruiker werkt hier in de app, hij kijkt niet alleen. */
const GUIDE_DIM = 0.25;

function sameRect(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

/** Meet het anker (met terugval op de linttab) zolang `anchor` gezet is. */
function useAnchorRect(anchor: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!anchor) { setRect(null); return; }
    const fallback = ribbonTabFallback(anchor);
    const measure = () => {
      const next = findTourAnchorRect(anchor) ?? (fallback ? findTourAnchorRect(fallback) : null);
      setRect(prev => (sameRect(prev, next) ? prev : next));
    };
    measure();
    const timer = setInterval(measure, ANCHOR_POLL_MS);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', measure);
    };
  }, [anchor]);
  return rect;
}

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export function GuidePanel() {
  const { t, i18n } = useTranslation('common');
  const view = useSyncExternalStore(subscribeGuideView, getGuideView);
  const openHelpArticle = useAppStore(s => s.openHelpArticle);
  const panelRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<'end' | 'start'>('end');

  const lang = helpImageLang(i18n.language);
  const step = view?.step ?? null;
  const manual = !step?.hasCheck || !!view?.checkFailed;
  const complete = !!view && (view.done || manual);
  const anchorRect = useAnchorRect(view && step?.anchor && !view.done ? step.anchor : null);

  // Uitwijken: ligt het gemarkeerde anker onder het paneel en is de andere kant wél vrij, zet het
  // paneel daar. Een anker dat beide kanten raakt (bv. de hele Gantt-kaart) verschuift niets.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !anchorRect) return;
    const here = panel.getBoundingClientRect();
    if (!overlaps(here, anchorRect)) return;
    const mirrored = new DOMRect(window.innerWidth - here.right, here.top, here.width, here.height);
    if (!overlaps(mirrored, anchorRect)) setSide(prev => (prev === 'end' ? 'start' : 'end'));
  }, [anchorRect]);

  const resolveImage = useCallback(
    (src: string) => guideResolveImage(resolveHelpImagePath(src, lang)),
    [lang],
  );
  const handlers = useMemo(() => ({
    onNavigate: (target: string) => openHelpArticle(target),
    onOpenProject: (asset: string) => { void guideOpenProject(asset); },
    resolveImage,
  }), [openHelpArticle, resolveImage]);

  const parts = useMemo(() => (step ? splitGuideBody(step.body[lang]) : null), [step, lang]);
  const taskNodes = useMemo(() => (parts ? renderMiniMarkdown(parts.task, handlers) : null), [parts, handlers]);
  const explanationNodes = useMemo(
    () => (parts && parts.explanation.trim() ? renderMiniMarkdown(parts.explanation, handlers) : null),
    [parts, handlers],
  );

  if (!view || !step) return null;

  const isFirst = view.stepIndex === 0;
  const isLast = view.stepIndex === view.stepCount - 1;
  const primaryLabel = isLast ? t('extGuide.finish') : manual ? t('extGuide.doneNext') : t('extGuide.next');

  return (
    <>
      {anchorRect && <TourSpotlight rect={anchorRect} dimOpacity={GUIDE_DIM} zIndex={65} />}
      <div
        ref={panelRef}
        role="region"
        aria-label={t('extGuide.region')}
        className={`guide-panel guide-panel--${side}`}
        data-ops-guide-panel={view.guideId}
        data-ops-guide-step={step.id}
        data-ops-guide-done={view.done ? 'true' : 'false'}
      >
        <div className="guide-panel-head">
          <div className="min-w-0 flex-1">
            <div className="text-caption leading-4 uppercase tracking-wider text-text-secondary font-semibold">
              {t('extGuide.region')}
            </div>
            <div className="text-heading leading-5 font-semibold truncate" style={{ fontFamily: 'var(--font-heading)' }}>
              {view.title[lang]}
            </div>
          </div>
          <button
            type="button"
            className="guide-panel-close"
            onClick={() => stopGuideSession()}
            title={t('extGuide.close')}
            aria-label={t('extGuide.close')}
            data-ops-guide-action="close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="guide-panel-meta text-small leading-4 text-text-secondary">
          <span data-ops-guide-progress>{t('extGuide.stepOf', { current: view.stepIndex + 1, total: view.stepCount })}</span>
          {view.done && (
            <span className="guide-panel-done" data-ops-guide-done-badge>
              <CheckCircle2 size={12} /> {t('extGuide.stepDone')}
            </span>
          )}
        </div>

        <div className="guide-panel-body help-article-body" key={`${view.session}:${step.id}`}>
          <div data-ops-guide-task>{taskNodes}</div>
          {!complete && (
            <p className="text-small leading-4 text-text-secondary" data-ops-guide-waiting>{t('extGuide.waiting')}</p>
          )}
          {complete && explanationNodes && (
            <div className="guide-panel-explanation" data-ops-guide-explanation>{explanationNodes}</div>
          )}
        </div>

        <div className="guide-panel-actions">
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={guidePrevious}
            disabled={isFirst || view.busy}
            data-ops-guide-action="back"
          >
            {t('extGuide.back')}
          </button>
          {step.hasPrepare && (
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => { void guideShowMe(); }}
              disabled={view.busy}
              title={t('extGuide.showMeHint')}
              data-ops-guide-action="showMe"
            >
              {t('extGuide.showMe')}
            </button>
          )}
          {step.hasReset && (
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => { void guideReset(); }}
              disabled={view.busy}
              title={t('extGuide.resetHint')}
              data-ops-guide-action="reset"
            >
              {t('extGuide.reset')}
            </button>
          )}
          <span className="flex-1" />
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={guideNext}
            disabled={!complete || view.busy}
            data-ops-guide-action="next"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </>
  );
}
