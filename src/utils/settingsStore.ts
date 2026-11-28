import type {
  WeekStartDay,
  UITheme,
  ScrollMode,
  PositionDivision,
  ModifierMap,
  DocumentChromeStyle,
  Layout,
  DateNotation,
  TimeNotation,
  DurationDisplay,
  BarSplitMode,
  DissolveSummaryMode,
  FilterNode,
  SavedFilter,
  UIFontFamily,
} from '@/state/slices/types';
import type { PersistedTaskGridPreferencesV1 } from '@/types/taskGrid';
import type { FormatNoticeKind } from '@/services/formatNoticeKinds';
import type { LayoutOverlays } from '@/types/view';
import { parseFeatureFlagValues, type FeatureFlagValues } from '@/utils/featureFlags';
import { migrateSavedFilters } from '@/engine/view/layoutPresets';
import { AI_MODE_AVAILABLE } from '@/utils/buildFlags';
import { isTauri } from '@/utils/platform';
import { siteHostTheme } from '@/services/fileAccess/siteHostPreferences';
import {
  noteSiteHostSettingChanged, siteHostSettingWriteHeld, type SettingWriteOrigin,
} from '@/services/fileAccess/siteHostSettings';

export type { SettingWriteOrigin };
import {
  legacyLayoutColumnsToTaskGridPreferences,
  normalizePersistedTaskGridPreferences,
  normalizeTaskGridColumnPreferences,
} from '@/engine/taskGrid/preferences';

export function localStorageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function readLocal(key: string): string | null {
  const value = tryReadLocal(key);
  return value === false ? null : value;
}

export function tryReadLocal(key: string): string | null | false {
  try {
    return localStorage.getItem(key);
  } catch {
    return false;
  }
}

let warnedSettingsWrite = false;
export function writeLocal(key: string, value: string, origin: SettingWriteOrigin = 'user'): void {
  if (origin === 'user' && siteHostSettingWriteHeld(key)) return;
  try {
    localStorage.setItem(key, value);
    noteSiteHostSettingChanged(key, origin);
  } catch (error) {
    if (!warnedSettingsWrite) {
      warnedSettingsWrite = true;
      console.warn('Instelling kon niet worden bewaard (opslag geblokkeerd of vol):', key, error);
    }
  }
}

export function removeLocal(key: string, origin: SettingWriteOrigin = 'user'): void {
  if (origin === 'user' && siteHostSettingWriteHeld(key)) return;
  try {
    localStorage.removeItem(key);
    noteSiteHostSettingChanged(key, origin);
  } catch { }
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const raw = readLocal(`ops-${key}`);
  if (raw === null) return undefined;
  try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
}

export class SettingsUnreadableError extends Error {
  constructor(key: string) {
    super(`Instelling niet te lezen: ${key}`);
    this.name = 'SettingsUnreadableError';
  }
}

export class LayoutsNotSavedError extends Error {
  constructor() {
    super('Layouts niet opgeslagen');
    this.name = 'LayoutsNotSavedError';
  }
}

export function ignoreUnreadable(error: unknown): void {
  if (!(error instanceof SettingsUnreadableError)) throw error;
}

async function getSettingOrThrow<T>(key: string): Promise<T | undefined> {
  const raw = tryReadLocal(`ops-${key}`);
  if (raw === false) throw new SettingsUnreadableError(key);
  if (raw === null) return undefined;
  try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
}

export async function setSetting<T>(key: string, value: T, origin: SettingWriteOrigin = 'user'): Promise<void> {
  writeLocal(`ops-${key}`, typeof value === 'string' ? value : JSON.stringify(value), origin);
}

export async function syncSettingToLocalStorage(storeKey: string, localStorageKey: string): Promise<void> {
  const value = readLocal(`ops-${storeKey}`);
  if (value) {
    writeLocal(localStorageKey, value, 'start');
  }
}

export async function saveLocale(code: string): Promise<void> {
  writeLocal('ops-locale', code);
}

export async function saveTheme(theme: UITheme): Promise<void> {
  writeLocal('ops-theme', theme);
}

