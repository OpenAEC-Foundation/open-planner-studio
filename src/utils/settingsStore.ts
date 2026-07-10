import type {
  WeekStartDay,
  UITheme,
  ScrollMode,
  PositionDivision,
  ModifierMap,
  WheelFunction,
  DocumentChromeStyle,
  Layout,
  DateNotation,
  DurationDisplay,
  BarSplitMode,
} from '@/state/slices/types';
import { DATE_NOTATIONS, DURATION_DISPLAYS, BAR_SPLIT_MODES } from '@/state/slices/types';

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const raw = localStorage.getItem(`ops-${key}`);
  if (raw === null) return undefined;
  try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  localStorage.setItem(`ops-${key}`, typeof value === 'string' ? value : JSON.stringify(value));
}

export async function syncSettingToLocalStorage(storeKey: string, localStorageKey: string): Promise<void> {
  const value = localStorage.getItem(`ops-${storeKey}`);
  if (value) {
    localStorage.setItem(localStorageKey, value);
  }
}

export async function saveLocale(code: string): Promise<void> {
  localStorage.setItem('ops-locale', code);
}

export async function saveTheme(theme: UITheme): Promise<void> {
  localStorage.setItem('ops-theme', theme);
}

// Migration map: 7 oude thema's → 3 nieuwe (post stylebook alignment)
// 'default' was de warme bruine + amber dark theme; nu de canonical 'dark'
// 'light' blijft 'light' (light kleuren krijgen OpenAEC token-update in globals.css)
// 'highContrast' wordt 'high-contrast' (consistente naamgeving)
// Alle andere oude thema's vallen terug op 'dark'
const THEME_MIGRATION: Record<string, UITheme> = {
  'default': 'dark',
  'light': 'light',
  'dark': 'dark',
  'blue': 'dark',
  'amber-navy': 'dark',
  'warm-ember': 'dark',
  'highContrast': 'high-contrast',
  'high-contrast': 'high-contrast',
};

export async function initTheme(): Promise<UITheme> {
  const saved = localStorage.getItem('ops-theme');
  if (!saved) return 'dark';

  const migrated = THEME_MIGRATION[saved] ?? 'dark';
  if (migrated !== saved) {
    // Persisteer de migratie zodat dit een eenmalige conversie is
    localStorage.setItem('ops-theme', migrated);
  }
  return migrated;
}

export interface PersistedZoomSettings {
  enableQuarterHourZoom: boolean;
  weekStartDay: WeekStartDay;
  scrollMode: ScrollMode;
  positionDivision: PositionDivision;
  modifierMap: ModifierMap;
}

const WHEEL_FUNCTIONS: WheelFunction[] = ['vertical', 'horizontal', 'zoom'];

// A ModifierMap is only valid if it is a strict bijection over the three
// wheel functions (each used exactly once). Reject anything else so a
// corrupted localStorage value can't desync the wheel handler.
function isValidModifierMap(m: unknown): m is ModifierMap {
  if (!m || typeof m !== 'object') return false;
  const map = m as Record<string, unknown>;
  const values = [map.plain, map.ctrl, map.shift];
  if (!values.every(v => typeof v === 'string' && WHEEL_FUNCTIONS.includes(v as WheelFunction))) {
    return false;
  }
  return new Set(values).size === 3;
}

export async function loadZoomSettings(): Promise<Partial<PersistedZoomSettings>> {
  const result: Partial<PersistedZoomSettings> = {};
  const qh = await getSetting<boolean>('enableQuarterHourZoom');
  const week = await getSetting<WeekStartDay>('weekStartDay');
  const mode = await getSetting<ScrollMode>('scrollMode');
  const division = await getSetting<PositionDivision>('positionDivision');
  const modMap = await getSetting<ModifierMap>('modifierMap');
  if (typeof qh === 'boolean') result.enableQuarterHourZoom = qh;
  if (week === 'monday' || week === 'sunday') result.weekStartDay = week;
  if (mode === 'position' || mode === 'modifier' || mode === 'drag') result.scrollMode = mode;
  if (division === 'left-right' || division === 'top-bottom' || division === 'corner') {
    result.positionDivision = division;
  }
  if (isValidModifierMap(modMap)) result.modifierMap = modMap;
  return result;
}

export async function saveZoomSettings(settings: Partial<PersistedZoomSettings>): Promise<void> {
  if (settings.enableQuarterHourZoom !== undefined) await setSetting('enableQuarterHourZoom', settings.enableQuarterHourZoom);
  if (settings.weekStartDay !== undefined) await setSetting('weekStartDay', settings.weekStartDay);
  if (settings.scrollMode !== undefined) await setSetting('scrollMode', settings.scrollMode);
  if (settings.positionDivision !== undefined) await setSetting('positionDivision', settings.positionDivision);
  if (settings.modifierMap !== undefined) await setSetting('modifierMap', settings.modifierMap);
}

export async function loadDebugTerminalEnabled(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('debugTerminalEnabled');
  return typeof v === 'boolean' ? v : undefined;
}

