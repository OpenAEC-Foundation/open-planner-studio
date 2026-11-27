import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { documentFileBase } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import { paginateCanvasToPdfBytes } from '@/services/print/paginate';
import { ensureReportFontLoaded, getArabicFontBytes, getInterFontBytes, getReportFontBytes, loadReportTextMetrics } from '@/services/pdf/fontLoader';
import { reportFontStack, type ReportFontChoice } from '@/services/pdf/reportFont';
import { RTL_LOCALES, type Locale } from '@/i18n/config';
import { Select } from '@/components/common/Select';
import { inlineDirectionOf, panelWidthAtPointer, useSplitter } from '@/hooks/useSplitter';
import { saveBytesDialog } from '@/services/fileAccess';
import { describeVectorFallback } from '@/services/print/exportGanttReportPdf';
import {
  patchReportSettings, reportFontKey, TABLE_REPORT_TYPES,
  type ReportPaperSize, type ReportOrientation, type ReportType, type TableReportOptions,
} from '@/utils/reportSettings';
import { reportFontStyle, TableReportView } from './reports/TableReportView';
import { TableReportOptionsBlock } from './reports/TableReportOptionsBlock';
import { ReportOptionsCard } from './reports/reportFormPrimitives';
import { useTableReportSpec } from './reports/useTableReportSpec';
import { toPdfSpec } from './reports/tableReportSpec';
import { useTaskIdDateText, type TaskIdDateText } from '@/hooks/displayDate';
import { MilestoneReport, useMilestoneRows, STATUS_COLOR as MILESTONE_STATUS_COLOR, type MilestoneRow } from './MilestoneReport';
import { VarianceReport, useVarianceResult, STATUS_COLOR as VARIANCE_STATUS_COLOR, fmtDelta } from './VarianceReport';
import type { VarianceRow } from '@/engine/variance';
import type { PdfTableColumn } from '@/services/pdf/pdfTable';
import type { TFunction } from 'i18next';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import { scheduleErrorText } from '@/i18n/scheduleErrors';
import { useReportSettings } from '@/hooks/useReportSettings';

function buildMilestoneColumns(t: TFunction<'report'>, taskDate: TaskIdDateText): PdfTableColumn<MilestoneRow>[] {
  return [
    { header: t('milestoneReport.wbs'), width: 70, align: 'left', text: r => r.wbs },
    { header: t('milestoneReport.name'), width: 260, align: 'left', text: r => `${r.mandatory ? '◆ ' : ''}${r.name}` },
    { header: t('milestoneReport.kind'), width: 90, align: 'left', text: r => t(`milestoneReport.kind_${r.kind}`) },
    { header: t('milestoneReport.date'), width: 100, align: 'left', text: r => taskDate(r.id, r.date, 'start') },
    { header: t('milestoneReport.guardDate'), width: 130, align: 'left', text: r => taskDate(r.id, r.guardDate, r.guardSide, { milestoneOwn: false }) || '—' },
    {
      header: t('milestoneReport.float'), width: 70, align: 'right',
      text: r => (r.float === undefined ? '—' : String(r.float)),
      color: r => (r.float !== undefined && r.float < 0 ? '#DC2626' : undefined),
      bold: r => r.float !== undefined && r.float < 0,
    },
    { header: t('milestoneReport.mandatory'), width: 90, align: 'left', text: r => (r.mandatory ? t('milestoneReport.yes') : '') },
    {
      header: t('milestoneReport.status'), width: 110, align: 'left',
      text: r => t(`milestoneReport.status_${r.status}`),
      color: r => MILESTONE_STATUS_COLOR[r.status],
      bold: () => true,
    },
  ];
}

