import { readLocal, tryReadLocal, writeLocal } from '@/utils/settingsStore';
import { snapToChoice } from '@/utils/numberChoice';
import { parseBoolean, parseClampedInt, parseClampedNumber, parseEnum } from '@/utils/settingParsers';
import { parseBarColorSelection } from '@/utils/barColorSettings';
import { DEFAULT_BAR_COLOR_SELECTION, type BarColorSelection } from '@/types/barColor';
import { NAME_COLUMN_WIDTH_DEFAULT, NAME_COLUMN_WIDTH_MAX, NAME_COLUMN_WIDTH_MIN, REPORT_FONT_SCALES, REPORT_MAX_ZOOM, REPORT_MIN_DAY_WIDTH } from '@/services/print/printPreview';
import {
  REPORTING_PERIOD_PRESETS, type ReportingPeriod, isIsoDay, weeksToPreset,
} from '@/engine/reports/reportingPeriod';
import type { ResourceLoadingBucket } from '@/engine/reports/resourceLoading';
import { DEFAULT_REPORT_FONT_ID, REPORT_FONT_IDS, type ReportFontChoice } from '@/services/pdf/reportFont';
import { RESOURCE_DIAGRAM_LAYOUT_ID } from '@/engine/view/layoutPresets';

const LOCAL_KEY = 'ops-reportSettings';

export type ReportType =
  | 'gantt'
  | 'resourceGantt'
  | 'milestones' | 'variance'
  | 'lookAhead' | 'critical' | 'progress' | 'health' | 'resourceLoading' | 'resourceAssignments' | 'wbsSummary'
  | 'progressCurve';

export const TABLE_REPORT_TYPES: readonly ReportType[] = [
  'lookAhead', 'critical', 'progress', 'progressCurve', 'health', 'resourceLoading', 'resourceAssignments', 'wbsSummary',
];

export function isTableReportType(type: ReportType): boolean {
  return TABLE_REPORT_TYPES.includes(type);
}

export interface TableReportOptions {
  lookAheadPeriod: ReportingPeriod;
  nearCriticalDays: number;
  progressPeriod: ReportingPeriod;
  healthHighFloatDays: number;
  healthLongDurationDays: number;
  healthLagDays: number;
  resourceLoadPeriod: ReportingPeriod;
  resourceLoadBucket: ResourceLoadingBucket;
  resourceLoadOnlyOverloaded: boolean;
  resourceAssignmentPeriod: ReportingPeriod;
  resourceAssignmentIncludeCompleted: boolean;
  wbsSummaryLevel: number;
  wbsSummaryIncludeActivities: boolean;
}

export const DEFAULT_TABLE_REPORT_OPTIONS: TableReportOptions = {
  lookAheadPeriod: { preset: 'nextMonth' },
  nearCriticalDays: 5,
  progressPeriod: { preset: 'lastMonth' },
  healthHighFloatDays: 44,
  healthLongDurationDays: 44,
  healthLagDays: 10,
  resourceLoadPeriod: { preset: 'project' },
  resourceLoadBucket: 'week',
  resourceLoadOnlyOverloaded: false,
  resourceAssignmentPeriod: { preset: 'project' },
  resourceAssignmentIncludeCompleted: false,
  wbsSummaryLevel: 2,
  wbsSummaryIncludeActivities: false,
};

export const TABLE_REPORT_PERIOD_KEYS = ['lookAheadPeriod', 'progressPeriod', 'resourceLoadPeriod', 'resourceAssignmentPeriod'] as const;
export type TableReportPeriodKey = (typeof TABLE_REPORT_PERIOD_KEYS)[number];

export interface ResourceGanttReportOptions {
  pageBreakPerResource: boolean;
  includeUnassigned: boolean;
  groupByType: boolean;
  showAssignmentColumns: boolean;
}

export const DEFAULT_RESOURCE_GANTT_OPTIONS: ResourceGanttReportOptions = {
  pageBreakPerResource: false,
  includeUnassigned: false,
  groupByType: false,
  showAssignmentColumns: true,
};

export const TABLE_REPORT_LIMITS = {
  nearCriticalDays: { min: 0, max: 60 },
  thresholdDays: { min: 1, max: 365 },
  lagDays: { min: 0, max: 365 },
  wbsLevel: { min: 0, max: 8 },
} as const;
export type ReportPaperSize = 'A4' | 'A3' | 'A2' | 'A1';
export type ReportOrientation = 'landscape' | 'portrait';

