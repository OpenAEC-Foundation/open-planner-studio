// De PDF van de Gantt-afdruk en het resourcediagram: één bouwfunctie voor het oude rapportpaneel
// (`ReportPanel.tsx`) en het nieuwe Rapport-tabblad (feature flag `reportRedesign`, issue #817), zodat
// beide precies dezelfde PDF maken. Verplaatst uit `ReportPanel.runExport`, ongewijzigd.

import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { renderPrintCanvas, renderReport, type PrintOptions } from '@/services/print/printPreview';
import { paginateCanvasToPdfBytes, type PaginateOptions } from '@/services/print/paginate';
import { computeTileLayout, footerLayoutWidthFor } from '@/services/print/tileLayout';
import { computeHighResScale } from '@/utils/miniPdf';
import { ensureReportFontLoaded, getArabicFontBytes, getInterFontBytes, getReportFontBytes } from '@/services/pdf/fontLoader';
import type { ReportFontId } from '@/services/pdf/reportFont';
import { RTL_LOCALES, type Locale } from '@/i18n/config';
import { ganttTileOptions } from '@/services/print/reportPaperModel';

/**
 * Beschrijf waarom de vector-export terugvalt op raster. Herkent de `VectorUnsupportedError`
 * aan z'n `name` — géén eager import van `paginateVector`, zodat pdf-lib/fontkit uit de hoofdbundle
 * blijft — en logt de ongedekte codepoints (bv. een CJK/Arabische taaknaam) i.p.v. tofu te tekenen.
 */
