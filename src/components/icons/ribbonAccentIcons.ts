import type { IconDef, IconId } from './b2/icons.generated';

/**
 * TIJDELIJK, achter de feature flag `lint-iconen-accent` (standaard uit; besluit van Ethan, 7 november 2026).
 *
 * Ethan vond op 7 november 2026 drie lintknoppen te grijs of te verschillend:
 * - *Taak* (tab Start) krijgt dezelfde plus als *Nieuwe resource*: half grijs, half oranje. In de Blueprint krijgt
 *   `task.add` dezelfde tekening als `resource.new`; tot die er is, toont de knop met de flag aan `resource.new`.
 * - *Vereffenen* en *Vereffening wissen* (tab Resources) krijgen een oranje deel: de balk van de weegschaal en het
 *   gewiste spoor onder de gum. De tekeningen hieronder komen uit de Blueprint-branch
 *   `iconen/taak-plus-en-vereffenen` (`scripts/b2_richtlijn.py`, `balance` en `eraser`), omgezet met
 *   `scripts/style-icons.py`.
 *
 * Flag uit: precies de iconen van main. Deze module en de flag gaan eruit zodra de nieuwe tekeningen in de
 * vastgezette Blueprint-set (`b2/icons.generated.ts`) staan en de flag standaard aan gaat.
 */
export const RIBBON_ACCENT_FLAG = 'lint-iconen-accent';

export type IconDrawing = Pick<IconDef, 's16' | 's24'>;

export const RIBBON_ACCENT_DRAWINGS: Readonly<Record<'resource.level' | 'resource.clear-level', IconDrawing>> = {
  'resource.level': {
    s16: { w: 1.25, parts: [[0, 1, "M2.5 2.5L12.5 2.5"], [0, 0, "M7.5 4.75L7.5 13.5"], [0, 0, "M4.5 13.5L10.5 13.5"], [0, 0, "M2.63 5.13L4.37 10.12Q4.5 10.5 4.1 10.5L1.4 10.5Q1 10.5 1.1 10.11L2.4 5.14Q2.5 4.75 2.63 5.13Z"], [0, 0, "M12.6 5.14L13.9 10.11Q14 10.5 13.6 10.5L10.9 10.5Q10.5 10.5 10.63 10.12L12.37 5.13Q12.5 4.75 12.6 5.14Z"]] },
    s24: { w: 1.75, parts: [[0, 1, "M4 4L20 4"], [0, 0, "M12 7.25L12 21"], [0, 0, "M7 21L17 21"], [0, 0, "M5.28 7.78L8.22 13.47Q8.5 14 7.9 14L2.1 14Q1.5 14 1.78 13.47L4.72 7.78Q5 7.25 5.28 7.78Z"], [0, 0, "M19.28 7.78L22.22 13.47Q22.5 14 21.9 14L16.1 14Q15.5 14 15.78 13.47L18.72 7.78Q19 7.25 19.28 7.78Z"]] },
  },
  'resource.clear-level': {
    s16: { w: 1.25, parts: [[0, 1, "M7.5 14.5L13.5 14.5"], [0, 0, "M9.92 1.92L14.08 6.08Q14.5 6.5 14.08 6.92L9.92 11.08Q9.5 11.5 8.9 11.5L6.1 11.5Q5.5 11.5 5.08 11.08L2.92 8.92Q2.5 8.5 2.92 8.08L9.08 1.92Q9.5 1.5 9.92 1.92Z"], [0, 0, "M5.5 5.5L10.5 10.5"]] },
    s24: { w: 1.75, parts: [[0, 1, "M11 21L21 21"], [0, 0, "M14.57 2.57L21.43 9.43Q22 10 21.43 10.57L15.57 16.43Q15 17 14.2 17L9.8 17Q9 17 8.43 16.43L4.57 12.57Q4 12 4.57 11.43L13.43 2.57Q14 2 14.57 2.57Z"], [0, 0, "M8 8L16 16"]] },
  },
};

export type RibbonAccentIconId = 'task.add' | 'resource.level' | 'resource.clear-level';

/** Welk id en welke tekening een van de drie lintknoppen toont. Flag uit: het id zelf, met de Blueprint-tekening. */
export function ribbonAccentIcon(id: RibbonAccentIconId, enabled: boolean): { id: IconId; drawing?: IconDrawing } {
  if (!enabled) return { id };
  if (id === 'task.add') return { id: 'resource.new' };
  return { id, drawing: RIBBON_ACCENT_DRAWINGS[id] };
}
