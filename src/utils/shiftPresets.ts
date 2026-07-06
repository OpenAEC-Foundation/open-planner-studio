import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import { workDaysFromBands } from '@/services/subdayIo';

/**
 * Ploeg-/werktijd-presets (fase 2.8b, §6.6/§6.7). Eén gedeelde definitie voor zowel de
 * kalenderdialoog (`CalendarForm`) als de nieuw-project-wizard (`ProjectInfoDialog`), plus de
 * eigen-preset-opslag op app-niveau (localStorage, §6.8 — NIET in het projectbestand).
 *
 * Een preset zet de `workTime`-banden (§3.2, canoniek `[start,end)` in minuten-vanaf-middernacht,
 * wrap ⇒ `end ∈ (1440,2880]`) + de `shift`-classificatie (§7.1) + de scalar-fallbackvelden
 * (`workDays`/`workStartHour`/`workEndHour`/`hoursPerDay`) die de dag↔uur-adapters gebruiken.
 * "Dagdienst" is bewust GEEN uur-kalender: het wist `workTime` (terug naar dag-modus).
 */

export type ShiftPresetKey = 'day' | 'two-shift' | 'three-shift' | 'night' | 'continuous';

/** Patch die op een `WorkCalendar` wordt toegepast. `workTime: undefined` ⇒ dag-kalender. */
export interface WorkTimePatch {
  workTime: WorkTimeBands | undefined;
  shift: WorkCalendar['shift'] | undefined;
  workDays: number[];
  workStartHour: number;
  workEndHour: number;
  hoursPerDay: number;
}

const WEEKDAYS = [1, 2, 3, 4, 5];

/** Bouw een `WorkTimeBands` met dezelfde banden op elke opgegeven weekdag. */
export function makeBands(days: number[], bands: { start: number; end: number }[]): WorkTimeBands {
  const byWeekday = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] } as WorkTimeBands['byWeekday'];
  for (const d of days) byWeekday[d as 1] = bands.map((b) => ({ ...b }));
  return { byWeekday };
}

/**
 * Banden voor ÉÉN werkdag afgeleid uit het scalar-model (`workStartHour`/`workEndHour`/`hoursPerDay`),
 * zó dat de **band-som EXACT `hoursPerDay × 60` minuten** is (QA-fix golf, ontwerpdoc §2.3, open risico 5).
 *
 * Het gevaar: de default-kalender is `07:00-16:00` met `hoursPerDay=8` — 9 klokuren spanne, 8 netto uur.
 * Eén naïeve band `[07:00,16:00]` levert 9u en corrumpeert `deriveHoursPerDay` naar 9. In plaats daarvan
 * materialiseren we het impliciete verschil (`spanne − netto`) als een **pauze-gat rond het middaguur**
 * (12:00), zodat 9 klokuren/8 netto ⇒ `07:00-12:00 + 13:00-16:00` (som exact 480m = 8u).
 *
 * - `spanne ≤ netto` (bv. 08:00-16:00 op 8u, of 00:00-24:00 op 24u) ⇒ één band `[start,end)`, byte-identiek.
 * - `spanne > netto` ⇒ twee banden met het pauze-gat; de pauze wordt zo dicht mogelijk bij 12:00 gelegd,
 *   geklemd binnen `[start,end)`. Landt de pauze precies op een rand, dan valt de lege band weg (één band).
 */
export function seedScalarBands(
  startMin: number,
  endMin: number,
  hoursPerDay: number,
): { start: number; end: number }[] {
  const target = Math.round(hoursPerDay * 60);
  // Defensief: een niet-oplopende of ongeldige spanne ⇒ één rauwe band (canonicalisatie doet de rest).
  if (endMin <= startMin || target <= 0) return [{ start: startMin, end: endMin }];
  const span = endMin - startMin;
  if (span <= target) return [{ start: startMin, end: endMin }];
  const gap = span - target; // impliciete pauze
  const NOON = 12 * 60;
  // Pauze rond het middaguur, geklemd zodat beide randen binnen [start,end) blijven.
  const gapStart = Math.min(Math.max(NOON, startMin), endMin - gap);
  const gapEnd = gapStart + gap;
  const bands: { start: number; end: number }[] = [];
  if (gapStart > startMin) bands.push({ start: startMin, end: gapStart });
  if (gapEnd < endMin) bands.push({ start: gapEnd, end: endMin });
  return bands.length ? bands : [{ start: startMin, end: endMin }];
}

/**
 * Seed een volledige `WorkTimeBands` uit het scalar-dag-model bij het openen van de banden-editor op een
 * dag-kalender (QA-fix golf). Elke werkdag krijgt dezelfde {@link seedScalarBands}-banden, zodat de
 * afgeleide `hoursPerDay` gelijk blijft aan de opgegeven scalar-waarde (regressiekern).
 */