export const THEME_MIGRATION: Record<string, UITheme> = {
  'default': 'dark',
  'light': 'light',
  'dark': 'dark',
  'blue': 'dark',
  'amber-navy': 'dark',
  'warm-ember': 'dark',
  'highContrast': 'high-contrast',
  'high-contrast': 'high-contrast',
  'system': 'system',
};

function devSessionTheme(): UITheme | null {
  if (!import.meta.env.DEV || typeof window === 'undefined' || isTauri()) return null;
  const theme = new URLSearchParams(window.location.search).get('theme');
  return theme === 'light' || theme === 'dark' || theme === 'high-contrast' ? theme : null;
}

function sessionTheme(): UITheme | null {
  return devSessionTheme() ?? siteHostTheme();
}

export function startTheme(): UITheme {
  return sessionTheme() ?? 'dark';
}

export function hostThemeWinsNextStart(
  devTheme: UITheme | null = devSessionTheme(),
  hostTheme: UITheme | null = siteHostTheme(),
): boolean {
  return devTheme === null && hostTheme !== null;
}

export async function initTheme(): Promise<UITheme> {
  const session = sessionTheme();
  if (session) return session;
  const saved = readLocal('ops-theme');
  if (!saved) return 'dark';

  const migrated = THEME_MIGRATION[saved] ?? 'dark';
  if (migrated !== saved) {
    writeLocal('ops-theme', migrated, 'start');
  }
  return migrated;
}

export function peekTheme(): UITheme {
  try {
    const session = sessionTheme();
    if (session) return session;
    const saved = readLocal('ops-theme');
    if (!saved) return 'dark';
    return THEME_MIGRATION[saved] ?? 'dark';
  } catch {
    return 'dark';
  }
}

export interface PersistedZoomSettings {
  enableQuarterHourZoom: boolean;
  weekStartDay: WeekStartDay;
  scrollMode: ScrollMode;
  positionDivision: PositionDivision;
  modifierMap: ModifierMap;
}

export async function saveZoomSettings(settings: Partial<PersistedZoomSettings>): Promise<void> {
  if (settings.enableQuarterHourZoom !== undefined) await setSetting('enableQuarterHourZoom', settings.enableQuarterHourZoom);
  if (settings.weekStartDay !== undefined) await setSetting('weekStartDay', settings.weekStartDay);
  if (settings.scrollMode !== undefined) await setSetting('scrollMode', settings.scrollMode);
  if (settings.positionDivision !== undefined) await setSetting('positionDivision', settings.positionDivision);
  if (settings.modifierMap !== undefined) await setSetting('modifierMap', settings.modifierMap);
}

export async function saveDebugTerminalEnabled(value: boolean): Promise<void> {
  await setSetting('debugTerminalEnabled', value);
}

export async function saveExperimentalSettingsVisible(value: boolean): Promise<void> {
  await setSetting('experimentalSettingsVisible', value);
}

export async function saveFeatureFlags(value: FeatureFlagValues): Promise<void> {
  await setSetting('featureFlags', value);
}

export function loadFeatureFlags(stored?: FeatureFlagValues): FeatureFlagValues {
  let flags: FeatureFlagValues = stored ?? {};
  if (!stored) {
    try {
      flags = parseFeatureFlagValues(JSON.parse(readLocal('ops-featureFlags') ?? 'null')) ?? {};
    } catch { }
  }
  return flags;
}

export const TASK_TABLE_MIN_WIDTH = 150;
export const TASK_TABLE_MAX_WIDTH = 800;

export async function saveLeftPanelWidth(value: number): Promise<void> {
  await setSetting('leftPanelWidth', Math.round(value));
}

export const RIGHT_PANEL_MIN_WIDTH = 200;
export const RIGHT_PANEL_MAX_WIDTH = 900;

export async function saveRightPanelWidth(value: number): Promise<void> {
  await setSetting('rightPanelWidth', Math.round(value));
}

export const RAIL_SECTION_MIN_HEIGHT = 120;
export const RAIL_SECTION_MAX_HEIGHT = 2000;

export async function saveRailPropertiesHeight(value: number): Promise<void> {
  await setSetting('railPropertiesHeight', Math.round(value));
}

