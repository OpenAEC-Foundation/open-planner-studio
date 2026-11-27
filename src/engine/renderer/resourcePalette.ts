import type { Resource } from '@/types/resource';
import { TASK_TYPES } from '@/types/task';
import { contrastRatio } from '@/engine/renderer/themePalette';

export const RESOURCE_PALETTE: readonly string[] = [
  '#1E293B',
  '#B91C1C',
  '#DB2777',
  '#C2410C',
  '#6366F1',
  '#0D9488',
  '#D97706',
  '#A78BFA',
  '#38BDF8',
  '#4ADE80',
  '#FBBF24',
  '#BEF264',
];

function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function paletteColorForId(id: string): string {
  return RESOURCE_PALETTE[hashId(id) % RESOURCE_PALETTE.length];
}

const CRITICAL_LOOKALIKE_SLOT = 1;
const BUILTIN_TASK_TYPE_SLOTS = new Set(TASK_TYPES.map(type => hashId(type) % RESOURCE_PALETTE.length));
export const BUILTIN_TASK_TYPE_COLORS: readonly string[] = TASK_TYPES.map(type => paletteColorForId(type));
const CUSTOM_TASK_TYPE_EXTRA_COLORS: readonly string[] = [
  '#7E22CE',
  '#0E7490',
  '#15803D',
  '#CA8A04',
  '#F472B6',
  '#2563EB',
  '#7C2D12',
  '#94A3B8',
];
export const CUSTOM_TASK_TYPE_COLOR_ORDER: readonly string[] = (() => {
  const usable = RESOURCE_PALETTE.map((_, slot) => slot).filter(slot => slot !== CRITICAL_LOOKALIKE_SLOT);
  return [
    ...usable.filter(slot => !BUILTIN_TASK_TYPE_SLOTS.has(slot)).map(slot => RESOURCE_PALETTE[slot]),
    ...CUSTOM_TASK_TYPE_EXTRA_COLORS,
  ];
})();

export function resourceDisplayColor(res: Pick<Resource, 'id' | 'color'>): string {
  return res.color || paletteColorForId(res.id);
}

export function nextFreePaletteColor(existing: ReadonlyArray<Pick<Resource, 'id' | 'color'>>): string {
  const used = new Set(existing.map(resourceDisplayColor));
  for (const c of RESOURCE_PALETTE) if (!used.has(c)) return c;
  return RESOURCE_PALETTE[0];
}

function hexLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const DARK_THEME_MIN_LUMA = 0.34;

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to = (v: number) => Math.round(Math.min(1, Math.max(0, v + m)) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function ensureThemeVisible(hex: string, dark: boolean): string {
  if (!dark || hexLuminance(hex) >= DARK_THEME_MIN_LUMA) return hex;
  const { h, s, l } = hexToHsl(hex);
  let nl = l;
  for (let i = 0; i < 60 && hexLuminance(hslToHex(h, s, nl)) < DARK_THEME_MIN_LUMA; i++) nl = Math.min(1, nl + 0.02);
  return hslToHex(h, s, nl);
}

export function ensureCustomBarVisible(hex: string, dark: boolean): string {
  if (dark) return ensureThemeVisible(hex, true);
  if (hexLuminance(hex) <= 0.30) return hex;
  const { h, s, l } = hexToHsl(hex);
  let nl = l;
  for (let i = 0; i < 60 && hexLuminance(hslToHex(h, s, nl)) > 0.30; i++) nl = Math.max(0, nl - 0.02);
  return hslToHex(h, s, nl);
}

export function ensureHighContrastBarVisible(hex: string, backgrounds: readonly string[]): string {
  const rgb = (value: string): [number, number, number] | null => {
    const match = /^#([0-9a-f]{6})$/i.exec(value);
    if (!match) return null;
    return [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16)) as [number, number, number];
  };
  const bgs = backgrounds.map(bg => rgb(bg) ?? [10, 10, 10] as [number, number, number]);
  const minimumContrast = (color: [number, number, number]) => Math.min(...bgs.map(bg => contrastRatio(color, bg)));
  const original = rgb(hex);
  if (!original || minimumContrast(original) >= 7) return hex;
  const { h, s, l } = hexToHsl(hex);
  const towardWhite = minimumContrast([255, 255, 255]) >= minimumContrast([0, 0, 0]);
  let lightness = l;
  for (let i = 0; i < 100; i++) {
    lightness = Math.max(0, Math.min(1, lightness + (towardWhite ? 0.01 : -0.01)));
    const result = hslToHex(h, s, lightness);
    if (minimumContrast(rgb(result)!) >= 7) return result;
  }
  return towardWhite ? '#ffffff' : '#000000';
}
