// DE lijst van het instellingenpaneel: per instelling naam, uitleg, groep, zoekwoorden, bediening en
// eventueel een plaatje. Het paneel, de zoekbalk, de stip "gewijzigd", "standaard terugzetten" en de
// directe link (`openSettingsAt`) lezen allemaal hieruit. Een nieuwe instelling in het paneel = één
// entry hier (plus een id in `settingIds.ts`); zie docs/recepten/instelling.md.
//
// De LAAD-kant van een instelling staat los hiervan in `src/utils/settingsRegistry.ts`, de opslag in
// `settingsStore.ts`. Weergavekeuzes die je in het lint of door te slepen instelt, staan hier niet.

import { createDefaultUI } from '@/state/slices/uiSlice';
import type { UIState, UITheme } from '@/state/slices/types';
import {
  BAR_SPLIT_MODES, DATE_NOTATIONS, DURATION_DISPLAYS, TIME_NOTATIONS, UI_FONT_FAMILIES, UI_FONT_SCALES,
} from '@/state/slices/types';
import {
  saveAiAutostart, saveAllowMixedDayHour, saveAutoFitColumns, saveBarSplitMode, saveCompressNonWorkdays,
  saveConstructionMode, saveDateNotation, saveDebugTerminalEnabled, saveDocumentChromeStyle, saveDurationDisplay,
  saveFormatNoticeHidden, saveRibbonWheelSwitchesTabs, saveShowClassicViewControls, saveShowTaskTypes,
  saveTimeNotation, saveUIFontFamily, saveUIFontScale, saveZoomSettings, startTheme,
} from '@/utils/settingsStore';
import { profileCountsWorkdays } from '@/utils/taskDuration';
import { applyAiModeLive } from '@/services/mcp/server';
import { AI_MODE_AVAILABLE, DOWNLOAD_STATS_AVAILABLE } from '@/utils/buildFlags';
import { displayDate } from '@/utils/displayDate';
import { localTodayIso } from '@/utils/dateUtils';
import { FORMAT_NOTICE_KINDS } from '@/services/formatNoticeKinds';
import { applyAutoCalcCPM, applySetting, applyTheme } from '../applySetting';
import { LANGUAGE_OPTIONS, LanguageSelect } from '../settingControls';
import {
  BarSplitVisual, CompressNonWorkdaysVisual, DocumentChromeVisual, DurationDisplayVisual, PositionDivisionVisual,
  QuarterHourVisual, ScrollModeVisual,
} from '../settingVisuals';
import {
  BenchmarkControl, ExperimentalControl, FormatNoticesControl, ModifierMapControl, StatsControl, ThemeControl,
  TourControl, VersionControl, themeSearchTexts,
} from '../settingCustomControls';
import { SETTING_IDS, SETTINGS_GROUP_IDS, type SettingId, type SettingsGroupId } from '@/utils/settingIds';
import type { ChoiceOption, CommonKey, SettingBinding, SettingEntry } from './types';

// --- Hulp voor een getypeerde binding ------------------------------------------------------------

/** Binding aan een UIState-veld, met het vaste recept: eerst live zetten, dan bewaren. */
function bind<K extends keyof UIState>(field: K, save: (value: UIState[K]) => unknown): SettingBinding {
  return { field, apply: value => applySetting(field, value as UIState[K], save) };
}

/** Keuzes met een vertaalsleutel per waarde. */
function options<T>(entries: readonly (readonly [T, CommonKey])[]): ChoiceOption[] {
  return entries.map(([value, labelKey]) => ({ value, labelKey }));
}

const DATE_NOTATION_KEYS = { dmy: 'settings.dateNotationDmy', mdy: 'settings.dateNotationMdy', ymd: 'settings.dateNotationYmd' } as const;
const TIME_NOTATION_KEYS = { '24h': 'settings.timeNotation24h', '12h': 'settings.timeNotation12h' } as const;
const DURATION_KEYS = { auto: 'settings.durationDisplayAuto', days: 'settings.durationDisplayDays', hours: 'settings.durationDisplayHours' } as const;
const BAR_SPLIT_KEYS = { never: 'settings.barSplitNever', selection: 'settings.barSplitSelection', always: 'settings.barSplitAlways' } as const;
const FONT_FAMILY_KEYS = {
  default: 'settings.fontFamilyDefault',
  system: 'settings.fontFamilySystem',
  serif: 'settings.fontFamilySerif',
  mono: 'settings.fontFamilyMono',
} as const;

