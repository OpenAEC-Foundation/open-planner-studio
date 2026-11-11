// Rapportinstellingen (Rapport-ribbontab) — persistente voorkeuren van het rapportpaneel.
//
// WAAROM een eigen moduletje en NIET het settings-register (`settingsRegistry.ts`)?
// Dat register bindt elke instelling aan een veld in `UIState`, en alles wat in `UIState` landt valt
// in dit project onder de "3-plekken-regel": elke app-instelling moet tegelijk verschijnen in de
// tandwiel-popup, de Instellingen-ribbontab én Backstage → Instellingen (via het gedeelde
// `SettingsPanelContent`). Rapportopties horen daar niet thuis — ze horen bij het rapportpaneel
// zelf, waar ze in context staan naast de live preview. Bovendien zou het `UIState` met veertien
// velden opblazen die verder geen enkel ander onderdeel van de app leest.
//
// WAAROM één sleutel met een object erin, en geen veertien losse `ops-*`-sleutels?
// Dit is één samenhangende voorkeurenset van één paneel; als groep opslaan houdt localStorage
// overzichtelijk, maakt het uitbreiden triviaal (veld erbij = default erbij) en voorkomt veertien
// bijna-identieke `saveX`-wrappers in `settingsStore.ts`. De prefix (`ops-`) en JSON-serialisatie
// komen van `getSetting`/`setSetting`, dus we blijven op hetzelfde opslagpad als de rest van de app.
//
// WAAROM staat `companyName` hier NIET bij:
// die wordt in het paneel geïnitialiseerd uit `project.company` en is dus PROJECTDATA, geen
// app-voorkeur. Zou hij globaal bewaard worden, dan zou de bedrijfsnaam van project A stilletjes in
// het rapport van project B opduiken (of andersom: het projectveld overschrijven). Bedrijfsnaam
// hoort in het projectbestand thuis (IFC-round-trip), niet in localStorage.

import { getSetting, setSetting } from '@/utils/settingsStore';
import { snapToChoice } from '@/utils/numberChoice';
import { parseBoolean, parseClampedInt, parseClampedNumber, parseEnum } from '@/utils/settingParsers';
import { parseBarColorSelection } from '@/utils/barColorSettings';
import { DEFAULT_BAR_COLOR_SELECTION, type BarColorSelection } from '@/types/barColor';
import { NAME_COLUMN_WIDTH_DEFAULT, NAME_COLUMN_WIDTH_MAX, NAME_COLUMN_WIDTH_MIN, REPORT_FONT_SCALES, REPORT_MAX_ZOOM, REPORT_MIN_DAY_WIDTH } from '@/services/print/printPreview';
import {
  REPORTING_PERIOD_PRESETS, type ReportingPeriod, isIsoDay, weeksToPreset,
} from '@/engine/reports/reportingPeriod';
import type { ResourceLoadingBucket } from '@/engine/reports/resourceLoading';
import { DEFAULT_REPORT_FONT_ID, REPORT_FONT_IDS, type ReportFontId } from '@/services/pdf/reportFont';

/** localStorage-sleutel (wordt door `setSetting` geprefixt tot `ops-reportSettings`). */
const STORAGE_KEY = 'reportSettings';

export type ReportType =
  | 'gantt'
  // Resourcediagram (issue #113, gfayat): de Gantt-afdruk gegroepeerd per resource — "wie doet
  // wat, en wanneer" — met desgewenst een pagina per resource. Zie `src/engine/reports/resourceGantt.ts`.
  | 'resourceGantt'
  | 'milestones' | 'variance'
  // Tabelrapporten uit discussie #31 (manuvarkey) — zie `src/engine/reports/`.
  | 'lookAhead' | 'critical' | 'progress' | 'health' | 'resourceLoading' | 'resourceAssignments' | 'wbsSummary'
  // Voortgangscurve (issue #689): kerncijfers en een S-curve — zie `src/engine/reports/progressCurve.ts`.
  | 'progressCurve';

/** De rapporttypen die via het gedeelde tabelrapport (`TableReportView`) lopen. */
export const TABLE_REPORT_TYPES: readonly ReportType[] = [
  'lookAhead', 'critical', 'progress', 'progressCurve', 'health', 'resourceLoading', 'resourceAssignments', 'wbsSummary',
];

export function isTableReportType(type: ReportType): boolean {
  return TABLE_REPORT_TYPES.includes(type);
}