export function seedScalarWorkTime(
  workDays: number[],
  workStartHour: number,
  workEndHour: number,
  hoursPerDay: number,
): WorkTimeBands {
  return makeBands(workDays, seedScalarBands(workStartHour * 60, workEndHour * 60, hoursPerDay));
}

/**
 * Volledige patch voor een ingebouwde ploeg-preset.
 * - `day`         — dagdienst 08:00-16:00, dag-kalender (geen `workTime`).
 * - `two-shift`   — dag+avond 06:00-22:00 (16u/dag), ma-vr.
 * - `three-shift` — dag/avond/nacht, volle 24u/dag (06:00-06:00 volgende dag), ma-vr.
 * - `night`       — nachtploeg 22:00-06:00 (wrap, 8u), ma-vr.
 * - `continuous`  — 24/7, alle 7 dagen 00:00-24:00 (24u).
 */
export function shiftPresetPatch(key: ShiftPresetKey): WorkTimePatch {
  switch (key) {
    case 'day':
      return {
        workTime: undefined, shift: undefined,
        workDays: [...WEEKDAYS], workStartHour: 8, workEndHour: 16, hoursPerDay: 8,
      };
    case 'two-shift':
      return {
        workTime: makeBands(WEEKDAYS, [{ start: 360, end: 840 }, { start: 840, end: 1320 }]),
        shift: 'SECOND',
        workDays: [...WEEKDAYS], workStartHour: 6, workEndHour: 22, hoursPerDay: 16,
      };
    case 'three-shift':
      return {
        // 06:00-14:00 + 14:00-22:00 + 22:00-06:00(wrap) = volle 24u.
        workTime: makeBands(WEEKDAYS, [
          { start: 360, end: 840 }, { start: 840, end: 1320 }, { start: 1320, end: 1800 },
        ]),
        shift: 'USERDEFINED',
        workDays: [...WEEKDAYS], workStartHour: 0, workEndHour: 24, hoursPerDay: 24,
      };
    case 'night':
      return {
        workTime: makeBands(WEEKDAYS, [{ start: 1320, end: 1800 }]), // 22:00 → 06:00 (wrap)
        shift: 'THIRD',
        workDays: [...WEEKDAYS], workStartHour: 22, workEndHour: 6, hoursPerDay: 8,
      };
    case 'continuous':
      return {
        workTime: makeBands([1, 2, 3, 4, 5, 6, 7], [{ start: 0, end: 1440 }]),
        shift: 'USERDEFINED',
        workDays: [1, 2, 3, 4, 5, 6, 7], workStartHour: 0, workEndHour: 24, hoursPerDay: 24,
      };
  }
}

/** i18n-key (common-namespace) voor een preset-label. */
export const SHIFT_PRESET_LABEL: Record<ShiftPresetKey, string> = {
  'day': 'calendar.shift.day',
  'two-shift': 'calendar.shift.twoShift',
  'three-shift': 'calendar.shift.threeShift',
  'night': 'calendar.shift.night',
  'continuous': 'calendar.shift.continuous',
};

/** Presets in de kalenderdialoog-rij (§6.6a). */
export const CALENDAR_PRESETS: ShiftPresetKey[] = ['day', 'two-shift', 'night', 'continuous'];
/** Presets in de wizard-ploegkeuze (§6.7). */
export const WIZARD_PRESETS: ShiftPresetKey[] = ['day', 'two-shift', 'three-shift', 'continuous'];

/**
 * Eigen (gebruiker-)preset — app-niveau localStorage (§6.6b/§6.8). Bewaart de werktijd-relevante
 * velden van een kalender onder een naam; reist NIET mee met een projectbestand.
 */
export interface WorkTimePreset {
  id: string;
  name: string;
  workTime?: WorkTimeBands;
  shift?: WorkCalendar['shift'];
  workDays: number[];
  workStartHour: number;
  workEndHour: number;
  hoursPerDay: number;
}

/** Snapshot de werktijd-velden van een kalender als eigen preset. */
export function presetFromCalendar(id: string, name: string, cal: WorkCalendar): WorkTimePreset {
  return {
    id, name,
    workTime: cal.workTime,
    shift: cal.shift,
    workDays: [...cal.workDays],
    workStartHour: cal.workStartHour,
    workEndHour: cal.workEndHour,
    hoursPerDay: cal.hoursPerDay,
  };
}

/** Patch om een eigen preset op een kalender toe te passen (werkdagen volgen de banden). */
export function patchFromPreset(p: WorkTimePreset): WorkTimePatch {
  const workDays = p.workTime ? workDaysFromBands(p.workTime) : p.workDays;
  return {
    workTime: p.workTime, shift: p.shift,
    workDays, workStartHour: p.workStartHour, workEndHour: p.workEndHour, hoursPerDay: p.hoursPerDay,
  };
}