export const REPORT_DEFAULT_COLUMNS: readonly string[] = [
  'task.wbsCode', 'task.name', 'task.time.scheduleDuration', 'task.time.start', 'task.time.finish', 'task.time.completion',
];
export const REPORT_REQUIRED_COLUMN = 'task.name';
export const REPORT_MAX_COLUMNS = 24;

export type ReportSidebarMode = 'open' | 'rail';

export const REPORT_STUDIO_STEPS = ['tasks', 'columns', 'bars', 'page', 'headerFooter'] as const;
export type ReportStudioStep = typeof REPORT_STUDIO_STEPS[number];

export interface ReportSettings {
  reportType: ReportType;
  showCritical: boolean;
  showFloat: boolean;
  showDeps: boolean;
  showWeekends: boolean;
  compressNonWorkdays: boolean;
  showLegend: boolean;
  showTaskNames: boolean;
  showCompletion: boolean;
  showBarDates: boolean;
  truncateTaskNames: boolean;
  taskNameColumnWidth: number;
  showBaselineOverlay: boolean;
  autoFit: boolean;
  customZoom: number;
  paperSize: ReportPaperSize;
  orientation: ReportOrientation;
  repeatHeader: boolean;
  repeatFooter: boolean;
  timelineColumns: number;
  reportFontScale: number;
  reportFontFamily: ReportFontChoice;
  customReportFont: CustomReportFontRef | null;
  statusLine: 'none' | 'statusDate' | 'progress';
  followView: boolean;
  layoutId: string;
  period: ReportingPeriod;
  legacyResourcePeriod?: ReportingPeriod;
  tableReports: TableReportOptions;
  resourceGantt: ResourceGanttReportOptions;
  columns: string[];
  barColors: BarColorSelection;
  sidebar: ReportSidebarMode;
  studioStep: ReportStudioStep | 'none';
  paperHintSeen: boolean;
}

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  reportType: 'gantt',
  showCritical: true,
  showFloat: true,
  showDeps: true,
  showWeekends: true,
  compressNonWorkdays: false,
  showLegend: true,
  showTaskNames: true,
  showCompletion: true,
  showBarDates: false,
  truncateTaskNames: true,
  taskNameColumnWidth: NAME_COLUMN_WIDTH_DEFAULT,
  showBaselineOverlay: false,
  autoFit: true,
  customZoom: 22,
  paperSize: 'A3',
  orientation: 'landscape',
  repeatHeader: true,
  repeatFooter: true,
  timelineColumns: 1,
  reportFontScale: 100,
  reportFontFamily: DEFAULT_REPORT_FONT_ID,
  customReportFont: null,
  statusLine: 'none',
  followView: false,
  layoutId: '',
  period: { preset: 'project' },
  tableReports: { ...DEFAULT_TABLE_REPORT_OPTIONS },
  resourceGantt: { ...DEFAULT_RESOURCE_GANTT_OPTIONS },
  columns: [...REPORT_DEFAULT_COLUMNS],
  barColors: DEFAULT_BAR_COLOR_SELECTION,
  sidebar: 'open',
  studioStep: 'tasks',
  paperHintSeen: false,
};

export function defaultReportColumns(showCompletion: boolean): string[] {
  return REPORT_DEFAULT_COLUMNS.filter(id => showCompletion || id !== 'task.time.completion');
}

export function parseReportColumns(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 200) continue;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(value)) continue;
    if (!ids.includes(value)) ids.push(value);
    if (ids.length >= REPORT_MAX_COLUMNS) break;
  }
  if (ids.length === 0) return undefined;
  if (!ids.includes(REPORT_REQUIRED_COLUMN)) ids.unshift(REPORT_REQUIRED_COLUMN);
  return ids.slice(0, REPORT_MAX_COLUMNS);
}

export function parseReportLayoutId(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length > 200) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return undefined;
  return raw;
}

