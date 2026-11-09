import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/icons';
import { hitPaperRegion, type PageRegions, type PaperRect, type PaperRegionId } from '@/services/print/reportPaper';
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

/**
 * Zoom van het papier als deel van de ware grootte (1 = het blad op 96 px per inch, zoals een
 * pdf-lezer 100 % toont). Los van de Gantt-zoom (`ZOOM_STEP` in ganttViewport.ts): andere eenheid.
 */
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const PAPER_ZOOM_STOPS = [0.1, 0.15, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4];
const PAGE_GAP = 20;
/** Ruimte tussen twee rijen bladen: ruim genoeg voor de bladtitel en het naamlabel erboven. */
const PAGE_ROW_GAP = 32;
const PAGES_PAD = 24;
/** Ruimte boven het eerste blad, met de bladtitel en het naamlabel erin (`.rs-pages`, `.rs-page-caption`). */
const PAGES_PAD_TOP = 30;
/** CSS-px per PDF-punt: 96 per inch tegen 72 per inch. */
const PX_PER_PT = 96 / 72;

/** Hoe het blad in het venster past: het hele blad, de breedte, of een eigen zoom. */
type PaperFit = { fit: 'page' | 'width' } | { scale: number };

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function pct(v: number, of: number): string {
  return `${(v / of) * 100}%`;
}

/**
 * Het interactieve papier: de bladen als SVG (scherp op elke zoom). Standaard staat het hele blad in
 * beeld ("Hele blad"); "Breedte" vult de breedte van het venster. Zoomen met − en +, Ctrl+scrollen of
 * + / − / 0 (0 = hele blad). De delen van het blad lichten bij bewegen op; hun naam staat boven het
 * blad, zodat hij niets afdekt. Een klik op een deel opent de bijbehorende stap. Alleen bladen in (of
 * vlak bij) beeld krijgen hun SVG; de rest is een leeg vel van de juiste maat, zodat ook een planning
 * van honderden bladen direct scrolt.
 */
