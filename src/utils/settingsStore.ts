import type {
  WeekStartDay,
  UITheme,
  ScrollMode,
  PositionDivision,
  ModifierMap,
  DocumentChromeStyle,
  Layout,
  DateNotation,
  DurationDisplay,
  BarSplitMode,
  FilterNode,
  SavedFilter,
  UIFontFamily,
} from '@/state/slices/types';

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

/** Synchrone tegenhanger van `initTheme` voor de stóre-default (issue #61): leest en migreert de
 *  opgeslagen themavoorkeur zonder te persisteren. Zo start `ui.uiTheme` met hetzelfde thema als
 *  het pre-paint-script in index.html en kan het `data-theme`-effect in App.tsx bij de eerste
 *  commit nooit een verkeerde default terugzetten (de flits die #61 meldde). Headless (Node,
 *  geen localStorage) valt dit terug op 'dark'; `initTheme` blijft de persisterende bron. */
export function peekTheme(): UITheme {
  try {
    const saved = localStorage.getItem('ops-theme');
    if (!saved) return 'dark';
    return THEME_MIGRATION[saved] ?? 'dark';
  } catch {
    return 'dark';
  }
}

export interface PersistedZoomSettings {
  enableQuarterHourZoom: boolean;
  weekStartDay: WeekStartDay;
  scrollMode: ScrollMode;
  positionDivision: PositionDivision;
  modifierMap: ModifierMap;
}

// De LOAD-kant van de zoom-instellingen (`loadZoomSettings`) + de `isValidModifierMap`-validator zijn
// naar het settings-register verhuisd (`src/utils/settingsRegistry.ts`, pakket M/audit H1). De
// SAVE-kant blijft hier als dunne wrapper zodat de bestaande UI-callsites ongemoeid blijven.
export async function saveZoomSettings(settings: Partial<PersistedZoomSettings>): Promise<void> {
  if (settings.enableQuarterHourZoom !== undefined) await setSetting('enableQuarterHourZoom', settings.enableQuarterHourZoom);
  if (settings.weekStartDay !== undefined) await setSetting('weekStartDay', settings.weekStartDay);
  if (settings.scrollMode !== undefined) await setSetting('scrollMode', settings.scrollMode);
  if (settings.positionDivision !== undefined) await setSetting('positionDivision', settings.positionDivision);
  if (settings.modifierMap !== undefined) await setSetting('modifierMap', settings.modifierMap);
}

export async function saveDebugTerminalEnabled(value: boolean): Promise<void> {
  await setSetting('debugTerminalEnabled', value);
}

// Breedte van de takentabel links in de Gantt (ui.leftPanelWidth); begrensd
// zodat een corrupte localStorage-waarde de chart niet onbruikbaar maakt.
export const TASK_TABLE_MIN_WIDTH = 150;
export const TASK_TABLE_MAX_WIDTH = 800;

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

export async function saveRightPanelWidth(value: number): Promise<void> {
  await setSetting('rightPanelWidth', Math.round(value));
}

// Hoogte van de Eigenschappen-sectie in de rail-accordeon (issue #46, slot; ui.railPropertiesHeight)
// wanneer BEIDE secties openstaan. Zelfde categorie als histogramHeight hieronder: view-state, geen
// instelling — persist via de ops-prefix, buiten de 3-plekken-regel. De boven-klem is bewust ruim en
// statisch (een corrupte localStorage-waarde mag de rail niet onbruikbaar maken); de live klem
// tijdens het slepen rekent met de werkelijke railhoogte, die pas op dat moment bekend is.
export const RAIL_SECTION_MIN_HEIGHT = 120;
export const RAIL_SECTION_MAX_HEIGHT = 2000;

export async function saveRailPropertiesHeight(value: number): Promise<void> {
  await setSetting('railPropertiesHeight', Math.round(value));
}

export async function saveRibbonCompact(value: boolean): Promise<void> {
  await setSetting('ribbonCompact', value);
}

// Histogramstrook (fase 2.5, §6.5): zichtbaarheid + hoogte zijn view-state (net als
// leftPanelWidth), geen instellingen — persist via dezelfde ops-prefix, geen 3-plekken-regel.
export async function saveShowHistogram(value: boolean): Promise<void> {
  await setSetting('showHistogram', value);
}

export const HISTOGRAM_MIN_HEIGHT = 80;
export const HISTOGRAM_MAX_HEIGHT = 480;

export async function saveHistogramHeight(value: number): Promise<void> {
  await setSetting('histogramHeight', Math.round(value));
}

// Baseline-/voortgang-overlays (fase 2.6, §11.1): view-state zoals showHistogram — geen
// instellingen, persist via dezelfde ops-prefix, buiten de 3-plekken-regel.
export async function saveShowBaselineOverlay(value: boolean): Promise<void> {
  await setSetting('showBaselineOverlay', value);
}

export async function saveShowProgressLine(value: boolean): Promise<void> {
  await setSetting('showProgressLine', value);
}

