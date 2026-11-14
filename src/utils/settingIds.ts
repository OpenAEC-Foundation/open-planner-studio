// De vaste namen van de instellingen in het instellingenpaneel en van zijn groepen. Bewust een
// losse module zonder React of store: de Help-poort (`scripts/verify-docs.ts`) controleert hiermee
// elke `settings://<id>`-link, en een directe link (`openSettingsAt`) gebruikt dezelfde namen.
// Een id is een contract: een Help-artikel of een ander scherm kan ernaar wijzen. Hernoem er dus
// geen zonder die verwijzingen mee te nemen.

/** De groepen in de volgorde van de navigatie links. */
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

/** Elke rij in het paneel, in de volgorde waarin hij binnen zijn groep staat. */
export const SETTING_IDS = [
  // Uiterlijk
  'theme',
  'language',
  'fontFamily',
  'fontScale',
  // Notatie
  'dateNotation',
  'timeNotation',
  'durationDisplay',
  'weekStartDay',
  // Tijdlijn
  'compressNonWorkdays',
  'quarterHourZoom',
  'barSplitMode',
  'scrollMode',
  'positionDivision',
  'modifierMap',
  // Werkruimte
  'documentChrome',
  'ribbonWheel',
  'autoFitColumns',
  // Planning
  'constructionMode',
  'autoCalc',
  'taskTypes',
  'mixedDayHour',
  // Meldingen
  'formatNotices',
  // Geavanceerd
  'aiMode',
  'aiAutostart',
  'debugTerminal',
  'classicViewControls',
  // Over de app (Experimenteel staat direct onder de versie: je ontgrendelt het via het versienummer)
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