/**
 * Opties van de tabelrapporten — één object, samen bewaard met de rest van de rapportinstellingen.
 * De drempels zijn werkdagen; de vensters zijn rapportageperiodes (één gedeeld periodemodel met
 * presets rond de statusdatum, de projectspanne of een eigen datumbereik — zie
 * `src/engine/reports/reportingPeriod.ts`). Defaults: look-ahead de komende maand,
 * voortgang de afgelopen maand, belasting en toewijzingen de hele projectspanne; near-critical ≤ 5 wd,
 * gezondheid volgens DCMA (44 wd). Bestaande gebruikers raken die defaults niet: hun opgeslagen
 * weken-getal migreert naar de bijbehorende preset (zie `legacyWeeksPeriod`). De oude sleutels
 * worden daarna NIET teruggeschreven — wie terugrolt naar een oudere appversie valt voor deze
 * vier opties stil terug op de fabrieksdefault. Dat is aanvaardbaar voor een rapportvoorkeur
 * (geen projectdata), maar het is een bewuste keuze, geen vergissing.
 */
export interface TableReportOptions {
  lookAheadPeriod: ReportingPeriod;
  nearCriticalDays: number;
  progressPeriod: ReportingPeriod;
  healthHighFloatDays: number;
  healthLongDurationDays: number;
  healthLagDays: number;
  resourceLoadPeriod: ReportingPeriod;
  /** Aggregatie van het belastingsrapport: per kalenderweek of per kalendermaand. */
  resourceLoadBucket: ResourceLoadingBucket;
  resourceLoadOnlyOverloaded: boolean;
  resourceAssignmentPeriod: ReportingPeriod;
  resourceAssignmentIncludeCompleted: boolean;
  /** 0 = volledige WBS. */
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

/** De periode-opties — één lijst, zodat UI en loader dezelfde velden kennen. */
export const TABLE_REPORT_PERIOD_KEYS = ['lookAheadPeriod', 'progressPeriod', 'resourceLoadPeriod', 'resourceAssignmentPeriod'] as const;
export type TableReportPeriodKey = (typeof TABLE_REPORT_PERIOD_KEYS)[number];

/**
 * Opties van het resourcediagram. `pageBreakPerResource` = "een blad per persoon":
 * elke resource begint op een nieuwe pagina, zodat je per ploeg of medewerker één vel kunt
 * uitdelen; uit = één doorlopend overlegdocument. `includeUnassigned` neemt de taken zonder
 * resource als laatste band mee — handig om in een overleg te zien wat nog niemand heeft.
 * `groupByType` zet er een laag boven: eerst een band per resourcetype (arbeid, ploeg,
 * onderaannemer, materieel, materiaal), daarbinnen per resource. `period` is de gedeelde
 * rapportageperiode: alleen taken die het venster raken, en de tijdas exact op het venster; default
 * `project` = de hele projectspanne. `showAssignmentColumns` zet achter de taaknaam twee kolommen met eenheden per dag en verdeelcurve van de resource van
 * de band — standaard aan: dat is de informatie waarvoor je dit rapport uitdeelt.
 */
export interface ResourceGanttReportOptions {
  pageBreakPerResource: boolean;
  includeUnassigned: boolean;
  groupByType: boolean;
  period: ReportingPeriod;
  showAssignmentColumns: boolean;
}

export const DEFAULT_RESOURCE_GANTT_OPTIONS: ResourceGanttReportOptions = {
  pageBreakPerResource: false,
  includeUnassigned: false,
  groupByType: false,
  period: { preset: 'project' },
  showAssignmentColumns: true,
};

/** Grenzen van de numerieke opties (de UI en de loader delen ze). */
export const TABLE_REPORT_LIMITS = {
  nearCriticalDays: { min: 0, max: 60 },
  thresholdDays: { min: 1, max: 365 },
  lagDays: { min: 0, max: 365 },
  wbsLevel: { min: 0, max: 8 },
} as const;
export type ReportPaperSize = 'A4' | 'A3' | 'A2' | 'A1';
export type ReportOrientation = 'landscape' | 'portrait';

/**
 * De kolommen van de Gantt-afdruk (issue #817 deel B), als id's uit het kolomregister van het
 * taakraster (`taskColumnRegistry.ts`), in volgorde. De standaard is de vaste tabel van vóór #817:
 * WBS, Taaknaam, Duur, Start, Einde en Voltooiing.
 */
export const REPORT_DEFAULT_COLUMNS: readonly string[] = [
  'task.wbsCode', 'task.name', 'task.time.scheduleDuration', 'task.time.start', 'task.time.finish', 'task.time.completion',
];
/** De verplichte kolom: zonder taaknaam is een rij op papier niet te lezen. */
export const REPORT_REQUIRED_COLUMN = 'task.name';
/** Bovengrens van de kolomlijst; meer past nooit op een blad naast een tijdlijn. */
export const REPORT_MAX_COLUMNS = 24;

/** Stand van de zijbalk van het Rapport-tabblad: open, of ingeklapt tot een rand met pictogrammen. */
export type ReportSidebarMode = 'open' | 'rail';

/** De stappen van het Rapport-tabblad, in de volgorde van het papier. */
export const REPORT_STUDIO_STEPS = ['tasks', 'columns', 'bars', 'page', 'headerFooter'] as const;
export type ReportStudioStep = typeof REPORT_STUDIO_STEPS[number];

export interface ReportSettings {
  reportType: ReportType;
  showCritical: boolean;
  showFloat: boolean;
  showDeps: boolean;
  showWeekends: boolean;
  /** Werkdagen-as alleen in het rapport; los van de scherm-Gantt-instelling. */
  compressNonWorkdays: boolean;
  showLegend: boolean;
  showTaskNames: boolean;
  showCompletion: boolean;
  /** Taaknamen in de tabel afkappen op `taskNameColumnWidth` (aan), of de kolom aan de langste
   *  naam laten aanpassen (uit). */
  truncateTaskNames: boolean;
  /** Breedte van de naamkolom (ongeschaalde px) wanneer `truncateTaskNames` aanstaat. */
  taskNameColumnWidth: number;
  showBaselineOverlay: boolean;
  autoFit: boolean;
  /** Breedte per dag bij "Vaste schaal" (logische px). Mag een breuk zijn en onder 1 liggen (Rapport-tabblad). */
  customZoom: number;
  paperSize: ReportPaperSize;
  orientation: ReportOrientation;
  repeatHeader: boolean;
  /** Voet (projectnaam, afdrukdatum, legenda) op elke pagina — anders alleen op de laatste. */
  repeatFooter: boolean;
  timelineColumns: number;
  reportFontScale: number;
  /** Lettertype van alle rapporttekst (issue #770): een id uit het vaste setje in `reportFont.ts`.
   *  Alleen deze voorkeur op het apparaat; het IFC-bestand weet er niets van. */
  reportFontFamily: ReportFontId;
  /** Statuslijn in de export: drie opties. */
  statusLine: 'none' | 'statusDate' | 'progress';
  /** Export volgt de schermweergave — filter, groepering, sortering én inklapstatus. */
  followView: boolean;
  /**
   * De layout waarvan het Rapport-tabblad de rijen neemt (issue #861), op id; `''` = geen layout
   * ("Alle taken" of "Zoals de weergave", via `followView`). Ook de meegeleverde layout Resourcediagram staat
   * hier, los van het geopende rapporttype (review Sol #847, ronde 4). Een oude opslag met
   * `reportType: 'resourceGantt'` opent als die layout. Zie `reportTaskSource`.
   */
  layoutId: string;
  tableReports: TableReportOptions;
  resourceGantt: ResourceGanttReportOptions;
  /**
   * Kolommen van de Gantt-afdruk (registerkolom-id's, in volgorde, met de taaknaam erin). Het
   * Rapport-tabblad leest en schrijft dit veld.
   */
  columns: string[];
  /**
   * De balkkleuren van de Gantt-afdruk (keuze Ethan, 10 november 2026: eigen balkkleuren, net als de
   * kolommen). Het Rapport-tabblad leest en schrijft dit veld; het verandert de Gantt op het
   * scherm nooit. Standaard het kritieke pad, net als een vers scherm. Bij *Zoals de weergave* telt dit veld
   * niet (`reportBarColors`).
   */
  barColors: BarColorSelection;
  /** Zijbalk van het Rapport-tabblad. */
  sidebar: ReportSidebarMode;
  /**
   * De open stap van het Rapport-tabblad, of `'none'` als alle stappen dicht zijn. Bij het eerste
   * bezoek stap 1 (Taken), daarna de laatst gebruikte.
   */
  studioStep: ReportStudioStep | 'none';
  /** De aanwijzing "klik op het papier" is gezien (de gebruiker klikte op het papier of sloot hem). */
  paperHintSeen: boolean;
}

/**
 * De defaults van een verse installatie (of een gewiste sleutel); persistentie mag geen stille
 * gedragswijziging zijn.
 */
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
  truncateTaskNames: true,
  taskNameColumnWidth: NAME_COLUMN_WIDTH_DEFAULT,
  showBaselineOverlay: false,
  autoFit: true,
  customZoom: 22,
  paperSize: 'A3',
  orientation: 'landscape',
  repeatHeader: true,
  // Standaard aan, net als de kop: een uitdeelvel zonder legenda is onleesbaar.
  repeatFooter: true,
  timelineColumns: 1,
  reportFontScale: 100,
  // De letter van vóór de keuzelijst: een verse installatie en een oude opslag drukken ongewijzigd af.
  reportFontFamily: DEFAULT_REPORT_FONT_ID,
  statusLine: 'none',
  followView: false,
  layoutId: '',
  tableReports: { ...DEFAULT_TABLE_REPORT_OPTIONS },
  resourceGantt: { ...DEFAULT_RESOURCE_GANTT_OPTIONS },
  columns: [...REPORT_DEFAULT_COLUMNS],
  barColors: DEFAULT_BAR_COLOR_SELECTION,
  sidebar: 'open',
  studioStep: 'tasks',
  paperHintSeen: false,
};

