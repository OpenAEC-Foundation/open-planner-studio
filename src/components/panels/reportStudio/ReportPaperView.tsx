import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { hitPaperRegion, type PaperRect, type PaperRegionId } from '@/services/print/reportPaper';
import type { ReportPaperModel } from './useReportPaper';
import { markReportPaperCommitted } from './studioPerf';

/** Een deel van het papier dat een stap opent; `page` = de marge (stap Pagina). */
export type PaperTarget = PaperRegionId | 'page';

export interface PaperPick {
  target: PaperTarget;
  /** Sleutel van de kolom onder de muis (alleen bij `columns`). */
  column?: string;
  /** Plek op het scherm, voor het zwevende venster bij een ingeklapte zijbalk. */
  anchor: { x: number; y: number };
}

interface HoverState { page: number; target: PaperTarget; column?: string }

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 6;
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6];
const PAGE_GAP = 20;
const PAGES_PAD = 24;

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function pct(v: number, of: number): string {
  return `${(v / of) * 100}%`;
}

/**
 * Het interactieve papier: de bladen als SVG (scherp op elke zoom), zoomen met knoppen, Ctrl+scrollen
 * of + / − / 0, en de delen van het blad die bij bewegen oplichten met hun naam. Een klik op een deel
 * opent de bijbehorende stap. Alleen bladen in (of vlak bij) beeld krijgen hun SVG; de rest is een
 * leeg vel van de juiste maat, zodat ook een planning van honderden bladen direct scrolt.
 */
