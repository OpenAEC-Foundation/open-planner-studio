import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import { renderReport, type PrintOptions, type RenderReportResult, type ReportRowWindowRequest } from '@/services/print/printPreview';
import {
  computeTileLayout, footerRelayoutWidth, reportTileInput, type ReportTileOptions, type TileLayout,
} from '@/services/print/tileLayout';
import { indexRecording, SvgRecordingDraw2D, type RecordedReport, type SvgTextMetrics } from '@/services/pdf/svgDraw2d';

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

export function pagesRowRange(layout: TileLayout, pages: readonly number[]): { y0: number; y1: number } | null {
  const total = layout.rows * layout.cols;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const page of pages) {
    if (!Number.isInteger(page) || page < 0 || page >= total) continue;
    const row = layout.bodyRows[Math.floor(page / layout.cols)];
    if (!row) continue;
    y0 = Math.min(y0, row.srcY);
    y1 = Math.max(y1, row.srcY + row.srcH);
  }
  return y0 <= y1 ? { y0, y1 } : null;
}

export interface ReportPaperRecorder {
  result: RenderReportResult;
  layout: TileLayout;
  passes: number;
  recordingFor(pages: readonly number[]): RecordedReport;
}

export function createReportPaperRecorder(
  tasks: Task[],
  sequences: Sequence[],
  calendar: WorkCalendar,
  projectName: string,
  options: PrintOptions,
  repeatHeader: boolean,
  repeatFooter: boolean,
  metrics: SvgTextMetrics,
  firstPages: readonly number[],
): ReportPaperRecorder {
  const tile = ganttTileOptions(options, repeatHeader, repeatFooter);
  const render = (passOptions: PrintOptions, window: ReportRowWindowRequest) => {
    const holder: { recorder?: SvgRecordingDraw2D } = {};
    const result = renderReport(
      (w, h) => { holder.recorder = new SvgRecordingDraw2D(w, h, metrics); return holder.recorder; },
      tasks, sequences, calendar, projectName, passOptions, window,
    );
    return { result, recorder: holder.recorder ?? new SvgRecordingDraw2D(result.width, result.height, metrics) };
  };
  const firstWindow = (pages: readonly number[]) => {
    const seen: { layout?: TileLayout; range?: { y0: number; y1: number } | null } = {};
    const request: ReportRowWindowRequest = result => {
      seen.layout = computeTileLayout(reportTileInput(result, tile));
      seen.range = pagesRowRange(seen.layout, pages) ?? pagesRowRange(seen.layout, [0]);
      return seen.range;
    };
    return { request, seen };
  };

  let passOptions = options;
  let first = firstWindow(firstPages);
  let pass = render(passOptions, first.request);
  let layout = first.seen.layout ?? computeTileLayout(reportTileInput(pass.result, tile));
  let passes = 1;
  const footerWidth = footerRelayoutWidth(layout, pass.result.width);
  if (footerWidth !== undefined) {
    passOptions = { ...options, footerLayoutWidth: footerWidth };
    first = firstWindow(firstPages);
    pass = render(passOptions, first.request);
    layout = first.seen.layout ?? computeTileLayout(reportTileInput(pass.result, tile));
    passes = 2;
  }
  const finalLayout = layout;
  const recordings: { y0: number; y1: number; recording: RecordedReport }[] = [];
  if (first.seen.range) recordings.push({ ...first.seen.range, recording: indexRecording(pass.recorder) });

  return {
    result: pass.result,
    layout: finalLayout,
    passes,
    recordingFor(pages) {
      const need = pagesRowRange(finalLayout, pages) ?? pagesRowRange(finalLayout, [0]);
      if (!need) return recordings[0]?.recording ?? indexRecording(pass.recorder);
      const hit = recordings.find(r => r.y0 <= need.y0 && r.y1 >= need.y1);
      if (hit) return hit.recording;
      const next = render(passOptions, () => need);
      const recording = indexRecording(next.recorder);
      recordings.push({ ...need, recording });
      return recording;
    },
  };
}