export async function saveShowStatusDateLine(value: boolean): Promise<void> {
  await setSetting('showStatusDateLine', value);
}

export async function saveShowResourceAccent(value: boolean): Promise<void> {
  await setSetting('showResourceAccent', value);
}

// Mini-map (fase 2.7, §11.3): app-globale zichtbaarheid, view-state zoals showHistogram —
// persist via dezelfde ops-prefix (`ops-showMiniMap`), buiten de 3-plekken-regel.
export async function saveShowMiniMap(value: boolean): Promise<void> {
  await setSetting('showMiniMap', value);
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

// Opgeslagen filters (issue #85): net als layouts app-breed op dit apparaat, maar bewust alleen
// de filterboom. Daardoor blijft de rest van de actuele weergave onaangetast bij snel wisselen.
const FILTER_OPERATORS = new Set(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'contains', 'startsWith', 'between', 'isEmpty', 'in']);

function isFilterNode(value: unknown): value is FilterNode {
  if (!value || typeof value !== 'object') return false;
  const node = value as Record<string, unknown>;
  if (node.kind === 'group') {
    return (node.op === 'AND' || node.op === 'OR') && Array.isArray(node.children) && node.children.every(isFilterNode);
  }
  if (node.kind !== 'rule' || !FILTER_OPERATORS.has(node.operator as string)) return false;
  const field = node.field;
  if (!field || typeof field !== 'object') return false;
  const ref = field as Record<string, unknown>;
  return (ref.src === 'builtin' && typeof ref.key === 'string') ||
    (ref.src === 'activityCode' && typeof ref.typeId === 'string') ||
    (ref.src === 'customField' && typeof ref.defId === 'string') ||
    ref.src === 'resource';
}

function isValidSavedFilter(value: unknown): value is SavedFilter {
  if (!value || typeof value !== 'object') return false;
  const filter = value as Record<string, unknown>;
  return typeof filter.id === 'string' && filter.id.length > 0 &&
    typeof filter.name === 'string' && filter.name.trim().length > 0 &&
    isFilterNode(filter.filter);
}

export async function loadSavedFilters(): Promise<SavedFilter[]> {
  const raw = await getSetting<unknown>('savedFilters');
  return Array.isArray(raw) ? raw.filter(isValidSavedFilter) : [];
}

export async function saveSavedFilters(filters: SavedFilter[]): Promise<void> {
  await setSetting('savedFilters', filters);
}

// Automatisch berekenen (fase 2.7 vervolg): app-instelling, dus WEL onder de 3-plekken-regel
// (tandwiel, Instellingen-ribbontab, File-backstage delen allemaal SettingsPanelContent). Default
// UIT — huidig handmatige (F5) gedrag blijft ongewijzigd tenzij de gebruiker 'm expliciet aanzet.
export async function saveAutoCalcCPM(value: boolean): Promise<void> {
  await setSetting('autoCalcCPM', value);
}

// Bouwmodus (bouw-agnostische modus, 2026-07-13): app-instelling onder de 3-plekken-regel
// (tandwiel/ribbontab/backstage delen SettingsPanelContent). AAN = huidige bouwgerichte app;
// UIT = bouw-agnostisch (neutrale default-kalender, geen bouwvak/NL-feestdagen, alleen "Leeg"-
// sjabloon, neutraal taaktype). Default AAN, dus bestaande gebruikers merken niets.
// AFWIJKING van de meeste load*-helpers: dit paar is SYNCHROON (geen Promise) omdat de synchrone
// default-kalenderfabriek (`createDefaultCalendar`/`buildGeneratedCalendar`) de vlag direct moet
// kunnen uitlezen. De `typeof localStorage`-guard houdt de headless test-/Node-omgeving (geen
// localStorage) op de default (bouwmodus aan) — zo blijft de bestaande CPM-suite byte-identiek.
export function loadConstructionMode(): boolean {
  if (typeof localStorage === 'undefined') return true;
  const raw = localStorage.getItem('ops-constructionMode');
  if (raw === null) return true;
  try { return JSON.parse(raw) !== false; } catch { return true; }
}

export function saveConstructionMode(value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('ops-constructionMode', JSON.stringify(value));
}

// Datumnotatie (taak #53): app-instelling, dus WEL onder de 3-plekken-regel (tandwiel,
// Instellingen-ribbontab, File-backstage delen allemaal SettingsPanelContent). Ontbrekende of
// corrupte sleutel ⇒ undefined → de store houdt de default 'dmy' (dd-mm-jjjj), geen reset.
export async function saveDateNotation(value: DateNotation): Promise<void> {
  await setSetting('dateNotation', value);
}

// Lettertype-instellingen interface (issue #25.4): app-instellingen onder de 3-plekken-regel
// (tandwiel/ribbontab/backstage delen SettingsPanelContent). Ontbrekende/corrupte sleutel ⇒
// undefined → de store houdt zijn default ('default' / 100), zonder reset van andere voorkeuren.
export async function saveUIFontFamily(value: UIFontFamily): Promise<void> {
  await setSetting('uiFontFamily', value);
}

