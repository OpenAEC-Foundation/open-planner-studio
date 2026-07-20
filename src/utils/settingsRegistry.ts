// Settings-register (pakket M, audit H1) — DÉ declaratieve bron van waarheid die per app-instelling
// (localStorage-sleutel, validator/parser, doel-UIState-veld) bindt. Naar het bewezen `SHORTCUTS`-
// patroon (`src/hooks/keyboard/shortcutRegistry.ts`): één descriptor-entry per instelling i.p.v. een
// hand-gesynchroniseerd load-blok in `useSettingsBootstrap` én een parallel `loadX`-paar hier.
// Doel (audit-eis H1): een nieuwe instelling toevoegen = één entry hieronder (+ eventueel een dunne
// `saveX`-wrapper in `settingsStore.ts` en de gedeelde UI in `SettingsPanelContent`).
//
// Contract: elke descriptor is 1-op-1 (één localStorage-sleutel → één UIState-veld). De AFWIJKERS
// die niet in dit uniforme patroon passen — thema (7→3-migratie + persisteert de conversie + levert
// ALTIJD een waarde) en bouwmodus (synchroon, geen Promise, want de kalenderfabriek leest 'm direct)
// — worden expliciet in `loadAllSettings()` afgehandeld, met motivatie ter plaatse. Sleutels die
// buiten de opstart-hydratatie lazy worden geladen (layouts, lastLayoutId, workTimePresets,
// welcomeSeen, locale) staan BEWUST niet in dit register: die voeden geen enkele opstart-`setUI`.
//
// De localStorage-sleutels en -formaten MOETEN byte-identiek blijven aan de oude `loadX`-helpers —
// dit register vervangt alleen de LOAD-kant; de bestaande `saveX`-functies (en dus het
// serialisatieformaat) blijven ongemoeid.

import type { UIState } from '@/state/slices/types';
import {
  DATE_NOTATIONS,
  DURATION_DISPLAYS,
  BAR_SPLIT_MODES,
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
  TASK_TABLE_MIN_WIDTH,
  TASK_TABLE_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  HISTOGRAM_MIN_HEIGHT,
  HISTOGRAM_MAX_HEIGHT,
} from '@/utils/settingsStore';

// --- Parse-/validatiehelpers (byte-identiek aan de oude `loadX`-validators) ---------------------

/** Boolean-instelling: alleen een echte boolean wordt overgenomen; al het andere ⇒ default behouden. */
function parseBoolean(raw: unknown): boolean | undefined {
  return typeof raw === 'boolean' ? raw : undefined;
}

