/**
 * Het begeleidingspaneel: de app tekent de stappen die een extensie via `api.help.startGuide`
 * aanlevert (contract 1.4.0). De looptijd (welke stap, gedaan of niet, controles) woont in
 * `extensions/guideRuntime.ts`; dit component leest alleen de momentopname en stuurt de knoppen door.
 *
 * WAAR HET PANEEL STAAT, EN WAAROM. Zwevend onderaan (standaard aan de eindkant: rechts, in ar/fa
 * links), boven de statusbalk — niet in de rechterrail. De rail bestaat alleen zolang er een
 * railpaneel aan staat en wordt in de volledige werkruimtes (Tabel/IFC/Rapport/Resources) en in
 * Backstage niet gerenderd; een tutorial loopt juist dóór die weergaven heen. Een stap die de
 * rail zelf aanwijst (`properties-panel`, `rail:…`) zou bovendien naast zijn eigen instructie staan
 * te wringen om ruimte. Zwevend blijft het paneel in elke weergave op dezelfde plek. Het wijkt uit
 * voor het gemarkeerde anker en voor een open venster, en klapt vanzelf in als dat aan geen van beide
 * kanten lukt; de beslissing staat in `guidePlacement.ts`. De gebruiker kan het ook zelf inklappen
 * (bijv. op een laag scherm); een nieuwe stap klapt het weer uit.
 *
 * GEEN MARKERING. Het paneel markeert het anker niet en dimt de app niet: de stapstekst zegt al wat de
 * gebruiker moet doen, en een ring plus grijs scherm maakte de app onbruikbaar (besluit eigenaar,
 * 2026-10-23). Het anker telt alleen nog voor de plaatsing: het paneel bedekt het niet.
 *
 * SLEPEN. De gebruiker kan het paneel aan de kop (of het ingeklapte knopje) verslepen. Vanaf dat moment
 * staat het waar de gebruiker het neerzet, ook bij een volgende stap of tutorial, tot de app herlaadt; de
 * automatische plaatsing en het vanzelf inklappen staan dan uit. Bij een kleiner venster blijft het
 * binnen beeld.
 *
 * Het paneel ligt boven dialogen (een stap kan over een dialoog gaan, en de gebruiker moet het daar kunnen
 * uitklappen) maar onder de meldingen.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useAppStore } from '@/state/appStore';
import { renderMiniMarkdown } from '@/utils/miniMarkdown';
import { helpImageLang, resolveHelpImagePath } from '@/utils/helpManifest';
import { splitGuideBody } from '@/extensions/guideModel';
import {
  getGuideView, guideNext, guideOpenProject, guidePrevious, guideReset, guideResolveImage, guideShowMe,
  stopGuideSession, subscribeGuideView,
} from '@/extensions/guideRuntime';
import { findTourAnchorRect, ribbonTabFallback } from '@/components/tour/tourAnchor';
import { placeGuidePanel, type GuideSide, type PlacementRect } from './guidePlacement';
import '@/components/backstage/HelpPanel.css';
import './GuidePanel.css';

/** Hoe vaak anker, vensters en paneel opnieuw gemeten worden: een anker kan verschijnen (tabwissel),
 *  verschuiven of weg zijn, een venster opent of sluit, een afbeelding in de stap laadt. */
const MEASURE_MS = 250;
/** Schatting van het ingeklapte knopje zolang het nog niet getekend is; daarna telt de echte maat. */
const COMPACT_ESTIMATE = { width: 180, height: 36 };

/** Het anker (met terugval op de linttab), of `null`. */
function measureAnchor(anchor: string | null): DOMRect | null {
  if (!anchor) return null;
  const fallback = ribbonTabFallback(anchor);
  return findTourAnchorRect(anchor) ?? (fallback ? findTourAnchorRect(fallback) : null);
}