export async function saveUIFontScale(value: number): Promise<void> {
  await setSetting('uiFontScale', value);
}

// --- Fase 2.8b: urenplanning-instellingen (§6.8). App-instellingen, dus onder de 3-plekken-regel
//     (tandwiel/ribbontab/backstage delen SettingsPanelContent). Ontbrekende/corrupte sleutel ⇒
//     undefined → de store houdt zijn default (§6.8: hoofdschakelaar uit, gemengd aan, duurweergave
//     automatisch, balk-opsplitsing bij selectie), zonder reset van andere voorkeuren.
export async function saveEnableHourPlanning(value: boolean): Promise<void> {
  await setSetting('enableHourPlanning', value);
}

export async function saveDurationDisplay(value: DurationDisplay): Promise<void> {
  await setSetting('durationDisplay', value);
}

export async function saveBarSplitMode(value: BarSplitMode): Promise<void> {
  await setSetting('barSplitMode', value);
}

// Issue #21 punt 5 (fase 2): «alleen werkbare dagen tonen» — globale weergavevoorkeur, zelfde
// 1-op-1-patroon als barSplitMode hierboven.
export async function saveCompressNonWorkdays(value: boolean): Promise<void> {
  await setSetting('compressNonWorkdays', value);
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

// "Je bent net geüpdatet"-detectie (fase "kleine dingen"): de laatst gestarte appversie. Bij de
// volgende start vergelijken we deze met `getVersion()`; verschillen ze, dan is er net geüpdatet.
// Ontbreekt de sleutel (verse installatie), dan tonen we NIETS en schrijven we 'm alleen weg.
// Zelfde ops-* localStorage-pad als alle andere instellingen.
export async function loadLastVersion(): Promise<string | undefined> {
  const v = await getSetting<string>('lastVersion');
  return typeof v === 'string' && v ? v : undefined;
}

export async function saveLastVersion(value: string): Promise<void> {
  await setSetting('lastVersion', value);
}

// --- MCP-bridge / AI-modus (fase 1 MCP, spec §UI + §Beveiliging). ---------------------------------
// Alle vier via de vertrouwde ops-* localStorage-prefix (geen Tauri plugin-store). `aiMode` en
// `aiAutoBackup` zijn app-instellingen (async, patroon van saveAutoCalcCPM). `mcpPort` en `mcpToken`
// zijn SYNCHROON (zelfde afwijking als loadConstructionMode): de bridge-levenscyclus (`server.ts`)
// moet ze direct kunnen uitlezen bij het starten, en de headless test draait zonder async-bootstrap.
// De `typeof localStorage`-guard houdt de Node-test-/headless-omgeving op de default zonder crash.

/**
 * AI-modus persisteren. Default UIT. Het LADEN loopt via de settingsRegistry
 * (`setting({ key: 'aiMode', … })` in `settingsRegistry.ts`) → `loadAllSettings`, dus een aparte
 * `loadAiMode` is er niet: die zou dode code zijn.
 */
export async function saveAiMode(value: boolean): Promise<void> {
  await setSetting('aiMode', value);
}

/**
 * Automatisch starten van de bridge bij het opstarten van de app. Default UIT — een luisterende
 * poort openen blijft een bewuste keuze. Laden loopt, net als `aiMode`, via de settingsRegistry.
 */
export async function saveAiAutostart(value: boolean): Promise<void> {
  await setSetting('aiAutostart', value);
}

/** Automatische AI-backup vóór de eerste mutatie per document (spec §AI-backup). Default AAN. */
export async function loadAiAutoBackup(): Promise<boolean> {
  const v = await getSetting<boolean>('aiAutoBackup');
  return typeof v === 'boolean' ? v : true;
}

export async function saveAiAutoBackup(value: boolean): Promise<void> {
  await setSetting('aiAutoBackup', value);
}

/** Bridge-poort. Default 3877; een corrupte/ongeldige waarde (buiten 1..65535) valt terug op de default. */
export const MCP_DEFAULT_PORT = 3877;

export function loadMcpPort(): number {
  if (typeof localStorage === 'undefined') return MCP_DEFAULT_PORT;
  const raw = localStorage.getItem('ops-mcpPort');
  if (raw === null) return MCP_DEFAULT_PORT;
  let n: number;
  try { n = Number(JSON.parse(raw)); } catch { return MCP_DEFAULT_PORT; }
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : MCP_DEFAULT_PORT;
}

export function saveMcpPort(value: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('ops-mcpPort', JSON.stringify(Math.round(value)));
}

/** Bridge-Bearer-token. Default null (nog niet gegenereerd); `server.ensureMcpToken` vult 'm bij eerste start. */
export function loadMcpToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem('ops-mcpToken');
  return typeof raw === 'string' && raw ? raw : null;
}

export function saveMcpToken(value: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('ops-mcpToken', value);
}
