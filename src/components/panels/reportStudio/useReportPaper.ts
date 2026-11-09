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

export interface ReportPaperModel {
  /** Volgnummer van deze opname; een nieuwe opname maakt alle bladcaches ongeldig. */
  id: number;
  layout: TileLayout;
  totalPages: number;
  /** Breedte van de taaktabel en hoogte van de kopstrook (logische px), voor de zijbalk. */
  tableWidth: number;
  headerHeight: number;
  /** Eén blad als SVG-tekst (berekend bij de eerste vraag, daarna onthouden). */
  pageSvg: (pageIndex: number) => string;
  /** De klikbare delen van één blad (idem). */
  pageRegions: (pageIndex: number) => PageRegions;
  /**
   * Neemt de rijen van deze bladen in één render op (de bladen in beeld). Daarna komt `pageSvg` voor
   * elk van die bladen zonder nieuwe render. Een blad dat al in een opname zit, kost niets.
   */
  prepare: (pages: readonly number[]) => void;
}

export interface ReportPaperState {
  paper: ReportPaperModel | null;
  /**
   * `true` zolang de getoonde opname bij oudere instellingen hoort dan de zijbalk. Los van het model:
   * zo blijft het model hetzelfde object als alleen deze vlag wisselt, en slaan de bladen een render over.
   */
  stale: boolean;
}

export interface ReportPaperInput {
  tasks: Task[];
  sequences: Sequence[];
  calendar: WorkCalendar;
  projectName: string;
  options: PrintOptions | null;
  /** Dezelfde meting als de vector-PDF en de kolombreedtes (`loadReportTextMetrics`). */
  metrics: ReportTextMetrics | null;
  repeatHeader: boolean;
  repeatFooter: boolean;
  rtl: boolean;
}

let recordingSeq = 0;

/**
 * Eén model per invoerobject. React rekent een `useMemo` in de ontwikkelversie (StrictMode) twee keer, en
 * bij een nieuwe mount opnieuw; met deze cache doet hij de opname maar één keer. De invoer is
 * gememoriseerd, dus een gelijk object is gelijke invoer.
 */
const modelCache = new WeakMap<ReportPaperInput, ReportPaperModel>();

/** Het paginanummer in 8 pt Inter, zoals de PDF het zet. */
const PAGE_LABEL_FONT = '8px InterPDF, sans-serif';

/**
 * Het papier van de Gantt-afdruk als SVG-opname (issue #817), met dezelfde stappen als de PDF. Per
 * instellingenwijziging één render voor de maten en de bladindeling; die tekent meteen alleen de rijen
 * van de bladen in beeld (`visibleHint`, `createReportPaperRecorder`). Andere bladen krijgen hun rijen
 * pas als ze in beeld komen. Bij 5000 taken tekent een klik zo ±80 rijen in plaats van 5000.
 *
 * Volgorde bij een klik: eerst tekent de browser de bediening in haar nieuwe stand (één frame), pas
 * daarna begint het papier (`requestAnimationFrame` + `setTimeout`, dus ná dat frame). Zo voelt de
 * bediening direct, ook als een grote planning langer rekent. Komen er klikken bij terwijl het papier
 * nog wacht, dan neemt het papier alleen de laatste stand. De aanroeper geeft een gememoriseerd
 * invoerobject mee, anders rekent elke render opnieuw.
 */
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
      const regionCache = new Map<number, PageRegions>();
      // De opname zelf en het renderresultaat blijven in deze closure en staan niet als veld op het
      // model. Reden: React vergelijkt in de dev-modus bij elke render de oude en nieuwe props, ook
      // diep in objecten. Met de tekenopdrachten als veld kostte dat bij 5000 taken minuten.
      return {
        id: ++recordingSeq,
        layout,
        totalPages: layout.rows * layout.cols,
        tableWidth: result.tableWidth,
        headerHeight: result.headerHeight,
        pageSvg: (pageIndex: number) => {
          let svg = svgCache.get(pageIndex);
          if (svg === undefined) {
            const recording = recordingFor([pageIndex]);
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
        prepare: (pages: readonly number[]) => {
          const missing = pages.filter(page => page >= 0 && page < layout.rows * layout.cols && !svgCache.has(page));
          if (missing.length > 0) recordingFor(missing);
        },
      };
    });
    modelCache.set(deferred, created);
    return created;
    // `visibleHint` is een ref: alleen de stand bij het opnemen telt.
  }, [deferred, visibleHint]);
  const stale = model !== null && deferred !== input;
  return useMemo(() => ({ paper: model, stale }), [model, stale]);
}

/**
 * `value` met één frame vertraging: de nieuwe waarde komt pas ná het eerstvolgende frame door. Eén
 * wachtende overgang tegelijk; die neemt bij het uitvoeren de laatste waarde.
 */
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