export function ReportPaperView({
  paper, loading, selected, onPick, regionLabel, columnLabel, status, actions,
}: {
  paper: ReportPaperModel | null;
  loading: boolean;
  /** Het deel dat bij de open stap hoort; staat gemarkeerd op elk blad in beeld. */
  selected: { targets: PaperTarget[]; column?: string } | null;
  onPick: (pick: PaperPick) => void;
  regionLabel: (target: PaperTarget) => string;
  columnLabel: (key: string) => string;
  /** Links in de werkbalk: de stand van het papier. */
  status: ReactNode;
  /** Rechts naast de zoomknoppen. */
  actions?: ReactNode;
}) {
  const { t } = useTranslation('report');
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [visible, setVisible] = useState<ReadonlySet<number>>(() => new Set([0, 1]));
  const pendingScroll = useRef<{ ratio: number; px: number; py: number } | null>(null);

  const layout = paper?.layout;
  const cols = layout ? Math.max(1, layout.cols) : 1;
  const totalPages = paper?.totalPages ?? 0;
  const aspect = layout ? layout.pageHeightPt / layout.pageWidthPt : 297 / 420;
  // Passend = de bladen van één rij naast elkaar over de beschikbare breedte.
  const fitWidth = Math.max(160, (viewportWidth - 2 * PAGES_PAD - (cols - 1) * PAGE_GAP) / cols);
  const pageWidth = fitWidth * zoom;
  const pageHeight = pageWidth * aspect;

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (width > 0) setViewportWidth(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Zoom rond een punt: het stuk papier onder de muis blijft onder de muis.
  const zoomTo = useCallback((next: number, clientX?: number, clientY?: number) => {
    const node = viewportRef.current;
    setZoom(prev => {
      const target = clampZoom(next);
      if (node && target !== prev) {
        const rect = node.getBoundingClientRect();
        const px = (clientX ?? rect.left + rect.width / 2) - rect.left;
        const py = (clientY ?? rect.top + rect.height / 2) - rect.top;
        pendingScroll.current = { ratio: target / prev, px, py };
      }
      return target;
    });
  }, []);

  useLayoutEffect(() => {
    const node = viewportRef.current;
    const pending = pendingScroll.current;
    if (!node || !pending) return;
    pendingScroll.current = null;
    node.scrollLeft = (node.scrollLeft + pending.px - PAGES_PAD) * pending.ratio + PAGES_PAD - pending.px;
    node.scrollTop = (node.scrollTop + pending.py - PAGES_PAD) * pending.ratio + PAGES_PAD - pending.py;
  }, [zoom]);

  const stepZoom = useCallback((dir: 1 | -1) => {
    setZoom(prev => {
      const next = dir > 0 ? ZOOM_STEPS.find(z => z > prev + 0.001) ?? ZOOM_MAX : [...ZOOM_STEPS].reverse().find(z => z < prev - 0.001) ?? ZOOM_MIN;
      const node = viewportRef.current;
      if (node) {
        const rect = node.getBoundingClientRect();
        pendingScroll.current = { ratio: next / prev, px: rect.width / 2, py: rect.height / 2 };
      }
      return next;
    });
  }, []);

  // Ctrl/⌘ + scrollen zoomt (geen passieve luisteraar: anders zoomt de browser de hele pagina).
  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(prev => {
        const target = clampZoom(prev * Math.exp(-e.deltaY * 0.0018));
        const rect = node.getBoundingClientRect();
        pendingScroll.current = { ratio: target / prev, px: e.clientX - rect.left, py: e.clientY - rect.top };
        return target;
      });
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  // Welke bladen staan in of vlak bij beeld.
  useEffect(() => {
    const root = viewportRef.current;
    if (!root || totalPages === 0) return;
    const shown = new Set<number>();
    const observer = new IntersectionObserver(entries => {
      let changed = false;
      for (const entry of entries) {
        const index = Number((entry.target as HTMLElement).dataset.rsPage);
        if (!Number.isInteger(index)) continue;
        if (entry.isIntersecting && !shown.has(index)) { shown.add(index); changed = true; }
        if (!entry.isIntersecting && shown.delete(index)) changed = true;
      }
      if (changed) setVisible(new Set(shown));
    }, { root, rootMargin: '400px 400px' });
    root.querySelectorAll<HTMLElement>('[data-rs-page]').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [totalPages, pageWidth, cols]);

  // Meting: het papier met de nieuwe stand is vastgelegd.
  useLayoutEffect(() => {
    if (paper && !paper.stale) markReportPaperCommitted();
  }, [paper]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); stepZoom(1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); stepZoom(-1); }
    else if (e.key === '0') { e.preventDefault(); zoomTo(1); }
  };

  const pagePoint = (e: { clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!layout || rect.width === 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * layout.pageWidthPt,
      y: ((e.clientY - rect.top) / rect.height) * layout.pageHeightPt,
    };
  };

  const targetAt = (pageIndex: number, x: number, y: number): { target: PaperTarget; column?: string } => {
    if (!paper) return { target: 'page' };
    const hit = hitPaperRegion(paper.pageRegions(pageIndex), x, y);
    return hit ? { target: hit.id, column: hit.column } : { target: 'page' };
  };

  const onPageMove = (pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    const p = pagePoint(e);
    if (!p) return;
    const hit = targetAt(pageIndex, p.x, p.y);
    setHover(prev => (prev && prev.page === pageIndex && prev.target === hit.target && prev.column === hit.column
      ? prev
      : { page: pageIndex, ...hit }));
  };

  const onPageClick = (pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    const p = pagePoint(e);
    if (!p) return;
    const hit = targetAt(pageIndex, p.x, p.y);
    onPick({ ...hit, anchor: { x: e.clientX, y: e.clientY } });
  };

  const pages = useMemo(() => Array.from({ length: totalPages }, (_, i) => i), [totalPages]);
  const zoomLabel = `${Math.round(zoom * 100)} %`;

  return (
    <div className="rs-paper-area">
      <div className="rs-toolbar" data-rs-toolbar>
        <div className="rs-status" data-busy={paper?.stale || loading ? 'true' : 'false'} aria-live="polite" data-rs-status>
          <span className="rs-status-dot" aria-hidden="true" />
          {status}
        </div>
        <div className="rs-zoom" role="group" aria-label={t('studio.zoom.label')}>
          <button type="button" className="rs-icon-btn" onClick={() => stepZoom(-1)} disabled={zoom <= ZOOM_MIN}
            title={t('studio.zoom.out')} aria-label={t('studio.zoom.out')} data-rs-zoom="out">
            <Icon id="view.zoom-out" size={16} />
          </button>
          <button type="button" className="rs-zoom-value" onClick={() => zoomTo(1)} title={t('studio.zoom.fitHint')}
            data-rs-zoom="value">
            {zoom === 1 ? t('studio.zoom.fit') : zoomLabel}
          </button>
          <button type="button" className="rs-icon-btn" onClick={() => stepZoom(1)} disabled={zoom >= ZOOM_MAX}
            title={t('studio.zoom.in')} aria-label={t('studio.zoom.in')} data-rs-zoom="in">
            <Icon id="view.zoom-in" size={16} />
          </button>
          <button type="button" className="rs-icon-btn" onClick={() => zoomTo(1)} aria-pressed={zoom === 1}
            title={t('studio.zoom.fitHint')} aria-label={t('studio.zoom.fit')} data-rs-zoom="fit">
            <Icon id="view.fit" size={16} />
          </button>
        </div>
        {actions}
      </div>
      <div
        ref={viewportRef}
        className="rs-viewport"
        tabIndex={0}
        role="region"
        aria-label={t('studio.paper.label', { count: totalPages })}
        aria-roledescription={t('studio.paper.role')}
        onKeyDown={onKeyDown}
        data-report-preview-viewport
        data-rs-viewport
      >
        {loading || !paper ? (
          <div className="rs-pages">
            <div className="rs-page-wrap" style={{ width: fitWidth, height: fitWidth * aspect }}>
              <div className="rs-page" style={{ width: '100%', height: '100%' }} aria-hidden="true">
                <div className="rs-page-skeleton" />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rs-pages"
            style={cols > 1 ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, ${pageWidth}px)`, justifyContent: 'center', columnGap: PAGE_GAP, rowGap: PAGE_GAP + 8 } : undefined}
            onMouseLeave={() => setHover(null)}
          >
            {pages.map(index => (
              <PaperPage
                key={index}
                index={index}
                width={pageWidth}
                height={pageHeight}
                svg={visible.has(index) ? paper.pageSvg(index) : null}
                paper={paper}
                hover={hover && hover.page === index ? hover : null}
                selected={selected}
                regionLabel={regionLabel}
                columnLabel={columnLabel}
                onMove={onPageMove}
                onClick={onPageClick}
                onKeyPick={onPick}
                caption={t('studio.paper.sheet', { index: index + 1, total: totalPages })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const REGION_ORDER: readonly PaperRegionId[] = ['header', 'columns', 'chart', 'footer'];

const PaperPage = memo(function PaperPage({
  index, width, height, svg, paper, hover, selected, regionLabel, columnLabel, onMove, onClick, onKeyPick, caption,
}: {
  index: number;
  width: number;
  height: number;
  svg: string | null;
  paper: ReportPaperModel;
  hover: HoverState | null;
  selected: { targets: PaperTarget[]; column?: string } | null;
  regionLabel: (target: PaperTarget) => string;
  columnLabel: (key: string) => string;
  onMove: (page: number, e: React.MouseEvent<HTMLDivElement>) => void;
  onClick: (page: number, e: React.MouseEvent<HTMLDivElement>) => void;
  onKeyPick: (pick: PaperPick) => void;
  caption: string;
}) {
  const W = paper.layout.pageWidthPt;
  const H = paper.layout.pageHeightPt;
  const regions = svg !== null ? paper.pageRegions(index) : null;
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
  const labelRect = hoverRects[0];

  return (
    <div className="rs-page-wrap" style={{ width, height }} data-rs-page={index}>
      <div className="rs-page-caption" aria-hidden="true">{caption}</div>
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
          {labelRect && hoverLabel && (
            <div
              className="rs-region-label"
              data-inside={labelRect.y < H * 0.04 ? 'true' : 'false'}
              style={{ left: pct(labelRect.x + 4, W), top: pct(labelRect.y, H) }}
              data-rs-region-label
            >
              {hoverLabel}
            </div>
          )}
          {/* Toetsenbord: op het eerste blad is elk deel een knop (verborgen tot hij focus krijgt). */}
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
