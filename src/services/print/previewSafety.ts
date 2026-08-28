import { PAPER_PT, type Orientation, type PaperSize } from './tileLayout';

/**
 * De papieren preview is een hulpmiddel, geen exportbron. Deze limieten houden de tijdelijke
 * rasterbuffers ruim onder het punt waarop een optiewijziging de UI-thread of het systeem kan
 * laten vastlopen. De vector-export behoudt alle pagina's en gebruikt deze limieten niet.
 */
/**
 * Kwaliteit bepaalt een expliciet totaalbudget voor actieve pagina-afbeeldingen. De drie standen
 * lopen naar de fysieke schermdichtheid toe: Standaard is de snelle halve dichtheid, Hoog de
 * gebalanceerde driekwartdichtheid en Maximaal de native dichtheid. De oude 1x/2x/3x *boven op* de
 * DPR maakte Standaard al volledig native en liet de twee hogere standen dus naar exact dezelfde
 * schermpixels terugschalen. Boven native supersamplen kost hier veel geheugen zonder zichtbaar
 * extra schermdetail; de PDF-export heeft zijn eigen ongewijzigde hoge-res/vectorpad.
 */
export const PREVIEW_QUALITY_RASTER_BUDGETS = { 1: 6_000_000, 2: 12_000_000, 3: 18_000_000 } as const;
export const PREVIEW_MAX_RASTER_PIXELS = PREVIEW_QUALITY_RASTER_BUDGETS[3];
/** Eén pagina mag nooit het hele cachebudget opslokken; zo kunnen twee aangrenzende pagina's blijven staan. */
export const PREVIEW_MAX_PAGE_PIXELS = 9_000_000;
export const PREVIEW_MAX_PAGES = 30;
export type PreviewQuality = 1 | 2 | 3;

const PREVIEW_QUALITY_DENSITIES: Record<PreviewQuality, number> = { 1: 0.5, 2: 0.75, 3: 1 };

export interface PreviewRasterLimits {
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
  // Iedere stand houdt minstens twee aangrenzende pagina's beschikbaar, binnen het eigen budget.
  const budget = PREVIEW_QUALITY_RASTER_BUDGETS[qualityFactor];

  const paper = PAPER_PT[paperSize];
  const pageWidth = orientation === 'landscape' ? paper.height : paper.width;
  const pageHeight = orientation === 'landscape' ? paper.width : paper.height;
  const density = PREVIEW_QUALITY_DENSITIES[qualityFactor];
  const wantedSupersample = (Math.max(1, cssPageWidth) * dpr * density) / pageWidth;
  const pagePixelArea = Math.max(1, pageWidth * pageHeight);
  const wantedPagePixels = pagePixelArea * wantedSupersample * wantedSupersample;
  const pagePixelLimit = Math.min(PREVIEW_MAX_PAGE_PIXELS, budget / 2);
  // Alleen een extreem grote zichtbare pagina (bv. DPR 3 + A1 portret) wordt geklemd. Een lang
  // rapport heeft hier geen invloed meer op: dat is precies het verschil met de oude broncanvasroute.
  const pageSupersample = Math.max(
    1 / Math.max(pageWidth, pageHeight),
    wantedSupersample * Math.min(1, Math.sqrt(pagePixelLimit / wantedPagePixels)),
  );
  const pixelsPerPage = Math.max(1, Math.ceil(pagePixelArea * pageSupersample * pageSupersample));
  const maxPages = Math.max(2, Math.min(
    PREVIEW_MAX_PAGES,
    Math.floor(budget / pixelsPerPage),
  ));

  return { maxPages, pageSupersample };
}
