import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
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
import { notifyToastLayoutChange } from '@/components/layout/toastPlacement';
import './GuidePanel.css';

const MEASURE_MS = 250;
const COMPACT_ESTIMATE = { width: 180, height: 36 };

function measureAnchor(anchor: string | null): DOMRect | null {
  if (!anchor) return null;
  const fallback = ribbonTabFallback(anchor);
  return findTourAnchorRect(anchor) ?? (fallback ? findTourAnchorRect(fallback) : null);
}

function measureDialogs(): DOMRect[] {
  const rects: DOMRect[] = [];
  document.querySelectorAll('[role="dialog"]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) rects.push(r);
  });
  return rects;
}

const EDGE = 12;

function isRtl(): boolean {
  return getComputedStyle(document.documentElement).direction === 'rtl';
}

type FreePos = { left: number; top: number };
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
  const suppressClick = useRef(false);
  const [override, setOverride] = useState<{ key: string; auto: boolean; mode: 'collapsed' | 'expanded' } | null>(null);

  const lang = helpImageLang(i18n.language);
  const step = view?.step ?? null;
  const manual = !step?.hasCheck || !!view?.checkFailed;
  const complete = !!view && (view.done || manual);
  const anchor = view && step?.anchor && !view.done ? step.anchor : null;
  const stepKey = view && step ? `${view.session}:${step.id}` : '';
  const mode = override && override.key === stepKey && override.auto === autoCompact ? override.mode : null;
  const compact = mode === 'collapsed' || (mode !== 'expanded' && autoCompact);

  const live = useRef({ anchor, compact, expandedSize: null as { width: number; height: number } | null });

  const measure = useCallback(() => {
    const cur = live.current;
    const panel = panelRef.current;
    if (!panel) return;
    const here = panel.getBoundingClientRect();
    const free = freePosRef.current;
    if (free) {
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
  useLayoutEffect(() => {
    notifyToastLayoutChange();
    return notifyToastLayoutChange;
  }, [active, side, compact, freePos]);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(measure, MEASURE_MS);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', measure);
    };
  }, [active, measure]);

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
          <Icon id="guide.expand" size={14} />
          <span data-ops-guide-progress>{progress}</span>
          {view.done && <Icon id="status.success" size={12} data-ops-guide-done-badge />}
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
            <Icon id="guide.compact" size={14} />
          </button>
          <button
            type="button"
            className="guide-panel-close"
            onClick={() => stopGuideSession()}
            title={t('extGuide.close')}
            aria-label={t('extGuide.close')}
            data-ops-guide-action="close"
          >
            <Icon id="ui.close" size={14} />
          </button>
        </div>

        <div className="guide-panel-meta text-small leading-4 text-text-secondary">
          <span data-ops-guide-progress>{progress}</span>
          {view.done && (
            <span className="guide-panel-done" data-ops-guide-done-badge>
              <Icon id="status.success" size={12} /> {t('extGuide.stepDone')}
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