// --- De lijst ------------------------------------------------------------------------------------

const ENTRIES: readonly SettingEntry[] = [
  // Uiterlijk
  {
    kind: 'custom', id: 'theme', group: 'appearance', labelKey: 'settings.theme', hintKey: 'settings.themeHint',
    keywordsKey: 'settings.keywords.theme', Control: ThemeControl, searchTexts: themeSearchTexts,
    // `applyTheme` bewaart de keuze en meldt ingebed dat de host bij de volgende start wint. De
    // standaard is het thema van een eerste start: dat van de host of de dev-link, anders Donker.
    binding: { field: 'uiTheme', apply: value => applyTheme(value as UITheme), defaultValue: startTheme },
  },
  {
    kind: 'custom', id: 'language', group: 'appearance', labelKey: 'settings.language', hintKey: 'settings.languageHint',
    keywordsKey: 'settings.keywords.language', Control: LanguageSelect, inline: true,
    searchTexts: () => LANGUAGE_OPTIONS.map(o => o.label),
  },
  {
    kind: 'choice', id: 'fontFamily', group: 'appearance', labelKey: 'settings.fontFamilyLabel', hintKey: 'settings.fontHint',
    keywordsKey: 'settings.keywords.fontFamily', binding: bind('uiFontFamily', saveUIFontFamily),
    options: options(UI_FONT_FAMILIES.map(f => [f, FONT_FAMILY_KEYS[f]] as const)),
  },
  {
    kind: 'choice', id: 'fontScale', group: 'appearance', labelKey: 'settings.fontScaleLabel', hintKey: 'settings.fontScaleHint',
    keywordsKey: 'settings.keywords.fontScale', binding: bind('uiFontScale', saveUIFontScale),
    options: UI_FONT_SCALES.map(s => ({ value: s, label: `${s}%` })),
  },

  // Notatie
  {
    kind: 'choice', id: 'dateNotation', group: 'notation', labelKey: 'settings.dateNotation', hintKey: 'settings.dateNotationHint',
    keywordsKey: 'settings.keywords.dateNotation', binding: bind('dateNotation', saveDateNotation),
    options: options(DATE_NOTATIONS.map(n => [n, DATE_NOTATION_KEYS[n]] as const)),
    // De patroonletters zijn taalgebonden (jjjj, yyyy, JJJJ, aaaa); de datum van vandaag ernaast
    // laat zien wat het patroon betekent.
    example: value => displayDate(localTodayIso(), value as UIState['dateNotation']),
  },
  {
    kind: 'choice', id: 'timeNotation', group: 'notation', labelKey: 'settings.timeNotation', hintKey: 'settings.timeNotationHint',
    keywordsKey: 'settings.keywords.timeNotation', binding: bind('timeNotation', saveTimeNotation),
    options: options(TIME_NOTATIONS.map(n => [n, TIME_NOTATION_KEYS[n]] as const)),
  },
  {
    kind: 'choice', id: 'durationDisplay', group: 'notation', labelKey: 'settings.durationDisplay', hintKey: 'settings.durationDisplayHint',
    keywordsKey: 'settings.keywords.durationDisplay', binding: bind('durationDisplay', saveDurationDisplay),
    options: options(DURATION_DISPLAYS.map(d => [d, DURATION_KEYS[d]] as const)),
    visual: DurationDisplayVisual,
    // B9: grijs zolang het profiel de dagenmaat telt (het OPS-profiel); dezelfde regel als de schermen.
    requires: { met: s => !profileCountsWorkdays(s.project), reasonKey: 'settings.durationDisplayOpsHint' },
  },
  {
    kind: 'choice', id: 'weekStartDay', group: 'notation', labelKey: 'settings.weekStartDay', hintKey: 'settings.weekStartDayHint',
    keywordsKey: 'settings.keywords.weekStartDay',
    binding: bind('weekStartDay', value => saveZoomSettings({ weekStartDay: value })),
    options: options([['monday', 'settings.weekStartMonday'], ['sunday', 'settings.weekStartSunday']] as const),
  },

  // Tijdlijn
  {
    kind: 'toggle', id: 'compressNonWorkdays', group: 'timeline', labelKey: 'settings.compressNonWorkdays',
    hintKey: 'settings.compressNonWorkdaysHint', keywordsKey: 'settings.keywords.compressNonWorkdays',
    binding: bind('compressNonWorkdays', saveCompressNonWorkdays), visual: CompressNonWorkdaysVisual,
  },
  {
    kind: 'toggle', id: 'quarterHourZoom', group: 'timeline', labelKey: 'settings.enableQuarterHourZoom',
    hintKey: 'settings.enableQuarterHourZoomHint', keywordsKey: 'settings.keywords.quarterHourZoom',
    binding: bind('enableQuarterHourZoom', value => saveZoomSettings({ enableQuarterHourZoom: value })),
    visual: QuarterHourVisual,
  },
  {
    kind: 'choice', id: 'barSplitMode', group: 'timeline', labelKey: 'settings.barSplitMode', hintKey: 'settings.barSplitModeHint',
    keywordsKey: 'settings.keywords.barSplitMode', binding: bind('barSplitMode', saveBarSplitMode),
    options: options(BAR_SPLIT_MODES.map(m => [m, BAR_SPLIT_KEYS[m]] as const)), visual: BarSplitVisual,
  },
  {
    kind: 'choice', id: 'scrollMode', group: 'timeline', labelKey: 'settings.scrollMode', hintKey: 'settings.scrollModeHint',
    keywordsKey: 'settings.keywords.scrollMode',
    binding: bind('scrollMode', value => saveZoomSettings({ scrollMode: value })),
    options: options([
      ['drag', 'settings.scrollModeDrag'], ['position', 'settings.scrollModePosition'], ['modifier', 'settings.scrollModeModifier'],
    ] as const),
    visual: ScrollModeVisual,
    valueHintKeys: { drag: 'settings.dragModeHint', position: 'settings.positionModeHint' },
  },
  {
    kind: 'choice', id: 'positionDivision', group: 'timeline', labelKey: 'settings.screenDivision', hintKey: 'settings.screenDivisionHint',
    keywordsKey: 'settings.keywords.positionDivision',
    binding: bind('positionDivision', value => saveZoomSettings({ positionDivision: value })),
    options: options([
      ['left-right', 'settings.screenDivisionLeftRight'], ['top-bottom', 'settings.screenDivisionTopBottom'],
      ['corner', 'settings.screenDivisionCorner'],
    ] as const),
    visual: PositionDivisionVisual,
    requires: { met: s => s.ui.scrollMode === 'position', reasonKey: 'settings.requiresScrollModePosition', hide: 'browse' },
  },
  {
    kind: 'custom', id: 'modifierMap', group: 'timeline', labelKey: 'settings.modifierMap', hintKey: 'settings.modifierMapHint',
    keywordsKey: 'settings.keywords.modifierMap', Control: ModifierMapControl,
    binding: bind('modifierMap', value => saveZoomSettings({ modifierMap: value })),
    requires: { met: s => s.ui.scrollMode === 'modifier', reasonKey: 'settings.requiresScrollModeModifier', hide: 'browse' },
  },

  // Werkruimte
  {
    kind: 'choice', id: 'documentChrome', group: 'workspace', labelKey: 'settings.documentChrome', hintKey: 'settings.documentChromeHint',
    keywordsKey: 'settings.keywords.documentChrome', binding: bind('documentChromeStyle', saveDocumentChromeStyle),
    options: options([
      ['tabs', 'settings.documentChromeTabs'], ['rail', 'settings.documentChromeRail'], ['switcher', 'settings.documentChromeSwitcher'],
    ] as const),
    visual: DocumentChromeVisual,
  },
  {
    kind: 'toggle', id: 'ribbonWheel', group: 'workspace', labelKey: 'settings.ribbonWheelSwitchesTabs',
    hintKey: 'settings.ribbonWheelSwitchesTabsHint', keywordsKey: 'settings.keywords.ribbonWheel',
    binding: bind('ribbonWheelSwitchesTabs', saveRibbonWheelSwitchesTabs),
    inputProps: { 'data-ops-ribbon-wheel-setting': '' },
  },
  {
    kind: 'toggle', id: 'autoFitColumns', group: 'workspace', labelKey: 'settings.autoFitColumns', hintKey: 'settings.autoFitColumnsHint',
    keywordsKey: 'settings.keywords.autoFitColumns', binding: bind('autoFitColumns', saveAutoFitColumns),
    inputProps: { 'data-ops-auto-fit-columns': '' },
  },

  // Planning
  {
    // De synchrone kalenderfabriek leest de vlag rechtstreeks uit localStorage; de save is daarom
    // synchroon en staat er vóór een eventuele nieuw-project-actie.
    kind: 'toggle', id: 'constructionMode', group: 'planning', labelKey: 'settings.constructionMode',
    hintKey: 'settings.constructionModeHint', keywordsKey: 'settings.keywords.constructionMode',
    binding: bind('constructionMode', saveConstructionMode),
  },
  {
    kind: 'toggle', id: 'autoCalc', group: 'planning', labelKey: 'settings.autoCalcCPM', hintKey: 'settings.autoCalcCPMHint',
    keywordsKey: 'settings.keywords.autoCalc',
    binding: { field: 'autoCalcCPM', apply: value => applyAutoCalcCPM(value as boolean) },
  },
  {
    kind: 'toggle', id: 'taskTypes', group: 'planning', labelKey: 'settings.showTaskTypes', hintKey: 'settings.showTaskTypesHint',
    hintAsNote: true, keywordsKey: 'settings.keywords.taskTypes', binding: bind('showTaskTypes', saveShowTaskTypes),
    inputProps: { 'data-ops-setting-show-task-types': '' },
  },
  {
    kind: 'toggle', id: 'mixedDayHour', group: 'planning', labelKey: 'settings.allowMixedDayHour', hintKey: 'settings.allowMixedDayHourHint',
    keywordsKey: 'settings.keywords.mixedDayHour', binding: bind('allowMixedDayHour', saveAllowMixedDayHour),
  },

  // Meldingen
  {
    kind: 'custom', id: 'formatNotices', group: 'notices', labelKey: 'formatNotice.settingsSection',
    keywordsKey: 'settings.keywords.formatNotices', Control: FormatNoticesControl,
    binding: bind('formatNoticeHidden', saveFormatNoticeHidden),
    searchTexts: t => FORMAT_NOTICE_KINDS.map(kind => t(`formatNotice.formats.${kind}.name`)),
  },

  // Geavanceerd
  {
    // AAN ⇒ tabblad MCP verschijnt; UIT ⇒ tabblad weg + bridge gestopt (`applyAiModeLive`).
    // Platformbouw (#307): geen AI-modus, dus ook geen automatisch starten.
    kind: 'toggle', id: 'aiMode', group: 'advanced', labelKey: 'settings.aiMode', hintKey: 'settings.aiModeHint',
    keywordsKey: 'settings.keywords.aiMode', available: AI_MODE_AVAILABLE,
    binding: { field: 'aiMode', apply: value => { void applyAiModeLive(value as boolean); } },
  },
  {
    // Zonder AI-modus is er geen bridge om te starten: uitgegrijsd in plaats van stil niets doen.
    kind: 'toggle', id: 'aiAutostart', group: 'advanced', labelKey: 'settings.aiAutostart', hintKey: 'settings.aiAutostartHint',
    keywordsKey: 'settings.keywords.aiAutostart', available: AI_MODE_AVAILABLE,
    binding: bind('aiAutostart', saveAiAutostart),
    requires: { met: s => s.ui.aiMode, reasonKey: 'settings.requiresAiMode' },
  },
  {
    kind: 'toggle', id: 'debugTerminal', group: 'advanced', labelKey: 'settings.debugTerminalEnable', hintKey: 'settings.debugTerminalHint',
    keywordsKey: 'settings.keywords.debugTerminal', binding: bind('debugTerminalEnabled', saveDebugTerminalEnabled),
  },
  {
    kind: 'toggle', id: 'classicViewControls', group: 'advanced', labelKey: 'settings.classicViewControls',
    hintKey: 'settings.classicViewControlsHint', keywordsKey: 'settings.keywords.classicViewControls', legacy: true,
    binding: bind('showClassicViewControls', saveShowClassicViewControls),
  },

  // Over de app
  {
    kind: 'custom', id: 'version', group: 'about', labelKey: 'settings.version', hintKey: 'settings.versionHint',
    keywordsKey: 'settings.keywords.version', Control: VersionControl,
  },
  {
    kind: 'custom', id: 'experimental', group: 'about', labelKey: 'settings.experimentalSection',
    keywordsKey: 'settings.keywords.experimental', Control: ExperimentalControl,
    requires: { met: s => s.ui.experimentalSettingsVisible, reasonKey: 'settings.experimentalSection', hide: 'always' },
  },
  {
    kind: 'custom', id: 'tour', group: 'about', labelKey: 'tour.restartButton', hintKey: 'settings.tourHint',
    keywordsKey: 'settings.keywords.tour', Control: TourControl,
  },
  {
    kind: 'custom', id: 'stats', group: 'about', labelKey: 'settings.statsSection', hintKey: 'settings.statsSectionHint',
    keywordsKey: 'settings.keywords.stats', available: DOWNLOAD_STATS_AVAILABLE, Control: StatsControl,
  },
  {
    kind: 'custom', id: 'benchmark', group: 'about', labelKey: 'benchmark.section', hintKey: 'benchmark.sectionHint',
    keywordsKey: 'settings.keywords.benchmark', Control: BenchmarkControl,
  },
];