/**
 * De standaardkolommen bij een gegeven *Voltooiing tonen*: zo ziet een oude opgeslagen instelling
 * zonder kolomlijst (Voltooiing uit) na de overstap precies dezelfde tabel als voorheen.
 */
export function defaultReportColumns(showCompletion: boolean): string[] {
  return REPORT_DEFAULT_COLUMNS.filter(id => showCompletion || id !== 'task.time.completion');
}

/**
 * Een opgeslagen kolomlijst: alleen niet-lege tekst-id's zonder stuurtekens, zonder dubbele, hoogstens
 * {@link REPORT_MAX_COLUMNS}, en altijd met de taaknaam (vooraan als hij ontbrak). Geen bruikbare lijst ⇒
 * `undefined`, zodat de aanroeper op de standaard terugvalt. Een id die in dit project niet bestaat
 * blijft staan: in een ander project (met dat eigen veld) is hij weer geldig, en het paneel slaat hem
 * bij het tekenen over.
 */
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

/** Een opgeslagen layout-id: tekst zonder stuurtekens, hoogstens 200 tekens; anders geen layout. */
export function parseReportLayoutId(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length > 200) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return undefined;
  return raw;
}

/** Toegestane waarden voor de keuzelijsten. */
const REPORT_TYPES: readonly ReportType[] = ['gantt', 'resourceGantt', 'milestones', 'variance', ...TABLE_REPORT_TYPES];
const PAPER_SIZES: readonly ReportPaperSize[] = ['A4', 'A3', 'A2', 'A1'];
const ORIENTATIONS: readonly ReportOrientation[] = ['landscape', 'portrait'];
const STATUS_LINES: readonly ReportSettings['statusLine'][] = ['none', 'statusDate', 'progress'];
const SIDEBAR_MODES: readonly ReportSidebarMode[] = ['open', 'rail'];
const STUDIO_STEPS: readonly ReportSettings['studioStep'][] = [...REPORT_STUDIO_STEPS, 'none'];
/** De vaste trap uit `printPreview` — bewust GEEN eigen kopie: de Select in het paneel, de klem in
 *  `makeMetrics` en deze parser moeten per definitie dezelfde waarden kennen, anders accepteert de
 *  ene laag iets wat de andere niet kan tonen of tekenen. */