/** De zichtbare open vensters (gedeelde `Dialog` en de eigen vensters met `role="dialog"`). */
function measureDialogs(): DOMRect[] {
  const rects: DOMRect[] = [];
  document.querySelectorAll('[role="dialog"]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) rects.push(r);
  });
  return rects;
}

/** Marge tot de vensterrand (gelijk aan `.guide-panel--end/start`). */
const EDGE = 12;

/** Is de interface rechts-naar-links (ar/fa)? Dan ligt de eindkant links. */
function isRtl(): boolean {
  return getComputedStyle(document.documentElement).direction === 'rtl';
}

/** Een zelf neergezet paneel (linkerbovenhoek), binnen het venster gehouden. */
type FreePos = { left: number; top: number };
/** Onder deze afstand (px) is een druk op de kop een klik, geen sleep. */
const DRAG_THRESHOLD = 4;

function clampPos(pos: FreePos, size: { width: number; height: number }): FreePos {
  const maxLeft = Math.max(EDGE, window.innerWidth - EDGE - size.width);
  const maxTop = Math.max(EDGE, window.innerHeight - EDGE - size.height);
  return {
    left: Math.min(Math.max(pos.left, EDGE), maxLeft),
    top: Math.min(Math.max(pos.top, EDGE), maxTop),
  };
}

function samePos(a: FreePos | null, b: FreePos | null): boolean {
  return a === b || (!!a && !!b && a.left === b.left && a.top === b.top);
}

/** Een paneel van `size` met onderkant `bottom` aan elke kant. */
function sideRects(size: { width: number; height: number }, bottom: number): Record<GuideSide, PlacementRect> {
  const at = (left: number): PlacementRect => ({ left, top: bottom - size.height, right: left + size.width, bottom });
  const near = at(EDGE);
  const far = at(window.innerWidth - EDGE - size.width);
  return isRtl() ? { end: near, start: far } : { end: far, start: near };
}

