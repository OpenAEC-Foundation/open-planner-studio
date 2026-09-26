// workRuleMapping.ts — de vertaling tussen de neutrale werkregel (`WorkRule`) en de menukaarten van
// MS Project en Primavera P6. Puur, geen store.
//
// De tabel (cel voor cel geverifieerd tegen de MSP- en P6-documentatie):
//   MSP Fixed Units   + effort-driven  ⇔ P6 Fixed Units/Time              ⇔ FIXED_RATE
//   MSP Fixed Units   − effort-driven  ⇒ FIXED_RATE  + bewaard effortDriven=false
//   MSP Fixed Duration − effort-driven ⇔ P6 Fixed Duration & Units/Time   ⇔ FIXED_DURATION_RATE
//   MSP Fixed Duration + effort-driven ⇒ FIXED_DURATION_WORK + bewaard effortDriven=true
//   MSP Fixed Work (altijd effort-driven) ⇔ P6 Fixed Units               ⇔ FIXED_WORK
// De twee MSP-gevallen die niet exact in een P6-type passen worden dus op het dichtstbijzijnde
// P6-type gelegd, en het bewaarde `Task.effortDriven` stuurt de twee afwijkende cellen in de
// regeltabel (`workTriangle.ts`, `TriangleState.effortDriven`).
//
// Bronnen voor de codes en namen: MSPDI `<Type>` 0/1/2 = Fixed units / Fixed duration / Fixed work
// (Microsoft Learn, "Type Element (Multiple Parents)", ZEKER); P6 `DurationType`-namen uit de
// P6 EPPM REST-documentatie van het Activity-object (ZEKER; dezelfde enum als PMXML); de XER-tokens
// zijn `DT_FixedDrtn`/`DT_FixedDUR2`/`DT_FixedQty`/`DT_FixedRate`.
import type { MspTaskType } from '@/types/task';
import type { WorkRule } from '@/types/workRule';

// ── MS Project ──────────────────────────────────────────────────────────────────────────────────

/** MSPDI `<Type>` op een `<Task>`: 0 = Fixed units, 1 = Fixed duration, 2 = Fixed work. Dezelfde
 *  volgorde als `mppReader.ts`'s `MSP_TASK_TYPE_VALUES`. */
export const MSPDI_TASK_TYPE_CODE: Record<MspTaskType, 0 | 1 | 2> = {
  FIXED_UNITS: 0,
  FIXED_DURATION: 1,
  FIXED_WORK: 2,
};

const MSP_TASK_TYPES_BY_CODE: readonly MspTaskType[] = ['FIXED_UNITS', 'FIXED_DURATION', 'FIXED_WORK'];

/** MSPDI-code → MSP-taaktype; elke andere waarde ⇒ `undefined` (geen terugval: een ontbrekend of
 *  ongeldig `<Type>` betekent "geen typedata", niet "Fixed Work"). */
export function mspTaskTypeFromCode(code: number | null | undefined): MspTaskType | undefined {
  if (code === null || code === undefined || !Number.isInteger(code)) return undefined;
  return MSP_TASK_TYPES_BY_CODE[code];
}

/** MSP-taaktype + effort-driven-vlag → werkregel. Zonder taaktype geen regel. Fixed Work is in MSP
 *  altijd effort-driven, dus de vlag doet daar niets. */
export function workRuleFromMsp(type: MspTaskType | undefined, effortDriven: boolean | undefined): WorkRule | undefined {
  switch (type) {
    case 'FIXED_UNITS': return 'FIXED_RATE';
    case 'FIXED_DURATION': return effortDriven ? 'FIXED_DURATION_WORK' : 'FIXED_DURATION_RATE';
    case 'FIXED_WORK': return 'FIXED_WORK';
    default: return undefined;
  }
}

/**
 * Werkregel → MSP-taaktype + effort-driven-vlag voor de export. Een bewaard `effortDriven` (van een
 * eerdere MSP-import) wint: dan komt de taak terug zoals hij binnenkwam. Zonder bewaarde vlag de
 * P6-lezing van de regel: FIXED_RATE ⇒ effort-driven aan (resource erbij verkort de duur),
 * FIXED_DURATION_RATE ⇒ uit, FIXED_DURATION_WORK ⇒ aan, FIXED_WORK ⇒ altijd aan.
 */
export function mspFromWorkRule(rule: WorkRule, effortDriven: boolean | undefined): { type: MspTaskType; effortDriven: boolean } {
  switch (rule) {
    case 'FIXED_RATE': return { type: 'FIXED_UNITS', effortDriven: effortDriven ?? true };
    case 'FIXED_DURATION_RATE': return { type: 'FIXED_DURATION', effortDriven: effortDriven ?? false };
    case 'FIXED_DURATION_WORK': return { type: 'FIXED_DURATION', effortDriven: effortDriven ?? true };
    case 'FIXED_WORK': return { type: 'FIXED_WORK', effortDriven: true };
  }
}

// ── Primavera P6 (XML) ──────────────────────────────────────────────────────────────────────────

/** P6 `DurationType`-namen (Activity-object; PMXML gebruikt dezelfde tekst). */
export const P6_DURATION_TYPE_NAME: Record<WorkRule, string> = {
  FIXED_DURATION_RATE: 'Fixed Duration and Units/Time',
  FIXED_DURATION_WORK: 'Fixed Duration and Units',
  FIXED_WORK: 'Fixed Units',
  FIXED_RATE: 'Fixed Units/Time',
};