export async function saveRailWarningsHeight(value: number): Promise<void> {
  await setSetting('railWarningsHeight', Math.round(value));
}

export async function saveRibbonCompact(value: boolean): Promise<void> {
  await setSetting('ribbonCompact', value);
}

export async function saveRibbonWheelSwitchesTabs(value: boolean): Promise<void> {
  await setSetting('ribbonWheelSwitchesTabs', value);
}

export async function saveShowHistogram(value: boolean): Promise<void> {
  await setSetting('showHistogram', value);
}

export const HISTOGRAM_MIN_HEIGHT = 80;
export const HISTOGRAM_MAX_HEIGHT = 480;

export async function saveHistogramHeight(value: number): Promise<void> {
  await setSetting('histogramHeight', Math.round(value));
}

export async function saveShowBaselineOverlay(value: boolean): Promise<void> {
  await setSetting('showBaselineOverlay', value);
}

export async function saveShowProgressLine(value: boolean): Promise<void> {
  await setSetting('showProgressLine', value);
}

export async function saveShowStatusDateLine(value: boolean): Promise<void> {
  await setSetting('showStatusDateLine', value);
}

export async function saveShowFloatBand(value: boolean): Promise<void> {
  await setSetting('showFloatBand', value);
}

export async function saveShowBarDates(value: boolean): Promise<void> {
  await setSetting('showBarDates', value);
}

export async function saveShowResourceAccent(value: boolean): Promise<void> {
  await setSetting('showResourceAccent', value);
}

export async function saveShowMiniMap(value: boolean): Promise<void> {
  await setSetting('showMiniMap', value);
}

export async function saveDocumentChromeStyle(value: DocumentChromeStyle): Promise<void> {
  await setSetting('documentChromeStyle', value);
}

export type TaskGridPreferencesLoadResult =
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'valid'; value: PersistedTaskGridPreferencesV1 };

export async function loadTaskGridPreferences(
  defaults: PersistedTaskGridPreferencesV1,
): Promise<TaskGridPreferencesLoadResult> {
  const raw = readLocal('ops-taskGridPreferences');
  if (raw === null) return { status: 'missing' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'invalid' };
  }
  const value = normalizePersistedTaskGridPreferences(parsed, defaults);
  return value ? { status: 'valid', value } : { status: 'invalid' };
}

export async function saveTaskGridPreferences(
  preferences: PersistedTaskGridPreferencesV1,
  origin: SettingWriteOrigin = 'user',
): Promise<void> {
  await setSetting('taskGridPreferences', preferences, origin);
}

const TASK_GRID_LAYOUTS_VERSION = 1;

interface PersistedTaskGridLayoutsV1 {
  version: 1;
  layouts: Layout[];
}

interface LegacyColumnConfigLike {
  field: Record<string, unknown>;
  visible: boolean;
  width: number;
}

