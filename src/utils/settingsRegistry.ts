import { snapToChoice } from '@/utils/numberChoice';
import { parseBoolean, parseClampedInt as clampedInt, parseEnum as parseEnumValue } from '@/utils/settingParsers';
import { loadBarColorSelection } from '@/utils/barColorSettings';
import { parseFormatNoticeHidden } from '@/services/formatNoticeKinds';
import { parseFeatureFlagValues } from '@/utils/featureFlags';
import type { UIState } from '@/state/slices/types';
import type { PersistedTaskGridPreferencesV1 } from '@/types/taskGrid';
import {
  DATE_NOTATIONS,
  TIME_NOTATIONS,
  DURATION_DISPLAYS,
  BAR_SPLIT_MODES,
  DISSOLVE_SUMMARY_MODES,
  UI_FONT_FAMILIES,
  UI_FONT_SCALES,
} from '@/state/slices/types';
import type {
  WeekStartDay,
  ScrollMode,
  PositionDivision,
  ModifierMap,
  WheelFunction,
  DocumentChromeStyle,
} from '@/state/slices/types';
import {
  getSetting,
  initTheme,
  loadConstructionMode,
  loadFeatureFlags,
  TASK_TABLE_MIN_WIDTH,
  TASK_TABLE_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  RAIL_SECTION_MIN_HEIGHT,
  RAIL_SECTION_MAX_HEIGHT,
  HISTOGRAM_MIN_HEIGHT,
  HISTOGRAM_MAX_HEIGHT,
  loadTaskGridPreferences,
} from '@/utils/settingsStore';
import type { TaskGridPreferencesLoadResult } from '@/utils/settingsStore';

function parseEnum<T extends string>(allowed: readonly T[]) {
  return (raw: unknown): T | undefined => parseEnumValue(allowed, raw);
}

function parseClampedInt(min: number, max: number) {
  return (raw: unknown): number | undefined => clampedInt(raw, min, max);
}

function parseNumberChoice(allowed: readonly number[]) {
  return (raw: unknown): number | undefined => snapToChoice(allowed, raw);
}

function parseFeedbackEmail(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.length <= 254 ? raw : undefined;
}

const WHEEL_FUNCTIONS: WheelFunction[] = ['vertical', 'horizontal', 'zoom'];

function parseModifierMap(raw: unknown): ModifierMap | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const map = raw as Record<string, unknown>;
  const values = [map.plain, map.ctrl, map.shift];
  if (!values.every(v => typeof v === 'string' && WHEEL_FUNCTIONS.includes(v as WheelFunction))) {
    return undefined;
  }
  if (new Set(values).size !== 3) return undefined;
  return raw as ModifierMap;
}

const SCROLL_MODES: ScrollMode[] = ['position', 'modifier', 'drag'];
const POSITION_DIVISIONS: PositionDivision[] = ['left-right', 'top-bottom', 'corner'];
const WEEK_START_DAYS: WeekStartDay[] = ['monday', 'sunday'];
const DOCUMENT_CHROME_STYLES: DocumentChromeStyle[] = ['tabs', 'rail', 'switcher'];

export interface SettingDescriptor<K extends keyof UIState = keyof UIState> {
  key: string;
  field: K;
  parse: (raw: unknown) => UIState[K] | undefined;
}

function setting<K extends keyof UIState>(d: SettingDescriptor<K>): SettingDescriptor {
  return d as SettingDescriptor;
}