const REPORT_TYPES: readonly ReportType[] = ['gantt', 'resourceGantt', 'milestones', 'variance', ...TABLE_REPORT_TYPES];
const PAPER_SIZES: readonly ReportPaperSize[] = ['A4', 'A3', 'A2', 'A1'];
const ORIENTATIONS: readonly ReportOrientation[] = ['landscape', 'portrait'];
const STATUS_LINES: readonly ReportSettings['statusLine'][] = ['none', 'statusDate', 'progress'];
const SIDEBAR_MODES: readonly ReportSidebarMode[] = ['open', 'rail'];
const STUDIO_STEPS: readonly ReportSettings['studioStep'][] = [...REPORT_STUDIO_STEPS, 'none'];
const FONT_SCALES: readonly number[] = REPORT_FONT_SCALES;
const ZOOM_MIN = REPORT_MIN_DAY_WIDTH;
const ZOOM_MAX = REPORT_MAX_ZOOM;
const TIMELINE_COLUMNS_MIN = 1;
const TIMELINE_COLUMNS_MAX = 8;

export function parseReportingPeriod(raw: unknown, fallback: ReportingPeriod): ReportingPeriod {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback };
  const s = raw as Record<string, unknown>;
  const preset = parseEnum(REPORTING_PERIOD_PRESETS, s.preset);
  if (!preset) return { ...fallback };
  if (preset !== 'custom') return { preset };
  if (isIsoDay(s.from) && isIsoDay(s.to) && s.from <= s.to) return { preset, from: s.from, to: s.to };
  return { ...fallback };
}

function legacyWeeksPeriod(raw: unknown, direction: 'next' | 'last', zeroIsProject: boolean): ReportingPeriod | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  const n = Math.round(raw);
  if (n <= 0) return zeroIsProject ? { preset: 'project' } : undefined;
  return { preset: weeksToPreset(n, direction) };
}

const LOAD_BUCKETS: readonly ResourceLoadingBucket[] = ['week', 'month'];

export function parseTableReportOptions(raw: unknown): TableReportOptions {
  const d = DEFAULT_TABLE_REPORT_OPTIONS;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...d };
  const s = raw as Record<string, unknown>;
  const L = TABLE_REPORT_LIMITS;
  const period = (key: TableReportPeriodKey, legacy: ReportingPeriod | undefined): ReportingPeriod =>
    parseReportingPeriod(s[key], legacy ?? d[key]);
  return {
    lookAheadPeriod: period('lookAheadPeriod', legacyWeeksPeriod(s.lookAheadWeeks, 'next', false)),
    nearCriticalDays: parseClampedInt(s.nearCriticalDays, L.nearCriticalDays.min, L.nearCriticalDays.max) ?? d.nearCriticalDays,
    progressPeriod: period('progressPeriod', legacyWeeksPeriod(s.progressPeriodWeeks, 'last', false)),
    healthHighFloatDays: parseClampedInt(s.healthHighFloatDays, L.thresholdDays.min, L.thresholdDays.max) ?? d.healthHighFloatDays,
    healthLongDurationDays: parseClampedInt(s.healthLongDurationDays, L.thresholdDays.min, L.thresholdDays.max) ?? d.healthLongDurationDays,
    healthLagDays: parseClampedInt(s.healthLagDays, L.lagDays.min, L.lagDays.max) ?? d.healthLagDays,
    resourceLoadPeriod: period('resourceLoadPeriod', undefined),
    resourceLoadBucket: parseEnum(LOAD_BUCKETS, s.resourceLoadBucket) ?? d.resourceLoadBucket,
    resourceLoadOnlyOverloaded: parseBoolean(s.resourceLoadOnlyOverloaded) ?? d.resourceLoadOnlyOverloaded,
    resourceAssignmentPeriod: period('resourceAssignmentPeriod', legacyWeeksPeriod(s.resourceAssignmentWeeks, 'next', true)),
    resourceAssignmentIncludeCompleted: parseBoolean(s.resourceAssignmentIncludeCompleted) ?? d.resourceAssignmentIncludeCompleted,
    wbsSummaryLevel: parseClampedInt(s.wbsSummaryLevel, L.wbsLevel.min, L.wbsLevel.max) ?? d.wbsSummaryLevel,
    wbsSummaryIncludeActivities: parseBoolean(s.wbsSummaryIncludeActivities) ?? d.wbsSummaryIncludeActivities,
  };
}

function parseGanttPeriod(s: Record<string, unknown>): Pick<ReportSettings, 'period' | 'legacyResourcePeriod'> {
  const project: ReportingPeriod = { preset: 'project' };
  const period = s.period !== undefined ? parseReportingPeriod(s.period, project) : project;
  const pending = s.legacyResourcePeriod !== undefined ? parseReportingPeriod(s.legacyResourcePeriod, project) : undefined;
  if (pending) return pending.preset === 'project' ? { period } : { period, legacyResourcePeriod: pending };
  const rg = s.resourceGantt && typeof s.resourceGantt === 'object' ? s.resourceGantt as Record<string, unknown> : null;
  if (s.period !== undefined || rg?.period === undefined) return { period };
  const legacy = parseReportingPeriod(rg.period, project);
  if (legacy.preset === 'project') return { period };
  if (s.reportType === 'resourceGantt' || s.layoutId === RESOURCE_DIAGRAM_LAYOUT_ID) return { period: legacy };
  return { period, legacyResourcePeriod: legacy };
}