// Volgorde en volledigheid volgen `settingIds.ts`: één bron voor de volgorde, en een id zonder
// entry (of andersom) valt bij het laden van deze module meteen op.
const BY_ID = new Map(ENTRIES.map(entry => [entry.id, entry]));
if (BY_ID.size !== ENTRIES.length || SETTING_IDS.some(id => !BY_ID.has(id)) || ENTRIES.length !== SETTING_IDS.length) {
  throw new Error('settingsCatalog: de entries volgen settingIds.ts niet precies');
}

/** Alle instellingen die in deze bouw bestaan, in de vaste volgorde. */
export const SETTINGS_CATALOG: readonly SettingEntry[] = SETTING_IDS
  .map(id => BY_ID.get(id)!)
  .filter(entry => entry.available !== false);

export function settingEntry(id: SettingId): SettingEntry | undefined {
  return SETTINGS_CATALOG.find(entry => entry.id === id);
}

export const GROUP_LABEL_KEYS = {
  appearance: 'settings.groups.appearance',
  notation: 'settings.groups.notation',
  timeline: 'settings.groups.timeline',
  workspace: 'settings.groups.workspace',
  planning: 'settings.groups.planning',
  notices: 'settings.groups.notices',
  advanced: 'settings.groups.advanced',
  about: 'settings.groups.about',
} as const satisfies Record<SettingsGroupId, CommonKey>;

