import type { FieldRef } from '@/types/view';

export interface CriticalBarColors {
  critical: string;
  nearCritical: string;
  normal: string;
}

/** Eén app-globale keuze die zowel de scherm-Gantt als de rapportexport aanstuurt. */
export type BarColorSelection =
  | { mode: 'critical'; colors?: CriticalBarColors }
  | { mode: 'auto' }
  | { mode: 'category'; field: FieldRef };

/** Veilige categorie wanneer een projectgebonden activity code of gebruikersveld ontbreekt. */
export const TASK_TYPE_BAR_COLOR_FIELD: FieldRef = { src: 'builtin', key: 'taskType' };

/** Verse installatie en ongeldige opslag houden het vertrouwde kritiek-pad-beeld. */
export const DEFAULT_BAR_COLOR_SELECTION: BarColorSelection = { mode: 'critical' };
