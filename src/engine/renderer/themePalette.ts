function cssVarReader(): (name: string, fallback: string) => string {
  const s = getComputedStyle(document.documentElement);
  return (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
}

export const GANTT_TRACE_COLORS = {
  predecessor: '#F59E0B',
  predecessorDriving: '#D97706',
  successor: '#A78BFA',
  successorDriving: '#7C3AED',
} as const;

const BRAND = {
  critical: '#DC2626',
  nearCritical: '#F59E0B',
  hammock: '#0E7490',
  normal: '#2563EB',
  milestone: '#7C3AED',
  baseline: '#1F2937',
  dependency: '#6B7280',
  summary: '#475569',
  ghost: '#94A3B8',
  constraintEarly: '#3B82F6',
  constraintLate: '#8B5CF6',
  deadlineOk: '#10B981',
  tracePred: GANTT_TRACE_COLORS.predecessor,
  tracePredDriving: GANTT_TRACE_COLORS.predecessorDriving,
  traceSucc: GANTT_TRACE_COLORS.successor,
  traceSuccDriving: GANTT_TRACE_COLORS.successorDriving,
};

const FLOAT_PATH_TINTS: string[] = [
  BRAND.normal, BRAND.milestone, '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#0D9488', '#9333EA',
];

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const BAR_LABEL_DARK = '#111827';
export const BAR_LABEL_LIGHT = '#ffffff';

export function barLabelColor(barColor: string): string {
  const rgb = hexToRgb(barColor);
  if (!rgb) return BAR_LABEL_LIGHT;
  const dark = contrastRatio(rgb, [17, 24, 39]);
  const light = contrastRatio(rgb, [255, 255, 255]);
  return dark >= light ? BAR_LABEL_DARK : BAR_LABEL_LIGHT;
}

const DONE_BAR_GREY = { light: '#E5E7EB', dark: '#4E5561' } as const;
const DONE_BAR_TEXT = { light: '#4B5563', dark: '#E2E5EA' } as const;
const DONE_BAR_HUE = 0.08;

export interface DoneBarTones {
  fill: string;
  text: string;
}

export function doneBarTones(base: string, dark: boolean): DoneBarTones {
  const grey = dark ? DONE_BAR_GREY.dark : DONE_BAR_GREY.light;
  const text = dark ? DONE_BAR_TEXT.dark : DONE_BAR_TEXT.light;
  const g = hexToRgb(grey)!;
  const b = hexToRgb(base);
  if (!b) return { fill: grey, text };
  const hx = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const mix = (i: number): string => hx(g[i] + (b[i] - g[i]) * DONE_BAR_HUE);
  return { fill: `#${mix(0)}${mix(1)}${mix(2)}`, text };
}

export interface GanttPalette {
  bg: string;
  surface: string;
  grid: string;
  gridWeekend: string;
  gridWeekBand: string;
  border: string;
  text: string;
  textSecondary: string;
  critical: string;
  nearCritical: string;
  hammock: string;
  normal: string;
  milestone: string;
  float: string;
  baseline: string;
  baselineCompare1: string;
  baselineCompare2: string;
  selected: string;
  dependency: string;
  today: string;
  statusDate: string;
  headerBg: string;
  summary: string;
  ghost: string;
  constraintEarly: string;
  constraintLate: string;
  deadlineOk: string;
  tracePred: string;
  tracePredDriving: string;
  traceSucc: string;
  traceSuccDriving: string;
  floatPathTints: string[];
  accentOn: string;
}

export function readGanttPalette(): GanttPalette {
  const v = cssVarReader();
  return {
    bg: v('--theme-surface', '#ffffff'),
    surface: v('--theme-surface-alt', '#F6F8FB'),
    grid: v('--theme-border-light', '#EDF0F5'),
    gridWeekend: v('--theme-grid-weekend', '#EFF2F7'),
    gridWeekBand: v('--theme-grid-week-band', '#F1F4F9'),
    border: v('--theme-border', '#E2E7EE'),
    text: v('--theme-text', '#333845'),
    textSecondary: v('--theme-text-dim', '#5B6472'),
    critical: v('--theme-bar-critical', BRAND.critical),
    nearCritical: BRAND.nearCritical,
    hammock: BRAND.hammock,
    normal: v('--theme-bar-normal', BRAND.normal),
    milestone: v('--theme-bar-milestone', BRAND.milestone),
    float: v('--theme-bar-float', '#059669'),
    baseline: v('--theme-bar-baseline', BRAND.baseline),
    baselineCompare1: v('--theme-bar-baseline-compare-1', '#0891B2'),
    baselineCompare2: v('--theme-bar-baseline-compare-2', '#A21CAF'),
    selected: v('--theme-accent', '#B45309'),
    dependency: BRAND.dependency,
    today: v('--theme-accent', '#B45309'),
    statusDate: v('--theme-accent', '#B45309'),
    headerBg: v('--theme-surface-alt', '#F6F8FB'),
    summary: v('--theme-bar-summary', BRAND.summary),
    ghost: BRAND.ghost,
    constraintEarly: BRAND.constraintEarly,
    constraintLate: BRAND.constraintLate,
    deadlineOk: BRAND.deadlineOk,
    tracePred: BRAND.tracePred,
    tracePredDriving: BRAND.tracePredDriving,
    traceSucc: BRAND.traceSucc,
    traceSuccDriving: BRAND.traceSuccDriving,
    floatPathTints: FLOAT_PATH_TINTS,
    accentOn: v('--theme-accent-on', '#ffffff'),
  };
}

export interface HistogramPalette {
  bg: string;
  surfaceAlt: string;
  grid: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  hover: string;
  active: string;
  barNormal: string;
  barOver: string;
  capacity: string;
}

export function readHistogramPalette(): HistogramPalette {
  const v = cssVarReader();
  return {
    bg: v('--theme-surface', '#ffffff'),
    surfaceAlt: v('--theme-surface-alt', '#F6F8FB'),
    grid: v('--theme-border-light', '#EDF0F5'),
    border: v('--theme-border', '#E2E7EE'),
    text: v('--theme-text', '#333845'),
    textDim: v('--theme-text-dim', '#5B6472'),
    accent: v('--theme-accent', '#D97706'),
    hover: v('--theme-hover', 'rgba(0,0,0,0.05)'),
    active: v('--theme-active', 'rgba(0,0,0,0.08)'),
    barNormal: v('--theme-bar-normal', BRAND.normal),
    barOver: v('--theme-bar-critical', BRAND.critical),
    capacity: v('--theme-text-dim', '#5B6472'),
  };
}

export interface MiniMapPalette {
  bg: string;
  border: string;
  bar: string;
  critical: string;
  frame: string;
}

export function readMiniMapPalette(): MiniMapPalette {
  const v = cssVarReader();
  return {
    bg: v('--theme-surface-alt', '#F6F8FB'),
    border: v('--theme-border', '#E2E7EE'),
    bar: v('--theme-bar-normal', BRAND.normal),
    critical: v('--theme-bar-critical', BRAND.critical),
    frame: v('--theme-accent', '#B45309'),
  };
}

export const PRINT_PALETTE = {
  bg: '#ffffff',
  surface: '#f8f9fa',
  grid: '#e5e7eb',
  gridWeekend: '#f0f1f3',
  gridWeekBand: '#f1f4f9',
  gridHoliday: '#fef3c7',
  border: '#d1d5db',
  borderDark: '#9ca3af',
  text: '#111827',
  textSecondary: '#6b7280',
  critical: '#DC2626',
  criticalDark: '#991b1b',
  nearCritical: BRAND.nearCritical,
  normal: '#2563EB',
  normalDark: '#1d4ed8',
  milestone: '#7C3AED',
  baseline: '#1F2937',
  baselineCompare1: '#0891B2',
  baselineCompare2: '#A21CAF',
  uncategorized: BRAND.ghost,
  float: '#10B981',
  dependency: '#9CA3AF',
  today: '#F59E0B',
  headerBg: '#f1f5f9',
  summary: '#7C3AED',
  rowEven: '#f9fafb',
  rowOdd: '#ffffff',
};
