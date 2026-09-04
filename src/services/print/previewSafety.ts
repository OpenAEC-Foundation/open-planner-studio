import { PAPER_PT, type Orientation, type PaperSize } from './tileLayout';

/**
 * De papieren preview is een hulpmiddel, geen exportbron. Deze limieten houden de tijdelijke
 * rasterbuffers ruim onder het punt waarop een optiewijziging de UI-thread of het systeem kan
 * laten vastlopen. De vector-export behoudt alle pagina's en gebruikt deze limieten niet.
 */
/**
 * Kwaliteit bepaalt een expliciet totaalbudget voor actieve pagina-afbeeldingen. De drie standen
 * lopen vanaf een leesbare basis omhoog: Standaard is native CSS×DPR, Hoog anderhalfmaal en
 * Maximaal tweemaal die rasterdichtheid. Voor de vaste A3-landscape preview van 900 CSS-px zijn
 * dat 900×636, 1350×954 en 1800×1272 rasterpixels bij DPR 1. De CSS-papiermaat verandert daarbij
 * niet; de PDF-export behoudt zijn eigen ongewijzigde hoge-res/vectorpad.
 */
export const PREVIEW_QUALITY_RASTER_BUDGETS = { 1: 6_000_000, 2: 12_000_000, 3: 18_000_000 } as const;
export const PREVIEW_MAX_RASTER_PIXELS = PREVIEW_QUALITY_RASTER_BUDGETS[3];
/** Eén pagina mag nooit het hele cachebudget opslokken; zo kunnen twee aangrenzende pagina's blijven staan. */
export const PREVIEW_MAX_PAGE_PIXELS = 9_000_000;
export const PREVIEW_MAX_PAGES = 30;
export type PreviewQuality = 1 | 2 | 3;

const PREVIEW_QUALITY_DENSITIES: Record<PreviewQuality, number> = { 1: 1, 2: 1.5, 3: 2 };

export interface PreviewRasterLimits {
  /** Aantal complete papiercanvassen dat de preview tegelijk mag vasthouden. */
  maxPages: number;
  /** Fysieke rasterbreedte van één zichtbare papierpagina. */
  pageRasterWidth: number;
  /** Fysieke rasterhoogte van één zichtbare papierpagina. */
  pageRasterHeight: number;
  /** Pixels per PDF-punt voor de tekengeometrie, afgeleid van de rasterbreedte. */
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
  // Iedere stand houdt minstens twee aangrenzende pagina's beschikbaar, binnen het eigen budget.
  const budget = PREVIEW_QUALITY_RASTER_BUDGETS[qualityFactor];

  const paper = PAPER_PT[paperSize];
  const pageWidth = orientation === 'landscape' ? paper.height : paper.width;
  const pageHeight = orientation === 'landscape' ? paper.width : paper.height;
  const density = PREVIEW_QUALITY_DENSITIES[qualityFactor];
  // Rond eerst de leesbare basispagina af en schaal daarna beide rasterassen. Daardoor is de
  // kwaliteitsladder stabiel in hele pixels: A3-landscape bij 900 CSS-px wordt 900×636,
  // 1350×954 en 1800×1272, in plaats van door onafhankelijke afronding 1350×955/1800×1273.
  const baseRasterWidth = Math.max(1, Math.round(Math.max(1, cssPageWidth) * dpr));
  const baseRasterHeight = Math.max(1, Math.round(baseRasterWidth * pageHeight / pageWidth));
  const wantedRasterWidth = Math.max(1, Math.round(baseRasterWidth * density));
  const wantedRasterHeight = Math.max(1, Math.round(baseRasterHeight * density));
  const wantedPagePixels = wantedRasterWidth * wantedRasterHeight;
  const pagePixelLimit = Math.min(PREVIEW_MAX_PAGE_PIXELS, budget / 2);
  // Alleen een extreem grote zichtbare pagina (bv. DPR 3 + A1 portret) wordt geklemd. Een lang
  // rapport heeft hier geen invloed meer op: dat is precies het verschil met de oude broncanvasroute.
  const budgetScale = Math.min(1, Math.sqrt(pagePixelLimit / wantedPagePixels));
  const pageRasterWidth = Math.max(1, Math.round(wantedRasterWidth * budgetScale));
  const pageRasterHeight = Math.max(1, Math.round(wantedRasterHeight * budgetScale));
  const pageSupersample = Math.max(1 / Math.max(pageWidth, pageHeight), pageRasterWidth / pageWidth);
  const pixelsPerPage = Math.max(1, pageRasterWidth * pageRasterHeight);
  const maxPages = Math.max(2, Math.min(
    PREVIEW_MAX_PAGES,
    Math.floor(budget / pixelsPerPage),
  ));

  return { maxPages, pageRasterWidth, pageRasterHeight, pageSupersample };
}
