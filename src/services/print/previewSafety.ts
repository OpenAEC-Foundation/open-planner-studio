import { PAPER_PT, type Orientation, type PaperSize } from './tileLayout';

/**
 * De papieren preview is een hulpmiddel, geen exportbron. Deze limieten houden de tijdelijke
 * rasterbuffers ruim onder het punt waarop een optiewijziging de UI-thread of het systeem kan
 * laten vastlopen. De vector-export behoudt alle pagina's en gebruikt deze limieten niet.
 */
// Een normale A4-preview met circa 260 rijen blijft zo op 1× scherp. Alleen uitzonderlijk grote
// rapporten worden teruggeschaald; vóór deze grens werd ook de alledaagse preview uitgezoomd en
// vervolgens op papierformaat opgeblazen.
export const PREVIEW_MAX_SOURCE_PIXELS = 12_000_000;
/** Bron + actieve previewpagina's delen dit budget; zo telt supersampling werkelijk mee. */
export const PREVIEW_MAX_RASTER_PIXELS = 18_000_000;
export const PREVIEW_MAX_PAGE_PIXELS = PREVIEW_MAX_RASTER_PIXELS - PREVIEW_MAX_SOURCE_PIXELS;
export const PREVIEW_RENDER_SCALE = 2;
export const PREVIEW_MAX_PAGES = 30;

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
  activePages = 2,
): PreviewRasterLimits {
  const width = Number.isFinite(logicalWidth) ? Math.max(1, logicalWidth) : 1;
  const height = Number.isFinite(logicalHeight) ? Math.max(1, logicalHeight) : 1;
  const logicalPixels = width * height;

  // Houd minstens één rasterpixel in beide richtingen over; de pagineerder gebruikt die schaal om
  // bronvensters correct naar de pagina te vertalen.
  const minScale = Math.max(1 / width, 1 / height);
  const renderScale = Math.max(
    minScale,
    Math.min(PREVIEW_RENDER_SCALE, Math.sqrt(PREVIEW_MAX_SOURCE_PIXELS / logicalPixels)),
  );

  const paper = PAPER_PT[paperSize];
  const pageWidth = orientation === 'landscape' ? paper.height : paper.width;
  const pageHeight = orientation === 'landscape' ? paper.width : paper.height;
  const wantedSupersample = (Math.max(1, cssPageWidth) * Math.max(1, devicePixelRatio)) / pageWidth;
  const pagePixelArea = Math.max(1, pageWidth * pageHeight);
  const pageBudget = Math.max(1, PREVIEW_MAX_RASTER_PIXELS - logicalPixels * renderScale * renderScale);
  const pageSupersample = Math.max(1 / Math.max(pageWidth, pageHeight), Math.min(
    wantedSupersample,
    Math.sqrt(pageBudget / (pagePixelArea * Math.max(1, activePages))),
  ));
  const pixelsPerPage = Math.max(1, Math.ceil(pagePixelArea * pageSupersample * pageSupersample));
  const maxPages = Math.max(1, Math.min(PREVIEW_MAX_PAGES, Math.floor(pageBudget / pixelsPerPage)));

  return { renderScale, maxPages, pageSupersample };
}