export async function saveDebugTerminalEnabled(value: boolean): Promise<void> {
  await setSetting('debugTerminalEnabled', value);
}

// Breedte van de takentabel links in de Gantt (ui.leftPanelWidth); begrensd
// zodat een corrupte localStorage-waarde de chart niet onbruikbaar maakt.
export const TASK_TABLE_MIN_WIDTH = 150;
export const TASK_TABLE_MAX_WIDTH = 800;

export async function loadLeftPanelWidth(): Promise<number | undefined> {
  const v = await getSetting<number>('leftPanelWidth');
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.min(TASK_TABLE_MAX_WIDTH, Math.max(TASK_TABLE_MIN_WIDTH, Math.round(v)));
}

export async function saveLeftPanelWidth(value: number): Promise<void> {
  await setSetting('leftPanelWidth', Math.round(value));
}

// Breedte van het rechterpaneel (eigenschappen / gedockte resourcelijst, ui.rightPanelWidth).
// Zelfde patroon als leftPanelWidth hierboven. De boven-klem is bewust ruim en statisch (i.p.v.
// "60% van het venster", wat pas bij het slepen zelf bekend is) — dat voorkomt alleen dat een
// corrupte localStorage-waarde de layout onbruikbaar maakt; de live drag-klem in App.tsx gebruikt
// wel de venstergrootte.
export const RIGHT_PANEL_MIN_WIDTH = 200;
export const RIGHT_PANEL_MAX_WIDTH = 900;

export async function loadRightPanelWidth(): Promise<number | undefined> {
  const v = await getSetting<number>('rightPanelWidth');
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, Math.round(v)));
}

export async function saveRightPanelWidth(value: number): Promise<void> {
  await setSetting('rightPanelWidth', Math.round(value));
}

export async function loadRibbonCompact(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('ribbonCompact');
  return typeof v === 'boolean' ? v : undefined;
}

export async function saveRibbonCompact(value: boolean): Promise<void> {
  await setSetting('ribbonCompact', value);
}

// Histogramstrook (fase 2.5, §6.5): zichtbaarheid + hoogte zijn view-state (net als
// leftPanelWidth), geen instellingen — persist via dezelfde ops-prefix, geen 3-plekken-regel.
export async function loadShowHistogram(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('showHistogram');
  return typeof v === 'boolean' ? v : undefined;
}

export async function saveShowHistogram(value: boolean): Promise<void> {
  await setSetting('showHistogram', value);
}

export const HISTOGRAM_MIN_HEIGHT = 80;
export const HISTOGRAM_MAX_HEIGHT = 480;

export async function loadHistogramHeight(): Promise<number | undefined> {
  const v = await getSetting<number>('histogramHeight');
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.min(HISTOGRAM_MAX_HEIGHT, Math.max(HISTOGRAM_MIN_HEIGHT, Math.round(v)));
}

export async function saveHistogramHeight(value: number): Promise<void> {
  await setSetting('histogramHeight', Math.round(value));
}

// Baseline-/voortgang-overlays (fase 2.6, §11.1): view-state zoals showHistogram — geen
// instellingen, persist via dezelfde ops-prefix, buiten de 3-plekken-regel.
export async function loadShowBaselineOverlay(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('showBaselineOverlay');
  return typeof v === 'boolean' ? v : undefined;
}
export async function saveShowBaselineOverlay(value: boolean): Promise<void> {
  await setSetting('showBaselineOverlay', value);
}

export async function loadShowProgressLine(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('showProgressLine');
  return typeof v === 'boolean' ? v : undefined;
}
export async function saveShowProgressLine(value: boolean): Promise<void> {
  await setSetting('showProgressLine', value);
}

export async function loadShowStatusDateLine(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('showStatusDateLine');
  return typeof v === 'boolean' ? v : undefined;
}
export async function saveShowStatusDateLine(value: boolean): Promise<void> {
  await setSetting('showStatusDateLine', value);
}

// Mini-map (fase 2.7, §11.3): app-globale zichtbaarheid, view-state zoals showHistogram —
// persist via dezelfde ops-prefix (`ops-showMiniMap`), buiten de 3-plekken-regel.
export async function loadShowMiniMap(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('showMiniMap');
  return typeof v === 'boolean' ? v : undefined;
}
export async function saveShowMiniMap(value: boolean): Promise<void> {
  await setSetting('showMiniMap', value);
}

const DOCUMENT_CHROME_STYLES: DocumentChromeStyle[] = ['tabs', 'rail', 'switcher'];

export async function loadDocumentChromeStyle(): Promise<DocumentChromeStyle | undefined> {
  const v = await getSetting<DocumentChromeStyle>('documentChromeStyle');
  return v && DOCUMENT_CHROME_STYLES.includes(v) ? v : undefined;
}

export async function saveDocumentChromeStyle(value: DocumentChromeStyle): Promise<void> {
  await setSetting('documentChromeStyle', value);
}

