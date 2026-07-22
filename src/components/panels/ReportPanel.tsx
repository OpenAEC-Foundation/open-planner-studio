import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { renderPrintCanvas, renderReport, PrintOptions } from '@/services/print/printPreview';
import { getLocalizedMonths, getLocalizedMonthsShort } from '@/i18n/dateFormat';
import { ensureExtension } from '@/utils/filePath';
import { computeHighResScale } from '@/utils/miniPdf';
import { paginateCanvasToPdfBytes, paginateCanvasToTiles } from '@/services/print/paginate';
import { ensureInterLoaded, getInterFontBytes } from '@/services/pdf/fontLoader';
import { Select } from '@/components/common/Select';
import { isTauri } from '@/utils/platform';
import { MilestoneReport, useMilestoneRows } from './MilestoneReport';
import { VarianceReport, useVarianceResult } from './VarianceReport';

/** Render-schaal voor de gepagineerde preview (goedkoper dan de export; wordt toch verkleind getoond). */
const PREVIEW_RENDER_SCALE = 2;
/** Maximaal aantal papiervellen dat de preview toont (rest verwijst naar de export). */
const PREVIEW_MAX_PAGES = 30;

/** Eén papiervel in de preview: PNG-dataURL + echte puntmaat (voor de beeldverhouding). */
interface PreviewPage {
  dataUrl: string;
  wPt: number;
  hPt: number;
}