export function legacyPeriodPatch(settings: Pick<ReportSettings, 'legacyResourcePeriod'>, resourceSource: boolean): Partial<ReportSettings> | null {
  if (!settings.legacyResourcePeriod || !resourceSource) return null;
  return { period: settings.legacyResourcePeriod, legacyResourcePeriod: undefined };
}

export function periodChoicePatch(period: ReportingPeriod): Partial<ReportSettings> {
  return { period, legacyResourcePeriod: undefined };
}

function parseResourceGanttOptions(raw: unknown): ResourceGanttReportOptions {
  const d = DEFAULT_RESOURCE_GANTT_OPTIONS;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...d };
  const s = raw as Record<string, unknown>;
  return {
    pageBreakPerResource: parseBoolean(s.pageBreakPerResource) ?? d.pageBreakPerResource,
    includeUnassigned: parseBoolean(s.includeUnassigned) ?? d.includeUnassigned,
    groupByType: parseBoolean(s.groupByType) ?? d.groupByType,
    showAssignmentColumns: parseBoolean(s.showAssignmentColumns) ?? d.showAssignmentColumns,
  };
}

export interface CustomReportFontRef {
  name: string;
  rev: number;
}

function parseCustomReportFont(raw: unknown): CustomReportFontRef | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { name, rev } = raw as Record<string, unknown>;
  return typeof name === 'string' && name.trim() !== '' && typeof rev === 'number' && Number.isFinite(rev) ? { name, rev } : null;
}

export function parseReportFontChoice(raw: unknown, custom: CustomReportFontRef | null): ReportFontChoice {
  if (raw === 'custom') return custom ? 'custom' : DEFAULT_REPORT_FONT_ID;
  return parseEnum(REPORT_FONT_IDS, raw) ?? DEFAULT_REPORT_FONT_ID;
}

export function reportFontKey(settings: Pick<ReportSettings, 'reportFontFamily' | 'customReportFont'>): string {
  return settings.reportFontFamily === 'custom' ? `custom:${settings.customReportFont?.rev ?? 0}` : settings.reportFontFamily;
}

export async function loadReportSettings(): Promise<ReportSettings> {
  return readReportSettings();
}

function readReportSettings(): ReportSettings {
  return readStoredReportSettings() ?? { ...DEFAULT_REPORT_SETTINGS };
}

function readStoredReportSettings(): ReportSettings | null {
  const json = tryReadLocal(LOCAL_KEY);
  if (json === false) return null;
  let raw: unknown;
  if (json !== null) {
    try { raw = JSON.parse(json); } catch { raw = json; }
  }
  return parseReportSettings(raw);
}