function buildVarianceColumns(t: TFunction<'report'>, taskDate: TaskIdDateText, locale: string): PdfTableColumn<VarianceRow>[] {
  return [
    { header: t('milestoneReport.wbs'), width: 70, align: 'left', text: r => r.wbs },
    { header: t('milestoneReport.name'), width: 220, align: 'left', text: r => r.name },
    { header: t('variance.baselineStart'), width: 110, align: 'left', text: r => taskDate(r.taskId, r.baselineStart, 'start') || '—' },
    { header: t('variance.baselineFinish'), width: 110, align: 'left', text: r => taskDate(r.taskId, r.baselineFinish, 'end') || '—' },
    { header: t('variance.currentStart'), width: 110, align: 'left', text: r => taskDate(r.taskId, r.currentStart, 'start') || '—' },
    { header: t('variance.currentFinish'), width: 110, align: 'left', text: r => taskDate(r.taskId, r.currentFinish, 'end') || '—' },
    {
      header: t('variance.deltaStart'), width: 90, align: 'right',
      text: r => fmtDelta(r.deltaStart, locale),
      color: r => (r.deltaStart !== undefined && r.deltaStart > 0 ? '#DC2626' : undefined),
      bold: r => r.deltaStart !== undefined && r.deltaStart > 0,
    },
    {
      header: t('variance.deltaFinish'), width: 90, align: 'right',
      text: r => fmtDelta(r.deltaFinish, locale),
      color: r => (r.deltaFinish !== undefined && r.deltaFinish > 0 ? '#DC2626' : undefined),
      bold: r => r.deltaFinish !== undefined && r.deltaFinish > 0,
    },
    {
      header: t('variance.status'), width: 110, align: 'left',
      text: r => t(`variance.status_${r.status}`),
      color: r => VARIANCE_STATUS_COLOR[r.status],
      bold: () => true,
    },
  ];
}

const SETTINGS_PANEL_DEFAULT_WIDTH = 256;
const SETTINGS_PANEL_MIN_WIDTH = 200;