function isLayoutOverlays(value: unknown): value is LayoutOverlays {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  const flags = ['baseline', 'progressLine', 'statusDateLine', 'resourceAccent', 'floatBand'] as const;
  if (!flags.every(flag => typeof o[flag] === 'boolean')) return false;
  const colors = o.barColors as Record<string, unknown> | null | undefined;
  if (!colors || typeof colors !== 'object') return false;
  if (colors.colors !== undefined) {
    if (!colors.colors || typeof colors.colors !== 'object' || Array.isArray(colors.colors)) return false;
    const custom = colors.colors as Record<string, unknown>;
    if (!['critical', 'nearCritical', 'normal'].every(key => custom[key] === undefined || (typeof custom[key] === 'string' && /^#[0-9a-f]{6}$/i.test(custom[key] as string)))) return false;
  }
  if (colors.mode === 'critical' || colors.mode === 'auto') return true;
  const field = colors.field as Record<string, unknown> | null | undefined;
  return colors.mode === 'category' && !!field && typeof field === 'object' && typeof field.src === 'string';
}

function baseLayout(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null;
  const l = v as Record<string, unknown>;
  return (
    typeof l.id === 'string' &&
    typeof l.name === 'string' &&
    (l.group === undefined || Array.isArray(l.group)) &&
    (l.sort === undefined || Array.isArray(l.sort)) &&
    (l.filter === undefined || l.filter === null || typeof l.filter === 'object') &&
    (l.timeScale === undefined || typeof l.timeScale === 'string') &&
    (l.columns === undefined || Array.isArray(l.columns)) &&
    (l.showRelations === undefined || typeof l.showRelations === 'boolean') &&
    (l.overlays === undefined || isLayoutOverlays(l.overlays)) &&
    (l.icon === undefined || typeof l.icon === 'string')
  ) ? l : null;
}

function isLegacyColumnConfig(value: unknown): value is LegacyColumnConfigLike {
  if (!value || typeof value !== 'object') return false;
  const column = value as Record<string, unknown>;
  if (typeof column.visible !== 'boolean'
    || typeof column.width !== 'number'
    || !Number.isFinite(column.width)
    || !column.field
    || typeof column.field !== 'object') return false;
  const field = column.field as Record<string, unknown>;
  return typeof field.src === 'string' && field.src.length > 0;
}

function normalizeLayout(v: unknown): Layout | null {
  const l = baseLayout(v);
  if (!l) return null;
  const out: Layout = { id: l.id as string, name: l.name as string };
  if (Array.isArray(l.columns)) {
    const currentColumns = normalizeTaskGridColumnPreferences(l.columns);
    const legacyColumns = currentColumns === null && l.columns.every(isLegacyColumnConfig)
      ? legacyLayoutColumnsToTaskGridPreferences(l.columns)
      : null;
    const columns = currentColumns ?? legacyColumns;
    if (columns === null) return null;
    out.columns = columns;
  }
  if (l.group !== undefined) out.group = l.group as Layout['group'];
  if (l.sort !== undefined) out.sort = l.sort as Layout['sort'];
  if (l.filter !== undefined) out.filter = l.filter as Layout['filter'];
  if (l.timeScale !== undefined) out.timeScale = l.timeScale as Layout['timeScale'];
  if (l.showRelations !== undefined) out.showRelations = l.showRelations as boolean;
  if (l.overlays !== undefined) {
    const o = l.overlays as LayoutOverlays;
    out.overlays = {
      baseline: o.baseline, progressLine: o.progressLine, statusDateLine: o.statusDateLine,
      resourceAccent: o.resourceAccent, floatBand: o.floatBand, barColors: o.barColors,
    };
  }
  if (l.icon !== undefined) out.icon = l.icon as string;
  return out;
}

function normalizeLayouts(raw: unknown): Layout[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map(normalizeLayout).filter((layout): layout is Layout => layout !== null);
}

async function loadStoredLayouts(): Promise<Layout[]> {
  const current = await getSettingOrThrow<unknown>('taskGridLayouts');
  if (current && typeof current === 'object') {
    const wrapper = current as Record<string, unknown>;
    if (wrapper.version === TASK_GRID_LAYOUTS_VERSION) {
      const normalized = normalizeLayouts(wrapper.layouts);
      if (normalized) return normalized;
    }
  }
  const legacy = await getSettingOrThrow<unknown>('layouts');
  return normalizeLayouts(legacy) ?? [];
}

export async function loadLayouts(): Promise<Layout[]> {
  const layouts = await loadStoredLayouts();
  if (await getSettingOrThrow<boolean>('savedFiltersMigrated')) return layouts;
  const savedFilters = await loadSavedFilters();
  const merged = migrateSavedFilters(layouts, savedFilters);
  if (merged.length !== layouts.length) {
    await saveLayouts(merged, 'start');
    const stored = await loadStoredLayouts();
    if (stored.map(l => l.id).join('\n') !== merged.map(l => l.id).join('\n')) return merged;
  }
  await setSetting('savedFiltersMigrated', true, 'start');
  return merged;
}

export async function saveLayouts(layouts: Layout[], origin: SettingWriteOrigin = 'user'): Promise<void> {
  const normalized = normalizeLayouts(layouts);
  if (!normalized) return;
  const payload: PersistedTaskGridLayoutsV1 = { version: 1, layouts: normalized };
  await setSetting('taskGridLayouts', payload, origin);
}

export function updateLayouts(change: (current: Layout[]) => Layout[]): Promise<Layout[]> {
  const run = layoutUpdates.then(async () => {
    const next = change(await loadLayouts());
    await saveLayouts(next);
    if (JSON.stringify(await loadStoredLayouts()) !== JSON.stringify(normalizeLayouts(next))) throw new LayoutsNotSavedError();
    return next;
  });
  layoutUpdates = run.catch(() => undefined);
  return run;
}
let layoutUpdates: Promise<unknown> = Promise.resolve();

const FILTER_OPERATORS = new Set(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'contains', 'startsWith', 'between', 'isEmpty', 'in']);

function isFilterNode(value: unknown): value is FilterNode {
  if (!value || typeof value !== 'object') return false;
  const node = value as Record<string, unknown>;
  if (node.kind === 'group') {
    return (node.op === 'AND' || node.op === 'OR') && Array.isArray(node.children) && node.children.every(isFilterNode);
  }
  if (node.kind !== 'rule' || !FILTER_OPERATORS.has(node.operator as string)) return false;
  const field = node.field;
  if (!field || typeof field !== 'object') return false;
  const ref = field as Record<string, unknown>;
  return (ref.src === 'builtin' && typeof ref.key === 'string') ||
    (ref.src === 'activityCode' && typeof ref.typeId === 'string') ||
    (ref.src === 'customField' && typeof ref.defId === 'string') ||
    ref.src === 'resource';
}

function isValidSavedFilter(value: unknown): value is SavedFilter {
  if (!value || typeof value !== 'object') return false;
  const filter = value as Record<string, unknown>;
  return typeof filter.id === 'string' && filter.id.length > 0 &&
    typeof filter.name === 'string' && filter.name.trim().length > 0 &&
    isFilterNode(filter.filter);
}

export async function loadSavedFilters(): Promise<SavedFilter[]> {
  const raw = await getSettingOrThrow<unknown>('savedFilters');
  return Array.isArray(raw) ? raw.filter(isValidSavedFilter) : [];
}

export async function saveSavedFilters(filters: SavedFilter[]): Promise<void> {
  await setSetting('savedFilters', filters);
}

export async function saveShowClassicViewControls(value: boolean): Promise<void> {
  await setSetting('showClassicViewControls', value);
}

export async function saveAutoCalcCPM(value: boolean): Promise<void> {
  await setSetting('autoCalcCPM', value);
}

export async function saveAutoFitColumns(value: boolean): Promise<void> {
  await setSetting('autoFitColumns', value);
}

export function loadConstructionMode(): boolean {
  if (!localStorageAvailable()) return true;
  const raw = readLocal('ops-constructionMode');
  if (raw === null) return true;
  try { return JSON.parse(raw) !== false; } catch { return true; }
}

export function saveConstructionMode(value: boolean): void {
  if (!localStorageAvailable()) return;
  writeLocal('ops-constructionMode', JSON.stringify(value));
}

export async function saveDateNotation(value: DateNotation): Promise<void> {
  await setSetting('dateNotation', value);
}

export async function saveTimeNotation(value: TimeNotation): Promise<void> {
  await setSetting('timeNotation', value);
}

export async function saveUIFontFamily(value: UIFontFamily): Promise<void> {
  await setSetting('uiFontFamily', value);
}

export async function saveUIFontScale(value: number): Promise<void> {
  await setSetting('uiFontScale', value);
}

export async function saveShowTaskTypes(value: boolean): Promise<void> {
  await setSetting('showTaskTypes', value);
}

export async function saveAllowMixedDayHour(value: boolean): Promise<void> {
  await setSetting('allowMixedDayHour', value);
}

export async function saveDurationDisplay(value: DurationDisplay): Promise<void> {
  await setSetting('durationDisplay', value);
}

export async function saveBarSplitMode(value: BarSplitMode): Promise<void> {
  await setSetting('barSplitMode', value);
}

export async function saveDissolveSummaryMode(value: DissolveSummaryMode): Promise<void> {
  await setSetting('dissolveSummaryMode', value);
}

export async function saveCompressNonWorkdays(value: boolean): Promise<void> {
  await setSetting('compressNonWorkdays', value);
}

import type { WorkTimePreset } from '@/utils/shiftPresets';

function isValidWorkTimePreset(v: unknown): v is WorkTimePreset {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    Array.isArray(p.workDays) &&
    typeof p.workStartHour === 'number' &&
    typeof p.workEndHour === 'number' &&
    typeof p.hoursPerDay === 'number'
  );
}

export async function loadWorkTimePresets(): Promise<WorkTimePreset[]> {
  const raw = await getSetting<unknown>('workTimePresets');
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidWorkTimePreset);
}

