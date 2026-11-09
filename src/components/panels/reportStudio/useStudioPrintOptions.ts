import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/state/appStore';
import { useEffectiveDurationDisplay, useProfileCountsWorkdays } from '@/hooks/useDurationMeasure';
import { useFieldCatalogCtx } from '@/components/viewControls/useFieldCatalogCtx';
import {
  buildPrintRows, measureTableColumnWidths, measureTaskNameColumnWidth, nameCellFont,
  type PrintOptions, type PrintTableColumn, type TableColumnWidths, type TableHeaderLabels,
} from '@/services/print/printPreview';
import { getLocalizedMonths, getLocalizedMonthsShort } from '@/i18n/dateFormat';
import { durationSuffixesFrom } from '@/utils/taskDuration';
import { buildBaselineLayers, buildBaselineOverlay, comparisonOverlays } from '@/types/baseline';
import { knownDrivingSequenceIds } from '@/engine/scheduler/drivingInfo';
import type { ReportTextMetrics } from '@/services/pdf/reportTextMeasure';
import type { ReportSettings } from '@/utils/reportSettings';
import { reportFontStack, type ReportFontId } from '@/services/pdf/reportFont';

/** De rapportletter die geladen is, met zijn meting (dezelfde als de vector-PDF, `loadReportTextMetrics`). */
export interface StudioFont {
  id: ReportFontId;
  metrics: ReportTextMetrics;
}

/**
 * De `PrintOptions` van de Gantt-afdruk voor het nieuwe Rapport-tabblad. Dezelfde velden en dezelfde
 * vertaalde teksten als het oude paneel (`ReportPanel.tsx`, type `gantt`), plus de kolomlijst
 * (`tableColumns`, issue #817 deel B). De kolombreedtes en (bij niet afkappen) de naamkolom worden hier
 * gemeten op de geladen rapportletter — meten hoort in het paneel, niet in de printlaag (`reports.md`).
 *
 * `font`: de rapportletter die geladen is (#770), met de meting van de PDF; `null` zolang er nog geen
 * letter geladen is, dan geeft de hook geen opties. Meten, tekenen en de PDF gebruiken dezelfde stack
 * (`reportFontStack`) en dezelfde meting (`reportTextMeasure.ts`), dus een kolom die hier past, past ook
 * in de PDF.
 */