export function ReportPaperView({
  paper, stale, loading, selected, onPick, regionLabel, columnLabel, status, actions, onVisible,
  bottomReserve = 0, hint,
}: {
  paper: ReportPaperModel | null;
  /** De getoonde opname hoort bij oudere instellingen (de nieuwe wordt gemaakt). */
  stale: boolean;
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
  /** De bladen in (of vlak bij) beeld, na elke wijziging. */
  onVisible?: (pages: readonly number[]) => void;
  /** Ruimte (px) die onderaan vrij blijft voor de zwevende exportknop; "Hele blad" past erboven. */
  bottomReserve?: number;
  /** Korte aanwijzing boven het eerste blad (eerste bezoek), met een knop om hem te sluiten. */
  hint?: { text: string; closeLabel: string; onClose: () => void } | null;
}) {
  const { t, i18n } = useTranslation('report');
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [fit, setFit] = useState<PaperFit>({ fit: 'page' });
  const [hover, setHover] = useState<HoverState | null>(null);
  const [visible, setVisible] = useState<ReadonlySet<number>>(() => new Set([0, 1]));
  const pendingScroll = useRef<{ ratio: number; px: number; py: number } | null>(null);

  const layout = paper?.layout;
  const cols = layout ? Math.max(1, layout.cols) : 1;
  const totalPages = paper?.totalPages ?? 0;
  const pageWidthPt = layout?.pageWidthPt ?? 1190.55;
  const pageHeightPt = layout?.pageHeightPt ?? 841.89;
  const aspect = pageHeightPt / pageWidthPt;
  const realWidth = pageWidthPt * PX_PER_PT;
  // Breedte = de bladen van één rij naast elkaar over de beschikbare breedte. Hele blad = ook de hoogte
  // van één blad (met zijn titel) past, boven de vrije ruimte voor de exportknop.
  const widthFit = Math.max(160, (viewport.width - 2 * PAGES_PAD - (cols - 1) * PAGE_GAP) / cols);
  const heightFit = (viewport.height - PAGES_PAD_TOP - PAGES_PAD - bottomReserve) / aspect;
  const pageFit = Math.max(120, Math.min(widthFit, heightFit));
  const pageWidth = 'scale' in fit ? fit.scale * realWidth : fit.fit === 'page' ? pageFit : widthFit;
  const pageHeight = pageWidth * aspect;
  const scale = pageWidth / realWidth;
  // Laatste waarden voor de handlers hieronder, zonder dat die bij elke render nieuw worden.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const realWidthRef = useRef(realWidth);
  realWidthRef.current = realWidth;

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0) return;
      const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
      setViewport(prev => (prev.width === next.width && prev.height === next.height ? prev : next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Zoom rond een punt: het stuk papier onder de muis (of het midden) blijft op zijn plek.
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

  const chooseFit = useCallback((mode: 'page' | 'width') => setFit({ fit: mode }), []);

  useLayoutEffect(() => {
    const node = viewportRef.current;
    const pending = pendingScroll.current;
    if (!node || !pending) return;
    pendingScroll.current = null;
    node.scrollLeft = (node.scrollLeft + pending.px - PAGES_PAD) * pending.ratio + PAGES_PAD - pending.px;
    node.scrollTop = (node.scrollTop + pending.py - PAGES_PAD) * pending.ratio + PAGES_PAD - pending.py;
  }, [pageWidth]);

  // Ander papierformaat of andere stand: terug naar de bovenkant van blad 1. Anders sta je na een wissel
  // van A3 liggend naar A4 staand ergens midden in een ander blad.
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

  // Ctrl/⌘ + scrollen zoomt (geen passieve luisteraar: anders zoomt de browser de hele pagina).
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
    if (paper && !stale) markReportPaperCommitted();
  }, [paper, stale]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); stepZoom(1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); stepZoom(-1); }
    else if (e.key === '0') { e.preventDefault(); chooseFit('page'); }
  };

  // De bladen krijgen vaste handlers: zo slaat `memo` een blad over als alleen de zijbalk of de
  // stand "wordt bijgewerkt" verandert. Bij 139 bladen scheelt dat per klik een volle render.
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
  // Eén vaste functie in plaats van een vertaalde tekst per blad: bij 139 bladen kostte dat per render
  // 139 vertalingen, ook voor bladen die `memo` overslaat.
  const captionFor = useCallback((index: number) => t('studio.paper.sheet', { index: index + 1, total: totalPages }), [t, totalPages]);
  const visiblePages = useMemo(() => [...visible].sort((a, b) => a - b), [visible]);
  useEffect(() => { onVisible?.(visiblePages); }, [onVisible, visiblePages]);
  // De bladen hangen niet af van `stale` of de werkbalk: zo kost een klik in de zijbalk geen render van
  // honderd bladen (`memo` per blad slaat ze over, maar ook de lijst zelf kostte bij 139 bladen ±25 ms).
  const pageNodes = useMemo(() => {
    if (!paper || loading) return null;
    // Eén render voor de rijen van alle bladen in beeld, vóór de bladen hun SVG vragen.
    paper.prepare(visiblePages);
    return pages.map(index => (
      <PaperPage
        key={index}
        index={index}
        width={pageWidth}
        height={pageHeight}
        svg={visible.has(index) ? paper.pageSvg(index) : null}
        regions={visible.has(index) ? paper.pageRegions(index) : null}
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
  }, [paper, loading, pages, visible, visiblePages, pageWidth, pageHeight, hover, selected, regionLabel, columnLabel,
    onPageMove, onPageClick, onPick, captionFor, hint]);
  const zoomLabel = `${Math.round(scale * 100).toLocaleString(i18n.language)} %`;
  const fitMode = 'fit' in fit ? fit.fit : null;

  return (
    <div className="rs-paper-area">
      <div className="rs-toolbar" data-rs-toolbar>
        <div className="rs-status" data-busy={stale || loading ? 'true' : 'false'} aria-live="polite" data-rs-status>
          <span className="rs-status-dot" aria-hidden="true" />
          {status}
        </div>
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
            <div className="rs-page-wrap" style={{ width: pageWidth, height: pageHeight }}>
              <div className="rs-page" style={{ width: '100%', height: '100%' }} aria-hidden="true">
                <div className="rs-page-skeleton" />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rs-pages"
            style={{
              ...(cols > 1 ? { display: 'grid', gridTemplateColumns: `repeat(${cols}, ${pageWidth}px)`, justifyContent: 'center', columnGap: PAGE_GAP } : null),
              rowGap: PAGE_ROW_GAP,
              paddingBottom: PAGES_PAD + bottomReserve,
            }}
            onMouseLeave={() => setHover(null)}
          >
            {pageNodes}
          </div>
        )}
      </div>
    </div>
  );
}

const REGION_ORDER: readonly PaperRegionId[] = ['header', 'columns', 'chart', 'footer'];

const PaperPage = memo(function PaperPage({
  index, width, height, svg, regions, pageWidthPt: W, pageHeightPt: H, hover, selected, regionLabel, columnLabel,
  onMove, onClick, onKeyPick, caption, hint,
}: {
  index: number;
  width: number;
  height: number;
  svg: string | null;
  /** De klikbare delen van dit blad; `null` zolang het blad niet in beeld is. Bewust geen heel
   *  papiermodel als prop: React dev vergelijkt props diep, en dat kostte per blad seconden. */
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
    <div className="rs-page-wrap" style={{ width, height }} data-rs-page={index}>
      {/* Boven het blad: links de bladtitel, rechts de naam van het deel onder de muis (zo dekt hij niets
          van het blad af), of bij het eerste bezoek de aanwijzing dat je op het blad kunt klikken. */}
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