export function ReportPanel() {
  const { t } = useTranslation('report');
  const { t: tCommon, i18n } = useTranslation('common');
  const taskDate = useTaskIdDateText();
  const project = useAppStore(s => s.project);
  const projectCode = useAppStore(s => documentProjectCode(s.project, s.xerImportMetadata));
  const fileBase = documentFileBase(project.name, projectCode);
  const datesAsRecorded = useAppStore(s => s.datesAsRecorded);
  const recordedDatesNote = datesAsRecorded ? (
    <div
      className="mb-2 shrink-0 rounded-[6px] border border-border bg-surface px-3 py-2 text-small leading-4 text-text-secondary"
      data-report-recorded-dates-note
    >
      {t('tableReports.recordedDatesNote')}
    </div>
  ) : null;

  const reportSettings = useReportSettings();
  const { reportType, tableReports: tableOptions, paperSize, orientation, reportFontFamily } = reportSettings;
  const reportFont = reportFontStack(reportFontFamily);
  const reportFontLoadKey = reportFontKey(reportSettings);
  useEffect(() => { void ensureReportFontLoaded(reportFontFamily); }, [reportFontFamily, reportFontLoadKey]);
  const patchTableOptions = useCallback((patch: Partial<TableReportOptions>) => { patchReportSettings({ tableReports: patch }); }, []);
  const setPaperSize = useCallback((v: ReportPaperSize) => { patchReportSettings({ paperSize: v }); }, []);
  const setOrientation = useCallback((v: ReportOrientation) => { patchReportSettings({ orientation: v }); }, []);
  const setReportFontFamily = useCallback((v: ReportFontChoice) => { patchReportSettings({ reportFontFamily: v }); }, []);
  const chooseReportType = useCallback((next: ReportType) => { patchReportSettings({ reportType: next }); }, []);

  const [exportError, setExportError] = useState<Pick<CPMResult, 'error' | 'errorInfo'> | null>(null);
  const scheduleStale = useAppStore(s => s.scheduleStale);

  const containerRef = useRef<HTMLDivElement>(null);
  const [settingsWidth, setSettingsWidth] = useState(SETTINGS_PANEL_DEFAULT_WIDTH);
  const settingsSplitter = useSplitter({
    min: SETTINGS_PANEL_MIN_WIDTH,
    max: () => Math.round((containerRef.current?.getBoundingClientRect().width ?? 800) * 0.5),
    computeSize: e => {
      const container = containerRef.current;
      if (!container) return NaN;
      return Math.round(panelWidthAtPointer(
        e.clientX,
        container.getBoundingClientRect(),
        'inline-start',
        inlineDirectionOf(container),
      ));
    },
    onResize: w => { if (!Number.isNaN(w)) setSettingsWidth(w); },
  });

  const milestoneRef = useRef<HTMLDivElement>(null);
  const varianceRef = useRef<HTMLDivElement>(null);
  const tableReportRef = useRef<HTMLDivElement>(null);
  const tableSpec = useTableReportSpec(reportType, tableOptions);
  const locale = i18n.language;

  const milestoneRows = useMilestoneRows();
  const varianceResult = useVarianceResult();

  const writePdf = useCallback(async (pdfBytes: Uint8Array, defaultName: string) => {
    try {
      await saveBytesDialog(
        defaultName, pdfBytes,
        [{ name: 'PDF Document', extensions: ['pdf'] }],
        { mime: 'application/pdf', refuseTarget: useAppStore.getState().foreignTargetCheck(null) },
      );
    } catch (err) {
      useAppStore.getState().notify({
        severity: 'error',
        messageKey: 'notifications.saveFailed',
        detail: (err as Error).message,
      });
    }
  }, []);

  const runExport = useCallback(async () => {
    const cpm = useAppStore.getState().cpmResult;
    if (cpm?.error) {
      setExportError({ error: cpm.error, errorInfo: cpm.errorInfo });
      return;
    }
    setExportError(null);

    const lowerPaper = paperSize.toLowerCase() as 'a4' | 'a3' | 'a2' | 'a1';
    const exportBaseDir: 'ltr' | 'rtl' = RTL_LOCALES.includes(locale as Locale) ? 'rtl' : 'ltr';

    await ensureReportFontLoaded(reportFontFamily);

    const loadVectorFonts = async () => {
      const [regular, bold, arabicRegular, arabicBold, fallbackFonts] = await Promise.all([
        getReportFontBytes(reportFontFamily, 400),
        getReportFontBytes(reportFontFamily, 700),
        getArabicFontBytes(400),
        getArabicFontBytes(700),
        reportFontFamily === 'inter'
          ? Promise.resolve([])
          : Promise.all([getInterFontBytes(400), getInterFontBytes(700)])
            .then(([interRegular, interBold]) => [{ id: 'inter', bytes: { regular: interRegular, bold: interBold } }]),
      ]);
      return { main: { regular, bold }, arabic: { regular: arabicRegular, bold: arabicBold }, fallbackFonts };
    };

    const suffix = tableSpec ? tableSpec.fileSuffix : reportType === 'milestones' ? t('fileSuffix.milestones') : t('fileSuffix.variance');

    const exportTableRaster = async (): Promise<Uint8Array> => {
      const node = tableSpec ? tableReportRef.current : reportType === 'milestones' ? milestoneRef.current : varianceRef.current;
      if (!node) throw new Error('exportTableRaster: DOM-node niet beschikbaar');

      const pixelRatio = 2;
      const { domToCanvas } = await import('modern-screenshot');
      const rootEl = document.documentElement;
      const themeAttrs = ['data-theme', 'data-oa-theme'] as const;
      const prevThemes = themeAttrs.map(name => rootEl.getAttribute(name));
      for (const name of themeAttrs) rootEl.setAttribute(name, 'light');
      const shot = await domToCanvas(node, { scale: pixelRatio, backgroundColor: '#ffffff' })
        .finally(() => {
          themeAttrs.forEach((name, i) => {
            const prev = prevThemes[i];
            if (prev !== null) rootEl.setAttribute(name, prev);
            else rootEl.removeAttribute(name);
          });
        });

      return paginateCanvasToPdfBytes(shot, {
        paperSize: lowerPaper,
        orientation,
        mode: 'fit-width',
        logicalWidth: node.offsetWidth,
        logicalHeight: node.offsetHeight,
        frozenColumnWidthPx: 0,
      });
    };

    let tablePdfBytes: Uint8Array;
    try {
      const [{ paginateVectorToPdfBytes }, { makeTableRenderReport, makeSectionedRenderReport }, { subsetFont }, fonts] = await Promise.all([
        import('@/services/print/paginateVector'),
        import('@/services/pdf/pdfTable'),
        import('@/services/pdf/hbSubset'),
        loadVectorFonts(),
      ]);
      const vectorOpts = {
        paperSize: lowerPaper, orientation, mode: 'fit-width', baseDir: exportBaseDir, subsetFont, fallbackFonts: fonts.fallbackFonts,
      } as const;

      const headerMetrics = await loadReportTextMetrics(reportFontFamily, exportBaseDir);
      const measureHeader = (text: string, font: string) => headerMetrics.measure(text, font);

      if (tableSpec) {
        tablePdfBytes = await paginateVectorToPdfBytes(
          makeSectionedRenderReport(toPdfSpec(tableSpec), measureHeader, reportFont),
          vectorOpts,
          fonts.main,
          fonts.arabic,
        );
      } else if (reportType === 'milestones') {
        tablePdfBytes = await paginateVectorToPdfBytes(
          makeTableRenderReport({
            title: t('milestoneReport.title'),
            columns: buildMilestoneColumns(t, taskDate),
            rows: milestoneRows,
            emptyText: t('milestoneReport.empty'),
          }, measureHeader, reportFont),
          vectorOpts,
          fonts.main,
          fonts.arabic,
        );
      } else {
        tablePdfBytes = await paginateVectorToPdfBytes(
          makeTableRenderReport({
            title: t('variance.title'),
            columns: buildVarianceColumns(t, taskDate, locale),
            rows: varianceResult.rows,
            emptyText: t('variance.noBaseline'),
          }, measureHeader, reportFont),
          vectorOpts,
          fonts.main,
          fonts.arabic,
        );
      }
    } catch (err) {
      console.warn('[ReportPanel] Vector-tabel-PDF-export mislukt, terugval op DOM-screenshot:', describeVectorFallback(err));
      tablePdfBytes = await exportTableRaster();
    }

    await writePdf(tablePdfBytes, `${fileBase}-${suffix}.pdf`);
  }, [reportType, fileBase, paperSize, orientation, writePdf, t, taskDate, locale, milestoneRows, varianceResult, tableSpec,
    reportFontFamily, reportFont]);

  const exportPendingRef = useRef(false);
  const startExport = useCallback(() => {
    runExport().catch((err: unknown) => {
      useAppStore.getState().notify({
        severity: 'error',
        messageKey: 'notifications.saveFailed',
        detail: (err as Error).message,
      });
    });
  }, [runExport]);
  const handleExportPDF = useCallback(() => {
    const st = useAppStore.getState();
    if (st.scheduleStale) {
      exportPendingRef.current = true;
      st.runCPM();
      return;
    }
    startExport();
  }, [startExport]);
  useEffect(() => {
    if (!exportPendingRef.current || scheduleStale) return;
    exportPendingRef.current = false;
    startExport();
  }, [scheduleStale, startExport]);

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden bg-surface" style={{ position: 'relative' }}>
      <div
        onMouseDown={e => { e.preventDefault(); settingsSplitter.start(); }}
        style={{
          position: 'absolute',
          insetInlineStart: settingsWidth - 4,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'col-resize',
          zIndex: 10,
        }}
        data-ops-report-settings-resize
      />
      <div
        className="flex-shrink-0 min-w-0 overflow-y-auto p-3 flex flex-col gap-3"
        style={{ width: settingsWidth, borderInlineEnd: '1px solid var(--theme-border)' }}
      >
        <span
          className="text-small leading-4 font-bold uppercase"
          style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', color: 'var(--theme-text-muted)' }}
        >
          {t('title')}
        </span>

        <Select
          className="w-full min-w-0"
          aria-label={t('reportType.label')}
          value={reportType}
          onChange={v => chooseReportType(v as ReportType)}
          options={[
            { value: 'gantt', label: t('reportType.gantt') },
            { value: 'milestones', label: t('reportType.milestones') },
            { value: 'variance', label: t('reportType.variance') },
            ...TABLE_REPORT_TYPES.map(type => ({ value: type, label: t(`reportType.${type}`) })),
          ]}
        />

        <ReportOptionsCard title={t('summary')}>
          <div className="grid grid-cols-2 gap-1 text-small leading-4" data-ops-report-summary-block>
            {tableSpec ? (
              tableSpec.summary.map((item, i) => (
                <span key={i} className="contents">
                  <span className="text-text-secondary">{item.label}</span>
                  <span style={{ color: item.color, fontWeight: item.color ? 700 : undefined }}>{item.value}</span>
                </span>
              ))
            ) : reportType === 'milestones' ? (
              <>
                <span className="text-text-secondary">{t('milestoneReport.total')}</span>
                <span>{milestoneRows.length}</span>
                <span className="text-text-secondary">{t('milestoneReport.mandatoryCount')}</span>
                <span>{milestoneRows.filter(r => r.mandatory).length}</span>
                <span className="text-text-secondary">{t('milestoneReport.lateCount')}</span>
                <span className="text-red-400 font-bold">{milestoneRows.filter(r => r.status === 'late').length}</span>
              </>
            ) : (
              <>
                <span className="text-text-secondary">{t('variance.total')}</span>
                <span>{varianceResult.rows.length}</span>
                <span className="text-text-secondary">{t('variance.lateCount')}</span>
                <span className="text-red-400 font-bold">{varianceResult.rows.filter(r => r.status === 'late').length}</span>
                <span className="text-text-secondary">{t('variance.earlyCount')}</span>
                <span>{varianceResult.rows.filter(r => r.status === 'early').length}</span>
                {varianceResult.projectEndDelta !== undefined && (
                  <>
                    <span className="text-text-secondary col-span-2 mt-1" style={{ color: varianceResult.projectEndDelta > 0 ? '#DC2626' : 'var(--theme-text-dim)' }}>
                      {t('variance.projectEndDelta', { delta: varianceResult.projectEndDelta > 0 ? `+${varianceResult.projectEndDelta}` : `${varianceResult.projectEndDelta}` })}
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </ReportOptionsCard>

        <TableReportOptionsBlock
          reportType={reportType}
          options={tableOptions}
          onChange={patchTableOptions}
          paperSize={paperSize}
          orientation={orientation}
          onPaperSize={setPaperSize}
          onOrientation={setOrientation}
          fontFamily={reportFontFamily}
          onFontFamily={setReportFontFamily}
        />

        <form
          id="report-pdf-export"
          className="flex flex-col gap-2"
          onSubmit={e => { e.preventDefault(); handleExportPDF(); }}
        >
          <button
            type="submit"
            className="px-4 py-2 bg-accent text-accent-on rounded-lg hover:bg-accent-hover text-small leading-4 font-medium"
            style={{ boxShadow: 'var(--shadow-glow)' }}
          >
            {t('exportPDF', { defaultValue: 'Exporteer PDF' })}
          </button>
          {exportError && (
            <div className="text-small leading-4" style={{ color: 'var(--error)' }} role="alert">
              {scheduleErrorText(exportError, tCommon)}
            </div>
          )}
        </form>
      </div>

      <div className="flex-1 min-w-0 min-h-0" style={{ background: 'var(--theme-bg)' }}>
        {tableSpec ? (
          <div className="h-full overflow-auto p-4">
            <TableReportView ref={tableReportRef} spec={tableSpec} fontStack={reportFont} />
          </div>
        ) : reportType === 'milestones' ? (
          <div className="h-full overflow-auto p-4">
            {recordedDatesNote}
            <div
              ref={milestoneRef}
              className="bg-surface p-4"
              style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', maxWidth: 960, ...reportFontStyle(reportFont) }}
            >
              <h3 className="ui-card-header !text-small !leading-4 mb-3">{t('milestoneReport.title')}</h3>
              <MilestoneReport />
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto p-4">
            {recordedDatesNote}
            <div
              ref={varianceRef}
              className="bg-surface p-4"
              style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', maxWidth: 1100, ...reportFontStyle(reportFont) }}
            >
              <h3 className="ui-card-header !text-small !leading-4 mb-3">{t('variance.title')}</h3>
              <VarianceReport />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
