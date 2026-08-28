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
import { REPORT_FONT_SCALES, REPORT_MAX_ZOOM, REPORT_MIN_ZOOM } from '@/services/print/printPreview';

/** localStorage-sleutel (wordt door `setSetting` geprefixt tot `ops-reportSettings`). */
const STORAGE_KEY = 'reportSettings';

export type ReportType = 'gantt' | 'milestones' | 'variance';
export type ReportPaperSize = 'A4' | 'A3' | 'A2' | 'A1';
export type ReportOrientation = 'landscape' | 'portrait';

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
  showBaselineOverlay: boolean;
  autoFit: boolean;
  customZoom: number;
  paperSize: ReportPaperSize;
  orientation: ReportOrientation;
  repeatHeader: boolean;
  timelineColumns: number;
  reportFontScale: number;
  /** Statuslijn in de export (#54), letterlijk drie opties zoals gevraagd. */
  statusLine: 'none' | 'statusDate' | 'progress';
  /** Export volgt de schermweergave — filter, groepering, sortering én inklapstatus (#54). */
  followView: boolean;
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
  showBaselineOverlay: false,
  autoFit: true,
  customZoom: 22,
  paperSize: 'A3',
  orientation: 'landscape',
  repeatHeader: true,
  timelineColumns: 1,
  reportFontScale: 100,
  statusLine: 'none',
  followView: false,
};

/** Toegestane waarden voor de keuzelijsten — 1-op-1 met de opties in `ReportPanel`. */
const REPORT_TYPES: readonly ReportType[] = ['gantt', 'milestones', 'variance'];
const PAPER_SIZES: readonly ReportPaperSize[] = ['A4', 'A3', 'A2', 'A1'];
const ORIENTATIONS: readonly ReportOrientation[] = ['landscape', 'portrait'];
const STATUS_LINES: readonly ReportSettings['statusLine'][] = ['none', 'statusDate', 'progress'];
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
    showBaselineOverlay: parseBoolean(s.showBaselineOverlay) ?? d.showBaselineOverlay,
    autoFit: parseBoolean(s.autoFit) ?? d.autoFit,
    customZoom: parseClampedInt(s.customZoom, ZOOM_MIN, ZOOM_MAX) ?? d.customZoom,
    paperSize: parseEnum(PAPER_SIZES, s.paperSize) ?? d.paperSize,
    orientation: parseEnum(ORIENTATIONS, s.orientation) ?? d.orientation,
    repeatHeader: parseBoolean(s.repeatHeader) ?? d.repeatHeader,
    timelineColumns: parseClampedInt(s.timelineColumns, TIMELINE_COLUMNS_MIN, TIMELINE_COLUMNS_MAX) ?? d.timelineColumns,
    reportFontScale: parseNumberChoice(FONT_SCALES, s.reportFontScale) ?? d.reportFontScale,
    statusLine: parseEnum(STATUS_LINES, s.statusLine) ?? d.statusLine,
    followView: parseBoolean(s.followView) ?? d.followView,
  };
}

/** Schrijf de volledige set weg (één sleutel, dus altijd compleet — geen gedeeltelijke merge nodig). */
export async function saveReportSettings(settings: ReportSettings): Promise<void> {
  await setSetting(STORAGE_KEY, settings);
}