const FONT_SCALES: readonly number[] = REPORT_FONT_SCALES;
/** Grenzen van de breedte per dag (mag onder 1 px per dag) en van de tijdlijnkolommen. */
const ZOOM_MIN = REPORT_MIN_DAY_WIDTH;
const ZOOM_MAX = REPORT_MAX_ZOOM;
const TIMELINE_COLUMNS_MIN = 1;
const TIMELINE_COLUMNS_MAX = 8;

// --- Parsers -----------------------------------------------------------------------------------
// De veldparsers (`settingParsers.ts`) geven `undefined` terug bij een waarde die ze niet vertrouwen;
// de aanroeper valt dan PER VELD terug op de default. Dat is bewust: een handmatig geprutste of
// half-gemigreerde sleutel mag hooguit dát ene veld resetten, nooit de rest van de voorkeuren wegvagen.

/**
 * Een opgeslagen rapportageperiode: een geldige preset, bij `custom` met twee geordende ISO-dagen.
 * Een `custom` zonder bruikbare datums valt terug op de default (niet op een halve periode).
 */
export function parseReportingPeriod(raw: unknown, fallback: ReportingPeriod): ReportingPeriod {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback };
  const s = raw as Record<string, unknown>;
  const preset = parseEnum(REPORTING_PERIOD_PRESETS, s.preset);
  if (!preset) return { ...fallback };
  if (preset !== 'custom') return { preset };
  if (isIsoDay(s.from) && isIsoDay(s.to) && s.from <= s.to) return { preset, from: s.from, to: s.to };
  return { ...fallback };
}

