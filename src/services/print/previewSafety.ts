import { PAPER_PT, type Orientation, type PaperSize } from './tileLayout';

/**
 * De papieren preview is een hulpmiddel, geen exportbron. Deze limieten houden de tijdelijke
 * rasterbuffers ruim onder het punt waarop een optiewijziging de UI-thread of het systeem kan
 * laten vastlopen. De vector-export behoudt alle pagina's en gebruikt deze limieten niet.
 */
// Een normale A4-preview met circa 260 rijen blijft zo op 1× scherp. Alleen uitzonderlijk grote
// rapporten worden teruggeschaald; vóór deze grens werd ook de alledaagse preview uitgezoomd en
// vervolgens op papierformaat opgeblazen.
export const PREVIEW_MAX_SOURCE_PIXELS = 24_000_000;
/** Kwaliteit bepaalt een expliciet totaalbudget voor broncanvas plus actieve pagina's. */
export const PREVIEW_QUALITY_RASTER_BUDGETS = { 1: 9_000_000, 2: 18_000_000, 3: 30_000_000 } as const;
export const PREVIEW_MAX_RASTER_PIXELS = PREVIEW_QUALITY_RASTER_BUDGETS[2];
export const PREVIEW_MAX_PAGE_PIXELS = 6_000_000;
/** De kwaliteitsschaal is zowel de bron-renderScale als de zichtbare pagina-dichtheid. */
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
  const width = Number.isFinite(logicalWidth) ? Math.max(1, logicalWidth) : 1;
  const height = Number.isFinite(logicalHeight) ? Math.max(1, logicalHeight) : 1;
  const logicalPixels = width * height;

  const dpr = Math.max(1, devicePixelRatio);
  const qualityFactor: PreviewQuality = quality === 1 || quality === 3 ? quality : 2;
  // Maximaal kiest bewust één actieve pagina; zo kan de bron én de daadwerkelijk zichtbare pagina
  // 3× worden zonder een tweede nabije pagina blind veel geheugen te laten vasthouden.
  const activePages = qualityFactor === 3 ? 1 : 2;
  const budget = PREVIEW_QUALITY_RASTER_BUDGETS[qualityFactor];

  // Houd minstens één rasterpixel in beide richtingen over. Bron en pagina krijgen vervolgens
  // dezelfde terugschalingsfactor wanneer het gezamenlijke budget krapper is, zodat nooit een
  // hoge-res pagina uit een duidelijk lagere-res bron wordt uitvergroot.
  const minScale = Math.max(1 / width, 1 / height);
  const paper = PAPER_PT[paperSize];
  const pageWidth = orientation === 'landscape' ? paper.height : paper.width;
  const pageHeight = orientation === 'landscape' ? paper.width : paper.height;
  const wantedRenderScale = qualityFactor * dpr;
  const wantedSupersample = (Math.max(1, cssPageWidth) * dpr * qualityFactor) / pageWidth;
  const pagePixelArea = Math.max(1, pageWidth * pageHeight);
  const wantedPixels = logicalPixels * wantedRenderScale * wantedRenderScale
    + pagePixelArea * wantedSupersample * wantedSupersample * activePages;
  const sharedCap = Math.min(
    1,
    Math.sqrt(budget / Math.max(1, wantedPixels)),
    Math.sqrt(PREVIEW_MAX_SOURCE_PIXELS / Math.max(1, logicalPixels * wantedRenderScale * wantedRenderScale)),
  );
  const renderScale = Math.max(minScale, wantedRenderScale * sharedCap);
  const pageSupersample = Math.max(1 / Math.max(pageWidth, pageHeight), wantedSupersample * sharedCap);
  const sourcePixels = logicalPixels * renderScale * renderScale;
  const pageBudget = Math.max(1, budget - sourcePixels);
  const pixelsPerPage = Math.max(1, Math.ceil(pagePixelArea * pageSupersample * pageSupersample));
  const maxPages = Math.max(1, Math.min(
    PREVIEW_MAX_PAGES,
    qualityFactor === 3 ? 1 : Math.floor(pageBudget / pixelsPerPage),
  ));

  return { renderScale, maxPages, pageSupersample };
}
