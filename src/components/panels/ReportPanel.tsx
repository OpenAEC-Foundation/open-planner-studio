import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/state/appStore';
import { useTranslation } from 'react-i18next';
import { renderPrintCanvas, PrintOptions } from '@/services/print/printPreview';
import { getLocalizedMonths, getLocalizedMonthsShort } from '@/i18n/dateFormat';
import { ensureExtension } from '@/utils/filePath';
import { Select } from '@/components/common/Select';
import { isTauri } from '@/utils/platform';
import { MilestoneReport, useMilestoneRows, useMilestoneReportPrint } from './MilestoneReport';

export function ReportPanel() {
  const { t } = useTranslation('report');
  const { i18n } = useTranslation();
  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const calendar = useAppStore(s => s.calendar);
  const project = useAppStore(s => s.project);
  const projectName = project.name;

  const [reportType, setReportType] = useState<'gantt' | 'milestones'>('gantt');
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

  const canvasRef = useRef<HTMLCanvasElement>(null);

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
  };

  // Re-render the canvas whenever data or options change
  useEffect(() => {
    if (reportType !== 'gantt') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderPrintCanvas(canvas, tasks, sequences, calendar, projectName, options);
  }, [reportType, tasks, sequences, calendar, projectName, showCritical, showFloat, showDeps, showWeekends, showLegend, showTaskNames, showCompletion, autoFit, customZoom, paperSize, orientation, companyName, locale]);

  const milestoneRows = useMilestoneRows();
  const printMilestoneReport = useMilestoneReportPrint(projectName);

  const handlePrint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>${projectName}</title>
<style>
  * { margin: 0; padding: 0; }
  body { display: flex; justify-content: center; }
  img { max-width: 100%; height: auto; }
  @page { size: ${paperSize} ${orientation}; margin: 8mm; }
</style>
</head><body>
<img src="${dataUrl}" />
<script>window.onload=function(){window.print();}</script>
</body></html>`);
    printWindow.document.close();
  }, [projectName, orientation, paperSize]);

  const handleExportPDF = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const defaultName = `${projectName || 'project'}-planning.png`;

    if (isTauri()) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const picked = await save({
        defaultPath: defaultName,
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      });
      if (!picked) return;
      const savedPath = ensureExtension(picked, 'png');

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const buffer = await blob.arrayBuffer();
        await writeFile(savedPath, new Uint8Array(buffer));
      }, 'image/png');
    } else {
      const link = document.createElement('a');
      link.download = `${projectName || 'project'}-planning.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }, [projectName]);

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
          onChange={v => setReportType(v as 'gantt' | 'milestones')}
          options={[
            { value: 'gantt', label: t('reportType.gantt') },
            { value: 'milestones', label: t('reportType.milestones') },
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
            ) : (
              <>
                <span className="text-text-secondary">{t('milestoneReport.total')}</span>
                <span>{milestoneRows.length}</span>
                <span className="text-text-secondary">{t('milestoneReport.mandatoryCount')}</span>
                <span>{milestoneRows.filter(r => r.mandatory).length}</span>
                <span className="text-text-secondary">{t('milestoneReport.lateCount')}</span>
                <span className="text-red-400 font-bold">{milestoneRows.filter(r => r.status === 'late').length}</span>
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

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={reportType === 'gantt' ? handlePrint : printMilestoneReport}
            className="px-4 py-2 bg-accent text-accent-on rounded-lg hover:bg-accent-hover text-xs font-medium"
            style={{ boxShadow: 'var(--shadow-glow)' }}
          >
            {t('print')}
          </button>
          {reportType === 'gantt' && (
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium"
            >
              {t('exportPDF', { defaultValue: 'Exporteer PDF' })}
            </button>
          )}
        </div>
      </div>

      {/* Right: Live preview */}
      <div className="flex-1 overflow-auto p-4" style={{ background: 'var(--theme-bg)' }}>
        {reportType === 'gantt' ? (
          <div
            className="inline-block bg-white"
            style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}
          >
            <canvas ref={canvasRef} />
          </div>
        ) : (
          <div
            className="bg-surface p-4"
            style={{ borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', maxWidth: 960 }}
          >
            <h3 className="ui-card-header !text-xs mb-3">{t('milestoneReport.title')}</h3>
            <MilestoneReport />
          </div>
        )}
      </div>
    </div>
  );
}
