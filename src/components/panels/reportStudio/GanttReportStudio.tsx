import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconId } from '@/components/icons';
import { useAppStore } from '@/state/appStore';
import { Select } from '@/components/common/Select';
import { HelpButton } from '@/components/common/HelpButton';
import { REPORT_HELP_ARTICLE_ID } from '@/state/helpArticles';
import { ensureReportFontLoaded, loadReportTextMetrics } from '@/services/pdf/fontLoader';
import { DEFAULT_REPORT_FONT_ID } from '@/services/pdf/reportFont';
import { saveBytesDialog } from '@/services/fileAccess';
import { buildGanttReportPdf } from '@/services/print/exportGanttReportPdf';
import {
  fixedScaleStartDayWidth, NAME_COLUMN_WIDTH_MAX, NAME_COLUMN_WIDTH_MIN, REPORT_FONT_SCALES, REPORT_MAX_ZOOM, REPORT_MIN_DAY_WIDTH,
  type PrintTableColumn,
} from '@/services/print/printPreview';
import { printableWidthLogicalPx } from '@/services/print/tileLayout';
import { documentFileBase } from '@/utils/documents';
import { localTodayIso } from '@/utils/dateUtils';
import { DateTextInput } from '@/components/common/DateTextInput';
import { documentProjectCode } from '@/utils/documentProjectCode';
import { nameWithProjectCode } from '@/utils/projectCodeName';
import { scheduleErrorText } from '@/i18n/scheduleErrors';
import { RTL_LOCALES, type Locale } from '@/i18n/config';
import { useFieldCatalogCtx } from '@/components/viewControls/useFieldCatalogCtx';
import { barColorFieldOptions, effectiveBarColorControl } from '@/components/viewControls/barColorFieldOptions';
import { decodeFieldRef, encodeFieldRef } from '@/components/viewControls/fieldRefCodec';
import type { TaskColumnCategory } from '@/types/taskGrid';
import {
  REPORT_STUDIO_STEPS, saveReportSettings, TABLE_REPORT_TYPES, type ReportSettings, type ReportStudioStep, type ReportType,
} from '@/utils/reportSettings';
import { ReportFontSelect } from '@/components/panels/reports/reportFormPrimitives';
import { PaperBanner, StudioChoiceGroup, StudioGroup, StudioNotice, StudioSegmented, StudioStepScroll, StudioSwitch } from './studioPrimitives';
import { StepHead, StepPopover, UndoToast } from './studioChrome';
import { fieldsAreDefault, useStudioSettings, type StudioSettingKey } from './useStudioSettings';
import { useStudioPrintOptions, type StudioFont } from './useStudioPrintOptions';
import { useReportColumnDomain } from './useReportColumnDomain';
import { BUILTIN_REPORT_COLUMNS, isDefaultReportColumns, resolveReportColumns } from './reportColumns';
import type { PaperPick, PaperTarget } from './ReportPaperView';
import { samePaperInfo, StudioPaper, type PaperInfo } from './StudioPaper';
import { ColumnsEditor } from './ColumnsEditor';
import { markReportInput } from './studioPerf';
import './reportStudio.css';

/** De stappen van de zijbalk, in de volgorde van het papier. */
export type StudioStepId = ReportStudioStep;
const STEP_ORDER: readonly StudioStepId[] = REPORT_STUDIO_STEPS;
/**
 * De zwevende exportknop (zijbalk ingeklapt) staat `FAB_INSET` px van de rand van het papiervlak en
 * houdt onderaan `FAB_RESERVE` px. Raakt het blad die hoek, dan stopt het papier boven die strook; zo
 * bedekt de knop nooit inhoud (`ReportPaperView`). Zelfde maten als `.rs-fab` in reportStudio.css.
 */
const FAB_INSET = 16;
const FAB_GAP = 12;
const FAB_RESERVE = 64;
/** Logische px naar millimeter op papier (96 px per inch, 25,4 mm per inch). */
const MM_PER_PX = 25.4 / 96;
/** De schuif voor de breedte per dag loopt logaritmisch: elke stap is hetzelfde deel breder. */
const DAY_SLIDER_STEPS = 200;
const daySliderPos = (px: number) => Math.round(
  (Math.log(Math.max(REPORT_MIN_DAY_WIDTH, px) / REPORT_MIN_DAY_WIDTH) / Math.log(REPORT_MAX_ZOOM / REPORT_MIN_DAY_WIDTH)) * DAY_SLIDER_STEPS,
);
const daySliderValue = (pos: number) => REPORT_MIN_DAY_WIDTH * (REPORT_MAX_ZOOM / REPORT_MIN_DAY_WIDTH) ** (pos / DAY_SLIDER_STEPS);

