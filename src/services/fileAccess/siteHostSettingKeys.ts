/**
 * Welke `localStorage`-sleutels de tool bij de host bewaart (#818). Eén hostsleutel per `ops-`-sleutel,
 * met dezelfde naam. Het contract heeft geen `list`, dus bij de start vraagt de tool precies deze
 * sleutels op.
 *
 * `tests/planning/check-site-host-preferences.ts` leest de code: elke `ops-`-sleutel die de app schrijft
 * of wist, moet hier staan of in `HOST_EXCLUDED_KEYS`/`HOST_EXCLUDED_PREFIXES`. Een nieuwe instelling
 * zonder regel hier is daar rood. Elke descriptor in `SETTINGS` (`settingsRegistry.ts`) moet er ook staan.
 */

/** Blijvende instellingen: deze gaan naar de host en komen bij de start terug. */
export const HOST_PERSISTED_KEYS: readonly string[] = [
  // Afwijkers en losse sleutels in `settingsStore.ts`.
  'ops-theme',
  'ops-locale',
  'ops-constructionMode',
  'ops-barColorSelection',
  'ops-reportSettings',
  'ops-taskGridPreferences',
  'ops-taskGridLayouts',
  'ops-lastLayoutId',
  'ops-savedFilters',
  'ops-savedFiltersMigrated',
  'ops-workTimePresets',
  'ops-welcomeSeen',
  'ops-lastVersion',
  'ops-aiAutoBackup',
  // Buiten `settingsStore.ts`.
  'ops-hardPinHintSeen',
  'ops-docs-locale',
  'ops-wbs-templates',
  'ops-personalTaskTypes',
  'ops-schedulingProfiles',
  // Het register (`SETTINGS` in `settingsRegistry.ts`).
  'ops-enableQuarterHourZoom',
  'ops-weekStartDay',
  'ops-scrollMode',
  'ops-positionDivision',
  'ops-modifierMap',
  'ops-debugTerminalEnabled',
  'ops-experimentalSettingsVisible',
  'ops-featureFlags',
  'ops-aiMode',
  'ops-aiAutostart',
  'ops-documentChromeStyle',
  'ops-leftPanelWidth',
  'ops-rightPanelWidth',
  'ops-ribbonCompact',
  'ops-ribbonWheelSwitchesTabs',
  'ops-railPropertiesHeight',
  'ops-railWarningsHeight',
  'ops-showHistogram',
  'ops-histogramHeight',
  'ops-showBaselineOverlay',
  'ops-showProgressLine',
  'ops-showStatusDateLine',
  'ops-showResourceAccent',
  'ops-showFloatBand',
  'ops-showMiniMap',
  'ops-showClassicViewControls',
  'ops-autoCalcCPM',
  'ops-autoFitColumns',
  'ops-dateNotation',
  'ops-timeNotation',
  'ops-uiFontFamily',
  'ops-uiFontScale',
  'ops-showTaskTypes',
  'ops-allowMixedDayHour',
  'ops-durationDisplay',
  'ops-barSplitMode',
  'ops-reportPreviewQuality',
  'ops-compressNonWorkdays',
  'ops-tutorialOfferAnswered',
  'ops-formatNoticeHidden',
  'ops-feedbackEmail',
];

/** Bewust niet bij de host: van één apparaat of één instantie. */
export const HOST_EXCLUDED_KEYS: readonly string[] = [
  'ops-mcpPort', // de MCP-brug van de desktop-app
  'ops-mcpToken', // geheim token van die brug
  'ops-downloadStats', // een cache van 30 minuten
];

/** Bewust niet bij de host: sleutels met een naam die de tool vooraf niet kent. */
export const HOST_EXCLUDED_PREFIXES: readonly string[] = [
  // Instellingen van een extensie (`ops-ext:<id>:<sleutel>`). Extensies staan in de platformbouw uit en
  // leven in IndexedDB, die het frame van de SuperCloud weigert; zonder de extensie zijn ze zinloos.
  'ops-ext:',
];

const PERSISTED = new Set(HOST_PERSISTED_KEYS);

/** Hoort deze `localStorage`-sleutel bij de host? */
export function isHostPersistedKey(key: string): boolean {
  return PERSISTED.has(key);
}
