import { PAPER_PT, type Orientation, type PaperSize } from './tileLayout';

/**
 * De papieren preview is een hulpmiddel, geen exportbron. Deze limieten houden de tijdelijke
 * rasterbuffers ruim onder het punt waarop een optiewijziging de UI-thread of het systeem kan
 * laten vastlopen. De vector-export behoudt alle pagina's en gebruikt deze limieten niet.
 */
// Een normale A4-preview met circa 260 rijen blijft zo op 1× scherp. Alleen uitzonderlijk grote
// rapporten worden teruggeschaald; vóór deze grens werd ook de alledaagse preview uitgezoomd en
// vervolgens op papierformaat opgeblazen.
/** Kwaliteit bepaalt een expliciet totaalbudget voor actieve pagina-PNG's, nooit voor een volledig broncanvas. */
export const PREVIEW_QUALITY_RASTER_BUDGETS = { 1: 9_000_000, 2: 18_000_000, 3: 12_000_000 } as const;
export const PREVIEW_MAX_RASTER_PIXELS = PREVIEW_QUALITY_RASTER_BUDGETS[2];
export const PREVIEW_MAX_PAGE_PIXELS = PREVIEW_QUALITY_RASTER_BUDGETS[3];
/** De kwaliteitsschaal is ook de directe, page-local bronbemonstering. */
export const PREVIEW_RENDER_SCALE = 2;
export const PREVIEW_MAX_PAGES = 30;
export type PreviewQuality = 1 | 2 | 3;

export interface PreviewRasterLimits {
  /** Rasterpixels per logische px voor de tijdelijke broncanvas. */
  renderScale: number;
  /** Aantal complete papiercanvassen dat de preview tegelijk mag vasthouden. */
  maxPages: number;
  /** Pixels per PDF-punt voor zichtbare pagina's, begrensd door CSS-grootte × DPR en budget. */
  pageSupersample: number;
}

/**
 * Bepaal de hoogste veilige previewresolutie en het aantal pagina's binnen één gezamenlijk
 * rasterbudget. De functie is puur zodat de UI niet op een gok geheugen reserveert.
 */
export function computePreviewRasterLimits(
  logicalWidth: number,
  logicalHeight: number,
  paperSize: PaperSize,
  orientation: Orientation,
  cssPageWidth = 900,
  devicePixelRatio = 1,
  quality: PreviewQuality = 2,
): PreviewRasterLimits {
  // De parameters blijven deel van het pure publieke contract: de oude broncanvasroute gebruikte
  // ze voor zijn totale oppervlak. De page-local route rekent bewust niet meer op rapporthoogte.
  void logicalWidth;
  void logicalHeight;
  const dpr = Math.max(1, devicePixelRatio);
  const qualityFactor: PreviewQuality = quality === 1 || quality === 3 ? quality : 2;
  // Maximaal kiest bewust één actieve pagina; Standard/Hoog mogen alleen nabijpagina's houden
  // wanneer die samen binnen hun kwaliteitsspecifieke pagebudget passen.
  const budget = PREVIEW_QUALITY_RASTER_BUDGETS[qualityFactor];

  const paper = PAPER_PT[paperSize];
  const pageWidth = orientation === 'landscape' ? paper.height : paper.width;
  const pageHeight = orientation === 'landscape' ? paper.width : paper.height;
  const wantedRenderScale = qualityFactor * dpr;
  const wantedSupersample = (Math.max(1, cssPageWidth) * dpr * qualityFactor) / pageWidth;
  const pagePixelArea = Math.max(1, pageWidth * pageHeight);
  const wantedPagePixels = pagePixelArea * wantedSupersample * wantedSupersample;
  // Alleen een extreem grote zichtbare pagina (bv. DPR 3 + A1 portret) wordt geklemd. Een lang
  // rapport heeft hier geen invloed meer op: dat is precies het verschil met de oude broncanvasroute.
  const pageSupersample = Math.max(
    1 / Math.max(pageWidth, pageHeight),
    wantedSupersample * Math.min(1, Math.sqrt(PREVIEW_MAX_PAGE_PIXELS / wantedPagePixels)),
  );
  const pixelsPerPage = Math.max(1, Math.ceil(pagePixelArea * pageSupersample * pageSupersample));
  const maxPages = Math.max(1, Math.min(
    PREVIEW_MAX_PAGES,
    qualityFactor === 3 ? 1 : Math.floor(budget / pixelsPerPage),
  ));

  return { renderScale: wantedRenderScale, maxPages, pageSupersample };
}