/** Welke velden "Standaard" per stap terugzet. */
const STEP_KEYS: Record<StudioStepId, readonly StudioSettingKey[]> = {
  tasks: ['followView'],
  columns: ['columns', 'truncateTaskNames', 'taskNameColumnWidth'],
  bars: ['showTaskNames', 'showCompletion', 'showFloat', 'showBaselineOverlay', 'showDeps', 'showCritical', 'statusLine', 'showWeekends', 'compressNonWorkdays'],
  page: ['paperSize', 'orientation', 'autoFit', 'customZoom', 'timelineColumns', 'reportFontFamily', 'reportFontScale'],
  headerFooter: ['repeatHeader', 'repeatFooter', 'showLegend'],
};

/** B2-iconen per stap, gekozen op functie (B2 heeft geen eigen iconen voor kop/voet of papier). */
const STEP_ICONS: Record<StudioStepId, IconId> = {
  tasks: 'layout.task-tree', columns: 'table.columns', bars: 'planning.gantt', page: 'report.print-entry',
  headerFooter: 'project.properties',
};

/** Welk deel van het papier bij een stap hoort (gemarkeerd zolang de stap open is). */
const STEP_TARGETS: Record<StudioStepId, PaperTarget[]> = {
  tasks: [], columns: ['columns'], bars: ['chart'], page: ['page'], headerFooter: ['header', 'footer'],
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
 * papier volgen, met onderaan het bestand en de knop PDF exporteren; rechts het papier als SVG, waarop
 * elk deel oplicht en bij een klik zijn stap opent. Is de zijbalk ingeklapt, dan opent dezelfde
 * stapinhoud als klein venster naast dat deel: één bron van bediening, twee wegen ernaartoe.
 */
export function GanttReportStudio({ onReportTypeChange }: { onReportTypeChange: (type: ReportType) => void }) {
  const { t } = useTranslation('report');
  const { t: tCommon, i18n } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  const api = useStudioSettings();
  const { settings, patch, remember, hydrated } = api;

  const tasks = useAppStore(s => s.tasks);
  const sequences = useAppStore(s => s.sequences);
  const calendar = useAppStore(s => s.calendar);
  const project = useAppStore(s => s.project);
  const viewRows = useAppStore(s => s.viewRows);
  const scheduleStale = useAppStore(s => s.scheduleStale);
  const scheduleError = useAppStore(s => s.cpmResult?.error);
  const scheduleErrorInfo = useAppStore(s => s.cpmResult?.errorInfo);
  const setStatusDate = useAppStore(s => s.setStatusDate);
  const barColorSelection = useAppStore(s => s.ui.barColorSelection);
  const setOverlays = useAppStore(s => s.setOverlays);
  const gridColumns = useAppStore(s => s.taskGridSurfaces['gantt-task-grid'].columns);
  const projectCode = useAppStore(s => documentProjectCode(s.project, s.xerImportMetadata));
  const projectName = nameWithProjectCode(project.name, projectCode) || tCommon('project.untitled');
  const fileBase = documentFileBase(project.name, projectCode);
  const fileName = `${fileBase}-${t('fileSuffix.gantt')}.pdf`;
  const rtl = RTL_LOCALES.includes(i18n.language as Locale);
  const listSep = t('studio.listSep');

  // De rapportletter (#770). Meten en tekenen gebeuren op de letter die al geladen is; na een wissel
  // blijft het papier op de vorige letter staan tot de nieuwe geladen is (beide laders wijzen nooit af).
  // Twee dingen per letter: de `@font-face` waarmee de browser de SVG-tekst tekent, en de lettermaten
  // uit hetzelfde fontbestand waarmee het papier, de kolombreedtes en de PDF meten (`reportTextMeasure.ts`).
  const [loadedFont, setLoadedFont] = useState<StudioFont | null>(null);
  const chosenFont = settings.reportFontFamily;
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void Promise.all([ensureReportFontLoaded(chosenFont), loadReportTextMetrics(chosenFont, rtl ? 'rtl' : 'ltr')])
      .then(([, metrics]) => { if (!cancelled) setLoadedFont({ id: chosenFont, metrics }); });
    return () => { cancelled = true; };
  }, [hydrated, chosenFont, rtl]);
  const fontReady = loadedFont !== null;
  const fontPending = loadedFont?.id !== chosenFont;

  // De bedrijfsnaam komt uit het project en wordt bewust niet per apparaat bewaard (zie reportSettings.ts).
  const [companyName, setCompanyName] = useState(project.company || '');

  // ---- Kolommen ------------------------------------------------------------------------------------
  const { domain, labelForColumn } = useReportColumnDomain();
  // De celteksten van een registerkolom blijven bewaard zolang taken en register gelijk zijn: een kolom
  // erbij bouwt alleen haar eigen teksten op (5000 taken).
  const columnCache = useMemo(
    () => new Map<string, PrintTableColumn>(),
    // Nieuwe cache zodra een van de bronnen van de celteksten verandert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [domain, tasks, labelForColumn],
  );
  const resolved = useMemo(
    () => resolveReportColumns(settings.columns, domain, tasks, labelForColumn, columnCache),
    [settings.columns, domain, tasks, labelForColumn, columnCache],
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
  const options = useStudioPrintOptions(settings, companyName, resolved.columns, hydrated ? loadedFont : null);
  const paperMetrics = loadedFont?.metrics ?? null;
  const paperInput = useMemo(() => ({
    tasks, sequences, calendar, projectName, options, metrics: paperMetrics,
    repeatHeader: settings.repeatHeader, repeatFooter: settings.repeatFooter, rtl,
  }), [tasks, sequences, calendar, projectName, options, paperMetrics, settings.repeatHeader, settings.repeatFooter, rtl]);
  // Het papier zelf rekent in `StudioPaper`; de zijbalk krijgt alleen de maten die hij toont.
  const [paperInfo, setPaperInfo] = useState<PaperInfo | null>(null);
  const onPaperInfo = useCallback((next: PaperInfo | null) => {
    setPaperInfo(prev => (samePaperInfo(prev, next) ? prev : next));
  }, []);
  const totalPages = paperInfo?.totalPages ?? 0;
  const printable = printableWidthLogicalPx(settings.paperSize.toLowerCase() as 'a4', settings.orientation);
  const tableShare = paperInfo && paperInfo.headerHeight > 0 ? paperInfo.tableWidth / printable : null;

  // ---- Stappen: open stap, zijbalk, zwevend venster --------------------------------------------------
  // De open stap staat in de instellingen: bij het eerste bezoek stap 1, daarna de laatst gebruikte.
  const openStep: StudioStepId | null = !hydrated || settings.studioStep === 'none' ? null : settings.studioStep;
  const openStepRef = useRef(openStep);
  openStepRef.current = openStep;
  const setOpenStep = useCallback((step: StudioStepId | null) => remember({ studioStep: step ?? 'none' }), [remember]);
  const [focusColumn, setFocusColumn] = useState<{ id: string; seq: number } | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const closePopover = useCallback(() => setPopover(null), []);
  const rail = settings.sidebar === 'rail';
  const headRefs = useRef(new Map<StudioStepId, HTMLButtonElement>());
  const fabRef = useRef<HTMLButtonElement>(null);

  const openStepFromPaper = useCallback((pick: PaperPick) => {
    const step = TARGET_STEP[pick.target];
    markReportInput('paper-click');
    // Wie op het papier klikt, kent de aanwijzing: die hoeft niet meer.
    remember({ paperHintSeen: true });
    // Een klik op een kolom zet de focus op die rij; een klik elders op het papier vergeet een eerdere kolom.
    setFocusColumn(pick.column ? { id: paperKeyToId(pick.column), seq: Date.now() } : null);
    if (rail) {
      setPopover({ step, anchor: pick.anchor, from: 'paper' });
    } else {
      setOpenStep(step);
      requestAnimationFrame(() => headRefs.current.get(step)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }, [rail, paperKeyToId, remember, setOpenStep]);

  // Een stap openen via de kop, "Verder" of een stapknop: de kolom van een eerdere klik op het papier krijgt
  // dan geen focus meer (die nam de focus weg van de kop of van het eerste bedienelement).
  const openStepDirect = useCallback((step: StudioStepId | null) => {
    setFocusColumn(null);
    setOpenStep(step);
  }, [setOpenStep]);

  const toggleStep = useCallback((step: StudioStepId) => {
    markReportInput('step');
    openStepDirect(openStepRef.current === step ? null : step);
  }, [openStepDirect]);

  const paperHint = useMemo(() => (hydrated && !settings.paperHintSeen ? {
    text: t('studio.paper.hint'),
    closeLabel: t('studio.paper.hintClose'),
    onClose: () => remember({ paperHintSeen: true }),
  } : null), [hydrated, settings.paperHintSeen, t, remember]);

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

  const onStepHeadKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>, step: StudioStepId) => {
    const index = STEP_ORDER.indexOf(step);
    let next: StudioStepId | undefined;
    if (e.key === 'ArrowDown') next = STEP_ORDER[(index + 1) % STEP_ORDER.length];
    else if (e.key === 'ArrowUp') next = STEP_ORDER[(index - 1 + STEP_ORDER.length) % STEP_ORDER.length];
    else if (e.key === 'Home') next = STEP_ORDER[0];
    else if (e.key === 'End') next = STEP_ORDER[STEP_ORDER.length - 1];
    if (!next) return;
    e.preventDefault();
    headRefs.current.get(next)?.focus();
  }, []);

  const registerHead = useCallback((step: StudioStepId, el: HTMLButtonElement | null) => {
    if (el) headRefs.current.set(step, el);
    else headRefs.current.delete(step);
  }, []);

  // De zwevende knop: zijn breedte bepaalt de hoek die het papier vrij laat (lange vertalingen).
  const [fabWidth, setFabWidth] = useState(0);
  useLayoutEffect(() => {
    const node = fabRef.current;
    if (!rail || !node) { setFabWidth(0); return; }
    const update = () => setFabWidth(node.offsetWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [rail]);
  const fabZone = useMemo(
    () => (rail && fabWidth > 0 ? { width: FAB_INSET + fabWidth + FAB_GAP, height: FAB_RESERVE } : null),
    [rail, fabWidth],
  );

  // ---- Export: één actie voor de knop in de zijbalk en de zwevende knop ------------------------------
  const [exportBusy, setExportBusy] = useState(false);
  // Exporteren met een fout in de planning: de balk boven het papier licht even op.
  const [errorPulse, setErrorPulse] = useState(0);
  const exportPendingRef = useRef(false);
  const latest = useRef({ options, tasks, sequences, calendar, projectName, settings, fileName, loadedFont });
  latest.current = { options, tasks, sequences, calendar, projectName, settings, fileName, loadedFont };

  const runExport = useCallback(async () => {
    if (useAppStore.getState().cpmResult?.error) {
      setErrorPulse(n => n + 1);
      return;
    }
    const cur = latest.current;
    if (!cur.options) return;
    setExportBusy(true);
    try {
      const bytes = await buildGanttReportPdf({
        tasks: cur.tasks, sequences: cur.sequences, calendar: cur.calendar, projectName: cur.projectName,
        options: cur.options, repeatHeader: cur.settings.repeatHeader, repeatFooter: cur.settings.repeatFooter,
        // Dezelfde letter als waarop `options` gemeten is.
        fontId: cur.loadedFont?.id ?? DEFAULT_REPORT_FONT_ID,
      });
      await saveBytesDialog(cur.fileName, bytes, [{ name: 'PDF Document', extensions: ['pdf'] }], { mime: 'application/pdf' });
    } catch (err) {
      useAppStore.getState().notify({ severity: 'error', messageKey: 'notifications.saveFailed', detail: (err as Error).message });
    } finally {
      setExportBusy(false);
    }
  }, []);

  const exportPdf = useCallback(() => {
    if (exportBusy) return;
    const st = useAppStore.getState();
    // Een verouderde planning eerst doorrekenen; exporteren pas ná de render met de nieuwe waarden.
    if (st.scheduleStale) {
      exportPendingRef.current = true;
      st.runCPM();
      return;
    }
    // Net een andere letter gekozen: wachten tot hij geladen en gemeten is. Anders tekent de PDF de nieuwe
    // letter op de breedtes van de vorige en kapt hij namen af (zelfde reden als `measuredOnChosenFont`
    // in het oude paneel).
    if (fontPending) {
      exportPendingRef.current = true;
      return;
    }
    void runExport();
  }, [exportBusy, runExport, fontPending]);

  useEffect(() => {
    if (!exportPendingRef.current || scheduleStale || fontPending) return;
    exportPendingRef.current = false;
    void runExport();
  }, [scheduleStale, fontPending, runExport, options]);

  // "Nu doorrekenen": dezelfde actie als F5 (en de knop Bereken). Het papier volgt vanzelf. Een gekozen
  // statusdatum rekent via dezelfde weg door: anders verschijnt meteen de balk "niet doorgerekend".
  const recalculateReport = useCallback((input = 'recalculate') => {
    markReportInput(input);
    useAppStore.getState().recalculate();
  }, []);
  const chooseStatusDate = useCallback((date: string) => {
    setStatusDate(date);
    recalculateReport('statusDate');
  }, [setStatusDate, recalculateReport]);

  // Boven het papier: de planning is niet doorgerekend (dan wijkt het papier af van de PDF, die eerst
  // doorrekent), of heeft een fout (dan lukt exporteren niet).
  const banner = scheduleStale ? (
    <PaperBanner
      tone="warn"
      dataKey="stale"
      action={<button type="button" className="rs-btn" onClick={() => recalculateReport()} data-rs-recalculate>{t('studio.stale.action')}</button>}
    >
      {t('studio.stale.text')}
    </PaperBanner>
  ) : scheduleError ? (
    <div key={errorPulse} className="rs-banner-pulse">
      <PaperBanner tone="error" dataKey="schedule-error">
        {t('studio.export.error', { error: scheduleErrorText({ error: scheduleError, errorInfo: scheduleErrorInfo }, tCommon) })}
      </PaperBanner>
    </div>
  ) : null;

  // ---- Samenvattingen per stap ---------------------------------------------------------------------
  const paperLabel = t('studio.page.paperLabel', {
    paper: settings.paperSize,
    orientation: t(settings.orientation === 'landscape' ? 'studio.page.landscape' : 'studio.page.portrait').toLocaleLowerCase(i18n.language),
  });
  const shownRows = settings.followView ? viewRows.length : tasks.length;
  const rowsSummary = settings.followView ? t('studio.tasks.summaryView', { count: shownRows }) : t('studio.tasks.summaryAll', { count: shownRows });
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
  const sharePct = Math.round((tableShare ?? 0) * 100);
  const statusLineWithoutDate = settings.statusLine !== 'none' && !project.statusDate;
  const summaries: Record<StudioStepId, { text: string; warn?: boolean }> = {
    tasks: { text: rowsSummary },
    columns: {
      text: tableTooWide
        ? t('studio.columns.summaryWide', { count: resolved.columns.length, share: sharePct })
        : t('studio.columns.summaryList', {
          count: resolved.columns.length,
          list: resolved.columns.map(c => (c.builtin ? labelForId(c.key) : c.header)).join(listSep),
        }),
      warn: tableTooWide,
    },
    bars: {
      text: statusLineWithoutDate ? t('studio.bars.summaryNoStatusDate') : (onBars.length ? onBars.join(listSep) : t('studio.bars.summaryNone')),
      warn: statusLineWithoutDate,
    },
    page: {
      // Het aantal pagina's staat in de werkbalk boven het papier, niet ook hier.
      text: [
        paperLabel,
        !settings.autoFit && t('studio.page.fixedScale').toLocaleLowerCase(i18n.language),
        settings.reportFontFamily !== DEFAULT_REPORT_FONT_ID && t(`reportFontFamily.${settings.reportFontFamily}`),
        settings.reportFontScale !== 100 && `${settings.reportFontScale} %`,
      ].filter((v): v is string => typeof v === 'string').join(listSep),
      warn: tableTooWide,
    },
    headerFooter: {
      text: settings.repeatHeader && settings.repeatFooter
        ? t('studio.headerFooter.summaryEvery')
        : settings.repeatHeader ? t('studio.headerFooter.summaryHeaderOnly')
          : settings.repeatFooter ? t('studio.headerFooter.summaryFooterOnly') : t('studio.headerFooter.summaryOnce'),
    },
  };

  const regionLabel = useCallback((target: PaperTarget) => t(`studio.region.${target}`), [t]);
  const columnLabelForPaper = useCallback((key: string) => {
    const id = paperKeyToId(key);
    return labelForId(id);
  }, [paperKeyToId, labelForId]);

  // Breedtes in millimeter op papier: de tabel staat op 0,75 pt per logische px, maal de lettergrootte.
  const mm = (px: number, fmt: Intl.NumberFormatOptions) => t('studio.mm', { value: (px * MM_PER_PX).toLocaleString(i18n.language, fmt) });
  const nameWidthText = mm(settings.taskNameColumnWidth * settings.reportFontScale / 100, { maximumFractionDigits: 0 });
  const dayWidthText = t('studio.page.perDay', { value: mm(settings.customZoom, { maximumSignificantDigits: 2 }) });

  // Veel pagina's: het advies hangt af van waar de bladen vandaan komen. Eén blad breed ⇒ de rijen.
  const manyPages = totalPages >= MANY_PAGES && paperInfo !== null;
  const atMinDayWidth = settings.customZoom <= REPORT_MIN_DAY_WIDTH * 1.0001;
  const manyPagesText = !paperInfo ? '' : paperInfo.cols <= 1
    ? t('studio.page.manyPagesRows', { count: totalPages, rows: paperInfo.rows })
    : settings.autoFit ? t('studio.page.manyPages', { count: totalPages })
      : atMinDayWidth ? t('studio.page.manyPagesScaleMin', { count: totalPages })
        : t('studio.page.manyPagesScale', { count: totalPages });
  const manyPagesAction = !paperInfo ? null : paperInfo.cols <= 1
    ? (!settings.followView && viewRows.length < tasks.length ? (
      <button type="button" className="rs-link" onClick={() => patch({ followView: true }, 'followView')}>{t('studio.tasks.view')}</button>
    ) : null)
    : !settings.autoFit && atMinDayWidth ? (
      <button type="button" className="rs-link" onClick={() => patch({ autoFit: true }, 'autoFit')}>{t('studio.page.fitWidth')}</button>
    ) : null;

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
                {t('studio.columns.wideWarning', { share: sharePct })}
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
                <div className="rs-field">
                  <label className="rs-field-label" htmlFor="rs-name-width">{t('studio.columns.nameWidth')}</label>
                  <div className="rs-range">
                    <input
                      id="rs-name-width"
                      type="range"
                      min={NAME_COLUMN_WIDTH_MIN}
                      max={NAME_COLUMN_WIDTH_MAX}
                      step={5}
                      value={settings.taskNameColumnWidth}
                      onChange={e => patch({ taskNameColumnWidth: Number(e.target.value) }, 'name-width')}
                      aria-valuetext={nameWidthText}
                      data-rs-option="taskNameColumnWidth"
                    />
                    <output htmlFor="rs-name-width" data-rs-value="taskNameColumnWidth">{nameWidthText}</output>
                  </div>
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
              <StudioSwitch checked={settings.showCompletion} onChange={v => patch({ showCompletion: v }, 'showCompletion')} label={t('studio.bars.completion')} title={t('studio.bars.completionSub')} dataKey="showCompletion" />
              <StudioSwitch checked={settings.showFloat} onChange={v => patch({ showFloat: v }, 'showFloat')} label={t('showFloat')} dataKey="showFloat" />
              <StudioSwitch checked={settings.showBaselineOverlay} onChange={v => patch({ showBaselineOverlay: v }, 'showBaselineOverlay')} label={t('showBaselineOverlay')} dataKey="showBaselineOverlay" />
              <div className="rs-field-row">
                <span className="rs-field-label">{t('studio.bars.colors')}</span>
                <Select
                  className="rs-select w-full min-w-0"
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
              </div>
              {barColorSelection.mode === 'category' && barColorControl.effective.mode === 'category' && (
                <Select
                  className="rs-select w-full min-w-0"
                  aria-label={t('barColorFieldLabel')}
                  value={encodeFieldRef(barColorControl.effective.field)}
                  onChange={value => { markReportInput('barColor'); setOverlays({ barColors: { mode: 'category', field: decodeFieldRef(value), colors: barColorSelection.colors } }); }}
                  options={barColorFields.map(option => ({ value: encodeFieldRef(option.field), label: option.label }))}
                />
              )}
              {barColorControl.missingField && <StudioNotice tone="info" dataKey="bar-color-missing">{t('barColorMissingField')}</StudioNotice>}
              <p className="rs-hint">{t('studio.bars.colorHint')}</p>
            </StudioGroup>
            <StudioGroup label={t('studio.bars.lines')}>
              <StudioSwitch checked={settings.showDeps} onChange={v => patch({ showDeps: v }, 'showDeps')} label={t('showDependencies')} dataKey="showDeps" />
              <StudioSwitch checked={settings.showCritical} onChange={v => patch({ showCritical: v }, 'showCritical')} label={t('showCriticalPath')} title={t('studio.bars.criticalSub')} dataKey="showCritical" />
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
              {statusLineWithoutDate && (
                <StudioNotice
                  dataKey="no-status-date"
                  actions={(
                    <>
                      <button type="button" className="rs-link" onClick={() => chooseStatusDate(localTodayIso())}
                        data-rs-status-today>
                        {t('studio.bars.statusDateToday')}
                      </button>
                      <span className="rs-inline-date">
                        <span className="rs-field-label">{t('studio.bars.statusDateOther')}</span>
                        <DateTextInput
                          value=""
                          onCommit={v => { if (v) chooseStatusDate(v); }}
                          ariaLabel={t('studio.bars.statusDateOther')}
                          className="rs-date"
                        />
                      </span>
                    </>
                  )}
                >
                  {t('statusLineHint')}
                </StudioNotice>
              )}
            </StudioGroup>
            <StudioGroup label={t('studio.bars.timeline')}>
              <StudioSwitch checked={settings.showWeekends} onChange={v => patch({ showWeekends: v }, 'showWeekends')} label={t('showWeekends')} dataKey="showWeekends" />
              <StudioSwitch checked={settings.compressNonWorkdays} onChange={v => patch({ compressNonWorkdays: v }, 'compressNonWorkdays')} label={tCommon('settings.compressNonWorkdays')} dataKey="compressNonWorkdays" />
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
              {/* Een kleiner of staand blad maakt de tabel naar verhouding breder: meld dat direct onder
                  het papier, en niet alleen in de stap Kolommen. */}
              {tableTooWide && (
                <StudioNotice
                  dataKey="table-wide-page"
                  actions={(
                    <button type="button" className="rs-link" onClick={() => { markReportInput('step'); openStepDirect('columns'); }}>
                      {t('studio.page.toColumns')}
                    </button>
                  )}
                >
                  {t('studio.columns.wideWarning', { share: sharePct })}
                </StudioNotice>
              )}
            </StudioGroup>
            <StudioGroup label={t('studio.page.fit')}>
              <StudioSegmented
                ariaLabel={t('studio.page.fit')}
                value={settings.autoFit ? 'fit' : 'scale'}
                onChange={v => {
                  // Vaste schaal begint op precies de breedte per dag die "passen" nu geeft, ook onder 1 px
                  // per dag: het aantal pagina's verandert dan niet bij de wissel.
                  if (v === 'scale' && paperInfo && paperInfo.dayWidth > 0) {
                    patch({ autoFit: false, customZoom: fixedScaleStartDayWidth(paperInfo.dayWidth) }, 'autoFit');
                  } else {
                    patch({ autoFit: v === 'fit' }, 'autoFit');
                  }
                }}
                options={[
                  { value: 'fit', label: t('studio.page.fitWidth') },
                  { value: 'scale', label: t('studio.page.fixedScale') },
                ]}
                dataKey="autoFit"
              />
              <p className="rs-hint" data-rs-fit-hint>{settings.autoFit ? t('studio.page.fitWidthHint') : t('studio.page.fixedScaleHint')}</p>
              {settings.autoFit ? (
                <div className="rs-field-row">
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
                    <input type="range" min={0} max={DAY_SLIDER_STEPS} value={daySliderPos(settings.customZoom)}
                      onChange={e => patch({ customZoom: daySliderValue(Number(e.target.value)) }, 'customZoom')}
                      aria-label={t('studio.page.dayWidth')} aria-valuetext={dayWidthText} data-rs-option="customZoom" />
                    <output data-rs-value="customZoom">{dayWidthText}</output>
                  </div>
                </div>
              )}
              {manyPages && (
                <StudioNotice dataKey="many-pages" actions={manyPagesAction}>{manyPagesText}</StudioNotice>
              )}
            </StudioGroup>
            <StudioGroup label={t('studio.page.font')}>
              <ReportFontSelect
                className="rs-select w-full min-w-0"
                value={settings.reportFontFamily}
                onChange={v => patch({ reportFontFamily: v }, 'reportFontFamily')}
              />
              <StudioSegmented
                ariaLabel={t('studio.page.fontScale')}
                value={String(settings.reportFontScale)}
                onChange={v => patch({ reportFontScale: Number(v) }, 'reportFontScale')}
                options={REPORT_FONT_SCALES.map(n => ({ value: String(n), label: `${n}%` }))}
                dataKey="reportFontScale"
              />
            </StudioGroup>
          </>
        );
      case 'headerFooter':
        return (
          <>
            <div className="rs-field">
              <label className="rs-field-label" htmlFor="rs-company">{t('studio.headerFooter.company')}</label>
              <input id="rs-company" className="rs-input" value={companyName}
                onChange={e => {
                  markReportInput('company');
                  // Na Standaard een eigen naam getypt: die wint, ongedaan maken zou hem stil wissen.
                  if (api.lastReset?.scope === 'headerFooter') api.dismissReset();
                  setCompanyName(e.target.value);
                }}
                placeholder={t('companyPlaceholder')} />
              <span className="rs-hint">{t('studio.headerFooter.companyHint')}</span>
            </div>
            <div className="rs-field-row">
              <span className="rs-field-label">{t('studio.headerFooter.author')}</span>
              <span className="rs-hint truncate">{project.author || '—'}</span>
            </div>
            <StudioGroup label={t('studio.headerFooter.repeat')}>
              <StudioSwitch checked={settings.repeatHeader} onChange={v => patch({ repeatHeader: v }, 'repeatHeader')} label={t('repeatHeader')} dataKey="repeatHeader" />
              <StudioSwitch checked={settings.repeatFooter} onChange={v => patch({ repeatFooter: v }, 'repeatFooter')} label={t('repeatFooter')} dataKey="repeatFooter" />
              <StudioSwitch checked={settings.showLegend} onChange={v => patch({ showLegend: v }, 'showLegend')} label={t('showLegend')} dataKey="showLegend" />
            </StudioGroup>
          </>
        );
    }
  };

  /** Standaard en Verder: onder de inhoud, buiten het scrollvak, dus altijd in beeld. */
  const stepFooter = (step: StudioStepId, inPopover: boolean) => {
    const keys = STEP_KEYS[step];
    const isDefault = step === 'columns'
      ? isDefaultReportColumns(settings.columns) && fieldsAreDefault(settings, ['truncateTaskNames', 'taskNameColumnWidth'])
      : step === 'headerFooter'
        ? fieldsAreDefault(settings, keys) && companyName === (project.company || '')
        : fieldsAreDefault(settings, keys);
    const index = STEP_ORDER.indexOf(step);
    const next = STEP_ORDER[index + 1];
    return (
      <div className="rs-step-foot" data-rs-step-foot={step}>
        <button
          type="button"
          className="rs-link"
          disabled={isDefault}
          onClick={() => {
            const label = t(`studio.steps.${step}`);
            if (step === 'headerFooter') {
              // De bedrijfsnaam hoort bij deze stap: ongedaan maken zet ook hem terug.
              const before = companyName;
              api.resetFields(step, keys, label, () => setCompanyName(before));
              setCompanyName(project.company || '');
            } else {
              api.resetFields(step, keys, label);
            }
          }}
          data-rs-reset={step}
        >
          {t('studio.reset')}
        </button>
        {!inPopover && next && (
          <button type="button" className="rs-next" onClick={() => { markReportInput('step'); openStepDirect(next); headRefs.current.get(next)?.focus(); }}>
            {t('studio.next', { step: t(`studio.steps.${next}`) })}
          </button>
        )}
      </div>
    );
  };

  const stepChanged = (step: StudioStepId) => (step === 'columns'
    ? !isDefaultReportColumns(settings.columns) || !fieldsAreDefault(settings, ['truncateTaskNames', 'taskNameColumnWidth'])
    : !fieldsAreDefault(settings, STEP_KEYS[step]));

  // ---- Markering op het papier ---------------------------------------------------------------------
  const activeStep = popover?.step ?? (rail ? null : openStep);
  const selectedColumn = activeStep === 'columns' && focusColumn ? focusColumnPaperKey(focusColumn.id) : undefined;
  const selected = useMemo(
    () => (activeStep ? { targets: STEP_TARGETS[activeStep], column: selectedColumn } : null),
    [activeStep, selectedColumn],
  );

  // ---- Werkbalk boven het papier: het aantal pagina's (dat zet het papier zelf). Met de zijbalk open
  // staan papier, kolommen en taken in de stappen; ingeklapt staan ze hier, omdat de rand ze niet toont.
  const columnsSummary = t('studio.columns.summary', { count: resolved.columns.length });
  const statusItems = useMemo(() => (rail ? [paperLabel, columnsSummary, rowsSummary] : []), [rail, paperLabel, columnsSummary, rowsSummary]);
  const paperActions = useMemo(() => (rail ? <HelpButton articleId={REPORT_HELP_ARTICLE_ID} /> : undefined), [rail]);

  const reportTypeSelect = (
    <Select
      className="rs-select w-full min-w-0"
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

  const exportIcon = <Icon id={exportBusy ? 'status.busy' : 'file.export'} size={16} mono className={exportBusy ? 'animate-spin' : undefined} />;
  const exportLabel = exportBusy ? t('studio.export.busy') : t('studio.export.button');
  const exportTitle = `${fileName}\n${t('studio.export.vectorHint')}`;

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
              {STEP_ORDER.map((step, i) => (
                <button
                  key={step}
                  type="button"
                  className="rs-rail-btn"
                  aria-expanded={popover?.step === step}
                  aria-label={`${i + 1}. ${t(`studio.steps.${step}`)} — ${summaries[step].text}`}
                  title={`${i + 1}. ${t(`studio.steps.${step}`)}\n${summaries[step].text}`}
                  data-tooltip-lead
                  data-changed={stepChanged(step) ? 'true' : undefined}
                  data-warn={summaries[step].warn ? 'true' : undefined}
                  data-rs-rail-step={step}
                  onClick={e => {
                    markReportInput('step');
                    setFocusColumn(null);
                    const rect = e.currentTarget.getBoundingClientRect();
                    setPopover(prev => (prev?.step === step ? null : { step, anchor: { x: rect.right + 8, y: rect.top }, from: 'rail' }));
                  }}
                >
                  <span className="rs-rail-num" aria-hidden="true">{i + 1}</span>
                  <Icon id={STEP_ICONS[step]} size={18} />
                  <span className="rs-rail-label" aria-hidden="true">{t(`studio.steps.short.${step}`)}</span>
                </button>
              ))}
            </nav>
          </>
        ) : (
          <>
            <div className="rs-sidebar-head">
              <div className="min-w-0 flex-1">{reportTypeSelect}</div>
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
                    <StepHead
                      step={step}
                      index={i}
                      open={open}
                      title={t(`studio.steps.${step}`)}
                      summary={summary.text}
                      warn={!!summary.warn}
                      changed={stepChanged(step)}
                      onToggle={toggleStep}
                      onKeyDown={onStepHeadKeyDown}
                      register={registerHead}
                    />
                    {open && (
                      <>
                        <StudioStepScroll className="rs-step-body" id={`rs-step-${step}`} data-rs-step-body={step}>
                          {stepContent(step)}
                        </StudioStepScroll>
                        {stepFooter(step, false)}
                      </>
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
              <div className="rs-foot-file" title={fileName} data-rs-export-file>
                <span className="rs-foot-label">{t('studio.export.file')}</span>
                <span className="rs-foot-name">{fileName}</span>
              </div>
              <button type="submit" className="rs-primary" aria-busy={exportBusy} title={exportTitle} data-rs-export>
                {exportIcon}
                {exportLabel}
              </button>
            </form>
          </>
        )}
      </aside>

      <StudioPaper
        input={paperInput}
        loading={!hydrated || !fontReady || !options}
        selected={selected}
        onPick={openStepFromPaper}
        regionLabel={regionLabel}
        columnLabel={columnLabelForPaper}
        statusItems={statusItems}
        actions={paperActions}
        onInfo={onPaperInfo}
        fabZone={fabZone}
        hint={paperHint}
        banner={banner}
      />

      {/* Zijbalk ingeklapt: exporteren via de zwevende knop linksonder (besluit eigenaar 7-11-2026). Dezelfde
          actie als de knop onderaan de open zijbalk. */}
      {rail && (
        <button
          ref={fabRef}
          type="button"
          className="rs-fab"
          onClick={exportPdf}
          aria-busy={exportBusy}
          title={exportTitle}
          data-rs-fab-export
        >
          {exportIcon}
          <span>{exportLabel}</span>
        </button>
      )}

      {popover && (
        <StepPopover
          anchor={popover.anchor}
          title={`${STEP_ORDER.indexOf(popover.step) + 1}. ${t(`studio.steps.${popover.step}`)}`}
          closeLabel={t('studio.close')}
          openInSidebarLabel={t('studio.openInSidebar')}
          onClose={closePopover}
          onOpenInSidebar={() => { const step = popover.step; setPopover(null); setOpenStep(step); patch({ sidebar: 'open' }, 'sidebar'); }}
          dataKey={popover.step}
        >
          <StudioStepScroll className="rs-step-body rs-pop-scroll" data-rs-pop-body>
            {stepContent(popover.step)}
          </StudioStepScroll>
          {stepFooter(popover.step, true)}
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