export function ReportPanel() {
  const { t } = useTranslation('report');
  const { i18n } = useTranslation();
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const calendar = useAppStore(s => s.calendar);
  const project = useAppStore(s => s.project);
  const projectName = project.name;
  const dateNotation = useAppStore(s => s.ui.dateNotation);

  const [reportType, setReportType] = useState<'gantt' | 'milestones' | 'variance'>('gantt');
  const [showCritical, setShowCritical] = useState(true);
  const [showFloat, setShowFloat] = useState(true);
  const [showDeps, setShowDeps] = useState(true);
  const [showWeekends, setShowWeekends] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showTaskNames, setShowTaskNames] = useState(true);
  const [showCompletion, setShowCompletion] = useState(true);
  const [autoFit, setAutoFit] = useState(true);
  const [customZoom, setCustomZoom] = useState(22);
  const [paperSize, setPaperSize] = useState<'A3' | 'A4' | 'A1'>('A3');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [companyName, setCompanyName] = useState(project.company || '');

  const milestoneRef = useRef<HTMLDivElement>(null);
  const varianceRef = useRef<HTMLDivElement>(null);

  // Gepagineerde Gantt-preview: dezelfde tegels als de PDF-export (gedeelde pagineer-engine).
  const [previewPages, setPreviewPages] = useState<PreviewPage[]>([]);
  const [previewTotalPages, setPreviewTotalPages] = useState(0);

  const locale = i18n.language;
  const localizedMonths = getLocalizedMonths(locale);
  const localizedMonthsShort = getLocalizedMonthsShort(locale);

  const labels = {
    noTasks: t('noTasks'),
    printed: t('printed'),
    legend: {
      criticalPath: t('legend.criticalPath'),
      normal: t('legend.normal'),
      milestone: t('legend.milestone'),
      summary: t('legend.summary'),
      float: t('showFloat'),
      completion: t('showCompletion', { defaultValue: 'Completion' }),
    },
    tableHeaders: {
      rowNum: '#',
      wbs: t('tableHeaders.wbs'),
      taskName: t('tableHeaders.taskName'),
      start: t('tableHeaders.start'),
      end: t('tableHeaders.end'),
      duration: t('tableHeaders.duration'),
      completion: t('tableHeaders.completion', { defaultValue: 'Volt.' }),
    },
    page: t('page', { defaultValue: 'Pagina' }),
    of: t('of', { defaultValue: 'van' }),
  };

  const options: PrintOptions = {
    showCritical, showFloat, showDeps, showWeekends, showLegend,
    showTaskNames, showCompletion, autoFit, customZoom,
    paperSize, orientation, companyName,
    labels,
    localizedMonths,
    localizedMonthsShort,
    locale,
    projectStartDate: project.startDate,
    projectEndDate: project.endDate,
    projectAuthor: project.author,
    dateNotation,
  };

  // Bereken de Gantt-preview als gepagineerde papiervellen — via dezelfde pagineer-engine als de
  // PDF-export (paginateCanvasToTiles), zodat de preview WYSIWYG-identiek is aan de export.
  useEffect(() => {
    if (reportType !== 'gantt') {
      setPreviewPages([]);
      setPreviewTotalPages(0);
      return;
    }
    let cancelled = false;
    const renderPreview = () => {
      if (cancelled) return;
      const offscreen = document.createElement('canvas');
      // Eerste render (schaal 1) → logische maten + naam-kolombreedte; tweede render → preview-raster.
      const { width: logicalWidth, height: logicalHeight, tableWidth } = renderPrintCanvas(
        offscreen, tasks, sequences, calendar, projectName, options, 1,
      );
      renderPrintCanvas(offscreen, tasks, sequences, calendar, projectName, options, PREVIEW_RENDER_SCALE);
      const tiles = paginateCanvasToTiles(offscreen, {
        paperSize: paperSize.toLowerCase() as 'a4' | 'a3' | 'a1',
        orientation,
        mode: autoFit ? 'fit-width' : 'actual',
        logicalWidth,
        logicalHeight,
        frozenColumnWidthPx: tableWidth,
        supersample: 1, // preview: goedkoper; wordt toch verkleind weergegeven
      });
      const shown = tiles.pages.slice(0, PREVIEW_MAX_PAGES);
      setPreviewPages(shown.map(page => ({
        dataUrl: page.toDataURL('image/png'),
        wPt: tiles.pageWidthPt,
        hPt: tiles.pageHeightPt,
      })));
      setPreviewTotalPages(tiles.pages.length);
    };
    // Wacht op het gevendorde Inter-font (family 'InterPDF') vóór de eerste render, zodat
    // measureText/afkapping deterministisch is (§5.2). ensureInterLoaded is idempotent; de
    // cancelled-guard voorkomt dat een verouderde async-render na deps-wijziging/unmount nog toepast.
    ensureInterLoaded().then(renderPreview);
    return () => { cancelled = true; };
  }, [reportType, tasks, sequences, calendar, projectName, showCritical, showFloat, showDeps, showWeekends, showLegend, showTaskNames, showCompletion, autoFit, customZoom, paperSize, orientation, companyName, locale, dateNotation]);

  const milestoneRows = useMilestoneRows();
  const varianceResult = useVarianceResult();

  /** Gedeelde PDF-schrijver: Tauri → save-dialoog + writeFile, web → blob-download. */
  const writePdf = useCallback(async (pdfBytes: Uint8Array, defaultName: string) => {
    if (isTauri()) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const picked = await save({
        defaultPath: defaultName,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });
      if (!picked) return;
      const savedPath = ensureExtension(picked, 'pdf');
      await writeFile(savedPath, pdfBytes);
    } else {
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = defaultName;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  const handleExportPDF = useCallback(async () => {
    const lowerPaper = paperSize.toLowerCase() as 'a4' | 'a3' | 'a1';

    // Zorg dat het gevendorde Inter-font geladen is vóór de offscreen render, zodat ook de
    // raster-export het deterministische Inter gebruikt (measureText-pariteit met de preview, §5.2).
    await ensureInterLoaded();

    if (reportType === 'gantt') {
      const mode = autoFit ? 'fit-width' : 'actual';

      // De raster-tak (JPEG-tegels) als betrouwbare terugval: exact het bestaande pad, uitgesplitst
      // zodat de vector-tak erop kan terugvallen bij een fout (bv. een glyph buiten Inter — echte
      // script-detectie is fase 4). Render offscreen op een vaste hoge schaal, onafhankelijk van het
      // scherm van de exporterende gebruiker (window.devicePixelRatio, vaak 1x). Eerste render (schaal
      // 1) levert de LOGISCHE maten + naam-kolombreedte; de tweede render het high-res raster.
      const exportRaster = (): Uint8Array => {
        const exportCanvas = document.createElement('canvas');
        const { width: logicalWidth, height: logicalHeight, tableWidth } = renderPrintCanvas(
          exportCanvas, tasks, sequences, calendar, projectName, options, 1,
        );
        const exportScale = computeHighResScale(logicalWidth, logicalHeight);
        renderPrintCanvas(exportCanvas, tasks, sequences, calendar, projectName, options, exportScale);
        return paginateCanvasToPdfBytes(exportCanvas, {
          paperSize: lowerPaper, orientation, mode,
          logicalWidth, logicalHeight, frozenColumnWidthPx: tableWidth,
        });
      };

      // Vector-tak (fase 2): échte vector-PDF met selecteerbare tekst + ingebedde Inter. Bij een fout
      // valt de export terug op raster zodat hij nooit stukloopt. Lazy import houdt pdf-lib/fontkit
      // uit de hoofdbundle (B2).
      let pdfBytes: Uint8Array;
      try {
        const [{ paginateVectorToPdfBytes }, regular, bold] = await Promise.all([
          import('@/services/print/paginateVector'),
          getInterFontBytes(400),
          getInterFontBytes(700),
        ]);
        pdfBytes = await paginateVectorToPdfBytes(
          (make) => renderReport(make, tasks, sequences, calendar, projectName, options),
          { paperSize: lowerPaper, orientation, mode },
          { regular, bold },
        );
      } catch (err) {
        console.warn('[ReportPanel] Vector-PDF-export mislukt, terugval op raster:', err);
        pdfBytes = exportRaster();
      }
      await writePdf(pdfBytes, `${projectName || 'project'}-planning.pdf`);
      return;
    }

    // Mijlpalen / afwijkingen: DOM → canvas via modern-screenshot, dan pagineren (fit-width).
    const node = reportType === 'milestones' ? milestoneRef.current : varianceRef.current;
    if (!node) return;

    // domToCanvas met scale=s levert een canvas van node.offsetWidth*s × node.offsetHeight*s device-px;
    // de LOGISCHE maat blijft node.offsetWidth/offsetHeight, dus srcScale = canvas.width/logicalWidth = s.
    const pixelRatio = 2;
    const { domToCanvas } = await import('modern-screenshot');
    // Een PDF is een wit-papier-artefact. De rapporttabellen kleuren hun tekst via de thema-
    // CSS-variabelen; in een donker thema is dat lichte tekst, die op de geforceerde witte
    // achtergrond onleesbaar wordt. Forceer daarom kort het lichte thema tijdens de capture
    // (zodat tekst donker-op-wit uitvalt) en herstel daarna het thema van de gebruiker.
    const rootEl = document.documentElement;
    const prevTheme = rootEl.getAttribute('data-theme');
    rootEl.setAttribute('data-theme', 'light');
    const shot = await domToCanvas(node, { scale: pixelRatio, backgroundColor: '#ffffff' })
      .finally(() => {
        if (prevTheme !== null) rootEl.setAttribute('data-theme', prevTheme);
        else rootEl.removeAttribute('data-theme');
      });

    const pdfBytes = paginateCanvasToPdfBytes(shot, {
      paperSize: lowerPaper,
      orientation,
      mode: 'fit-width',
      logicalWidth: node.offsetWidth,
      logicalHeight: node.offsetHeight,
      frozenColumnWidthPx: 0,
    });
    const suffix = reportType === 'milestones' ? 'mijlpalen' : 'afwijkingen';
    await writePdf(pdfBytes, `${projectName || 'project'}-${suffix}.pdf`);
  }, [reportType, projectName, tasks, sequences, calendar, options, paperSize, orientation, autoFit, writePdf]);

  const criticalCount = tasks.filter(t => t.time.isCritical && t.childIds.length === 0).length;
  const leafCount = tasks.filter(t => t.childIds.length === 0).length;

  return (
    <div className="flex-1 flex overflow-hidden bg-surface">
      {/* Left: Settings panel */}
      <div className="w-64 flex-shrink-0 overflow-y-auto p-3 flex flex-col gap-3" style={{ borderRight: '1px solid var(--theme-border)' }}>
        <span
          className="text-xs font-bold uppercase"
          style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.08em', color: 'var(--theme-text-muted)' }}
        >
          {t('title')}
        </span>

        {/* Rapporttype (fase 2.4): Gantt-afdruk of mijlpalen-overzicht */}
        <Select
          aria-label={t('reportType.label')}
          value={reportType}
          onChange={v => setReportType(v as 'gantt' | 'milestones' | 'variance')}
          options={[
            { value: 'gantt', label: t('reportType.gantt') },
            { value: 'milestones', label: t('reportType.milestones') },
            { value: 'variance', label: t('reportType.variance') },
          ]}
        />

        {/* Project summary */}
        <div className="bg-surface-alt rounded-lg p-3" style={{ border: '1px solid var(--theme-border)' }}>
          <h3 className="ui-card-header !text-xs mb-2">{t('summary')}</h3>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {reportType === 'gantt' ? (
              <>
                <span className="text-text-secondary">{t('tasks')}</span>
                <span>{tasks.length}</span>
                <span className="text-text-secondary">{t('leafTasks')}</span>
                <span>{leafCount}</span>
                <span className="text-text-secondary">{t('critical')}</span>
                <span className="text-red-400 font-bold">{criticalCount}</span>
                <span className="text-text-secondary">{t('relations')}</span>
                <span>{sequences.length}</span>
              </>
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
        </div>

        {/* Report options */}
        {reportType === 'gantt' && (
        <div className="bg-surface-alt rounded-lg p-3" style={{ border: '1px solid var(--theme-border)' }}>
          <h3 className="ui-card-header !text-xs mb-2">{t('settings')}</h3>
          <div className="flex flex-col gap-2 text-xs">
            {/* Company name */}
            <div className="flex items-center gap-2">
              <label className="text-text-secondary w-20">{t('company', { defaultValue: 'Bedrijf:' })}</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder={t('companyPlaceholder', { defaultValue: 'Bedrijfsnaam' })}
                className="input flex-1 !w-auto !text-xs !px-2 !py-1"
              />
            </div>

            {/* Author (read-only from project) */}
            <div className="flex items-center gap-2">
              <label className="text-text-secondary w-20">{t('author', { defaultValue: 'Auteur:' })}</label>
              <span className="flex-1 px-2 py-1 text-xs text-text-secondary">{project.author || '-'}</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-text-secondary w-20">{t('paper')}</label>
              <Select
                className="flex-1"
                aria-label={t('paper')}
                value={paperSize}
                onChange={v => setPaperSize(v as 'A3' | 'A4' | 'A1')}
                options={[
                  { value: 'A4', label: 'A4' },
                  { value: 'A3', label: 'A3' },
                  { value: 'A1', label: 'A1' },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-text-secondary w-20">{t('orientation')}</label>
              <Select
                className="flex-1"
                aria-label={t('orientation')}
                value={orientation}
                onChange={v => setOrientation(v as 'landscape' | 'portrait')}
                options={[
                  { value: 'landscape', label: t('landscape') },
                  { value: 'portrait', label: t('portrait') },
                ]}
              />
            </div>

            {/* Auto-fit checkbox */}
            <label className="flex items-center gap-2 mt-1">
              <input type="checkbox" checked={autoFit} onChange={e => setAutoFit(e.target.checked)} className="accent-accent" />
              <span>{t('autoFit', { defaultValue: 'Auto-fit op papier' })}</span>
            </label>

            {/* Custom zoom slider (only when auto-fit is off) */}
            {!autoFit && (
              <div className="flex items-center gap-2">
                <label className="text-text-secondary w-20">{t('zoom', { defaultValue: 'Zoom:' })}</label>
                <input
                  type="range"
                  min={5}
                  max={40}
                  value={customZoom}
                  onChange={e => setCustomZoom(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-8 text-right">{customZoom}</span>
              </div>
            )}

            <label className="flex items-center gap-2 mt-1">
              <input type="checkbox" checked={showTaskNames} onChange={e => setShowTaskNames(e.target.checked)} className="accent-accent" />
              <span>{t('showTaskNames', { defaultValue: 'Taaknamen op staafjes' })}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showCompletion} onChange={e => setShowCompletion(e.target.checked)} className="accent-accent" />
              <span>{t('showCompletion', { defaultValue: 'Voltooiing tonen' })}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showCritical} onChange={e => setShowCritical(e.target.checked)} className="accent-accent" />
              <span>{t('showCriticalPath')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showFloat} onChange={e => setShowFloat(e.target.checked)} className="accent-accent" />
              <span>{t('showFloat')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showDeps} onChange={e => setShowDeps(e.target.checked)} className="accent-accent" />
              <span>{t('showDependencies')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showWeekends} onChange={e => setShowWeekends(e.target.checked)} className="accent-accent" />
              <span>{t('showWeekends')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showLegend} onChange={e => setShowLegend(e.target.checked)} className="accent-accent" />
              <span>{t('showLegend')}</span>
            </label>
          </div>
        </div>
        )}

        {/* Action buttons — alle rapporttypes exporteren naar PDF (geen uitprinten meer). */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-accent text-accent-on rounded-lg hover:bg-accent-hover text-xs font-medium"
            style={{ boxShadow: 'var(--shadow-glow)' }}
          >
            {t('exportPDF', { defaultValue: 'Exporteer PDF' })}
          </button>
        </div>
      </div>

      {/* Right: Live preview */}
      <div className="flex-1 overflow-auto p-4" style={{ background: 'var(--theme-bg)' }}>
        {reportType === 'gantt' ? (
          <div className="flex flex-col items-center gap-4">
            {previewPages.map((page, i) => (
              <div
                key={i}
                className="bg-white"
                style={{
                  width: 'min(100%, 900px)',
                  aspectRatio: `${page.wPt} / ${page.hPt}`,
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-card)',
                  overflow: 'hidden',
                }}
              >
                <img src={page.dataUrl} alt="" style={{ display: 'block', width: '100%', height: '100%' }} />
              </div>
            ))}
            {previewTotalPages > previewPages.length && (
              <div className="text-xs text-text-secondary text-center py-2">
                {t('previewPageLimit', {
                  defaultValue: '… en nog {{n}} pagina(\'s) — exporteer voor het volledige document',
                  n: previewTotalPages - previewPages.length,
                })}
              </div>
            )}
          </div>
        ) : reportType === 'milestones' ? (
          <div
            ref={milestoneRef}
            className="bg-surface p-4"
            style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', maxWidth: 960 }}
          >
            <h3 className="ui-card-header !text-xs mb-3">{t('milestoneReport.title')}</h3>
            <MilestoneReport />
          </div>
        ) : (
          <div
            ref={varianceRef}
            className="bg-surface p-4"
            style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', maxWidth: 1100 }}
          >
            <h3 className="ui-card-header !text-xs mb-3">{t('variance.title')}</h3>
            <VarianceReport />
          </div>
        )}
      </div>
    </div>
  );
}