export async function saveWorkTimePresets(presets: WorkTimePreset[]): Promise<void> {
  await setSetting('workTimePresets', presets);
}

export async function loadLastLayoutId(): Promise<string | null> {
  const v = await getSetting<string>('lastLayoutId');
  return typeof v === 'string' && v ? v : null;
}

export async function saveLastLayoutId(id: string | null): Promise<void> {
  await setSetting('lastLayoutId', id);
}

export async function loadWelcomeSeen(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('welcomeSeen');
  return typeof v === 'boolean' ? v : undefined;
}

export async function saveWelcomeSeen(value: boolean): Promise<void> {
  await setSetting('welcomeSeen', value);
}

let welcomeSeenSnapshot: boolean | undefined;
export function welcomeSeenAtStartup(): boolean {
  if (welcomeSeenSnapshot === undefined) welcomeSeenSnapshot = readLocal('ops-welcomeSeen') === 'true';
  return welcomeSeenSnapshot;
}

export async function saveTutorialOfferAnswered(value: boolean): Promise<void> {
  await setSetting('tutorialOfferAnswered', value);
}

export async function saveFeedbackEmail(value: string): Promise<void> {
  await setSetting('feedbackEmail', value);
}

export async function loadLastVersion(): Promise<string | undefined> {
  const v = await getSetting<string>('lastVersion');
  return typeof v === 'string' && v ? v : undefined;
}

