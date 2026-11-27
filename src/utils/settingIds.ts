export const SETTINGS_GROUP_IDS = [
  'appearance',
  'notation',
  'timeline',
  'workspace',
  'planning',
  'notices',
  'advanced',
  'about',
] as const;

export type SettingsGroupId = typeof SETTINGS_GROUP_IDS[number];

export const SETTING_IDS = [
  'theme',
  'language',
  'fontFamily',
  'fontScale',
  'dateNotation',
  'timeNotation',
  'durationDisplay',
  'weekStartDay',
  'compressNonWorkdays',
  'quarterHourZoom',
  'barSplitMode',
  'scrollMode',
  'positionDivision',
  'modifierMap',
  'documentChrome',
  'ribbonWheel',
  'autoFitColumns',
  'constructionMode',
  'autoCalc',
  'taskTypes',
  'mixedDayHour',
  'dissolveSummaryMode',
  'formatNotices',
  'foreignChangesQuestion',
  'aiMode',
  'aiAutostart',
  'debugTerminal',
  'classicViewControls',
  'version',
  'experimental',
  'tour',
  'stats',
  'benchmark',
] as const;

export type SettingId = typeof SETTING_IDS[number];

export function isSettingId(value: string): value is SettingId {
  return (SETTING_IDS as readonly string[]).includes(value);
}