// Layouts (fase 2.7, §8.2): app-globaal in localStorage, géén Tauri-store. Parse-guard: corrupte JSON
// of een item zonder de juiste shape → weggelaten (nooit een crash op een handmatig geprutste
// localStorage-waarde). `ops-lastLayoutId` moet naar een BESTAANDE layout wijzen, anders `null` —
// die check gebeurt hier niet (de aanroeper kent de actuele lijst pas na `loadLayouts()`).
function isValidLayout(v: unknown): v is Layout {
  if (!v || typeof v !== 'object') return false;
  const l = v as Record<string, unknown>;
  return (
    typeof l.id === 'string' &&
    typeof l.name === 'string' &&
    Array.isArray(l.columns) &&
    Array.isArray(l.group) &&
    Array.isArray(l.sort) &&
    (l.filter === null || typeof l.filter === 'object') &&
    typeof l.timeScale === 'string'
  );
}

export async function loadLayouts(): Promise<Layout[]> {
  const raw = await getSetting<unknown>('layouts');
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidLayout);
}

export async function saveLayouts(layouts: Layout[]): Promise<void> {
  await setSetting('layouts', layouts);
}

// Automatisch berekenen (fase 2.7 vervolg): app-instelling, dus WEL onder de 3-plekken-regel
// (tandwiel, Instellingen-ribbontab, File-backstage delen allemaal SettingsPanelContent). Default
// UIT — huidig handmatige (F5) gedrag blijft ongewijzigd tenzij de gebruiker 'm expliciet aanzet.
export async function loadAutoCalcCPM(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('autoCalcCPM');
  return typeof v === 'boolean' ? v : undefined;
}

export async function saveAutoCalcCPM(value: boolean): Promise<void> {
  await setSetting('autoCalcCPM', value);
}

// Datumnotatie (taak #53): app-instelling, dus WEL onder de 3-plekken-regel (tandwiel,
// Instellingen-ribbontab, File-backstage delen allemaal SettingsPanelContent). Ontbrekende of
// corrupte sleutel ⇒ undefined → de store houdt de default 'dmy' (dd-mm-jjjj), geen reset.
export async function loadDateNotation(): Promise<DateNotation | undefined> {
  const v = await getSetting<DateNotation>('dateNotation');
  return v && DATE_NOTATIONS.includes(v) ? v : undefined;
}

export async function saveDateNotation(value: DateNotation): Promise<void> {
  await setSetting('dateNotation', value);
}

// --- Fase 2.8b: urenplanning-instellingen (§6.8). App-instellingen, dus onder de 3-plekken-regel
//     (tandwiel/ribbontab/backstage delen SettingsPanelContent). Ontbrekende/corrupte sleutel ⇒
//     undefined → de store houdt zijn default (§6.8: hoofdschakelaar uit, gemengd aan, duurweergave
//     automatisch, balk-opsplitsing bij selectie), zonder reset van andere voorkeuren.
export async function loadEnableHourPlanning(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('enableHourPlanning');
  return typeof v === 'boolean' ? v : undefined;
}

export async function saveEnableHourPlanning(value: boolean): Promise<void> {
  await setSetting('enableHourPlanning', value);
}

export async function loadAllowMixedDayHour(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('allowMixedDayHour');
  return typeof v === 'boolean' ? v : undefined;
}

export async function saveAllowMixedDayHour(value: boolean): Promise<void> {
  await setSetting('allowMixedDayHour', value);
}

export async function loadDurationDisplay(): Promise<DurationDisplay | undefined> {
  const v = await getSetting<DurationDisplay>('durationDisplay');
  return v && DURATION_DISPLAYS.includes(v) ? v : undefined;
}

export async function saveDurationDisplay(value: DurationDisplay): Promise<void> {
  await setSetting('durationDisplay', value);
}

export async function loadBarSplitMode(): Promise<BarSplitMode | undefined> {
  const v = await getSetting<BarSplitMode>('barSplitMode');
  return v && BAR_SPLIT_MODES.includes(v) ? v : undefined;
}

export async function saveBarSplitMode(value: BarSplitMode): Promise<void> {
  await setSetting('barSplitMode', value);
}

// Eigen werktijd-presets (§6.6b): app-niveau localStorage, NIET in het projectbestand — ze reizen
// niet mee met een project maar zijn op elke machine van de gebruiker beschikbaar. Parse-guard:
// corrupte JSON of een item zonder de juiste shape ⇒ weggelaten (nooit een crash op een handmatig
// geprutste localStorage-waarde), analoog aan `loadLayouts`.
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

// First-startup-ervaring (fase 2.10, onderdeel 3, §1/§3): of de welkomstdialoog al gezien is.
// Géén appversie in de sleutel (bindend architect-besluit) — eenmaal gezet, blijft de app 'm
// nooit meer tonen, ook niet na een update. Zelfde ops-* localStorage-pad als alle andere
// instellingen (geen Tauri plugin-store), patroon identiek aan loadShowHistogram/saveShowHistogram.
export async function loadWelcomeSeen(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('welcomeSeen');
  return typeof v === 'boolean' ? v : undefined;
}

export async function saveWelcomeSeen(value: boolean): Promise<void> {
  await setSetting('welcomeSeen', value);
}