/**
 * Migratie van de oude "N weken"-getallen naar een preset: de kleinste preset
 * die N dekt (3 weken ⇒ 4 weken), 0 toewijzingsweken ⇒ hele project. Alleen gebruikt wanneer het
 * nieuwe periodeveld ontbreekt; de oude sleutel wordt daarna niet meer teruggeschreven.
 */
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

function parseResourceGanttOptions(raw: unknown): ResourceGanttReportOptions {
  const d = DEFAULT_RESOURCE_GANTT_OPTIONS;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...d };
  const s = raw as Record<string, unknown>;
  return {
    pageBreakPerResource: parseBoolean(s.pageBreakPerResource) ?? d.pageBreakPerResource,
    includeUnassigned: parseBoolean(s.includeUnassigned) ?? d.includeUnassigned,
    groupByType: parseBoolean(s.groupByType) ?? d.groupByType,
    period: parseReportingPeriod(s.period, d.period),
    showAssignmentColumns: parseBoolean(s.showAssignmentColumns) ?? d.showAssignmentColumns,
  };
}

/**
 * Laad de rapportinstellingen. Tolerant op alle drie de manieren waarop de sleutel "fout" kan staan:
 * hij ontbreekt (verse installatie), hij mist velden (opgeslagen door een oudere versie), of een
 * veld bevat rommel (handmatig geprutst). In alle gevallen wint de default voor precies dat veld.
 */
export async function loadReportSettings(): Promise<ReportSettings> {
  const raw = await getSetting<unknown>(STORAGE_KEY);
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
    // `snapToChoice`: dezelfde "getal buiten de keuzelijst"-semantiek als de settings-loader.
    reportFontScale: snapToChoice(FONT_SCALES, s.reportFontScale) ?? d.reportFontScale,
    // Een onbekende id (een letter die een latere versie toevoegde, of geprutst) ⇒ Inter.
    reportFontFamily: parseEnum(REPORT_FONT_IDS, s.reportFontFamily) ?? d.reportFontFamily,
    statusLine: parseEnum(STATUS_LINES, s.statusLine) ?? d.statusLine,
    followView: parseBoolean(s.followView) ?? d.followView,
    layoutId: parseReportLayoutId(s.layoutId) ?? d.layoutId,
    // `previewZoom` en `previewQuality` van de oude rasterpreview (vóór #817) lezen we niet meer; bij het
    // volgende opslaan vallen ze weg.
    tableReports: parseTableReportOptions(s.tableReports),
    resourceGantt: parseResourceGanttOptions(s.resourceGantt),
    // Oude sleutel zonder kolomlijst ⇒ de vaste tabel van toen, inclusief de keuze Voltooiing.
    columns: parseReportColumns(s.columns) ?? defaultReportColumns(parseBoolean(s.showCompletion) ?? d.showCompletion),
    // De structuur telt hier; een veld dat dit project niet heeft, vangt `effectiveBarColorSelection` op.
    barColors: parseBarColorSelection(s.barColors) ?? d.barColors,
    sidebar: parseEnum(SIDEBAR_MODES, s.sidebar) ?? d.sidebar,
    studioStep: parseEnum(STUDIO_STEPS, s.studioStep) ?? d.studioStep,
    paperHintSeen: parseBoolean(s.paperHintSeen) ?? d.paperHintSeen,
  };
}

/** Schrijf de volledige set weg (één sleutel, dus altijd compleet). */
export async function saveReportSettings(settings: ReportSettings): Promise<void> {
  await setSetting(STORAGE_KEY, settings);
}

let pendingPatch: Promise<void> = Promise.resolve();

/**
 * Wijzig alleen deze velden: lees de opgeslagen stand, zet de velden erover en schrijf het geheel terug.
 * Voor het rapportpaneel van de tabelrapporten (`ReportPanel`), dat maar een paar velden kent; zo raakt het
 * nooit de kolommen, balkkleuren of layout van het Rapport-tabblad kwijt. De aanroepen lopen na elkaar, zodat
 * twee snelle wijzigingen elkaar niet overschrijven.
 */
export function patchReportSettings(patch: Partial<ReportSettings>): Promise<void> {
  const run = pendingPatch.then(async () => {
    const current = await loadReportSettings();
    await saveReportSettings({ ...current, ...patch });
  });
  pendingPatch = run.catch(() => {});
  return run;
}
