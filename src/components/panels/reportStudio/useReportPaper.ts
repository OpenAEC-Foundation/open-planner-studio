import { useDeferredValue, useMemo } from 'react';
import type { Task } from '@/types/task';
import type { Sequence } from '@/types/sequence';
import type { WorkCalendar } from '@/types/calendar';
import type { PrintOptions, RenderReportResult } from '@/services/print/printPreview';
import type { TileLayout } from '@/services/print/tileLayout';
import type { RecordedReport } from '@/services/pdf/svgDraw2d';
import { recordReportPaper } from '@/services/print/reportPaperModel';
import { reportPageSvg, reportPaperRegions, type PageRegions } from '@/services/print/reportPaper';
import { studioTextMetrics } from './useStudioPrintOptions';
import { timeReportStep } from './studioPerf';

export interface ReportPaperModel {
  /** Volgnummer van deze opname; een nieuwe opname maakt alle bladcaches ongeldig. */
  id: number;
  result: RenderReportResult;
  layout: TileLayout;
  recording: RecordedReport;
  totalPages: number;
  /** Eén blad als SVG-tekst (berekend bij de eerste vraag, daarna onthouden). */
  pageSvg: (pageIndex: number) => string;
  /** De klikbare delen van één blad (idem). */
  pageRegions: (pageIndex: number) => PageRegions;
  /** `true` zolang de getoonde opname bij oudere instellingen hoort dan de zijbalk. */
  stale: boolean;
}

export interface ReportPaperInput {
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkCalendar;
  projectName: string;
  options: PrintOptions | null;
  repeatHeader: boolean;
  repeatFooter: boolean;
  rtl: boolean;
}

let recordingSeq = 0;

/** Het paginanummer in 8 pt Inter, zoals de PDF het zet. */
const PAGE_LABEL_FONT = '8px InterPDF, sans-serif';

/**
 * Het papier van de Gantt-afdruk als SVG-opname (issue #817). Eén opname per instellingenwijziging, met
 * dezelfde stappen als de PDF (`recordReportPaper`). Een blad wordt pas als SVG-tekst gemaakt als het in
 * beeld komt.
 *
 * De invoer gaat via `useDeferredValue`: een klik op een schakelaar tekent eerst de schakelaar (één
 * frame), daarna het papier. Zo voelt de bediening direct, ook als een grote planning langer rekent.
 * De aanroeper geeft een gememoriseerd invoerobject mee, anders rekent elke render opnieuw.
 */
export function useReportPaper(input: ReportPaperInput): ReportPaperModel | null {
  const deferred = useDeferredValue(input);
  const model = useMemo(() => {
    const { tasks, sequences, calendar, projectName, options, repeatHeader, repeatFooter, rtl } = deferred;
    if (!options) return null;
    return timeReportStep('ops-report:record', () => {
      const { result, layout, recording } = recordReportPaper(
        tasks, sequences, calendar, projectName, options, repeatHeader, repeatFooter, studioTextMetrics(),
      );
      const svgCache = new Map<number, string>();
      const regionCache = new Map<number, PageRegions>();
      return {
        id: ++recordingSeq,
        result,
        layout,
        recording,
        totalPages: layout.rows * layout.cols,
        pageSvg: (pageIndex: number) => {
          let svg = svgCache.get(pageIndex);
          if (svg === undefined) {
            svg = timeReportStep('ops-report:svg', () => reportPageSvg(recording, layout, pageIndex, { rtl, pageLabelFont: PAGE_LABEL_FONT }));
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
      };
    });
  }, [deferred]);
  return useMemo(() => (model ? { ...model, stale: deferred !== input } : null), [model, deferred, input]);
}