export function describeVectorFallback(err: unknown): string {
  if (err && typeof err === 'object' && (err as { name?: string }).name === 'VectorUnsupportedError') {
    const cps = (err as { codepoints?: number[] }).codepoints ?? [];
    const rtl = (err as { hasRtl?: boolean }).hasRtl ? ' (bevat RTL)' : '';
    const list = cps.map(cp => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')).join(' ');
    return `ongedekte glyphs${rtl}: ${list}`;
  }
  return String(err);
}

export interface GanttReportPdfInput {
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkCalendar;
  projectName: string;
  options: PrintOptions;
  /** Kop per pagina herhalen (pagineerder-zaak, geen `PrintOptions`-veld). */
  repeatHeader: boolean;
  /** Voet met legenda per pagina herhalen (idem). */
  repeatFooter: boolean;
  /**
   * De rapportletter (#770). Moet dezelfde zijn als de stack in `options.fontFamily`: de raster-tak
   * tekent met die stack, de vector-tak bedt de bytes van deze letter in. Zonder waarde: Inter.
   */
  fontId?: ReportFontId;
}

/**
 * Bouw de PDF-bytes: een échte vector-PDF met selecteerbare tekst en de ingebedde rapportletter; bij een fout
 * (bv. een glyph buiten de letter) de raster-terugval, zodat de export nooit stukloopt.
 */
export async function buildGanttReportPdf(input: GanttReportPdfInput): Promise<Uint8Array> {
  const { tasks, sequences, calendar, projectName, options, repeatHeader, repeatFooter, fontId = 'inter' } = input;
  const lowerPaper = options.paperSize.toLowerCase() as 'a4' | 'a3' | 'a2' | 'a1';
  const orientation = options.orientation;
  const timelineColumns = options.timelineColumns ?? 1;
  // Basisrichting van de export-taal: stuurt de bidi in het complexe RTL-tekst-pad van de vector-export.
  const exportBaseDir: 'ltr' | 'rtl' =
    RTL_LOCALES.includes((options.locale ?? '') as Locale) ? 'rtl' : 'ltr';

  // Zorg dat de gevendorde rapportletter geladen is vóór de offscreen render, zodat ook de
  // raster-export die letter gebruikt (measureText-pariteit met de preview).
  await ensureReportFontLoaded(fontId);
  const mode = options.autoFit ? 'fit-width' : 'actual';

  // De raster-tak (JPEG-tegels) als betrouwbare terugval: de vector-tak valt erop terug bij een
  // fout (bv. een glyph buiten Inter). Render offscreen op een vaste hoge schaal, onafhankelijk van het
  // scherm van de exporterende gebruiker (window.devicePixelRatio, vaak 1x). Eerste render (schaal
  // 1) levert de LOGISCHE maten + naam-kolombreedte; de tweede render het high-res raster.
  const exportRaster = (): Uint8Array => {
    const exportCanvas = document.createElement('canvas');
    const {
      width: logicalWidth, height: logicalHeight, tableWidth, headerHeight, footerHeight, breakOffsets, forcedBreakOffsets,
    } = renderPrintCanvas(exportCanvas, tasks, sequences, calendar, projectName, options, 1);
    const rasterTile: PaginateOptions = {
      paperSize: lowerPaper, orientation, mode,
      logicalWidth, logicalHeight, frozenColumnWidthPx: tableWidth,
      // Zelfde kop-/voetherhaling (px) en tijdlijn-spreiding als de preview en de vector-tak,
      // zodat de raster-terugval WYSIWYG gelijk is aan beide.
      repeatHeaderHeightPx: repeatHeader ? headerHeight : 0,
      repeatFooterHeightPx: repeatFooter ? footerHeight : 0,
      timelineColumns,
      breakOffsetsPx: breakOffsets,
      forcedBreakOffsetsPx: forcedBreakOffsets,
    };
    // De high-res render legt de voet binnen één paginabreedte (zie `footerLayoutWidth`) — alleen
    // wanneer hij herhaald wordt.
    const exportScale = computeHighResScale(logicalWidth, logicalHeight);
    renderPrintCanvas(exportCanvas, tasks, sequences, calendar, projectName,
      { ...options, footerLayoutWidth: footerLayoutWidthFor(computeTileLayout(rasterTile)) }, exportScale);
    return paginateCanvasToPdfBytes(exportCanvas, rasterTile);
  };

  // Vector-tak: lazy import houdt pdf-lib/fontkit uit de hoofdbundle. De bytes: de gekozen letter, Noto
  // Sans Arabic voor RTL, en bij elke andere letter dan Inter óók Inter als terugval voor de tekens die
  // die letter mist (zie `fallbackFonts` in paginateVector.ts). Zonder terugval valt de hele PDF om één
  // zo'n teken terug op raster.
  try {
    const [{ paginateVectorToPdfBytes }, { subsetFont }, regular, bold, arabicRegular, arabicBold, fallbackFonts] = await Promise.all([
      import('@/services/print/paginateVector'),
      import('@/services/pdf/hbSubset'),
      getReportFontBytes(fontId, 400),
      getReportFontBytes(fontId, 700),
      getArabicFontBytes(400),
      getArabicFontBytes(700),
      fontId === 'inter'
        ? Promise.resolve([])
        : Promise.all([getInterFontBytes(400), getInterFontBytes(700)])
          .then(([interRegular, interBold]) => [{ id: 'inter', bytes: { regular: interRegular, bold: interBold } }]),
    ]);
    return await paginateVectorToPdfBytes(
      (make, footerLayoutWidth) => renderReport(make, tasks, sequences, calendar, projectName, { ...options, footerLayoutWidth }),
      {
        // Papier, passing, kop/voet per pagina en tijdlijn over N pagina's: dezelfde keuzes als het
        // papier op het scherm (`ganttTileOptions`, #817).
        ...ganttTileOptions(options, repeatHeader, repeatFooter),
        baseDir: exportBaseDir,
        subsetFont,
        fallbackFonts,
      },
      { regular, bold },
      { regular: arabicRegular, bold: arabicBold },
    );
  } catch (err) {
    console.warn('[ReportPanel] Vector-PDF-export mislukt, terugval op raster:', describeVectorFallback(err));
    return exportRaster();
  }
}
