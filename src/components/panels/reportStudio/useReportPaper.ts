import { useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { PrintOptions } from '@/services/print/printPreview';
import type { TileLayout } from '@/services/print/tileLayout';
import { createReportPaperRecorder } from '@/services/print/reportPaperModel';
import { reportPageSvg, reportPaperRegions, type PageRegions } from '@/services/print/reportPaper';
import type { ReportTextMetrics } from '@/services/pdf/reportTextMeasure';
import { timeReportStep } from './studioPerf';
import { ensurePaperFontRules } from './paperFontRules';

export interface ReportPaperModel {
  id: number;
  layout: TileLayout;
  totalPages: number;
  tableWidth: number;
  headerHeight: number;
  dayWidth: number;
  assignmentColumnsDropped: boolean;
  pageSvg: (pageIndex: number) => string;
  pageRegions: (pageIndex: number) => PageRegions;
  prepare: (pages: readonly number[]) => void;
}

export interface ReportPaperState {
  paper: ReportPaperModel | null;
  stale: boolean;
}

export interface ReportPaperInput {
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkCalendar;
  projectName: string;
  options: PrintOptions | null;
  metrics: ReportTextMetrics | null;
  repeatHeader: boolean;
  repeatFooter: boolean;
  rtl: boolean;
}

let recordingSeq = 0;

const modelCache = new WeakMap<ReportPaperInput, ReportPaperModel>();

const PAGE_LABEL_FONT = '8px InterPDF, sans-serif';

export function useReportPaper(input: ReportPaperInput, visibleHint: { readonly current: readonly number[] }): ReportPaperState {
  const deferred = useAfterPaint(input);
  const model = useMemo((): ReportPaperModel | null => {
    const { tasks, sequences, calendar, projectName, options, metrics, repeatHeader, repeatFooter, rtl } = deferred;
    if (!options || !metrics) return null;
    const cached = modelCache.get(deferred);
    if (cached) return cached;
    const created = timeReportStep('ops-report:record', () => {
      const recorder = createReportPaperRecorder(
        tasks, sequences, calendar, projectName, options, repeatHeader, repeatFooter, metrics, visibleHint.current,
      );
      const { result, layout } = recorder;
      const recordingFor = (pages: readonly number[]) => timeReportStep('ops-report:record-rows', () => recorder.recordingFor(pages));
      const svgCache = new Map<number, string>();
      const windowCache = new Map<string, string[]>();
      const regionCache = new Map<number, PageRegions>();
      return {
        id: ++recordingSeq,
        layout,
        totalPages: layout.rows * layout.cols,
        tableWidth: result.tableWidth,
        headerHeight: result.headerHeight,
        dayWidth: result.dayWidth ?? 0,
        assignmentColumnsDropped: result.assignmentColumnsDropped === true,
        pageSvg: (pageIndex: number) => {
          let svg = svgCache.get(pageIndex);
          if (svg === undefined) {
            const recording = recordingFor([pageIndex]);
            ensurePaperFontRules(recording.fonts);
            svg = timeReportStep('ops-report:svg', () => reportPageSvg(recording, layout, pageIndex, {
              rtl, pageLabelFont: PAGE_LABEL_FONT, embedFontStyle: false, windowCache,
            }));
            svgCache.set(pageIndex, svg);
          }
          return svg;
        },
        pageRegions: (pageIndex: number) => {
          let regions = regionCache.get(pageIndex);
          if (!regions) {
            regions = reportPaperRegions(result, layout, pageIndex);
            regionCache.set(pageIndex, regions);
          }
          return regions;
        },
        prepare: (pages: readonly number[]) => {
          const missing = pages.filter(page => page >= 0 && page < layout.rows * layout.cols && !svgCache.has(page));
          if (missing.length > 0) recordingFor(missing);
        },
      };
    });
    modelCache.set(deferred, created);
    return created;
  }, [deferred, visibleHint]);
  const stale = model !== null && deferred !== input;
  return useMemo(() => ({ paper: model, stale }), [model, stale]);
}

function useAfterPaint<T>(value: T): T {
  const [applied, setApplied] = useState(value);
  const latest = useRef(value);
  latest.current = value;
  const pending = useRef<{ raf: number; timer: number } | null>(null);

  useEffect(() => {
    if (applied === value || pending.current) return;
    const handle = { raf: 0, timer: 0 };
    pending.current = handle;
    handle.raf = requestAnimationFrame(() => {
      handle.timer = window.setTimeout(() => {
        pending.current = null;
        setApplied(latest.current);
      }, 0);
    });
  }, [value, applied]);

  useEffect(() => () => {
    const handle = pending.current;
    if (handle) {
      cancelAnimationFrame(handle.raf);
      window.clearTimeout(handle.timer);
    }
    pending.current = null;
  }, []);

  return applied;
}
