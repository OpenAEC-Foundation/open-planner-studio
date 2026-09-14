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
import { NAME_COLUMN_WIDTH_DEFAULT, NAME_COLUMN_WIDTH_MAX, NAME_COLUMN_WIDTH_MIN, REPORT_FONT_SCALES, REPORT_MAX_ZOOM, REPORT_MIN_ZOOM } from '@/services/print/printPreview';
import {
  REPORTING_PERIOD_PRESETS, type ReportingPeriod, isIsoDay, weeksToPreset,
} from '@/engine/reports/reportingPeriod';
import type { ResourceLoadingBucket } from '@/engine/reports/resourceLoading';

/** localStorage-sleutel (wordt door `setSetting` geprefixt tot `ops-reportSettings`). */
const STORAGE_KEY = 'reportSettings';

export type ReportType =
  | 'gantt'
  // Resourcediagram (issue #113, gfayat): de Gantt-afdruk gegroepeerd per resource — "wie doet
  // wat, en wanneer" — met desgewenst een pagina per resource. Zie `src/engine/reports/resourceGantt.ts`.
  | 'resourceGantt'
  | 'milestones' | 'variance'
  // Tabelrapporten uit discussie #31 (manuvarkey) — zie `src/engine/reports/`.
  | 'lookAhead' | 'critical' | 'progress' | 'health' | 'resourceLoading' | 'resourceAssignments' | 'wbsSummary';

/**
 * De rapporttypen die door de Gantt-printpijplijn lopen (`renderReport` → raster-/vector-PDF met
 * de gepagineerde live preview). Het resourcediagram is dezelfde render met een andere rijenbron;
 * alle Gantt-tekenopties (kritiek pad, speling, relaties, balkkleuren, statuslijn, …) gelden er dus
 * onverkort — alleen *Volg weergave* niet, want de rijen komen dan niet van het scherm.
 */
export function isGanttReportType(type: ReportType): boolean {
  return type === 'gantt' || type === 'resourceGantt';
}

/**
 * Tekent dit rapporttype relatiepijlen? Het resourcediagram niet: een taak staat er onder élke
 * resource die eraan hangt, dus de printrender (`rowIndexOf`, laatste kopie wint) zou een pijl op
 * een willekeurige kopie ankeren en bij "blad per resource" de bladrand af sturen. Eén predicaat voor
 * de forcering van `showDeps` én het verbergen van het vinkje — twee losse condities lopen uit
 * elkaar (hyperkritische review op #132, tweede ronde, N6).
 */
export function reportTypeDrawsRelations(type: ReportType): boolean {
  return type !== 'resourceGantt';
}

/**
 * Toont dit rapporttype het vinkje *Kritiek pad*? Sinds de balkkleurkeuze (`barColorSelection`)
 * stuurt dat vinkje alléén de relatielijnen (rood tussen twee kritieke taken) en de legendaregel;
 * de balken zelf volgen `criticalFill` in `barColors.ts`, ongeacht het vinkje. Bij een type zonder
 * relatiepijlen zou het vinkje dus nog uitsluitend de legendaregel wegnemen terwijl de balken rood
 * blijven — misleidend (manuvarkey op #113). Daarom hetzelfde predicaat als de relaties; het paneel
 * forceert `showCritical` dan op `true`, zodat de legenda bij de rode balken past.
 */
export function reportTypeShowsCriticalToggle(type: ReportType): boolean {
  return reportTypeDrawsRelations(type);
}

/** De rapporttypen die via het gedeelde tabelrapport (`TableReportView`) lopen. */
export const TABLE_REPORT_TYPES: readonly ReportType[] = [
  'lookAhead', 'critical', 'progress', 'health', 'resourceLoading', 'resourceAssignments', 'wbsSummary',
];

export function isTableReportType(type: ReportType): boolean {
  return TABLE_REPORT_TYPES.includes(type);
}