/** Enum-instelling: alleen een waarde uit `allowed` wordt overgenomen. */
function parseEnum<T extends string>(allowed: readonly T[]) {
  return (raw: unknown): T | undefined =>
    typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

/** Geklemde integer: niet-eindig/geen getal ⇒ default behouden; anders afronden + klemmen op [min,max]
 *  — identiek aan de oude `loadLeftPanelWidth`/`loadRightPanelWidth`/`loadHistogramHeight`. */
function parseClampedInt(min: number, max: number) {
  return (raw: unknown): number | undefined => {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
    return Math.min(max, Math.max(min, Math.round(raw)));
  };
}

const WHEEL_FUNCTIONS: WheelFunction[] = ['vertical', 'horizontal', 'zoom'];

// Een ModifierMap is alleen geldig als hij een strikte bijectie over de drie wielfuncties is (elk
// precies één keer). Verworpen anders, zodat een corrupte localStorage-waarde de wielhandler niet
// kan desyncen. Byte-identiek verplaatst uit `settingsStore.isValidModifierMap`.
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

// Klem-grenzen komen rechtstreeks uit `settingsStore.ts` (dezelfde constanten die GanttCanvas/App
// voor de live drag-klem gebruiken), zodat de klem byte-identiek blijft aan de oude `loadX`-helpers.
// Geen import-cyclus: `settingsStore` importeert niets uit dit register.

const SCROLL_MODES: ScrollMode[] = ['position', 'modifier', 'drag'];
const POSITION_DIVISIONS: PositionDivision[] = ['left-right', 'top-bottom', 'corner'];
const WEEK_START_DAYS: WeekStartDay[] = ['monday', 'sunday'];
const DOCUMENT_CHROME_STYLES: DocumentChromeStyle[] = ['tabs', 'rail', 'switcher'];

// --- Register -----------------------------------------------------------------------------------

/** Eén 1-op-1-instelling: localStorage-sleutel `ops-<key>` → UIState-veld `field`, gefilterd door
 *  `parse` (ongeldig/afwezig ⇒ `undefined` → de store-default blijft staan, nooit een reset). */
export interface SettingDescriptor<K extends keyof UIState = keyof UIState> {
  key: string;
  field: K;
  parse: (raw: unknown) => UIState[K] | undefined;
}

// Kleine helper zodat elke entry veldspecifiek getypeerd wordt (parse-return moet bij `field` passen),
// terwijl `SETTINGS` een homogene array blijft.
function setting<K extends keyof UIState>(d: SettingDescriptor<K>): SettingDescriptor {
  return d as SettingDescriptor;
}

// Volgorde is niet betekenisvol: alle velden zijn onafhankelijk en worden tot één `setUI`-patch
// samengevoegd (geen veld overschrijft een ander). Gegroepeerd zoals de oude load-blokken voor
// leesbaarheid.
export const SETTINGS: SettingDescriptor[] = [
  // Zoom/scroll (was `loadZoomSettings` — vijf onafhankelijke sleutels, hier ontbundeld tot vijf
  // 1-op-1-descriptors; dezelfde sleutels, dezelfde validators).
  setting({ key: 'enableQuarterHourZoom', field: 'enableQuarterHourZoom', parse: parseBoolean }),
  setting({ key: 'weekStartDay', field: 'weekStartDay', parse: parseEnum(WEEK_START_DAYS) }),
  setting({ key: 'scrollMode', field: 'scrollMode', parse: parseEnum(SCROLL_MODES) }),
  setting({ key: 'positionDivision', field: 'positionDivision', parse: parseEnum(POSITION_DIVISIONS) }),
  setting({ key: 'modifierMap', field: 'modifierMap', parse: parseModifierMap }),

  // Debug-terminal
  setting({ key: 'debugTerminalEnabled', field: 'debugTerminalEnabled', parse: parseBoolean }),

  // Document-chrome-stijl
  setting({ key: 'documentChromeStyle', field: 'documentChromeStyle', parse: parseEnum(DOCUMENT_CHROME_STYLES) }),

  // Paneelbreedtes (geklemd) + ribbon-compact
  setting({ key: 'leftPanelWidth', field: 'leftPanelWidth', parse: parseClampedInt(TASK_TABLE_MIN_WIDTH, TASK_TABLE_MAX_WIDTH) }),
  setting({ key: 'rightPanelWidth', field: 'rightPanelWidth', parse: parseClampedInt(RIGHT_PANEL_MIN_WIDTH, RIGHT_PANEL_MAX_WIDTH) }),
  setting({ key: 'ribbonCompact', field: 'ribbonCompact', parse: parseBoolean }),

  // Histogramstrook (view-state) — zichtbaarheid + geklemde hoogte
  setting({ key: 'showHistogram', field: 'showHistogram', parse: parseBoolean }),
  setting({ key: 'histogramHeight', field: 'histogramHeight', parse: parseClampedInt(HISTOGRAM_MIN_HEIGHT, HISTOGRAM_MAX_HEIGHT) }),

  // Baseline-/voortgang-overlays (view-state)
  setting({ key: 'showBaselineOverlay', field: 'showBaselineOverlay', parse: parseBoolean }),
  setting({ key: 'showProgressLine', field: 'showProgressLine', parse: parseBoolean }),
  setting({ key: 'showStatusDateLine', field: 'showStatusDateLine', parse: parseBoolean }),

  // Mini-map (view-state)
  setting({ key: 'showMiniMap', field: 'showMiniMap', parse: parseBoolean }),

  // Automatisch berekenen
  setting({ key: 'autoCalcCPM', field: 'autoCalcCPM', parse: parseBoolean }),

  // Datumnotatie
  setting({ key: 'dateNotation', field: 'dateNotation', parse: parseEnum(DATE_NOTATIONS) }),

  // Urenplanning (fase 2.8b, §6.8)
  setting({ key: 'enableHourPlanning', field: 'enableHourPlanning', parse: parseBoolean }),
  setting({ key: 'allowMixedDayHour', field: 'allowMixedDayHour', parse: parseBoolean }),
  setting({ key: 'durationDisplay', field: 'durationDisplay', parse: parseEnum(DURATION_DISPLAYS) }),
  setting({ key: 'barSplitMode', field: 'barSplitMode', parse: parseEnum(BAR_SPLIT_MODES) }),
];

/** Hydrateert álle opstart-instellingen uit localStorage tot één `setUI`-patch. Vervangt de ~20 losse
 *  `loadX().then(v => setUI({...}))`-blokken in `useSettingsBootstrap`. Gedrag is identiek aan de som
 *  van die blokken: dezelfde sleutels, dezelfde validators, dezelfde defaults (ongeldig/afwezig ⇒
 *  veld weggelaten → store-default blijft). Eén patch i.p.v. ~20 losse `setUI`-calls scheelt alleen
 *  renders; de eindtoestand is identiek (geen veld overlapt een ander).
 *
 *  AFWIJKERS (bewust buiten `SETTINGS`, expliciet hier):
 *  - Thema: `initTheme()` migreert 7→3 oude thema's, PERSISTEERT de conversie terug naar localStorage
 *    en levert ALTIJD een waarde (default 'dark'). Dat past niet in het "afwezig ⇒ weglaten"-contract
 *    van `SETTINGS`, dus expliciet.
 *  - Bouwmodus: `loadConstructionMode()` is SYNCHROON (geen Promise) — de kalenderfabriek moet de vlag
 *    direct kunnen uitlezen — en heeft eigen serialisatie (`JSON.stringify`, default `true`). Wordt
 *    daarom als losse sync-aanroep toegevoegd; de vlag wordt ALTIJD gezet (net als voorheen). */
export async function loadAllSettings(): Promise<Partial<UIState>> {
  const patch: Partial<UIState> = {};

  // Afwijker 1: thema-migratie (levert altijd een waarde, persisteert de 7→3-conversie).
  patch.uiTheme = await initTheme();

  // Afwijker 2: bouwmodus (synchroon; altijd gezet).
  patch.constructionMode = loadConstructionMode();

  // 1-op-1-descriptors.
  for (const d of SETTINGS) {
    const raw = await getSetting<unknown>(d.key);
    const value = d.parse(raw);
    if (value !== undefined) {
      // Cast is veilig: `setting()` bindt `parse`'s return aan het type van `field`.
      (patch as Record<string, unknown>)[d.field] = value;
    }
  }

  return patch;
}
