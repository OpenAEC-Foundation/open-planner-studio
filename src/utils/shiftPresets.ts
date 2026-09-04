import type { WorkCalendar, WorkTimeBands } from '@/types/calendar';
import { workDaysFromBands } from '@/services/subdayIo';
export { seedScalarBands, seedScalarWorkTime } from '@/utils/effectiveWorkTime';

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
  simpleBreakStartMinute?: number;
  simpleBreakDurationMinutes?: number;
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
        simpleBreakStartMinute: undefined, simpleBreakDurationMinutes: undefined,
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

// ── Preset-omschrijving (B3, gebruikstest-bevinding 2026-08-15) ────────────────────────────────
// `applyPreset` in CalendarForm.tsx patchte tot dusver workTime/shift/uren, maar NOOIT
// `description` — dus "Standaard bouwkalender: ma-vr 07:00-16:00" bleef letterlijk staan op een
// net-toegepaste "2 ploegen"-kalender (06:00-22:00). `description` is vrije tekst (net als de
// kalendernaam, bewust GEEN i18n — zie `createDefaultCalendar()`), dus de labels hieronder zijn
// hardgecodeerd Nederlands, gelijk aan de NL-vertaling van `SHIFT_PRESET_LABEL`.
const PRESET_DESCRIPTION_LABEL: Record<ShiftPresetKey, string> = {
  'day': 'Dagdienst',
  'two-shift': '2 ploegen',
  'three-shift': '3 ploegen',
  'night': 'Nachtploeg',
  'continuous': '24/7',
};

/** Compacte, uit de preset-patch AFGELEIDE omschrijving: "<label>: <dagen> <start>:00-<eind>:00" —
 *  blijft dus altijd accuraat (in tegenstelling tot de oude hardgecodeerde default-tekst, die
 *  onwaar werd zodra de werkelijke uren afweken; zie ook de soortgelijke zorg in `mppCalendars.ts`
 *  bij het inlezen van externe kalenders). `three-shift`/`continuous` delen bewust dezelfde
 *  "00:00-24:00"-uren (ze dekken allebei de volle dag); alleen de dagen-tekst onderscheidt ze. */
export function presetDescription(key: ShiftPresetKey): string {
  const p = shiftPresetPatch(key);
  // GEEN modulo-wrap: alle vijf presets leveren workStartHour/workEndHour ∈ [0,24] (nooit negatief,
  // nooit >24), en 24 hoort als "24:00" te tonen (dagslot), niet als "00:00" (dat zou three-shift/
  // continuous — die de VOLLE dag dekken — laten lezen als "geen uren").
  const pad = (h: number) => String(h).padStart(2, '0');
  const days = p.workDays.length >= 7 ? 'alle dagen' : 'ma-vr';
  return `${PRESET_DESCRIPTION_LABEL[key]}: ${days} ${pad(p.workStartHour)}:00-${pad(p.workEndHour)}:00`;
}

/** De twee vaste fabrieksomschrijvingen (`createDefaultCalendar()`/`projectTemplates.ts`, van vóór
 *  er preset-omschrijvingen bestonden) — het historische "machine-gegenereerd"-patroon. */
const LEGACY_DEFAULT_DESCRIPTIONS: readonly string[] = [
  'Standaard bouwkalender: ma-vr 07:00-16:00',
  'Standaardkalender: ma-vr 07:00-16:00',
];

/**
 * Golden-rule-conventie (net als elders in de adapters: "alleen overschrijven wat aantoonbaar
 * gegenereerd is, nooit een handmatige invoer stil vervangen"): waar/onwaar of `description` nog
 * exact een machine-gegenereerde vorm is — óf de fabrieksdefault, óf wat `presetDescription` voor
 * een van de vijf ingebouwde presets zou opleveren. Zodra dat zo is, mag een volgende
 * preset-toepassing de omschrijving meenemen; is de tekst ooit handmatig aangepast (ook maar één
 * teken), dan matcht hij geen van beide meer en blijft hij voorgoed met rust.
 */
export function isAutoGeneratedDescription(description: string): boolean {
  if (LEGACY_DEFAULT_DESCRIPTIONS.includes(description)) return true;
  return (Object.keys(PRESET_DESCRIPTION_LABEL) as ShiftPresetKey[])
    .some(key => presetDescription(key) === description);
}

/** Presets in de kalenderdialoog-rij (§6.6a). Bevat `three-shift` sinds F2 (gebruikstest-
 *  bevinding): de gids (`public/docs/nl/gids-kalenders-uren.md`) noemt "3 ploegen" als vijfde
 *  ingebouwde preset naast Dagdienst/2 ploegen/Nachtploeg/24-7 — de preset zelf (`shiftPresetPatch`)
 *  bestond al (ook gebruikt door `WIZARD_PRESETS`), hij ontbrak alleen in deze rij. */
export const CALENDAR_PRESETS: ShiftPresetKey[] = ['day', 'two-shift', 'three-shift', 'night', 'continuous'];
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
  simpleBreakStartMinute?: number;
  simpleBreakDurationMinutes?: number;
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
    simpleBreakStartMinute: cal.simpleBreakStartMinute,
    simpleBreakDurationMinutes: cal.simpleBreakDurationMinutes,
  };
}

/** Patch om een eigen preset op een kalender toe te passen (werkdagen volgen de banden). */
export function patchFromPreset(p: WorkTimePreset): WorkTimePatch {
  const workDays = p.workTime ? workDaysFromBands(p.workTime) : p.workDays;
  return {
    workTime: p.workTime, shift: p.shift,
    workDays, workStartHour: p.workStartHour, workEndHour: p.workEndHour, hoursPerDay: p.hoursPerDay,
    simpleBreakStartMinute: p.simpleBreakStartMinute,
    simpleBreakDurationMinutes: p.simpleBreakDurationMinutes,
  };
}