function parseReportSettings(raw: unknown): ReportSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_REPORT_SETTINGS };
  const s = raw as Record<string, unknown>;
  const d = DEFAULT_REPORT_SETTINGS;
  return {
    reportType: parseEnum(REPORT_TYPES, s.reportType) ?? d.reportType,
    showCritical: parseBoolean(s.showCritical) ?? d.showCritical,
    showFloat: parseBoolean(s.showFloat) ?? d.showFloat,
    showDeps: parseBoolean(s.showDeps) ?? d.showDeps,
    showWeekends: parseBoolean(s.showWeekends) ?? d.showWeekends,
    compressNonWorkdays: parseBoolean(s.compressNonWorkdays) ?? d.compressNonWorkdays,
    showLegend: parseBoolean(s.showLegend) ?? d.showLegend,
    showTaskNames: parseBoolean(s.showTaskNames) ?? d.showTaskNames,
    showCompletion: parseBoolean(s.showCompletion) ?? d.showCompletion,
    showBarDates: parseBoolean(s.showBarDates) ?? d.showBarDates,
    truncateTaskNames: parseBoolean(s.truncateTaskNames) ?? d.truncateTaskNames,
    taskNameColumnWidth: parseClampedInt(s.taskNameColumnWidth, NAME_COLUMN_WIDTH_MIN, NAME_COLUMN_WIDTH_MAX) ?? d.taskNameColumnWidth,
    showBaselineOverlay: parseBoolean(s.showBaselineOverlay) ?? d.showBaselineOverlay,
    autoFit: parseBoolean(s.autoFit) ?? d.autoFit,
    customZoom: parseClampedNumber(s.customZoom, ZOOM_MIN, ZOOM_MAX) ?? d.customZoom,
    paperSize: parseEnum(PAPER_SIZES, s.paperSize) ?? d.paperSize,
    orientation: parseEnum(ORIENTATIONS, s.orientation) ?? d.orientation,
    repeatHeader: parseBoolean(s.repeatHeader) ?? d.repeatHeader,
    repeatFooter: parseBoolean(s.repeatFooter) ?? d.repeatFooter,
    timelineColumns: parseClampedInt(s.timelineColumns, TIMELINE_COLUMNS_MIN, TIMELINE_COLUMNS_MAX) ?? d.timelineColumns,
    reportFontScale: snapToChoice(FONT_SCALES, s.reportFontScale) ?? d.reportFontScale,
    reportFontFamily: parseReportFontChoice(s.reportFontFamily, parseCustomReportFont(s.customReportFont)),
    customReportFont: parseCustomReportFont(s.customReportFont),
    statusLine: parseEnum(STATUS_LINES, s.statusLine) ?? d.statusLine,
    followView: parseBoolean(s.followView) ?? d.followView,
    layoutId: parseReportLayoutId(s.layoutId) ?? d.layoutId,
    ...parseGanttPeriod(s),
    tableReports: parseTableReportOptions(s.tableReports),
    resourceGantt: parseResourceGanttOptions(s.resourceGantt),
    columns: parseReportColumns(s.columns) ?? defaultReportColumns(parseBoolean(s.showCompletion) ?? d.showCompletion),
    barColors: parseBarColorSelection(s.barColors) ?? d.barColors,
    sidebar: parseEnum(SIDEBAR_MODES, s.sidebar) ?? d.sidebar,
    studioStep: parseEnum(STUDIO_STEPS, s.studioStep) ?? d.studioStep,
    paperHintSeen: parseBoolean(s.paperHintSeen) ?? d.paperHintSeen,
  };
}

type OptionGroup = 'tableReports' | 'resourceGantt';

export type ReportSettingsPatch = Partial<Omit<ReportSettings, OptionGroup>> & {
  tableReports?: Partial<TableReportOptions>;
  resourceGantt?: Partial<ResourceGanttReportOptions>;
};

let current: ReportSettings | null = null;
let pending: ReportSettingsPatch | null = null;
const listeners = new Set<() => void>();

function applyPatch(base: ReportSettings, patch: ReportSettingsPatch): ReportSettings {
  return {
    ...base,
    ...patch,
    tableReports: { ...base.tableReports, ...patch.tableReports },
    resourceGantt: { ...base.resourceGantt, ...patch.resourceGantt },
  };
}

function combinePatches(first: ReportSettingsPatch, next: ReportSettingsPatch): ReportSettingsPatch {
  return {
    ...first,
    ...next,
    tableReports: { ...first.tableReports, ...next.tableReports },
    resourceGantt: { ...first.resourceGantt, ...next.resourceGantt },
  };
}

export function latestReportSettings(): ReportSettings {
  const stored = readStoredReportSettings();
  if (stored === null) return current ?? { ...DEFAULT_REPORT_SETTINGS };
  return pending ? applyPatch(stored, pending) : stored;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== LOCAL_KEY) return;
  current = latestReportSettings();
  notify();
}

export function reportSettingsSnapshot(): ReportSettings {
  return current ??= latestReportSettings();
}

export function subscribeReportSettings(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    current = latestReportSettings();
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

export function patchReportSettings(patch: ReportSettingsPatch): ReportSettings {
  const chosen = pending ? combinePatches(pending, patch) : patch;
  const stored = readStoredReportSettings();
  if (stored === null) {
    pending = chosen;
    current = applyPatch(current ?? { ...DEFAULT_REPORT_SETTINGS }, patch);
  } else {
    const merged = applyPatch(stored, chosen);
    const json = JSON.stringify(merged);
    writeLocal(LOCAL_KEY, json);
    pending = readLocal(LOCAL_KEY) === json ? null : chosen;
    current = merged;
  }
  notify();
  return current;
}
