import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconId } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { Select } from '@/components/common/Select';
import { HelpButton } from '@/components/common/HelpButton';
import { REPORT_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { ensureInterLoaded } from '@/services/pdf/fontLoader';
import { saveBytesDialog } from '@/services/fileAccess';
import { buildGanttReportPdf } from '@/services/print/exportGanttReportPdf';
import { NAME_COLUMN_WIDTH_MAX, NAME_COLUMN_WIDTH_MIN, REPORT_FONT_SCALES, REPORT_MAX_ZOOM, REPORT_MIN_ZOOM } from '@/services/print/printPreview';
import { printableWidthLogicalPx } from '@/services/print/tileLayout';
import { documentFileBase } from '@/utils/documents';
import { documentProjectCode } from '@/utils/documentProjectCode';
import { nameWithProjectCode } from '@/utils/projectCodeName';
import { scheduleErrorText } from '@/i18n/scheduleErrors';
import { RTL_LOCALES, type Locale } from '@/i18n/config';
import { useFieldCatalogCtx } from '@/components/viewControls/useFieldCatalogCtx';
import { barColorFieldOptions, effectiveBarColorControl } from '@/components/viewControls/barColorFieldOptions';
import { decodeFieldRef, encodeFieldRef } from '@/components/viewControls/fieldRefCodec';
import type { CPMResult } from '@/engine/scheduler/CPMSolver';
import type { TaskColumnCategory } from '@/types/taskGrid';
import { saveReportSettings, TABLE_REPORT_TYPES, type ReportSettings, type ReportType } from '@/utils/reportSettings';
import { StudioChoiceGroup, StudioGroup, StudioNotice, StudioSegmented, StudioSwitch } from './studioPrimitives';
import { fieldsAreDefault, useStudioSettings, type StudioSettingKey } from './useStudioSettings';
import { useStudioPrintOptions } from './useStudioPrintOptions';
import { useReportColumnDomain } from './useReportColumnDomain';
import { BUILTIN_REPORT_COLUMNS, isDefaultReportColumns, resolveReportColumns } from './reportColumns';
import { useReportPaper } from './useReportPaper';
import { ReportPaperView, type PaperPick, type PaperTarget } from './ReportPaperView';
import { ColumnsEditor } from './ColumnsEditor';
import { markReportInput } from './studioPerf';
import './reportStudio.css';

/** De stappen van de zijbalk, in de volgorde van het papier. */
export type StudioStepId = 'tasks' | 'columns' | 'bars' | 'page' | 'headerFooter' | 'export';
const STEP_ORDER: readonly StudioStepId[] = ['tasks', 'columns', 'bars', 'page', 'headerFooter', 'export'];

/** Welke velden "Standaard" per stap terugzet. */
const STEP_KEYS: Record<StudioStepId, readonly StudioSettingKey[]> = {
  tasks: ['followView'],
  columns: ['columns', 'truncateTaskNames', 'taskNameColumnWidth'],
  bars: ['showTaskNames', 'showCompletion', 'showFloat', 'showBaselineOverlay', 'showDeps', 'showCritical', 'statusLine', 'showWeekends', 'compressNonWorkdays'],
  page: ['paperSize', 'orientation', 'autoFit', 'customZoom', 'timelineColumns', 'reportFontScale'],
  headerFooter: ['repeatHeader', 'repeatFooter', 'showLegend'],
  export: [],
};

/** B2-iconen per stap, gekozen op functie (B2 heeft geen eigen iconen voor kop/voet of papier). */
const STEP_ICONS: Record<StudioStepId, IconId> = {
  tasks: 'layout.task-tree', columns: 'table.columns', bars: 'planning.gantt', page: 'report.print-entry',
  headerFooter: 'project.properties', export: 'file.export',
};

/** Welk deel van het papier bij een stap hoort (gemarkeerd zolang de stap open is). */
const STEP_TARGETS: Record<StudioStepId, PaperTarget[]> = {
  tasks: [], columns: ['columns'], bars: ['chart'], page: ['page'], headerFooter: ['header', 'footer'], export: [],
};

/** Welke stap een deel van het papier opent. */
const TARGET_STEP: Record<PaperTarget, StudioStepId> = {
  header: 'headerFooter', columns: 'columns', chart: 'bars', footer: 'headerFooter', page: 'page',
};

/** Boven dit deel van de breedte neemt de tabel zoveel ruimte dat de tijdlijn smal wordt. */
const TABLE_SHARE_WARN = 0.4;
/** Vanaf zoveel bladen meldt de stap Pagina dat het veel papier wordt. */
const MANY_PAGES = 12;

interface PopoverState { step: StudioStepId; anchor: { x: number; y: number }; from: 'rail' | 'paper' }

/**
 * Het nieuwe Rapport-tabblad voor de Gantt-afdruk (issue #817, feature flag `reportRedesign`; ontwerp
 * "schets 4 + 2" van de eigenaar, 7 november 2026). Links een inklapbare zijbalk met stappen die het
 * papier volgen; rechts het papier als SVG, waarop elk deel oplicht en bij een klik zijn stap opent. Is
 * de zijbalk ingeklapt, dan opent dezelfde stapinhoud als klein venster naast dat deel: één bron van
 * bediening, twee wegen ernaartoe.
 */
export function GanttReportStudio({ onReportTypeChange }: { onReportTypeChange: (type: ReportType) => void }) {
  const { t } = useTranslation('report');
  const { t: tCommon, i18n } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  const api = useStudioSettings();
  const { settings, patch, hydrated } = api;

  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const calendar = useAppStore(s => s.calendar);
  const project = useAppStore(s => s.project);
  const viewRows = useAppStore(s => s.viewRows);
  const scheduleStale = useAppStore(s => s.scheduleStale);
  const barColorSelection = useAppStore(s => s.ui.barColorSelection);
  const setOverlays = useAppStore(s => s.setOverlays);
  const gridColumns = useAppStore(s => s.taskGridSurfaces['gantt-task-grid'].columns);
  const projectCode = useAppStore(s => documentProjectCode(s.project, s.xerImportMetadata));
  const projectName = nameWithProjectCode(project.name, projectCode) || tCommon('project.untitled');
  const fileBase = documentFileBase(project.name, projectCode);
  const rtl = RTL_LOCALES.includes(i18n.language as Locale);

  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void ensureInterLoaded().then(() => { if (!cancelled) setFontReady(true); }, () => { if (!cancelled) setFontReady(true); });
    return () => { cancelled = true; };
  }, []);

  // De bedrijfsnaam komt uit het project en wordt bewust niet per apparaat bewaard (zie reportSettings.ts).
  const [companyName, setCompanyName] = useState(project.company || '');

  // ---- Kolommen ------------------------------------------------------------------------------------
  const { domain, labelForColumn } = useReportColumnDomain();
  const resolved = useMemo(
    () => resolveReportColumns(settings.columns, domain, tasks, labelForColumn),
    [settings.columns, domain, tasks, labelForColumn],
  );
  const columnLabels = useMemo(
    () => new Map(domain.availableColumns.map(column => [String(column.id), column.label] as const)),
    [domain.availableColumns],
  );
  const labelForId = useCallback((id: string) => columnLabels.get(id) ?? id, [columnLabels]);
  const builtinToId = useMemo(
    () => new Map(Object.entries(BUILTIN_REPORT_COLUMNS).map(([id, kind]) => [kind as string, id] as const)),
    [],
  );
  const paperKeyToId = useCallback((key: string) => builtinToId.get(key) ?? key, [builtinToId]);
  const gridIds = useMemo(() => gridColumns.map(column => String(column.id)), [gridColumns]);
  const categoryLabel = useCallback(
    (category: TaskColumnCategory) => tTask(`taskGrid.category.${category}`, { defaultValue: category }),
    [tTask],
  );

  // ---- Papier ---------------------------------------------------------------------------------------
  const options = useStudioPrintOptions(settings, companyName, resolved.columns, fontReady && hydrated);
  const paperInput = useMemo(() => ({
    tasks, sequences, calendar, projectName, options,
    repeatHeader: settings.repeatHeader, repeatFooter: settings.repeatFooter, rtl,
  }), [tasks, sequences, calendar, projectName, options, settings.repeatHeader, settings.repeatFooter, rtl]);
  const paper = useReportPaper(paperInput);
  const totalPages = paper?.totalPages ?? 0;
  const printable = printableWidthLogicalPx(settings.paperSize.toLowerCase() as 'a4', settings.orientation);
  const tableShare = paper && paper.result.headerHeight > 0 ? paper.result.tableWidth / printable : null;

  // ---- Stappen: open stap, zijbalk, zwevend venster --------------------------------------------------
  const [openStep, setOpenStep] = useState<StudioStepId | null>('columns');
  const [focusColumn, setFocusColumn] = useState<{ id: string; seq: number } | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const rail = settings.sidebar === 'rail';
  const headRefs = useRef(new Map<StudioStepId, HTMLButtonElement>());

  const openStepFromPaper = useCallback((pick: PaperPick) => {
    const step = TARGET_STEP[pick.target];
    markReportInput('paper-click');
    if (pick.column) setFocusColumn({ id: paperKeyToId(pick.column), seq: Date.now() });
    if (rail) {
      setPopover({ step, anchor: pick.anchor, from: 'paper' });
    } else {
      setOpenStep(step);
      requestAnimationFrame(() => headRefs.current.get(step)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }, [rail, paperKeyToId]);

  const toggleStep = useCallback((step: StudioStepId) => {
    markReportInput('step');
    setOpenStep(prev => (prev === step ? null : step));
  }, []);

  const setSidebar = useCallback((mode: ReportSettings['sidebar']) => {
    setPopover(null);
    patch({ sidebar: mode }, 'sidebar');
  }, [patch]);

  // Ctrl+\ klapt de zijbalk in of uit, zoals in veel editors (alleen op dit tabblad).
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setSidebar(rail ? 'open' : 'rail');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rail, setSidebar]);

  const onStepHeadKeyDown = (e: KeyboardEvent<HTMLButtonElement>, step: StudioStepId) => {
    const index = STEP_ORDER.indexOf(step);
    let next: StudioStepId | undefined;
    if (e.key === 'ArrowDown') next = STEP_ORDER[(index + 1) % STEP_ORDER.length];
    else if (e.key === 'ArrowUp') next = STEP_ORDER[(index - 1 + STEP_ORDER.length) % STEP_ORDER.length];
    else if (e.key === 'Home') next = STEP_ORDER[0];
    else if (e.key === 'End') next = STEP_ORDER[STEP_ORDER.length - 1];
    if (!next) return;
    e.preventDefault();
    headRefs.current.get(next)?.focus();
  };

  // ---- Export: één actie voor de zijbalk, de stap Opslaan en de zwevende knop ------------------------
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<Pick<CPMResult, 'error' | 'errorInfo'> | null>(null);
  const exportPendingRef = useRef(false);
  const latest = useRef({ options, tasks, sequences, calendar, projectName, settings, fileBase });
  latest.current = { options, tasks, sequences, calendar, projectName, settings, fileBase };

  const runExport = useCallback(async () => {
    const cpm = useAppStore.getState().cpmResult;
    if (cpm?.error) {
      setExportError({ error: cpm.error, errorInfo: cpm.errorInfo });
      setOpenStep('export');
      return;
    }
    setExportError(null);
    const cur = latest.current;
    if (!cur.options) return;
    setExportBusy(true);
    try {
      const bytes = await buildGanttReportPdf({
        tasks: cur.tasks, sequences: cur.sequences, calendar: cur.calendar, projectName: cur.projectName,
        options: cur.options, repeatHeader: cur.settings.repeatHeader, repeatFooter: cur.settings.repeatFooter,
      });
      await saveBytesDialog(`${cur.fileBase}-${t('fileSuffix.gantt')}.pdf`, bytes,
        [{ name: 'PDF Document', extensions: ['pdf'] }], { mime: 'application/pdf' });
    } catch (err) {
      useAppStore.getState().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: (err as Error).message });
    } finally {
      setExportBusy(false);
    }
  }, [t]);

  const exportPdf = useCallback(() => {
    if (exportBusy) return;
    const st = useAppStore.getState();
    // Een verouderde planning eerst doorrekenen; exporteren pas ná de render met de nieuwe waarden.
    if (st.scheduleStale) {
      exportPendingRef.current = true;
      st.runCPM();
      return;
    }
    void runExport();
  }, [exportBusy, runExport]);

  useEffect(() => {
    if (!exportPendingRef.current || scheduleStale) return;
    exportPendingRef.current = false;
    void runExport();
  }, [scheduleStale, runExport, options]);

  // ---- Samenvattingen per stap ---------------------------------------------------------------------
  const paperLabel = t('studio.page.paperLabel', {
    paper: settings.paperSize,
    orientation: t(settings.orientation === 'landscape' ? 'studio.page.landscape' : 'studio.page.portrait').toLocaleLowerCase(i18n.language),
  });
  const pagesText = t('studio.pages', { count: totalPages });
  const shownRows = settings.followView ? viewRows.length : tasks.length;
  const onBars = [
    settings.showCritical && t('studio.bars.short.critical'),
    settings.showDeps && t('studio.bars.short.relations'),
    settings.showFloat && t('studio.bars.short.float'),
    settings.showCompletion && t('studio.bars.short.completion'),
    settings.showTaskNames && t('studio.bars.short.names'),
    settings.showBaselineOverlay && t('studio.bars.short.baseline'),
    settings.statusLine !== 'none' && t('studio.bars.short.statusLine'),
  ].filter((v): v is string => typeof v === 'string');

  const tableTooWide = tableShare !== null && tableShare > TABLE_SHARE_WARN;
  const statusLineWithoutDate = settings.statusLine !== 'none' && !project.statusDate;
  const summaries: Record<StudioStepId, { text: string; warn?: boolean }> = {
    tasks: { text: settings.followView ? t('studio.tasks.summaryView', { count: shownRows }) : t('studio.tasks.summaryAll', { count: shownRows }) },
    columns: {
      text: tableTooWide
        ? t('studio.columns.summaryWide', { count: resolved.columns.length, share: Math.round((tableShare ?? 0) * 100) })
        : `${t('studio.columns.summary', { count: resolved.columns.length })} · ${resolved.columns.map(c => (c.builtin ? labelForId(c.key) : c.header)).join(', ')}`,
      warn: tableTooWide,
    },
    bars: {
      text: statusLineWithoutDate ? t('studio.bars.summaryNoStatusDate') : (onBars.length ? onBars.join(' · ') : t('studio.bars.summaryNone')),
      warn: statusLineWithoutDate,
    },
    page: { text: `${paperLabel} · ${pagesText}${settings.reportFontScale !== 100 ? ` · ${settings.reportFontScale} %` : ''}` },
    headerFooter: {
      text: settings.repeatHeader && settings.repeatFooter
        ? t('studio.headerFooter.summaryEvery')
        : settings.repeatHeader ? t('studio.headerFooter.summaryHeaderOnly')
          : settings.repeatFooter ? t('studio.headerFooter.summaryFooterOnly') : t('studio.headerFooter.summaryOnce'),
    },
    export: {
      text: exportError ? t('studio.export.summaryError') : `${t('studio.export.summary')} · ${pagesText}`,
      warn: !!exportError,
    },
  };

  const regionLabel = useCallback((target: PaperTarget) => t(`studio.region.${target}`), [t]);
  const columnLabelForPaper = useCallback((key: string) => {
    const id = paperKeyToId(key);
    return labelForId(id);
  }, [paperKeyToId, labelForId]);

  // ---- Stapinhoud: één bron voor de zijbalk en het zwevende venster -----------------------------
  const fieldCtx = useFieldCatalogCtx();
  const barColorFields = barColorFieldOptions(fieldCtx);
  const barColorControl = effectiveBarColorControl(barColorSelection, fieldCtx);

  const stepContent = (step: StudioStepId): ReactNode => {
    switch (step) {
      case 'tasks':
        return (
          <StudioChoiceGroup
            ariaLabel={t('studio.tasks.title')}
            value={settings.followView ? 'view' : 'all'}
            onChange={v => patch({ followView: v === 'view' }, 'followView')}
            options={[
              { value: 'all', title: t('studio.tasks.all'), text: t('studio.tasks.allText'), count: tasks.length },
              { value: 'view', title: t('studio.tasks.view'), text: t('studio.tasks.viewText'), count: viewRows.length },
            ]}
          />
        );
      case 'columns':
        return (
          <>
            {tableTooWide && (
              <StudioNotice
                dataKey="table-wide"
                actions={settings.truncateTaskNames && settings.taskNameColumnWidth > NAME_COLUMN_WIDTH_MIN + 20 ? (
                  <button type="button" className="rs-link" onClick={() => patch({ taskNameColumnWidth: Math.max(NAME_COLUMN_WIDTH_MIN, settings.taskNameColumnWidth - 40) }, 'name-narrower')}>
                    {t('studio.columns.narrowerName')}
                  </button>
                ) : !settings.truncateTaskNames ? (
                  <button type="button" className="rs-link" onClick={() => patch({ truncateTaskNames: true }, 'truncate')}>
                    {t('studio.columns.truncateInstead')}
                  </button>
                ) : null}
              >
                {t('studio.columns.wideWarning', { share: Math.round((tableShare ?? 0) * 100) })}
              </StudioNotice>
            )}
            <ColumnsEditor
              ids={settings.columns}
              onChange={(ids, input) => patch({ columns: ids }, input)}
              available={domain.availableColumns}
              gridIds={gridIds}
              focusId={focusColumn?.id ?? null}
              key={focusColumn?.seq ?? 0}
              labelFor={labelForId}
              categoryLabel={categoryLabel}
            />
            {resolved.missing.length > 0 && (
              <StudioNotice tone="info" dataKey="columns-missing">
                {t('studio.columns.missing', { count: resolved.missing.length })}
              </StudioNotice>
            )}
            <StudioGroup label={t('studio.columns.nameGroup')}>
              <StudioSegmented
                ariaLabel={t('studio.columns.nameGroup')}
                value={settings.truncateTaskNames ? 'cut' : 'full'}
                onChange={v => patch({ truncateTaskNames: v === 'cut' }, 'truncate')}
                options={[
                  { value: 'cut', label: t('studio.columns.nameCut') },
                  { value: 'full', label: t('studio.columns.nameFull') },
                ]}
                dataKey="name-mode"
              />
              {settings.truncateTaskNames ? (
                <div className="rs-range">
                  <input
                    type="range"
                    min={NAME_COLUMN_WIDTH_MIN}
                    max={NAME_COLUMN_WIDTH_MAX}
                    step={5}
                    value={settings.taskNameColumnWidth}
                    onChange={e => patch({ taskNameColumnWidth: Number(e.target.value) }, 'name-width')}
                    aria-label={t('studio.columns.nameWidth')}
                    data-rs-option="taskNameColumnWidth"
                  />
                  <output>{settings.taskNameColumnWidth}</output>
                </div>
              ) : (
                <p className="rs-hint">{t('taskNameColumnWidthHint')}</p>
              )}
            </StudioGroup>
          </>
        );
      case 'bars':
        return (
          <>
            <StudioGroup label={t('studio.bars.onBars')}>
              <StudioSwitch checked={settings.showTaskNames} onChange={v => patch({ showTaskNames: v }, 'showTaskNames')} label={t('studio.bars.names')} dataKey="showTaskNames" />
              <StudioSwitch checked={settings.showCompletion} onChange={v => patch({ showCompletion: v }, 'showCompletion')} label={t('studio.bars.completion')} sub={t('studio.bars.completionSub')} dataKey="showCompletion" />
              <StudioSwitch checked={settings.showFloat} onChange={v => patch({ showFloat: v }, 'showFloat')} label={t('showFloat')} dataKey="showFloat" />
              <StudioSwitch checked={settings.showBaselineOverlay} onChange={v => patch({ showBaselineOverlay: v }, 'showBaselineOverlay')} label={t('showBaselineOverlay')} dataKey="showBaselineOverlay" />
            </StudioGroup>
            <StudioGroup label={t('studio.bars.lines')}>
              <StudioSwitch checked={settings.showDeps} onChange={v => patch({ showDeps: v }, 'showDeps')} label={t('showDependencies')} dataKey="showDeps" />
              <StudioSwitch checked={settings.showCritical} onChange={v => patch({ showCritical: v }, 'showCritical')} label={t('showCriticalPath')} sub={t('studio.bars.criticalSub')} dataKey="showCritical" />
              <div className="rs-field">
                <span className="rs-field-label">{t('studio.bars.statusLine')}</span>
                <StudioSegmented
                  ariaLabel={t('studio.bars.statusLine')}
                  value={settings.statusLine}
                  onChange={v => patch({ statusLine: v }, 'statusLine')}
                  options={[
                    { value: 'none', label: t('statusLine_none') },
                    { value: 'statusDate', label: t('statusLine_statusDate') },
                    { value: 'progress', label: t('statusLine_progress') },
                  ]}
                  dataKey="statusLine"
                />
              </div>
              {statusLineWithoutDate && <StudioNotice dataKey="no-status-date">{t('statusLineHint')}</StudioNotice>}
            </StudioGroup>
            <StudioGroup label={t('studio.bars.timeline')}>
              <StudioSwitch checked={settings.showWeekends} onChange={v => patch({ showWeekends: v }, 'showWeekends')} label={t('showWeekends')} dataKey="showWeekends" />
              <StudioSwitch checked={settings.compressNonWorkdays} onChange={v => patch({ compressNonWorkdays: v }, 'compressNonWorkdays')} label={tCommon('settings.compressNonWorkdays')} dataKey="compressNonWorkdays" />
            </StudioGroup>
            <StudioGroup label={t('studio.bars.colors')}>
              <Select
                className="w-full min-w-0"
                aria-label={t('studio.bars.colors')}
                value={barColorSelection.mode}
                onChange={value => {
                  markReportInput('barColor');
                  if (value === 'critical' || value === 'auto') { setOverlays({ barColors: { mode: value, colors: barColorSelection.colors } }); return; }
                  const field = barColorControl.effective.mode === 'category' ? barColorControl.effective.field : barColorFields[0]?.field;
                  if (field) setOverlays({ barColors: { mode: 'category', field, colors: barColorSelection.colors } });
                }}
                options={[
                  { value: 'critical', label: t('barColorMode_critical') },
                  { value: 'auto', label: t('barColorMode_auto') },
                  { value: 'category', label: t('barColorMode_category') },
                ]}
              />
              {barColorSelection.mode === 'category' && barColorControl.effective.mode === 'category' && (
                <Select
                  className="w-full min-w-0"
                  aria-label={t('barColorFieldLabel')}
                  value={encodeFieldRef(barColorControl.effective.field)}
                  onChange={value => { markReportInput('barColor'); setOverlays({ barColors: { mode: 'category', field: decodeFieldRef(value), colors: barColorSelection.colors } }); }}
                  options={barColorFields.map(option => ({ value: encodeFieldRef(option.field), label: option.label }))}
                />
              )}
              {barColorControl.missingField && <StudioNotice tone="info" dataKey="bar-color-missing">{t('barColorMissingField')}</StudioNotice>}
              <p className="rs-hint">{t('studio.bars.colorHint')}</p>
            </StudioGroup>
          </>
        );
      case 'page':
        return (
          <>
            <StudioGroup label={t('studio.page.paper')}>
              <StudioSegmented
                ariaLabel={t('studio.page.paper')}
                value={settings.paperSize}
                onChange={v => patch({ paperSize: v }, 'paperSize')}
                options={(['A4', 'A3', 'A2', 'A1'] as const).map(v => ({ value: v, label: v }))}
                dataKey="paperSize"
              />
              <StudioSegmented
                ariaLabel={t('studio.page.orientation')}
                value={settings.orientation}
                onChange={v => patch({ orientation: v }, 'orientation')}
                options={[
                  { value: 'landscape', label: t('studio.page.landscape') },
                  { value: 'portrait', label: t('studio.page.portrait') },
                ]}
                dataKey="orientation"
              />
            </StudioGroup>
            <StudioGroup label={t('studio.page.fit')}>
              <StudioSegmented
                ariaLabel={t('studio.page.fit')}
                value={settings.autoFit ? 'fit' : 'scale'}
                onChange={v => patch({ autoFit: v === 'fit' }, 'autoFit')}
                options={[
                  { value: 'fit', label: t('studio.page.fitWidth') },
                  { value: 'scale', label: t('studio.page.fixedScale') },
                ]}
                dataKey="autoFit"
              />
              {settings.autoFit ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="rs-field-label">{t('studio.page.across')}</span>
                  <div className="rs-stepper" role="group" aria-label={t('studio.page.across')}>
                    <button type="button" className="rs-icon-btn" disabled={settings.timelineColumns <= 1}
                      onClick={() => patch({ timelineColumns: settings.timelineColumns - 1 }, 'timelineColumns')}
                      aria-label={t('studio.page.fewer')} data-rs-option="timelineColumns-less">−</button>
                    <output aria-live="polite" data-rs-value="timelineColumns">{t('timelineColumns', { count: settings.timelineColumns })}</output>
                    <button type="button" className="rs-icon-btn" disabled={settings.timelineColumns >= 8}
                      onClick={() => patch({ timelineColumns: settings.timelineColumns + 1 }, 'timelineColumns')}
                      aria-label={t('studio.page.more')} data-rs-option="timelineColumns-more">+</button>
                  </div>
                </div>
              ) : (
                <div className="rs-field">
                  <span className="rs-field-label">{t('studio.page.dayWidth')}</span>
                  <div className="rs-range">
                    <input type="range" min={REPORT_MIN_ZOOM} max={REPORT_MAX_ZOOM} value={settings.customZoom}
                      onChange={e => patch({ customZoom: Number(e.target.value) }, 'customZoom')}
                      aria-label={t('studio.page.dayWidth')} />
                    <output>{settings.customZoom}</output>
                  </div>
                </div>
              )}
            </StudioGroup>
            <StudioGroup label={t('studio.page.fontScale')}>
              <StudioSegmented
                ariaLabel={t('studio.page.fontScale')}
                value={String(settings.reportFontScale)}
                onChange={v => patch({ reportFontScale: Number(v) }, 'reportFontScale')}
                options={REPORT_FONT_SCALES.map(n => ({ value: String(n), label: `${n}%` }))}
                dataKey="reportFontScale"
              />
            </StudioGroup>
            {totalPages >= MANY_PAGES ? (
              <StudioNotice dataKey="many-pages">{t('studio.page.manyPages', { count: totalPages })}</StudioNotice>
            ) : paper ? (
              <StudioNotice tone="info" dataKey="pages">
                {paper.layout.cols > 1
                  ? t('studio.page.gridPages', { count: totalPages, rows: paper.layout.rows, cols: paper.layout.cols })
                  : pagesText}
              </StudioNotice>
            ) : null}
          </>
        );
      case 'headerFooter':
        return (
          <>
            <div className="rs-field">
              <label className="rs-field-label" htmlFor="rs-company">{t('studio.headerFooter.company')}</label>
              <input id="rs-company" className="rs-input" value={companyName}
                onChange={e => { markReportInput('company'); setCompanyName(e.target.value); }}
                placeholder={t('companyPlaceholder')} />
              <span className="rs-hint">{t('studio.headerFooter.companyHint')}</span>
            </div>
            <div className="rs-field">
              <span className="rs-field-label">{t('studio.headerFooter.author')}</span>
              <span className="rs-hint">{project.author || '—'}</span>
            </div>
            <StudioGroup label={t('studio.headerFooter.repeat')}>
              <StudioSwitch checked={settings.repeatHeader} onChange={v => patch({ repeatHeader: v }, 'repeatHeader')} label={t('repeatHeader')} dataKey="repeatHeader" />
              <StudioSwitch checked={settings.repeatFooter} onChange={v => patch({ repeatFooter: v }, 'repeatFooter')} label={t('repeatFooter')} dataKey="repeatFooter" />
              <StudioSwitch checked={settings.showLegend} onChange={v => patch({ showLegend: v }, 'showLegend')} label={t('showLegend')} dataKey="showLegend" />
            </StudioGroup>
          </>
        );
      case 'export':
        return (
          <>
            {exportError && (
              <StudioNotice tone="error" dataKey="export-error">{scheduleErrorText(exportError, tCommon)}</StudioNotice>
            )}
            {scheduleStale && !exportError && (
              <StudioNotice tone="info" dataKey="export-stale">{t('studio.export.stale')}</StudioNotice>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small leading-4">
              <dt className="text-text-secondary">{t('studio.export.file')}</dt>
              <dd className="min-w-0 truncate" title={`${fileBase}-${t('fileSuffix.gantt')}.pdf`}>{`${fileBase}-${t('fileSuffix.gantt')}.pdf`}</dd>
              <dt className="text-text-secondary">{t('studio.page.paper')}</dt>
              <dd>{paperLabel}</dd>
              <dt className="text-text-secondary">{t('studio.export.sheets')}</dt>
              <dd>{totalPages}</dd>
            </dl>
            <p className="rs-hint">{t('studio.export.vectorHint')}</p>
            <ExportButton busy={exportBusy} onClick={exportPdf} label={t('studio.export.button')} busyLabel={t('studio.export.busy')} />
          </>
        );
    }
  };

  const stepFooter = (step: StudioStepId, inPopover: boolean) => {
    const keys = STEP_KEYS[step];
    const isDefault = step === 'columns'
      ? isDefaultReportColumns(settings.columns) && fieldsAreDefault(settings, ['truncateTaskNames', 'taskNameColumnWidth'])
      : step === 'headerFooter'
        ? fieldsAreDefault(settings, keys) && companyName === (project.company || '')
        : fieldsAreDefault(settings, keys);
    const index = STEP_ORDER.indexOf(step);
    const next = STEP_ORDER[index + 1];
    if (step === 'export') return null;
    return (
      <div className="rs-step-foot">
        <button
          type="button"
          className="rs-link"
          disabled={isDefault}
          onClick={() => {
            api.resetFields(keys, t(`studio.steps.${step}`));
            if (step === 'headerFooter') setCompanyName(project.company || '');
          }}
          data-rs-reset={step}
        >
          {t('studio.reset')}
        </button>
        {!inPopover && next && (
          <button type="button" className="rs-next" onClick={() => { markReportInput('step'); setOpenStep(next); headRefs.current.get(next)?.focus(); }}>
            {t('studio.next', { step: t(`studio.steps.${next}`) })}
          </button>
        )}
      </div>
    );
  };

  const stepChanged = (step: StudioStepId) => (step === 'columns'
    ? !isDefaultReportColumns(settings.columns) || !fieldsAreDefault(settings, ['truncateTaskNames', 'taskNameColumnWidth'])
    : step === 'export' ? false : !fieldsAreDefault(settings, STEP_KEYS[step]));

  // ---- Markering op het papier ---------------------------------------------------------------------
  const activeStep = popover?.step ?? (rail ? null : openStep);
  const selected = activeStep
    ? { targets: STEP_TARGETS[activeStep], column: activeStep === 'columns' && focusColumn ? focusColumnPaperKey(focusColumn.id) : undefined }
    : null;

  // ---- Status in de werkbalk -----------------------------------------------------------------------
  const status = paper ? (
    <>
      <strong>{pagesText}</strong>
      <span>·</span>
      <span>{paperLabel}</span>
      <span>·</span>
      <span>{t('studio.columns.summary', { count: resolved.columns.length })}</span>
      <span>·</span>
      <span>{settings.followView ? t('studio.tasks.summaryView', { count: shownRows }) : t('studio.tasks.summaryAll', { count: shownRows })}</span>
      {paper.stale && <span className="sr-only">{t('studio.updating')}</span>}
    </>
  ) : <span>{t('studio.loading')}</span>;

  const reportTypeSelect = (
    <Select
      className="w-full min-w-0"
      aria-label={t('reportType.label')}
      value="gantt"
      onChange={v => {
        // Eerst bewaren, dan wisselen: het oude paneel leest het rapporttype bij het laden.
        void saveReportSettings({ ...settings, reportType: v as ReportType }).then(() => onReportTypeChange(v as ReportType));
      }}
      options={[
        { value: 'gantt', label: t('reportType.gantt') },
        { value: 'resourceGantt', label: `${t('studio.otherReport')}: ${t('reportType.resourceGantt')}` },
        { value: 'milestones', label: `${t('studio.otherReport')}: ${t('reportType.milestones')}` },
        { value: 'variance', label: `${t('studio.otherReport')}: ${t('reportType.variance')}` },
        ...TABLE_REPORT_TYPES.map(type => ({ value: type, label: `${t('studio.otherReport')}: ${t(`reportType.${type}`)}` })),
      ]}
    />
  );

  return (
    <div className="rs-root" data-tour-anchor="report-panel" data-rs-studio data-rs-sidebar={settings.sidebar}>
      <aside className="rs-sidebar" data-mode={settings.sidebar} aria-label={t('studio.sidebar')}>
        {rail ? (
          <>
            <div className="rs-sidebar-head">
              <button type="button" className="rs-icon-btn" onClick={() => setSidebar('open')}
                title={`${t('studio.expand')} (Ctrl+\\)`} aria-label={t('studio.expand')} data-rs-sidebar-toggle>
                <Icon id="panel.right" size={16} className="rs-panel-icon" />
              </button>
            </div>
            <nav className="rs-rail" aria-label={t('studio.steps.label')}>
              {STEP_ORDER.map((step, i) => {
                return (
                  <button
                    key={step}
                    type="button"
                    className="rs-rail-btn"
                    aria-expanded={popover?.step === step}
                    aria-label={`${i + 1}. ${t(`studio.steps.${step}`)} — ${summaries[step].text}`}
                    title={`${i + 1}. ${t(`studio.steps.${step}`)}\n${summaries[step].text}`}
                    data-tooltip-lead
                    data-changed={stepChanged(step) ? 'true' : undefined}
                    data-rs-rail-step={step}
                    onClick={e => {
                      markReportInput('step');
                      const rect = e.currentTarget.getBoundingClientRect();
                      setPopover(prev => (prev?.step === step ? null : { step, anchor: { x: rect.right + 8, y: rect.top }, from: 'rail' }));
                    }}
                  >
                    <Icon id={STEP_ICONS[step]} size={18} />
                  </button>
                );
              })}
            </nav>
          </>
        ) : (
          <>
            <div className="rs-sidebar-head">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="rs-eyebrow">{t('studio.eyebrow')}</span>
                {reportTypeSelect}
              </div>
              <HelpButton articleId={REPORT_HELP_ARTICLE_ID} />
              <button type="button" className="rs-icon-btn" onClick={() => setSidebar('rail')}
                title={`${t('studio.collapse')} (Ctrl+\\)`} aria-label={t('studio.collapse')} data-rs-sidebar-toggle>
                <Icon id="panel.right" size={16} className="rs-panel-icon" />
              </button>
            </div>
            <div className="rs-steps" role="list" aria-label={t('studio.steps.label')}>
              {STEP_ORDER.map((step, i) => {
                const open = openStep === step;
                const summary = summaries[step];
                return (
                  <section key={step} className="rs-step" data-open={open ? 'true' : 'false'} data-rs-step={step} role="listitem">
                    <button
                      ref={el => { if (el) headRefs.current.set(step, el); else headRefs.current.delete(step); }}
                      type="button"
                      className="rs-step-head"
                      aria-expanded={open}
                      aria-controls={`rs-step-${step}`}
                      onClick={() => toggleStep(step)}
                      onKeyDown={e => onStepHeadKeyDown(e, step)}
                      data-rs-step-head={step}
                    >
                      <span className="rs-step-num" data-changed={stepChanged(step) ? 'true' : undefined} aria-hidden="true">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="rs-step-title block">{t(`studio.steps.${step}`)}</span>
                        {!open && <span className="rs-step-summary block" data-warn={summary.warn ? 'true' : undefined} data-rs-summary={step}>{summary.text}</span>}
                      </span>
                      <Icon id="tree.expand" size={16} className="rs-chevron" />
                    </button>
                    {open && (
                      <div className="rs-step-body" id={`rs-step-${step}`} data-rs-step-body={step}>
                        {stepContent(step)}
                        {stepFooter(step, false)}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
            <form
              id="report-pdf-export"
              className="rs-sidebar-foot"
              onSubmit={e => { e.preventDefault(); exportPdf(); }}
            >
              <div className="rs-foot-meta" aria-live="polite">
                <span>{pagesText}</span>
                <span>{paperLabel}</span>
              </div>
              <button type="submit" className="rs-primary" aria-busy={exportBusy} data-rs-export>
                <Icon id={exportBusy ? 'status.busy' : 'file.export'} size={16} mono className={exportBusy ? 'animate-spin' : undefined} />
                {exportBusy ? t('studio.export.busy') : t('studio.export.button')}
              </button>
            </form>
          </>
        )}
      </aside>

      <ReportPaperView
        paper={paper}
        loading={!hydrated || !fontReady || !options}
        selected={selected}
        onPick={openStepFromPaper}
        regionLabel={regionLabel}
        columnLabel={columnLabelForPaper}
        status={status}
        actions={rail ? <HelpButton articleId={REPORT_HELP_ARTICLE_ID} /> : undefined}
      />

      {/* Zijbalk ingeklapt: exporteren via de zwevende knop linksonder (besluit eigenaar 7-11-2026). Dezelfde
          actie als de stap Opslaan in de zijbalk. */}
      {rail && (
        <button
          type="button"
          className="rs-fab"
          onClick={exportPdf}
          aria-busy={exportBusy}
          aria-label={t('studio.export.fab')}
          title={t('studio.export.fab')}
          data-rs-fab-export
        >
          <Icon id={exportBusy ? 'status.busy' : 'file.export'} size={20} mono className={exportBusy ? 'animate-spin' : undefined} />
        </button>
      )}

      {popover && (
        <StepPopover
          anchor={popover.anchor}
          title={`${STEP_ORDER.indexOf(popover.step) + 1}. ${t(`studio.steps.${popover.step}`)}`}
          closeLabel={t('studio.close')}
          openInSidebarLabel={t('studio.openInSidebar')}
          onClose={() => setPopover(null)}
          onOpenInSidebar={() => { const step = popover.step; setPopover(null); setOpenStep(step); patch({ sidebar: 'open' }, 'sidebar'); }}
          dataKey={popover.step}
        >
          <div className="rs-step-body">
            {stepContent(popover.step)}
            {stepFooter(popover.step, true)}
          </div>
        </StepPopover>
      )}

      {api.lastReset && (
        <UndoToast
          text={t('studio.resetDone', { step: api.lastReset.label })}
          undoLabel={t('studio.undo')}
          onUndo={api.undoReset}
          onDismiss={api.dismissReset}
        />
      )}
    </div>
  );

  function focusColumnPaperKey(id: string): string {
    return BUILTIN_REPORT_COLUMNS[id] ?? id;
  }
}

function ExportButton({ busy, onClick, label, busyLabel }: { busy: boolean; onClick: () => void; label: string; busyLabel: string }) {
  return (
    <button type="button" className="rs-primary" aria-busy={busy} onClick={onClick} data-rs-export-step>
      <Icon id={busy ? 'status.busy' : 'file.export'} size={16} mono className={busy ? 'animate-spin' : undefined} />
      {busy ? busyLabel : label}
    </button>
  );
}

/** Klein venster met een stap, naast de rand of naast het aangeklikte deel van het papier. */
function StepPopover({ anchor, title, closeLabel, openInSidebarLabel, onClose, onOpenInSidebar, children, dataKey }: {
  anchor: { x: number; y: number };
  title: string;
  closeLabel: string;
  openInSidebarLabel: string;
  onClose: () => void;
  onOpenInSidebar: () => void;
  children: ReactNode;
  dataKey: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: anchor.x + 12, top: anchor.y });
  const returnFocus = useRef<Element | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.x + 12;
    if (left + w > vw - 12) left = Math.max(12, anchor.x - w - 12);
    const top = Math.min(Math.max(12, anchor.y - 24), Math.max(12, vh - h - 12));
    setPos({ left, top });
  }, [anchor.x, anchor.y, dataKey]);

  useEffect(() => {
    returnFocus.current = document.activeElement;
    const node = ref.current;
    node?.querySelector<HTMLElement>('input, button:not([data-rs-pop-close]), [tabindex="0"]')?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (node && !node.contains(target) && !(target as HTMLElement).closest?.('[data-rs-rail-step], .rs-page, .ui-select-menu, [role="listbox"]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
      if (returnFocus.current instanceof HTMLElement) returnFocus.current.focus({ preventScroll: true });
    };
  }, [onClose, dataKey]);

  return (
    <div ref={ref} className="rs-pop" role="dialog" aria-label={title} style={{ left: pos.left, top: pos.top }} data-rs-popover={dataKey}>
      <div className="rs-pop-head">
        <span className="rs-step-title flex-1">{title}</span>
        <button type="button" className="rs-link" onClick={onOpenInSidebar}>{openInSidebarLabel}</button>
        <button type="button" className="rs-icon-btn" onClick={onClose} aria-label={closeLabel} title={closeLabel} data-rs-pop-close>
          <Icon id="ui.close" size={16} />
        </button>
      </div>
      <div className="rs-pop-scroll">{children}</div>
    </div>
  );
}

/** Na "Standaard": een korte melding met "Ongedaan maken" (verdwijnt na 8 s). */
function UndoToast({ text, undoLabel, onUndo, onDismiss }: { text: string; undoLabel: string; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(timer);
  }, [text, onDismiss]);
  return (
    <div className="rs-undo" role="status" data-rs-undo>
      <span>{text}</span>
      <button type="button" onClick={onUndo} data-rs-undo-button>{undoLabel}</button>
    </div>
  );
}