export function GuidePanel() {
  const { t, i18n } = useTranslation('common');
  const view = useSyncExternalStore(subscribeGuideView, getGuideView);
  const openHelpArticle = useAppStore(s => s.openHelpArticle);
  const panelRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<GuideSide>('end');
  const [autoCompact, setAutoCompact] = useState(false);
  const sideRef = useRef<GuideSide>('end');
  const [freePos, setFreePos] = useState<FreePos | null>(null);
  const freePosRef = useRef<FreePos | null>(null);
  // Na een sleep op het ingeklapte knopje mag de klik die erop volgt het paneel niet uitklappen.
  const suppressClick = useRef(false);
  // Zelf in- of uitgeklapt: geldt voor deze stap en zolang het vanzelf inklappen niet omslaat.
  const [override, setOverride] = useState<{ key: string; auto: boolean; mode: 'collapsed' | 'expanded' } | null>(null);

  const lang = helpImageLang(i18n.language);
  const step = view?.step ?? null;
  const manual = !step?.hasCheck || !!view?.checkFailed;
  const complete = !!view && (view.done || manual);
  const anchor = view && step?.anchor && !view.done ? step.anchor : null;
  const stepKey = view && step ? `${view.session}:${step.id}` : '';
  const mode = override && override.key === stepKey && override.auto === autoCompact ? override.mode : null;
  const compact = mode === 'collapsed' || (mode !== 'expanded' && autoCompact);

  // Wat de meting nodig heeft zonder elke keer een nieuwe interval te starten; bijgewerkt na elke render.
  const live = useRef({ anchor, compact, expandedSize: null as { width: number; height: number } | null });

  // Meet anker, vensters en paneel en kies de plek (`guidePlacement.ts`). Na elke render (zodat
  // een nieuwe stap meteen goed staat, vóór de schilderbeurt) en daarnaast op een interval en bij resize.
  const measure = useCallback(() => {
    const cur = live.current;
    const panel = panelRef.current;
    if (!panel) return;
    const here = panel.getBoundingClientRect();
    const free = freePosRef.current;
    if (free) {
      // Zelf neergezet: geen automatische plaatsing, alleen binnen beeld houden.
      const next = clampPos(free, { width: here.width, height: here.height });
      if (!samePos(next, free)) {
        freePosRef.current = next;
        setFreePos(next);
      }
      setAutoCompact(false);
      return;
    }
    const nextAnchor = measureAnchor(cur.anchor);
    if (!cur.compact) cur.expandedSize = { width: here.width, height: here.height };
    const expandedSize = cur.expandedSize ?? { width: here.width, height: here.height };
    const compactSize = cur.compact ? { width: here.width, height: here.height } : COMPACT_ESTIMATE;
    const next = placeGuidePanel({
      current: sideRef.current,
      expanded: sideRects(expandedSize, here.bottom),
      compact: sideRects(compactSize, here.bottom),
      anchor: nextAnchor,
      dialogs: measureDialogs(),
    });
    setSide(next.side);
    setAutoCompact(next.autoCompact);
  }, []);

  useLayoutEffect(() => {
    Object.assign(live.current, { anchor, compact });
    sideRef.current = side;
    measure();
  });
  const active = !!view;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(measure, MEASURE_MS);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', measure);
    };
  }, [active, measure]);

  // Slepen aan de kop of het knopje. Knoppen in de kop blijven gewone knoppen.
  const onDragStart = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const handle = e.currentTarget;
    if (handle.tagName !== 'BUTTON' && (e.target as HTMLElement).closest('button')) return;
    const panel = panelRef.current;
    if (!panel) return;
    const start = panel.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!moved) {
        moved = true;
        handle.setPointerCapture?.(pointerId);
      }
      const next = clampPos({ left: start.left + dx, top: start.top + dy }, { width: start.width, height: start.height });
      freePosRef.current = next;
      setFreePos(next);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (moved && handle.tagName === 'BUTTON') {
        // De klik volgt in dezelfde taak op pointerup; daarna telt een klik weer gewoon.
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 0);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, []);

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
  const progress = t('extGuide.stepOf', { current: view.stepIndex + 1, total: view.stepCount });
  const panelAttrs = {
    ref: panelRef,
    role: 'region',
    'aria-label': t('extGuide.region'),
    'data-ops-guide-panel': view.guideId,
    'data-ops-guide-step': step.id,
    'data-ops-guide-done': view.done ? 'true' : 'false',
    'data-ops-guide-compact': compact ? 'true' : 'false',
    'data-ops-guide-side': freePos ? 'free' : side,
    style: freePos ? { left: freePos.left, top: freePos.top } : undefined,
  } as const;
  const placementClass = freePos ? 'guide-panel--free' : `guide-panel--${side}`;

  if (compact) {
    return (
      <div {...panelAttrs} className={`guide-panel guide-panel--compact ${placementClass}`}>
        <button
          type="button"
          className="guide-panel-pill text-small leading-4"
          onPointerDown={onDragStart}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            setOverride({ key: stepKey, auto: autoCompact, mode: 'expanded' });
          }}
          title={t('extGuide.expand')}
          aria-label={`${t('extGuide.expand')}: ${progress}`}
          aria-expanded={false}
          data-ops-guide-action="expand"
        >
          <ChevronUp size={14} />
          <span data-ops-guide-progress>{progress}</span>
          {view.done && <CheckCircle2 size={12} className="guide-panel-done" data-ops-guide-done-badge />}
        </button>
      </div>
    );
  }

  return (
      <div {...panelAttrs} className={`guide-panel ${placementClass}`}>
        <div className="guide-panel-head" onPointerDown={onDragStart} data-ops-guide-drag>
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
            onClick={() => setOverride({ key: stepKey, auto: autoCompact, mode: 'collapsed' })}
            title={t('extGuide.collapse')}
            aria-label={t('extGuide.collapse')}
            aria-expanded={true}
            data-ops-guide-action="collapse"
          >
            <ChevronDown size={14} />
          </button>
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
          <span data-ops-guide-progress>{progress}</span>
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
  );
}