export async function saveLastVersion(value: string): Promise<void> {
  await setSetting('lastVersion', value);
}

export async function saveAiMode(value: boolean): Promise<void> {
  await setSetting('aiMode', value);
}

export async function saveAiAutostart(value: boolean): Promise<void> {
  await setSetting('aiAutostart', value);
}

export async function loadAiAutoBackup(): Promise<boolean> {
  const v = await getSetting<boolean>('aiAutoBackup');
  return typeof v === 'boolean' ? v : true;
}

export async function saveAiAutoBackup(value: boolean): Promise<void> {
  await setSetting('aiAutoBackup', value);
}

export const MCP_DEFAULT_PORT = 3877;

export function loadMcpPort(): number {
  if (!localStorageAvailable()) return MCP_DEFAULT_PORT;
  const raw = readLocal('ops-mcpPort');
  if (raw === null) return MCP_DEFAULT_PORT;
  let n: number;
  try { n = Number(JSON.parse(raw)); } catch { return MCP_DEFAULT_PORT; }
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : MCP_DEFAULT_PORT;
}

export function saveMcpPort(value: number): void {
  if (!localStorageAvailable()) return;
  writeLocal('ops-mcpPort', JSON.stringify(Math.round(value)));
}

export function loadMcpToken(): string | null {
  if (!AI_MODE_AVAILABLE || !localStorageAvailable()) return null;
  const raw = readLocal('ops-mcpToken');
  return typeof raw === 'string' && raw ? raw : null;
}

export function saveMcpToken(value: string): void {
  if (!AI_MODE_AVAILABLE || !localStorageAvailable()) return;
  writeLocal('ops-mcpToken', value);
}

export async function saveFormatNoticeHidden(value: readonly FormatNoticeKind[]): Promise<void> {
  await setSetting('formatNoticeHidden', [...value]);
}

export async function saveForeignChangesQuestion(value: boolean): Promise<void> {
  await setSetting('foreignChangesQuestion', value);
}
