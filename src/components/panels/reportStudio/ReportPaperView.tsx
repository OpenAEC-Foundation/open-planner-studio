import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
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

/**
 * Hoe het blad in het venster past: het hele blad, de breedte van één blad, de hele rij bladen naast
 * elkaar (alleen als de tijdlijn over meer bladen loopt), of een eigen zoom.
 */
type PaperFit = { fit: 'page' | 'width' | 'row' } | { scale: number };

/** De hoek linksonder (in rtl rechtsonder) die de zwevende exportknop inneemt, gemeten vanaf de rand van het papiervlak. */
export interface FabZone { width: number; height: number }

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function pct(v: number, of: number): string {
  return `${(v / of) * 100}%`;
}

const EMPTY_PAGES: ReadonlySet<number> = new Set();

/**
 * Het interactieve papier: de bladen als SVG (scherp op elke zoom). Standaard staat één heel blad in
 * beeld ("Hele blad"); "Breedte" vult de breedte met één blad, en "Hele rij" zet alle bladen van een rij
 * naast elkaar als de tijdlijn over meer bladen loopt. Zoomen met − en +, Ctrl+scrollen of + / − / 0
 * (0 = hele blad). De delen van het blad lichten bij bewegen op; hun naam staat boven het blad, zodat hij
 * niets afdekt. Een klik op een deel opent de bijbehorende stap.
 *
 * Snelheid bij honderden bladen: alleen bladen in (of vlak bij) beeld krijgen hun SVG, en de bladen
 * die echt in beeld staan eerst; die vlak erbuiten volgen één frame later. De maat van een blad staat in
 * een CSS-variabele op de lijst, dus een zoomstap rendert de bladen niet opnieuw.
 *
 * De zwevende exportknop (zijbalk ingeklapt) bedekt nooit inhoud: raakt een blad zijn hoek, dan stopt
 * het scrollvak boven een vrije strook onderaan, waarin de knop zweeft. Anders loopt het papier tot
 * onderaan door, en is "Hele blad" ingeklapt minstens zo groot als met de zijbalk open.
 */
export function ReportPaperView({
  paper, stale, loading, selected, onPick, regionLabel, columnLabel, status, actions, onVisible,
  fabZone = null, hint, banner,
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
  /** De bladen die echt in beeld staan, na elke wijziging (de volgende opname tekent hun rijen meteen). */
  onVisible?: (pages: readonly number[]) => void;
  /** De hoek van de zwevende exportknop, of `null` als die er niet is. */
  fabZone?: FabZone | null;
  /** Korte aanwijzing boven het eerste blad (eerste bezoek), met een knop om hem te sluiten. */
  hint?: { text: string; closeLabel: string; onClose: () => void } | null;
  /** Balk tussen de werkbalk en het papier, of `null`. */
  banner?: ReactNode;
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
  // "Hele rij" bestaat alleen als er meer bladen naast elkaar staan; anders is het "Breedte".
  const fitMode = 'fit' in fit ? (fit.fit === 'row' && cols <= 1 ? 'width' : fit.fit) : null;
  const availWidth = Math.max(0, viewport.width - 2 * PAGES_PAD);
  const widthFor = (reserve: number): number => {
    if ('scale' in fit) return fit.scale * realWidth;
    if (fitMode === 'row') return Math.max(160, (availWidth - (cols - 1) * PAGE_GAP) / cols);
    if (fitMode === 'width') return Math.max(160, availWidth);
    // Hele blad: één blad past in breedte én hoogte (met zijn titel erboven).
    const heightFit = (viewport.height - PAGES_PAD_TOP - PAGES_PAD - reserve) / aspect;
    return Math.max(120, Math.min(Math.max(160, availWidth), heightFit));
  };
  // Raakt de rij bladen de hoek van de zwevende knop? De bladen staan gecentreerd; is de rij breder dan
  // het venster, dan begint hij bij de marge.
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
  // Laatste waarden voor de handlers hieronder, zonder dat die bij elke render nieuw worden.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // De breedte uit het scrollvak (zonder schuifbalk), de hoogte uit het hele papiervlak: de strook voor
  // de knop maakt het scrollvak lager, maar mag de maat van "Hele blad" niet terug laten veranderen.
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

  const chooseFit = useCallback((mode: 'page' | 'width' | 'row') => setFit({ fit: mode }), []);

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

  // Welke bladen staan in beeld (`inView`), en welke vlak erbij (`near`, 400 px marge). Een blad in beeld
  // krijgt zijn SVG direct; een blad vlak erbij één frame later, zodat een sprong of een nieuwe opname eerst
  // het blad toont waar je naar kijkt.
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
    // `flushSync`: de bladen in beeld renderen nog in de taak van de waarnemer. Zonder die stap plant
    // React de render als een losse taak, en kwam er bij een sprong soms een tweede frame met een leeg
    // blad in het midden tussen.
    const exact = watch('0px', pages => flushSync(() => setInView(pages)));
    const around = watch('400px 400px', setNear);
    return () => { exact.disconnect(); around.disconnect(); };
  }, [totalPages, cols, showPages]);

  // De bladen vlak bij beeld, per opname: pas één frame nadat de bladen in beeld getekend zijn.
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
  const drawnPages = useMemo(() => [...drawn].sort((a, b) => a - b), [drawn]);
  const inViewPages = useMemo(() => [...inView].sort((a, b) => a - b), [inView]);
  useEffect(() => { onVisible?.(inViewPages); }, [onVisible, inViewPages]);
  // De bladen hangen niet af van `stale`, de werkbalk of de zoom (die staat in een CSS-variabele): zo kost
  // een klik in de zijbalk of een zoomstap geen render van honderd bladen.
  const pageNodes = useMemo(() => {
    if (!paper || loading) return null;
    // Eén render voor de rijen van alle getekende bladen, vóór de bladen hun SVG vragen.
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

const REGION_ORDER: readonly PaperRegionId[] = ['header', 'columns', 'chart', 'footer'];

const PaperPage = memo(function PaperPage({
  index, svg, regions, pageWidthPt: W, pageHeightPt: H, hover, selected, regionLabel, columnLabel,
  onMove, onClick, onKeyPick, caption, hint,
}: {
  index: number;
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
    <div className="rs-page-wrap" data-rs-page={index}>
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
