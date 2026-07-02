import type {
  WeekStartDay,
  UITheme,
  ScrollMode,
  PositionDivision,
  ModifierMap,
  WheelFunction,
  DocumentChromeStyle,
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

export async function loadRibbonCompact(): Promise<boolean | undefined> {
  const v = await getSetting<boolean>('ribbonCompact');
  return typeof v === 'boolean' ? v : undefined;
}

export async function saveRibbonCompact(value: boolean): Promise<void> {
  await setSetting('ribbonCompact', value);
}

const DOCUMENT_CHROME_STYLES: DocumentChromeStyle[] = ['tabs', 'rail', 'switcher'];

export async function loadDocumentChromeStyle(): Promise<DocumentChromeStyle | undefined> {
  const v = await getSetting<DocumentChromeStyle>('documentChromeStyle');
  return v && DOCUMENT_CHROME_STYLES.includes(v) ? v : undefined;
}

export async function saveDocumentChromeStyle(value: DocumentChromeStyle): Promise<void> {
  await setSetting('documentChromeStyle', value);
}
