import type { FieldRef } from '@/types/view';

export interface CriticalBarColors {
  critical?: string;
  nearCritical?: string;
  normal?: string;
}

export type BarColorSelection =
  (
  | { mode: 'critical' }
  | { mode: 'auto' }
  | { mode: 'category'; field: FieldRef }
  ) & { colors?: CriticalBarColors };

export const DEFAULT_CRITICAL_BAR_COLORS: Required<CriticalBarColors> = { critical: '#dc2626', nearCritical: '#f59e0b', normal: '#2563eb' };

export const TASK_TYPE_BAR_COLOR_FIELD: FieldRef = { src: 'builtin', key: 'taskType' };

export const DEFAULT_BAR_COLOR_SELECTION: BarColorSelection = { mode: 'critical' };