const P6_NAME_TO_RULE: ReadonlyMap<string, WorkRule> = new Map(
  (Object.entries(P6_DURATION_TYPE_NAME) as [WorkRule, string][]).map(([rule, name]) => [normalizeP6Name(name), rule]),
);

/** Tolerant voor "&" versus "and" en hoofdletters (de P6-client toont "Fixed Duration & Units",
 *  het XML-schema schrijft "and"); al het andere ⇒ `undefined`. */
function normalizeP6Name(name: string): string {
  return name.trim().toLowerCase().replace(/\s*&\s*/g, ' and ').replace(/\s+/g, ' ');
}

export function workRuleFromP6DurationType(name: string | null | undefined): WorkRule | undefined {
  if (!name) return undefined;
  return P6_NAME_TO_RULE.get(normalizeP6Name(name));
}

// ── Primavera P6 (XER) ──────────────────────────────────────────────────────────────────────────

/** XER `TASK.duration_type`-tokens. `DT_FixedDUR` (niet-standaard, in p6difftool-
 *  fixtures gezien) staat er bewust NIET in: niet raden, het token blijft rauw bewaard. */
export const XER_DURATION_TYPE_TOKEN: Record<WorkRule, string> = {
  FIXED_DURATION_RATE: 'DT_FixedDrtn',
  FIXED_DURATION_WORK: 'DT_FixedDUR2',
  FIXED_WORK: 'DT_FixedQty',
  FIXED_RATE: 'DT_FixedRate',
};

const XER_TOKEN_TO_RULE: ReadonlyMap<string, WorkRule> = new Map(
  (Object.entries(XER_DURATION_TYPE_TOKEN) as [WorkRule, string][]).map(([rule, token]) => [token, rule]),
);

export function workRuleFromXerDurationType(token: string | null | undefined): WorkRule | undefined {
  if (!token) return undefined;
  return XER_TOKEN_TO_RULE.get(token.trim());
}

// ── Werkvelden bij import ───────────────────────────────────────────────────────────────────────

/** Tolerantie waarbinnen een bronwaarde als "gelijk aan de afleiding" geldt: één minuut. */
const WORK_EPS_MINUTES = 1;

/**
 * "Afwezig ⇒ afgeleid" bij import: werkvelden worden alleen geschreven wanneer de bron een waarde
 * levert die van de afleiding afwijkt (XER: alleen wanneer `target_qty` afwijkt van duur ×
 * `target_qty_per_hr`).
 *
 * - Wijkt het begrote werk af van `duur × inzet`, of het resterende werk van `begroot − verricht`,
 *   dan gaan alle aanwezige bronwaarden mee (één consistent drietal) — het werk ÍS dan anders dan de
 *   afleiding, en de belasting hoort dat te tonen (`assignmentDayUnits` laag 3).
 * - Alleen verricht werk > 0 zonder zo'n afwijking: dan wordt
 *   uitsluitend `actualWorkMinutes` bewaard — verricht werk is een feit dat de afleiding niet kent —
 *   maar `plannedWorkMinutes`/`remainingWorkMinutes` blijven afwezig, want ze zeggen niets dat
 *   `duur × inzet` niet al zegt. Zo blijft `assignmentDayUnits` op laag 4 (de formule) voor
 *   histogram/overallocatie/nivelleerder.
 * - Niets van dat alles ⇒ alles afwezig.
 * Niet-eindige of negatieve bronwaarden gelden als afwezig.
 */
export function importedWorkFields(
  source: { plannedMinutes?: number; actualMinutes?: number; remainingMinutes?: number },
  derivedWorkMinutes: number,
): { plannedWorkMinutes?: number; actualWorkMinutes?: number; remainingWorkMinutes?: number } {
  const clean = (v: number | undefined): number | undefined =>
    (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
  const planned = clean(source.plannedMinutes);
  const actual = clean(source.actualMinutes);
  const remaining = clean(source.remainingMinutes);
  if (planned === undefined && actual === undefined && remaining === undefined) return {};
  const derived = Number.isFinite(derivedWorkMinutes) && derivedWorkMinutes >= 0 ? derivedWorkMinutes : 0;
  const plannedDeviates = planned !== undefined && Math.abs(planned - derived) > WORK_EPS_MINUTES;
  const actualPresent = actual !== undefined && actual > WORK_EPS_MINUTES;
  // Het verwachte restant is begroot − verricht, met de afleiding als begroot wanneer de bron hem mist.
  const expectedRemaining = (planned ?? derived) - (actual ?? 0);
  const remainingDeviates = remaining !== undefined && Math.abs(remaining - expectedRemaining) > WORK_EPS_MINUTES;
  if (!plannedDeviates && !remainingDeviates) return actualPresent ? { actualWorkMinutes: actual } : {};
  return {
    ...(planned !== undefined ? { plannedWorkMinutes: planned } : {}),
    ...(actual !== undefined ? { actualWorkMinutes: actual } : {}),
    ...(remaining !== undefined ? { remainingWorkMinutes: remaining } : {}),
  };
}
