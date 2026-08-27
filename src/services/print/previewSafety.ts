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
export const PREVIEW_MAX_PAGE_PIXELS = 12_000_000;
export const PREVIEW_RENDER_SCALE = 2;
export const PREVIEW_MAX_PAGES = 30;

export interface PreviewRasterLimits {
  /** Rasterpixels per logische px voor de tijdelijke broncanvas. */
  renderScale: number;
  /** Aantal complete papiercanvassen dat de preview tegelijk mag vasthouden. */
  maxPages: number;
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
  const pixelsPerPage = Math.max(1, Math.round(pageWidth) * Math.round(pageHeight));
  const maxPages = Math.max(1, Math.min(PREVIEW_MAX_PAGES, Math.floor(PREVIEW_MAX_PAGE_PIXELS / pixelsPerPage)));

  return { renderScale, maxPages };
}
