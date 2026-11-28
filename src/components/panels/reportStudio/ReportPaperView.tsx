import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { hitPaperRegion, type PageRegions, type PaperRect, type PaperRegionId } from '@/services/print/reportPaper';
import type { ReportPaperModel } from './useReportPaper';
import { markReportPaperCommitted } from './studioPerf';

export type PaperTarget = PaperRegionId | 'page';

export interface PaperPick {
  target: PaperTarget;
  column?: string;
  anchor: { x: number; y: number };
}

interface HoverState { page: number; target: PaperTarget; column?: string }

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 4;
const PAPER_ZOOM_STOPS = [0.05, 0.075, 0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4];
const ROW_MIN_PAGE_W = 60;
const PAGE_GAP = 20;
const PAGE_ROW_GAP = 32;
const PAGES_PAD = 24;
const PAGES_PAD_TOP = 30;
const PX_PER_PT = 96 / 72;

type PaperFit = { fit: 'page' | 'width' | 'row' } | { scale: number };

export interface FabZone { width: number; height: number }

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function pct(v: number, of: number): string {
  return `${(v / of) * 100}%`;
}

const EMPTY_PAGES: ReadonlySet<number> = new Set();

export function ReportPaperView({
  paper, stale, loading, selected, onPick, regionLabel, columnLabel, status, actions, onVisible,
  fabZone = null, hint, banner, notice,
}: {
  paper: ReportPaperModel | null;
  stale: boolean;
  loading: boolean;
  selected: { targets: PaperTarget[]; column?: string } | null;
  onPick: (pick: PaperPick) => void;
  regionLabel: (target: PaperTarget) => string;
  columnLabel: (key: string) => string;
  status: ReactNode;
  actions?: ReactNode;
  onVisible?: (pages: readonly number[]) => void;
  fabZone?: FabZone | null;
  hint?: { text: string; closeLabel: string; onClose: () => void } | null;
  banner?: ReactNode;
  notice?: ReactNode;
}) {
  const { t, i18n } = useTranslation('report');
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [fit, setFit] = useState<PaperFit>({ fit: 'page' });
  const [hover, setHover] = useState<HoverState | null>(null);
  const pendingScroll = useRef<{ ratio: number; px: number; py: number } | null>(null);

  const layout = paper?.layout;
  const cols = layout ? Math.max(1, layout.cols) : 1;
  const totalPages = paper?.totalPages ?? 0;
  const pageWidthPt = layout?.pageWidthPt ?? 1190.55;
  const pageHeightPt = layout?.pageHeightPt ?? 841.89;
  const aspect = pageHeightPt / pageWidthPt;
  const realWidth = pageWidthPt * PX_PER_PT;
  const fitMode = 'fit' in fit ? (fit.fit === 'row' && cols <= 1 ? 'width' : fit.fit) : null;
  const availWidth = Math.max(0, viewport.width - 2 * PAGES_PAD);
  const widthFor = (reserve: number): number => {
    if ('scale' in fit) return fit.scale * realWidth;
    if (fitMode === 'row') return Math.max(ROW_MIN_PAGE_W, (availWidth - (cols - 1) * PAGE_GAP) / cols);
    if (fitMode === 'width') return Math.max(160, availWidth);
    const heightFit = (viewport.height - PAGES_PAD_TOP - PAGES_PAD - reserve) / aspect;
    return Math.max(120, Math.min(Math.max(160, availWidth), heightFit));
  };
  const touchesFab = (width: number): boolean => {
    if (!fabZone) return false;
    const extent = cols * width + (cols - 1) * PAGE_GAP;
    return Math.max(PAGES_PAD, (viewport.width - extent) / 2) < fabZone.width;
  };
  const freeWidth = widthFor(0);
  const strip = fabZone && touchesFab(freeWidth) ? fabZone.height : 0;
  const pageWidth = strip ? widthFor(strip) : freeWidth;
  const pageHeight = pageWidth * aspect;
  const scale = pageWidth / realWidth;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useEffect(() => {
    const wrap = wrapRef.current;
    const node = viewportRef.current;
    if (!wrap || !node) return;
    const observer = new ResizeObserver(() => {
      const next = { width: Math.round(node.clientWidth), height: Math.round(wrap.clientHeight) };
      if (next.width <= 0) return;
      setViewport(prev => (prev.width === next.width && prev.height === next.height ? prev : next));
    });
    observer.observe(wrap);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const zoomTo = useCallback((next: number, clientX?: number, clientY?: number) => {
    const node = viewportRef.current;
    const prev = scaleRef.current;
    const target = clampZoom(next);
    if (node && Math.abs(target - prev) > 1e-6) {
      const rect = node.getBoundingClientRect();
      const px = (clientX ?? rect.left + rect.width / 2) - rect.left;
      const py = (clientY ?? rect.top + rect.height / 2) - rect.top;
      pendingScroll.current = { ratio: target / prev, px, py };
    }
    setFit({ scale: target });
  }, []);

  const pendingPage = useRef<number | null>(null);
  const chooseFit = useCallback((mode: 'page' | 'width' | 'row') => {
    if (mode === 'page') {
      const node = viewportRef.current;
      pendingPage.current = node ? mostVisiblePage(node) : null;
    }
    setFit({ fit: mode });
  }, []);

  useLayoutEffect(() => {
    const node = viewportRef.current;
    const pending = pendingScroll.current;
    if (!node || !pending) return;
    pendingScroll.current = null;
    node.scrollLeft = (node.scrollLeft + pending.px - PAGES_PAD) * pending.ratio + PAGES_PAD - pending.px;
    node.scrollTop = (node.scrollTop + pending.py - PAGES_PAD) * pending.ratio + PAGES_PAD - pending.py;
  }, [pageWidth]);

  useLayoutEffect(() => {
    const node = viewportRef.current;
    const page = pendingPage.current;
    pendingPage.current = null;
    if (!node || page === null) return;
    const wrap = node.querySelector<HTMLElement>(`[data-rs-page="${page}"]`);
    if (!wrap) return;
    const box = node.getBoundingClientRect();
    const rect = wrap.getBoundingClientRect();
    node.scrollTop = rect.top - box.top + node.scrollTop - PAGES_PAD_TOP;
    node.scrollLeft = rect.left - box.left + node.scrollLeft - Math.max(0, (node.clientWidth - rect.width) / 2);
  }, [pageWidth, fit]);

  const sheetKey = layout ? `${layout.pageWidthPt}x${layout.pageHeightPt}` : '';
  const shownSheet = useRef(sheetKey);
  useLayoutEffect(() => {
    if (!sheetKey || sheetKey === shownSheet.current) return;
    const first = shownSheet.current === '';
    shownSheet.current = sheetKey;
    pendingScroll.current = null;
    if (!first) viewportRef.current?.scrollTo({ top: 0, left: 0 });
  }, [sheetKey]);

  const stepZoom = useCallback((dir: 1 | -1) => {
    const prev = scaleRef.current;
    const next = dir > 0
      ? PAPER_ZOOM_STOPS.find(z => z > prev + 0.001) ?? ZOOM_MAX
      : [...PAPER_ZOOM_STOPS].reverse().find(z => z < prev - 0.001) ?? ZOOM_MIN;
    zoomTo(next);
  }, [zoomTo]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomTo(scaleRef.current * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  const [inView, setInView] = useState<ReadonlySet<number>>(() => new Set([0]));
  const [near, setNear] = useState<ReadonlySet<number>>(() => new Set([0, 1]));
  const showPages = !!paper && !loading;
  useEffect(() => {
    const root = viewportRef.current;
    if (!root || totalPages === 0 || !showPages) return;
    const watch = (margin: string, apply: (pages: ReadonlySet<number>) => void) => {
      const shown = new Set<number>();
      const observer = new IntersectionObserver(entries => {
        let changed = false;
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.rsPage);
          if (!Number.isInteger(index)) continue;
          if (entry.isIntersecting && !shown.has(index)) { shown.add(index); changed = true; }
          if (!entry.isIntersecting && shown.delete(index)) changed = true;
        }
        if (changed) apply(new Set(shown));
      }, { root, rootMargin: margin });
      root.querySelectorAll<HTMLElement>('[data-rs-page]').forEach(node => observer.observe(node));
      return observer;
    };
    const exact = watch('0px', pages => flushSync(() => setInView(pages)));
    const around = watch('400px 400px', setNear);
    return () => { exact.disconnect(); around.disconnect(); };
  }, [totalPages, cols, showPages]);

  const paperId = paper?.id ?? -1;
  const [nearDrawn, setNearDrawn] = useState<{ id: number; pages: ReadonlySet<number> }>({ id: -1, pages: EMPTY_PAGES });
  useEffect(() => {
    if (paperId < 0) return;
    const have = nearDrawn.id === paperId ? nearDrawn.pages : EMPTY_PAGES;
    if ([...near].every(page => have.has(page) || inView.has(page))) return;
    let timer = 0;
    const raf = requestAnimationFrame(() => {
      timer = window.setTimeout(() => setNearDrawn({ id: paperId, pages: new Set(near) }), 0);
    });
    return () => { cancelAnimationFrame(raf); window.clearTimeout(timer); };
  }, [paperId, near, inView, nearDrawn]);
  const drawn = useMemo(() => {
    const set = new Set(inView);
    if (nearDrawn.id === paperId) for (const page of nearDrawn.pages) if (near.has(page)) set.add(page);
    return set;
  }, [inView, near, nearDrawn, paperId]);

  useLayoutEffect(() => {
    if (paper && !stale) markReportPaperCommitted();
  }, [paper, stale]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); stepZoom(1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); stepZoom(-1); }
    else if (e.key === '0') { e.preventDefault(); chooseFit('page'); }
  };

  const live = useRef({ paper, onPick });
  useLayoutEffect(() => {
    live.current = { paper, onPick };
  }, [paper, onPick]);

  const hitAt = useCallback((pageIndex: number, e: { clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    const current = live.current.paper;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!current || rect.width === 0) return null;
    const x = ((e.clientX - rect.left) / rect.width) * current.layout.pageWidthPt;
    const y = ((e.clientY - rect.top) / rect.height) * current.layout.pageHeightPt;
    const hit = hitPaperRegion(current.pageRegions(pageIndex), x, y);
    return hit ? { target: hit.id as PaperTarget, column: hit.column } : { target: 'page' as PaperTarget };
  }, []);

  const onPageMove = useCallback((pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    const hit = hitAt(pageIndex, e);
    if (!hit) return;
    setHover(prev => (prev && prev.page === pageIndex && prev.target === hit.target && prev.column === hit.column
      ? prev
      : { page: pageIndex, ...hit }));
  }, [hitAt]);

  const onPageClick = useCallback((pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    const hit = hitAt(pageIndex, e);
    if (!hit) return;
    live.current.onPick({ ...hit, anchor: { x: e.clientX, y: e.clientY } });
  }, [hitAt]);

  const pages = useMemo(() => Array.from({ length: totalPages }, (_, i) => i), [totalPages]);
  const captionFor = useCallback((index: number) => t('studio.paper.sheet', { index: index + 1, total: totalPages }), [t, totalPages]);
  const drawnPages = useMemo(() => [...drawn].sort((a, b) => a - b), [drawn]);
  const inViewPages = useMemo(() => [...inView].sort((a, b) => a - b), [inView]);
  useEffect(() => { onVisible?.(inViewPages); }, [onVisible, inViewPages]);
  const pageNodes = useMemo(() => {
    if (!paper || loading) return null;
    paper.prepare(drawnPages);
    return pages.map(index => (
      <PaperPage
        key={index}
        index={index}
        svg={drawn.has(index) ? paper.pageSvg(index) : null}
        regions={drawn.has(index) ? paper.pageRegions(index) : null}
        pageWidthPt={paper.layout.pageWidthPt}
        pageHeightPt={paper.layout.pageHeightPt}
        hover={hover && hover.page === index ? hover : null}
        selected={selected}
        regionLabel={regionLabel}
        columnLabel={columnLabel}
        onMove={onPageMove}
        onClick={onPageClick}
        onKeyPick={onPick}
        caption={captionFor}
        hint={index === 0 ? hint ?? null : null}
      />
    ));
  }, [paper, loading, pages, drawn, drawnPages, hover, selected, regionLabel, columnLabel,
    onPageMove, onPageClick, onPick, captionFor, hint]);
  const zoomLabel = `${Math.round(scale * 100).toLocaleString(i18n.language)} %`;
  const sizeVars = { '--rs-page-w': `${pageWidth}px`, '--rs-page-h': `${pageHeight}px` } as CSSProperties;

  return (
    <div className="rs-paper-area">
      <div className="rs-toolbar" data-rs-toolbar>
        <div className="rs-status" data-busy={stale || loading ? 'true' : 'false'} aria-live="polite" data-rs-status>
          <span className="rs-status-dot" aria-hidden="true" />
          {status}
        </div>
        {notice}
        <div className="rs-zoom" role="group" aria-label={t('studio.zoom.label')}>
          <button type="button" className="rs-icon-btn" onClick={() => stepZoom(-1)} disabled={scale <= ZOOM_MIN + 0.001}
            title={t('studio.zoom.out')} aria-label={t('studio.zoom.out')} data-rs-zoom="out">
            <Icon id="view.zoom-out" size={16} />
          </button>
          <output className="rs-zoom-value" aria-live="polite" title={t('studio.zoom.valueHint')} data-rs-zoom="value">
            {zoomLabel}
          </output>
          <button type="button" className="rs-icon-btn" onClick={() => stepZoom(1)} disabled={scale >= ZOOM_MAX - 0.001}
            title={t('studio.zoom.in')} aria-label={t('studio.zoom.in')} data-rs-zoom="in">
            <Icon id="view.zoom-in" size={16} />
          </button>
          <span className="rs-zoom-sep" aria-hidden="true" />
          <button type="button" className="rs-fit-btn" onClick={() => chooseFit('page')} aria-pressed={fitMode === 'page'}
            title={t('studio.zoom.pageHint')} data-rs-zoom="page">
            {t('studio.zoom.page')}
          </button>
          <button type="button" className="rs-fit-btn" onClick={() => chooseFit('width')} aria-pressed={fitMode === 'width'}
            title={t('studio.zoom.widthHint')} data-rs-zoom="width">
            {t('studio.zoom.width')}
          </button>
          {cols > 1 && (
            <button type="button" className="rs-fit-btn" onClick={() => chooseFit('row')} aria-pressed={fitMode === 'row'}
              title={t('studio.zoom.rowHint', { count: cols })} data-rs-zoom="row">
              {t('studio.zoom.row')}
            </button>
          )}
        </div>
        {actions}
      </div>
      {banner}
      <div ref={wrapRef} className="rs-viewport-wrap" data-rs-fab-strip={strip > 0 ? 'true' : undefined}>
        <div
          ref={viewportRef}
          className="rs-viewport"
          style={strip > 0 ? { bottom: strip } : undefined}
          tabIndex={0}
          role="region"
          aria-label={t('studio.paper.label', { count: totalPages })}
          aria-roledescription={t('studio.paper.role')}
          onKeyDown={onKeyDown}
          data-report-preview-viewport
          data-rs-viewport
        >
          {loading || !paper ? (
            <div className="rs-pages" style={sizeVars}>
              <div className="rs-page-wrap">
                <div className="rs-page" style={{ width: '100%', height: '100%' }} aria-hidden="true">
                  <div className="rs-page-skeleton" />
                </div>
              </div>
            </div>
          ) : (
            <div
              className="rs-pages"
              style={{
                ...sizeVars,
                ...(cols > 1 ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, var(--rs-page-w))`, justifyContent: 'center', columnGap: PAGE_GAP } : null),
                rowGap: PAGE_ROW_GAP,
              }}
              onMouseLeave={() => setHover(null)}
              data-rs-paper={paper.id}
            >
              {pageNodes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function mostVisiblePage(node: HTMLElement): number | null {
  const box = node.getBoundingClientRect();
  let best: number | null = null;
  let bestArea = 0;
  for (const wrap of node.querySelectorAll<HTMLElement>('[data-rs-page]')) {
    const r = wrap.getBoundingClientRect();
    if (r.bottom < box.top || r.top > box.bottom) continue;
    const w = Math.min(r.right, box.right) - Math.max(r.left, box.left);
    const h = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top);
    const area = Math.max(0, w) * Math.max(0, h);
    if (area > bestArea) { bestArea = area; best = Number(wrap.dataset.rsPage); }
  }
  return best;
}

const REGION_ORDER: readonly PaperRegionId[] = ['header', 'columns', 'chart', 'footer'];

const PaperPage = memo(function PaperPage({
  index, svg, regions, pageWidthPt: W, pageHeightPt: H, hover, selected, regionLabel, columnLabel,
  onMove, onClick, onKeyPick, caption, hint,
}: {
  index: number;
  svg: string | null;
  regions: PageRegions | null;
  pageWidthPt: number;
  pageHeightPt: number;
  hover: HoverState | null;
  selected: { targets: PaperTarget[]; column?: string } | null;
  regionLabel: (target: PaperTarget) => string;
  columnLabel: (key: string) => string;
  onMove: (page: number, e: React.MouseEvent<HTMLDivElement>) => void;
  onClick: (page: number, e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyPick: (pick: PaperPick) => void;
  caption: (index: number) => string;
  hint: { text: string; closeLabel: string; onClose: () => void } | null;
}) {
  const rectStyle = (r: PaperRect) => ({ left: pct(r.x, W), top: pct(r.y, H), width: pct(r.w, W), height: pct(r.h, H) });

  const hoverRects: PaperRect[] = [];
  let hoverLabel = '';
  if (hover && regions) {
    if (hover.target === 'page') {
      hoverRects.push({ x: 0, y: 0, w: W, h: H });
      hoverLabel = regionLabel('page');
    } else {
      const region = regions.regions.find(r => r.id === hover.target);
      if (region) hoverRects.push(...region.rects);
      hoverLabel = regionLabel(hover.target);
      if (hover.column) hoverLabel = `${hoverLabel} · ${columnLabel(hover.column)}`;
    }
  }
  const columnRects = hover?.column && regions ? regions.columns.filter(c => c.key === hover.column) : [];
  const selectedRects: PaperRect[] = [];
  if (selected && regions) {
    for (const target of selected.targets) {
      if (target === 'page') selectedRects.push({ x: 0, y: 0, w: W, h: H });
      else selectedRects.push(...(regions.regions.find(r => r.id === target)?.rects ?? []));
    }
    if (selected.column) selectedRects.push(...regions.columns.filter(c => c.key === selected.column));
  }
  return (
    <div className="rs-page-wrap" data-rs-page={index}>
      <div className="rs-page-caption">
        <span aria-hidden="true">{caption(index)}</span>
        {hoverLabel ? (
          <span className="rs-region-label" data-rs-region-label aria-hidden="true">{hoverLabel}</span>
        ) : hint ? (
          <span className="rs-paper-hint" data-rs-paper-hint>
            <Icon id="status.info" size={14} />
            <span>{hint.text}</span>
            <button type="button" className="rs-paper-hint-close" onClick={hint.onClose} aria-label={hint.closeLabel} title={hint.closeLabel}>
              <Icon id="ui.close" size={12} />
            </button>
          </span>
        ) : null}
      </div>
      <div
        className="rs-page"
        style={{ width: '100%', height: '100%' }}
        data-preview-page={index}
        onMouseMove={e => onMove(index, e)}
        onClick={e => onClick(index, e)}
        aria-hidden={index > 0 ? 'true' : undefined}
      >
        {svg !== null
          ? <div className="rs-page-svg" dangerouslySetInnerHTML={{ __html: svg }} />
          : <div className="rs-page-skeleton" />}
        <div className="rs-overlay">
          {selectedRects.map((r, i) => <div key={`s${i}`} className="rs-region" data-kind="selected" style={rectStyle(r)} />)}
          {hoverRects.map((r, i) => <div key={`h${i}`} className="rs-region" style={rectStyle(r)} data-rs-hover={hover?.target} />)}
          {columnRects.map((r, i) => <div key={`c${i}`} className="rs-region" data-kind="column" style={rectStyle(r)} />)}
          {index === 0 && regions && REGION_ORDER.map(id => {
            const r = regions.regions.find(region => region.id === id)?.rects[0];
            if (!r) return null;
            return (
              <button
                key={id}
                type="button"
                className="rs-region-btn"
                style={rectStyle(r)}
                aria-label={regionLabel(id)}
                data-rs-region-button={id}
                onClick={e => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onKeyPick({ target: id, anchor: { x: rect.left + rect.width / 2, y: rect.top + Math.min(rect.height / 2, 40) } });
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});
