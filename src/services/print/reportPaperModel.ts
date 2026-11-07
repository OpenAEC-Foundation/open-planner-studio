// Het papier van de Gantt-afdruk als SVG-opname (issue #817), zonder React: de stappen zijn dezelfde
// als die van de vector-PDF (`paginateVectorToPdfBytes`), zodat het scherm dezelfde bladen toont als de
// PDF. Eerst de echte render, dan de bladindeling; alleen als de herhaalde voet smaller moet dan de
// render, een tweede render met die voetbreedte en opnieuw de indeling.

import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { renderReport, type PrintOptions, type RenderReportResult } from '@/services/print/printPreview';
import {
  computeTileLayout, footerRelayoutWidth, reportTileInput, type ReportTileOptions, type TileLayout,
} from '@/services/print/tileLayout';
import { indexRecording, SvgRecordingDraw2D, type RecordedReport, type SvgTextMetrics } from '@/services/pdf/svgDraw2d';

/**
 * De tegelkeuzes van de Gantt-afdruk uit de rapportopties. Eén bron voor de PDF (`buildGanttReportPdf`)
 * en het papier op het scherm.
 */
export function ganttTileOptions(options: PrintOptions, repeatHeader: boolean, repeatFooter: boolean): ReportTileOptions {
  return {
    paperSize: options.paperSize.toLowerCase() as 'a4' | 'a3' | 'a2' | 'a1',
    orientation: options.orientation,
    mode: options.autoFit ? 'fit-width' : 'actual',
    repeatHeader,
    repeatFooter,
    timelineColumns: options.timelineColumns ?? 1,
  };
}

export interface ReportPaperRecording {
  result: RenderReportResult;
  layout: TileLayout;
  recording: RecordedReport;
  /** Aantal renders (1, of 2 met een smallere herhaalde voet); voor de meting. */
  passes: number;
}

export function recordReportPaper(
  tasks: Task[],
  sequences: Sequence[],
  calendar: WorkCalendar,
  projectName: string,
  options: PrintOptions,
  repeatHeader: boolean,
  repeatFooter: boolean,
  metrics: SvgTextMetrics,
): ReportPaperRecording {
  const tile = ganttTileOptions(options, repeatHeader, repeatFooter);
  const render = (footerLayoutWidth?: number) => {
    const holder: { recorder?: SvgRecordingDraw2D } = {};
    const result = renderReport(
      (w, h) => { holder.recorder = new SvgRecordingDraw2D(w, h, metrics); return holder.recorder; },
      tasks, sequences, calendar, projectName,
      footerLayoutWidth === undefined ? options : { ...options, footerLayoutWidth },
    );
    return { result, recorder: holder.recorder ?? new SvgRecordingDraw2D(result.width, result.height, metrics) };
  };
  let pass = render();
  let layout = computeTileLayout(reportTileInput(pass.result, tile));
  let passes = 1;
  const footerWidth = footerRelayoutWidth(layout, pass.result.width);
  if (footerWidth !== undefined) {
    pass = render(footerWidth);
    layout = computeTileLayout(reportTileInput(pass.result, tile));
    passes = 2;
  }
  return { result: pass.result, layout, recording: indexRecording(pass.recorder), passes };
}