export function useStudioPrintOptions(
  settings: ReportSettings,
  companyName: string,
  tableColumns: readonly PrintTableColumn[],
  font: StudioFont | null,
): PrintOptions | null {
  const { t } = useTranslation('report');
  const { t: tCommon, i18n } = useTranslation('common');
  const { t: tTask } = useTranslation('task');
  const tasks = useAppStore(s => s.tasks);
  const calendar = useAppStore(s => s.calendar);
  const calendars = useAppStore(s => s.calendars);
  const project = useAppStore(s => s.project);
  const dateNotation = useAppStore(s => s.ui.dateNotation);
  const timeNotation = useAppStore(s => s.ui.timeNotation);
  const weekStartDay = useAppStore(s => s.ui.weekStartDay);
  const cpmResult = useAppStore(s => s.cpmResult);
  const viewRows = useAppStore(s => s.viewRows);
  const resources = useAppStore(s => s.resources);
  const assignments = useAppStore(s => s.assignments);
  const baselines = useAppStore(s => s.baselines);
  const activeBaselineId = useAppStore(s => s.activeBaselineId);
  const comparedBaselineIds = useAppStore(s => s.comparedBaselineIds);
  const barColorSelection = useAppStore(s => s.ui.barColorSelection);
  const durationDisplay = useEffectiveDurationDisplay();
  const workdayDurationMeasure = useProfileCountsWorkdays();
  const durationSuffixes = useMemo(() => durationSuffixesFrom(tCommon), [tCommon]);
  const fieldCtx = useFieldCatalogCtx();
  const taskTypeLabelsSignature = JSON.stringify(fieldCtx.taskTypeLabels);
  const taskTypeLabels = useMemo<Record<string, string>>(
    () => JSON.parse(taskTypeLabelsSignature) as Record<string, string>,
    [taskTypeLabelsSignature],
  );
  const baselineOverlay = useMemo(() => buildBaselineOverlay(baselines, activeBaselineId), [baselines, activeBaselineId]);
  const baselineLayers = useMemo(
    () => buildBaselineLayers(baselines, activeBaselineId, comparedBaselineIds),
    [baselines, activeBaselineId, comparedBaselineIds],
  );
  const baselineComparisons = useMemo(() => comparisonOverlays(baselineLayers), [baselineLayers]);
  const baselineNames = useMemo(
    () => Object.fromEntries(baselineLayers.map(l => [l.slot, l.name])) as Partial<Record<0 | 1 | 2, string>>,
    [baselineLayers],
  );

  const locale = i18n.language;
  const daySuffix = tCommon('duration.suffixDay');
  const tableHeaders = useMemo<TableHeaderLabels>(() => ({
    wbs: t('tableHeaders.wbs'),
    taskName: t('tableHeaders.taskName'),
    unitsPerDay: t('tableHeaders.unitsPerDay'),
    curve: t('tableHeaders.curve'),
    start: t('tableHeaders.start'),
    end: t('tableHeaders.end'),
    duration: t('tableHeaders.duration'),
    completion: t('tableHeaders.completion', { defaultValue: 'Volt.' }),
  }), [t]);

  const reportRows = settings.followView ? viewRows : undefined;
  const fontReady = font !== null;
  const fontStack = reportFontStack(font?.id ?? 'inter');
  const metrics = font?.metrics ?? null;

  // Naamkolom: afkappen op de instelbare breedte, of zo breed als de langste naam (gemeten).
  const autoNameWidth = useMemo(() => {
    if (!metrics || settings.truncateTaskNames) return undefined;
    return measureTaskNameColumnWidth(buildPrintRows(tasks, reportRows), (text, bold) => metrics.measure(text, nameCellFont(bold, fontStack)));
  }, [metrics, settings.truncateTaskNames, tasks, reportRows, fontStack]);

  // De datakolommen en de registerkolommen, gemeten op de koppen en cellen van dít rapport.
  const columnWidths = useMemo<TableColumnWidths | undefined>(() => {
    if (!metrics) return undefined;
    return measureTableColumnWidths(
      buildPrintRows(tasks, reportRows),
      {
        showCompletion: settings.showCompletion, dateNotation, timeNotation, numberLocale: locale, tableHeaders,
        labels: { daySuffix }, durationDisplay, durationSuffixes, calendar, calendars, tableColumns,
        fontFamily: fontStack,
      },
      (text, font) => metrics.measure(text, font),
    );
  }, [metrics, tasks, reportRows, settings.showCompletion, dateNotation, timeNotation, locale, tableHeaders, daySuffix,
    durationDisplay, durationSuffixes, calendar, calendars, tableColumns, fontStack]);

  return useMemo<PrintOptions | null>(() => {
    if (!fontReady) return null;
    return {
      showCritical: settings.showCritical,
      showFloat: settings.showFloat,
      showWeekends: settings.showWeekends,
      showLegend: settings.showLegend,
      showDeps: settings.showDeps,
      showTaskNames: settings.showTaskNames,
      showCompletion: settings.showCompletion,
      showBaselineOverlay: settings.showBaselineOverlay,
      autoFit: settings.autoFit,
      customZoom: settings.customZoom,
      paperSize: settings.paperSize,
      orientation: settings.orientation,
      companyName,
      taskNameColumnWidth: settings.truncateTaskNames ? settings.taskNameColumnWidth : (autoNameWidth ?? settings.taskNameColumnWidth),
      labels: {
        noTasks: t('noTasks'),
        printed: t('printed'),
        legend: {
          criticalPath: t('legend.criticalPath'),
          normal: t('legend.normal'),
          nearCritical: tTask('table.isNearCritical'),
          baseline: t('legend.baseline'),
          milestone: t('legend.milestone'),
          summary: t('legend.summary'),
          float: t('legend.float'),
          completion: t('legend.completion'),
          relationStyle: t('legend.relationStyle'),
        },
        tableHeaders,
        today: t('today', { defaultValue: 'Vandaag' }),
        statusDate: t('statusDateLabel', { defaultValue: 'Statusdatum' }),
        progressDate: t('progressDateLabel', { defaultValue: 'Voortgangsdatum' }),
        projectStart: t('projectStart'),
        projectEnd: t('projectEnd'),
        projectDuration: t('projectDuration'),
        daySuffix,
      },
      localizedMonths: getLocalizedMonths(locale),
      localizedMonthsShort: getLocalizedMonthsShort(locale),
      locale,
      projectStartDate: project.startDate,
      projectEndDate: project.endDate,
      projectAuthor: project.author,
      dateNotation,
      timeNotation,
      weekStartDay,
      compressNonWorkdays: settings.compressNonWorkdays,
      timelineColumns: settings.timelineColumns,
      reportFontScale: settings.reportFontScale,
      fontFamily: fontStack,
      drivingSequenceIds: knownDrivingSequenceIds(cpmResult),
      barColorSelection,
      activityCodeTypes: fieldCtx.activityCodeTypes,
      customFieldDefs: fieldCtx.customFieldDefs,
      taskTypeLabels,
      barColorNoneLabel: tTask('structure.none'),
      statusLine: settings.statusLine,
      statusDate: project.statusDate,
      resources,
      assignments,
      baselineOverlay,
      baselineComparisons,
      baselineNames,
      rows: reportRows,
      columnWidths,
      tableColumns,
      numberLocale: locale,
      durationDisplay,
      durationSuffixes,
      calendars,
      workdayDurationMeasure,
      barColorsLegendLabels: {
        criticalOutline: t('legend.criticalOutline', { defaultValue: 'Kritiek pad (rand)' }),
        categoriesMore: (count: number) => t('legend.categoriesMore', { count }),
      },
    };
    // Alleen de velden die op het papier staan: de zijbalkstand of de kolomlijst zelf (die via
    // `tableColumns` binnenkomt) mag geen nieuwe opname veroorzaken.
  }, [fontReady, settings.showCritical, settings.showFloat, settings.showWeekends, settings.showLegend, settings.showDeps,
    settings.showTaskNames, settings.showCompletion, settings.showBaselineOverlay, settings.autoFit, settings.customZoom,
    settings.paperSize, settings.orientation, settings.truncateTaskNames, settings.taskNameColumnWidth,
    settings.compressNonWorkdays, settings.timelineColumns, settings.reportFontScale, settings.statusLine,
    companyName, autoNameWidth, t, tTask, tableHeaders, daySuffix, locale, project.startDate,
    project.endDate, project.author, project.statusDate, dateNotation, timeNotation, weekStartDay, cpmResult, barColorSelection,
    fieldCtx.activityCodeTypes, fieldCtx.customFieldDefs, taskTypeLabels, resources, assignments, baselineOverlay,
    baselineComparisons, baselineNames, reportRows, columnWidths, tableColumns, durationDisplay, durationSuffixes, calendars,
    workdayDurationMeasure, fontStack]);
}