/**
 * Opties van de tabelrapporten — één object, samen bewaard met de rest van de rapportinstellingen.
 * De drempels zijn werkdagen; de vensters zijn rapportageperiodes (issue #120: één gedeeld
 * periodemodel met presets rond de statusdatum, de projectspanne of een eigen datumbereik — zie
 * `src/engine/reports/reportingPeriod.ts`). Defaults volgen issue #120: look-ahead de komende maand,
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
  /** Aggregatie van het belastingsrapport: per kalenderweek of per kalendermaand (issue #119). */
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
 * Opties van het resourcediagram (issue #113). `pageBreakPerResource` = "een blad per persoon":
 * elke resource begint op een nieuwe pagina, zodat je per ploeg of medewerker één vel kunt
 * uitdelen; uit = één doorlopend overlegdocument. `includeUnassigned` neemt de taken zonder
 * resource als laatste band mee — handig om in een overleg te zien wat nog niemand heeft.
 * `groupByType` (manuvarkey, punt 2) zet er een laag boven: eerst een band per resourcetype
 * (arbeid, ploeg, onderaannemer, materieel, materiaal), daarbinnen per resource. `period` (punt 3)
 * is de gedeelde rapportageperiode (issue #120): alleen taken die het venster raken, en de tijdas
 * exact op het venster; default `project` = het oude gedrag.
 */
export interface ResourceGanttReportOptions {
  pageBreakPerResource: boolean;
  includeUnassigned: boolean;
  groupByType: boolean;
  period: ReportingPeriod;
}

export const DEFAULT_RESOURCE_GANTT_OPTIONS: ResourceGanttReportOptions = {
  pageBreakPerResource: false,
  includeUnassigned: false,
  groupByType: false,
  period: { preset: 'project' },
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
/** Alleen de rasterkwaliteit van de live preview; heeft bewust geen invloed op rapport/PDF-layout. */
export type ReportPreviewQuality = '100' | '200' | '300';

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
  customZoom: number;
  paperSize: ReportPaperSize;
  orientation: ReportOrientation;
  repeatHeader: boolean;
  /** Voet (projectnaam, afdrukdatum, legenda) op elke pagina — anders alleen op de laatste. */
  repeatFooter: boolean;
  timelineColumns: number;
  reportFontScale: number;
  /** Statuslijn in de export (#54), letterlijk drie opties zoals gevraagd. */
  statusLine: 'none' | 'statusDate' | 'progress';
  /** Export volgt de schermweergave — filter, groepering, sortering én inklapstatus (#54). */
  followView: boolean;
  previewQuality: ReportPreviewQuality;
  tableReports: TableReportOptions;
  resourceGantt: ResourceGanttReportOptions;
}

/**
 * De defaults zijn EXACT de waarden waarmee `ReportPanel` z'n `useState`-hooks initialiseerde vóór
 * deze persistentie bestond. Een verse installatie (of een gewiste sleutel) gedraagt zich dus
 * byte-identiek aan de oude situatie — persistentie mag geen stille gedragswijziging zijn.
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
  // Standaard aan, net als de kop: een uitdeelvel zonder legenda is onleesbaar (issue #113).
  repeatFooter: true,
  timelineColumns: 1,
  reportFontScale: 100,
  statusLine: 'none',
  followView: false,
  previewQuality: '200',
  tableReports: { ...DEFAULT_TABLE_REPORT_OPTIONS },
  resourceGantt: { ...DEFAULT_RESOURCE_GANTT_OPTIONS },
};

/** Toegestane waarden voor de keuzelijsten — 1-op-1 met de opties in `ReportPanel`. */
const REPORT_TYPES: readonly ReportType[] = ['gantt', 'resourceGantt', 'milestones', 'variance', ...TABLE_REPORT_TYPES];
const PAPER_SIZES: readonly ReportPaperSize[] = ['A4', 'A3', 'A2', 'A1'];
const ORIENTATIONS: readonly ReportOrientation[] = ['landscape', 'portrait'];
const STATUS_LINES: readonly ReportSettings['statusLine'][] = ['none', 'statusDate', 'progress'];
const PREVIEW_QUALITIES: readonly ReportPreviewQuality[] = ['100', '200', '300'];
/** De vaste trap uit `printPreview` — bewust GEEN eigen kopie: de Select in het paneel, de klem in
 *  `makeMetrics` en deze parser moeten per definitie dezelfde waarden kennen, anders accepteert de
 *  ene laag iets wat de andere niet kan tonen of tekenen. */
const FONT_SCALES: readonly number[] = REPORT_FONT_SCALES;
/** Grenzen van de zoom-slider resp. de tijdlijnkolommen-Select in het paneel. */
const ZOOM_MIN = REPORT_MIN_ZOOM;
const ZOOM_MAX = REPORT_MAX_ZOOM;
const TIMELINE_COLUMNS_MIN = 1;
const TIMELINE_COLUMNS_MAX = 8;

// --- Parsers -----------------------------------------------------------------------------------
// Alle parsers geven `undefined` terug bij een waarde die ze niet vertrouwen; de aanroeper valt dan
// PER VELD terug op de default. Dat is bewust: een handmatig geprutste of half-gemigreerde sleutel
// mag hooguit dát ene veld resetten, nooit de rest van de voorkeuren wegvagen.

function parseBoolean(raw: unknown): boolean | undefined {
  return typeof raw === 'boolean' ? raw : undefined;
}

function parseEnum<T extends string>(allowed: readonly T[], raw: unknown): T | undefined {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

// Zie `snapToChoice`: één gedeelde semantiek voor "getal buiten de keuzelijst" (snappen naar de
// dichtstbijzijnde), zodat deze loader, de settings-loader en de render-engine niet elk hun eigen
// antwoord geven op dezelfde vraag.
function parseNumberChoice(allowed: readonly number[], raw: unknown): number | undefined {
  return snapToChoice(allowed, raw);
}

/** Vrij instelbaar getal: afronden + klemmen, zodat een rare waarde de UI niet onbruikbaar maakt. */
function parseClampedInt(raw: unknown, min: number, max: number): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

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
 * Migratie van de oude "N weken"-getallen (vóór issue #120) naar een preset: de kleinste preset
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
    customZoom: parseClampedInt(s.customZoom, ZOOM_MIN, ZOOM_MAX) ?? d.customZoom,
    paperSize: parseEnum(PAPER_SIZES, s.paperSize) ?? d.paperSize,
    orientation: parseEnum(ORIENTATIONS, s.orientation) ?? d.orientation,
    repeatHeader: parseBoolean(s.repeatHeader) ?? d.repeatHeader,
    repeatFooter: parseBoolean(s.repeatFooter) ?? d.repeatFooter,
    timelineColumns: parseClampedInt(s.timelineColumns, TIMELINE_COLUMNS_MIN, TIMELINE_COLUMNS_MAX) ?? d.timelineColumns,
    reportFontScale: parseNumberChoice(FONT_SCALES, s.reportFontScale) ?? d.reportFontScale,
    statusLine: parseEnum(STATUS_LINES, s.statusLine) ?? d.statusLine,
    followView: parseBoolean(s.followView) ?? d.followView,
    // `previewZoom` uit de kortstondige 69ad-versie wordt bewust genegeerd: de preview verandert
    // sindsdien nooit meer van CSS-formaat. Alleen een geldige kwaliteitswaarde heeft effect.
    previewQuality: parseEnum(PREVIEW_QUALITIES, s.previewQuality) ?? d.previewQuality,
    tableReports: parseTableReportOptions(s.tableReports),
    resourceGantt: parseResourceGanttOptions(s.resourceGantt),
  };
}

/** Schrijf de volledige set weg (één sleutel, dus altijd compleet — geen gedeeltelijke merge nodig). */
export async function saveReportSettings(settings: ReportSettings): Promise<void> {
  await setSetting(STORAGE_KEY, settings);
}
