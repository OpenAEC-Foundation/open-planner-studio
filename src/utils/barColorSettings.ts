import type { BarColorSelection } from '@/types/barColor';
import { DEFAULT_BAR_COLOR_SELECTION } from '@/types/barColor';
import type { BuiltinFieldKey, FieldRef } from '@/types/view';
import { getSetting, setSetting } from '@/utils/settingsStore';

const STORAGE_KEY = 'barColorSelection';

type LegacyBarColorMode = 'critical' | 'task' | 'auto' | 'resource';

function parseFieldRef(raw: unknown): FieldRef | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const field = raw as Record<string, unknown>;
  switch (field.src) {
    case 'builtin':
      return typeof field.key === 'string' && field.key.length > 0
        ? { src: 'builtin', key: field.key as BuiltinFieldKey }
        : undefined;
    case 'activityCode':
      return typeof field.typeId === 'string' && field.typeId.length > 0
        ? { src: 'activityCode', typeId: field.typeId }
        : undefined;
    case 'customField':
      return typeof field.defId === 'string' && field.defId.length > 0
        ? { src: 'customField', defId: field.defId }
        : undefined;
    case 'resource':
      return { src: 'resource' };
    default:
      return undefined;
  }
}

/** Structurele parser; projectcontext-validatie gebeurt later tegen de actuele Group-catalogus. */
export function parseBarColorSelection(raw: unknown): BarColorSelection | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const selection = raw as Record<string, unknown>;
  if (selection.mode === 'critical') return { mode: 'critical' };
  if (selection.mode === 'auto') return { mode: 'auto' };
  if (selection.mode !== 'category') return undefined;
  const field = parseFieldRef(selection.field);
  return field ? { mode: 'category', field } : undefined;
}

function parseLegacyMode(raw: unknown): LegacyBarColorMode | undefined {
  return raw === 'critical' || raw === 'task' || raw === 'auto' || raw === 'resource'
    ? raw
    : undefined;
}

function legacySelection(mode: LegacyBarColorMode | undefined): BarColorSelection | undefined {
  switch (mode) {
    case 'auto': return { mode: 'auto' };
    case 'resource': return { mode: 'category', field: { src: 'resource' } };
    case 'critical':
    case 'task':
      return { mode: 'critical' };
    default:
      return undefined;
  }
}

/**
 * Zet de twee tijdelijke branch-instellingen om naar één keuze. Een expliciete, niet-standaard
 * schermkeuze wint; anders een niet-standaard rapportkeuze; anders het kritiek-pad-default.
 */
export function migrateLegacyBarColorSelection(
  screenRaw: unknown,
  reportRaw: unknown,
): BarColorSelection {
  const screenMode = parseLegacyMode(screenRaw);
  const reportMode = reportRaw && typeof reportRaw === 'object' && !Array.isArray(reportRaw)
    ? parseLegacyMode((reportRaw as Record<string, unknown>).barColorMode)
    : undefined;

  if (screenMode && screenMode !== 'critical') return legacySelection(screenMode)!;
  if (reportMode && reportMode !== 'critical') return legacySelection(reportMode)!;
  return legacySelection(screenMode) ?? legacySelection(reportMode) ?? DEFAULT_BAR_COLOR_SELECTION;
}

export async function saveBarColorSelection(selection: BarColorSelection): Promise<void> {
  await setSetting(STORAGE_KEY, selection);
}

export async function loadBarColorSelection(): Promise<BarColorSelection> {
  const saved = parseBarColorSelection(await getSetting<unknown>(STORAGE_KEY));
  if (saved) return saved;

  const migrated = migrateLegacyBarColorSelection(
    await getSetting<unknown>('screenBarColorMode'),
    await getSetting<unknown>('reportSettings'),
  );
  await saveBarColorSelection(migrated);
  return migrated;
}