export const SETTINGS: SettingDescriptor[] = [
  setting({ key: 'enableQuarterHourZoom', field: 'enableQuarterHourZoom', parse: parseBoolean }),
  setting({ key: 'weekStartDay', field: 'weekStartDay', parse: parseEnum(WEEK_START_DAYS) }),
  setting({ key: 'scrollMode', field: 'scrollMode', parse: parseEnum(SCROLL_MODES) }),
  setting({ key: 'positionDivision', field: 'positionDivision', parse: parseEnum(POSITION_DIVISIONS) }),
  setting({ key: 'modifierMap', field: 'modifierMap', parse: parseModifierMap }),

  setting({ key: 'debugTerminalEnabled', field: 'debugTerminalEnabled', parse: parseBoolean }),

  setting({ key: 'experimentalSettingsVisible', field: 'experimentalSettingsVisible', parse: parseBoolean }),
  setting({ key: 'featureFlags', field: 'featureFlags', parse: raw => {
    const flags = parseFeatureFlagValues(raw);
    return flags ? loadFeatureFlags(flags) : undefined;
  } }),

  setting({ key: 'aiMode', field: 'aiMode', parse: parseBoolean }),
  setting({ key: 'aiAutostart', field: 'aiAutostart', parse: parseBoolean }),

  setting({ key: 'documentChromeStyle', field: 'documentChromeStyle', parse: parseEnum(DOCUMENT_CHROME_STYLES) }),

  setting({ key: 'leftPanelWidth', field: 'leftPanelWidth', parse: parseClampedInt(TASK_TABLE_MIN_WIDTH, TASK_TABLE_MAX_WIDTH) }),
  setting({ key: 'rightPanelWidth', field: 'rightPanelWidth', parse: parseClampedInt(RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH) }),
  setting({ key: 'ribbonCompact', field: 'ribbonCompact', parse: parseBoolean }),
  setting({ key: 'ribbonWheelSwitchesTabs', field: 'ribbonWheelSwitchesTabs', parse: parseBoolean }),

  setting({ key: 'railPropertiesHeight', field: 'railPropertiesHeight', parse: parseClampedInt(RAIL_SECTION_MIN_HEIGHT, RAIL_SECTION_MAX_HEIGHT) }),
  setting({ key: 'railWarningsHeight', field: 'railWarningsHeight', parse: parseClampedInt(RAIL_SECTION_MIN_HEIGHT, RAIL_SECTION_MAX_HEIGHT) }),

  setting({ key: 'showHistogram', field: 'showHistogram', parse: parseBoolean }),
  setting({ key: 'histogramHeight', field: 'histogramHeight', parse: parseClampedInt(HISTOGRAM_MIN_HEIGHT, HISTOGRAM_MAX_HEIGHT) }),

  setting({ key: 'showBaselineOverlay', field: 'showBaselineOverlay', parse: parseBoolean }),
  setting({ key: 'showProgressLine', field: 'showProgressLine', parse: parseBoolean }),
  setting({ key: 'showStatusDateLine', field: 'showStatusDateLine', parse: parseBoolean }),
  setting({ key: 'showResourceAccent', field: 'showResourceAccent', parse: parseBoolean }),
  setting({ key: 'showFloatBand', field: 'showFloatBand', parse: parseBoolean }),
  setting({ key: 'showBarDates', field: 'showBarDates', parse: parseBoolean }),

  setting({ key: 'showMiniMap', field: 'showMiniMap', parse: parseBoolean }),
  setting({ key: 'showClassicViewControls', field: 'showClassicViewControls', parse: parseBoolean }),

  setting({ key: 'autoCalcCPM', field: 'autoCalcCPM', parse: parseBoolean }),

  setting({ key: 'autoFitColumns', field: 'autoFitColumns', parse: parseBoolean }),

  setting({ key: 'dateNotation', field: 'dateNotation', parse: parseEnum(DATE_NOTATIONS) }),
  setting({ key: 'timeNotation', field: 'timeNotation', parse: parseEnum(TIME_NOTATIONS) }),

  setting({ key: 'uiFontFamily', field: 'uiFontFamily', parse: parseEnum(UI_FONT_FAMILIES) }),
  setting({ key: 'uiFontScale', field: 'uiFontScale', parse: parseNumberChoice(UI_FONT_SCALES) }),

  setting({ key: 'showTaskTypes', field: 'showTaskTypes', parse: parseBoolean }),
  setting({ key: 'allowMixedDayHour', field: 'allowMixedDayHour', parse: parseBoolean }),
  setting({ key: 'durationDisplay', field: 'durationDisplay', parse: parseEnum(DURATION_DISPLAYS) }),
  setting({ key: 'barSplitMode', field: 'barSplitMode', parse: parseEnum(BAR_SPLIT_MODES) }),
  setting({ key: 'dissolveSummaryMode', field: 'dissolveSummaryMode', parse: parseEnum(DISSOLVE_SUMMARY_MODES) }),

  setting({ key: 'compressNonWorkdays', field: 'compressNonWorkdays', parse: parseBoolean }),

  setting({ key: 'tutorialOfferAnswered', field: 'tutorialOfferAnswered', parse: parseBoolean }),

  setting({ key: 'formatNoticeHidden', field: 'formatNoticeHidden', parse: parseFormatNoticeHidden }),
  setting({ key: 'foreignChangesQuestion', field: 'foreignChangesQuestion', parse: parseBoolean }),

  setting({ key: 'feedbackEmail', field: 'feedbackEmail', parse: parseFeedbackEmail }),
];

export async function loadAllSettings(): Promise<Partial<UIState>> {
  const patch: Partial<UIState> = {};

  patch.uiTheme = await initTheme();

  patch.constructionMode = loadConstructionMode();

  patch.barColorSelection = await loadBarColorSelection();

  for (const d of SETTINGS) {
    const raw = await getSetting<unknown>(d.key);
    const value = d.parse(raw);
    if (value !== undefined) {
      (patch as Record<string, unknown>)[d.field] = value;
    }
  }

  return patch;
}

export function settingFieldsByStorageKey(): ReadonlyMap<string, keyof UIState> {
  const map = new Map<string, keyof UIState>([
    ['ops-theme', 'uiTheme'],
    ['ops-constructionMode', 'constructionMode'],
    ['ops-barColorSelection', 'barColorSelection'],
  ]);
  for (const d of SETTINGS) map.set(`ops-${d.key}`, d.field);
  return map;
}

export async function loadTaskGridSettings(
  defaults: PersistedTaskGridPreferencesV1,
): Promise<TaskGridPreferencesLoadResult> {
  return loadTaskGridPreferences(defaults);
}
