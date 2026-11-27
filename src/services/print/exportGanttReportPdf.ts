import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { renderPrintCanvas, renderReport, type PrintOptions } from '@/services/print/printPreview';
import { paginateCanvasToPdfBytes, type PaginateOptions } from '@/services/print/paginate';
import { computeTileLayout, footerLayoutWidthFor } from '@/services/print/tileLayout';
import { computeHighResScale } from '@/utils/miniPdf';
import { ensureReportFontLoaded, getArabicFontBytes, getInterFontBytes, getReportFontBytes } from '@/services/pdf/fontLoader';
import type { ReportFontChoice } from '@/services/pdf/reportFont';
import { RTL_LOCALES, type Locale } from '@/i18n/config';
import { ganttTileOptions } from '@/services/print/reportPaperModel';

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
  repeatHeader: boolean;
  repeatFooter: boolean;
  fontId?: ReportFontChoice;
}

export async function buildGanttReportPdf(input: GanttReportPdfInput): Promise<Uint8Array> {
  const { tasks, sequences, calendar, projectName, options, repeatHeader, repeatFooter, fontId = 'inter' } = input;
  const lowerPaper = options.paperSize.toLowerCase() as 'a4' | 'a3' | 'a2' | 'a1';
  const orientation = options.orientation;
  const timelineColumns = options.timelineColumns ?? 1;
  const exportBaseDir: 'ltr' | 'rtl' =
    RTL_LOCALES.includes((options.locale ?? '') as Locale) ? 'rtl' : 'ltr';

  await ensureReportFontLoaded(fontId);
  const mode = options.autoFit ? 'fit-width' : 'actual';

  const exportRaster = (): Uint8Array => {
    const exportCanvas = document.createElement('canvas');
    const {
      width: logicalWidth, height: logicalHeight, tableWidth, headerHeight, footerHeight, breakOffsets, forcedBreakOffsets,
    } = renderPrintCanvas(exportCanvas, tasks, sequences, calendar, projectName, options, 1);
    const rasterTile: PaginateOptions = {
      paperSize: lowerPaper, orientation, mode,
      logicalWidth, logicalHeight, frozenColumnWidthPx: tableWidth,
      repeatHeaderHeightPx: repeatHeader ? headerHeight : 0,
      repeatFooterHeightPx: repeatFooter ? footerHeight : 0,
      timelineColumns,
      breakOffsetsPx: breakOffsets,
      forcedBreakOffsetsPx: forcedBreakOffsets,
    };
    const exportScale = computeHighResScale(logicalWidth, logicalHeight);
    renderPrintCanvas(exportCanvas, tasks, sequences, calendar, projectName,
      { ...options, footerLayoutWidth: footerLayoutWidthFor(computeTileLayout(rasterTile)) }, exportScale);
    return paginateCanvasToPdfBytes(exportCanvas, rasterTile);
  };

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