/** De groepen die in deze bouw minstens één instelling hebben. */
export const SETTINGS_GROUPS: readonly SettingsGroupId[] = SETTINGS_GROUP_IDS
  .filter(group => SETTINGS_CATALOG.some(entry => entry.group === group));

// --- Standaardwaarden ----------------------------------------------------------------------------

let defaults: UIState | null = null;

/** De standaard van een instelling: die van een nieuwe store, dus dezelfde als bij een eerste start. */
export function defaultSettingValue(binding: SettingBinding): unknown {
  if (binding.defaultValue) return binding.defaultValue();
  defaults ??= createDefaultUI();
  return defaults[binding.field];
}

/** Gelijk voor de doeleinden van "gewijzigd": waarden, lijsten en platte objecten (de wieltoewijzing). */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && [...a].sort().every((v, i) => Object.is(v, [...b].sort()[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length
      && ka.every(k => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** Wijkt de instelling af van de standaard? Instellingen zonder binding (taal, knoppen) tellen niet. */
export function isSettingChanged(entry: SettingEntry, ui: UIState): boolean {
  const binding = entry.binding;
  if (!binding) return false;
  return !sameValue(ui[binding.field], defaultSettingValue(binding));
}

export function resetSetting(entry: SettingEntry): void {
  if (entry.binding) entry.binding.apply(defaultSettingValue(entry.binding));
}
