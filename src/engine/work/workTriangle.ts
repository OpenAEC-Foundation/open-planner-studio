// workTriangle.ts — de PURE rekenkern van de taaktypes-etappe (ontwerp
// `docs/superpowers/specs/2026-09-04-spec-taaktypes-opgeslagen-werk.md`, §5 en §6; bouwstap 3).
//
// WAT DIT IS. Eén rekensom, werk = duur × inzet, en per werkregel (`WorkRule`) de afspraak welke
// van de drie beschermd is wanneer de gebruiker aan een andere draait. Deze module krijgt de
// RESTERENDE toestand van één taak (restduur in werkminuten, per toewijzing inzet per dag en
// optioneel resterend werk) plus één bewerking, en geeft de nieuwe toestand terug — of een
// weigering. Verricht werk en verrichte duur zitten er bewust NIET in: dat zijn feiten die geen
// enkele regel aanraakt (spec §2.1/§2.2/§6.5); de driehoek werkt op het restant.
//
// GEEN store, geen Task/ResourceAssignment-types: de bedrading (bouwstap 4) vertaalt de
// domeinobjecten naar `TriangleState` en de uitkomst terug. Zo is de regeltabel headless en
// case-voor-case te toetsen (`tests/planning/check-work-triangle.ts` +
// `work-triangle-cases.json`, de meetlat uit spec §9) zonder dat de rest van de app er al van weet.
//
// DE DRIE REGELS DIE DE TABEL EENDUIDIG MAKEN (spec §5, "Drie regels…"):
//   1. Verdeelsleutel bij "totaal werk blijft; verdeeld": naar rato van de inzet zoals die bij de
//      bewerking geldt (de ingevoerde inzet van een nieuwe toewijzing, de huidige van de bestaande).
//   2. Taakduur bij meerdere toewijzingen: R = max over de werkresources van W_i / I_i (§6.2).
//      Direct ná een evenredige herverdeling is dat W / ΣI; "R = W / ΣI" wordt hier nooit als losse
//      formule gebruikt.
//   3. Na afronding (dagmodus: hele werkdagen, uurmodus: hele minuten, beide naar boven) zijn W en I
//      de opgeslagen grootheden en is R afgeleid; een volgende bewerking rekent uit de exacte W en I,
//      nooit terug uit de afgeronde R (§6.1).
//
// "Afwezig ⇒ afgeleid": een toewijzing zonder `remainingWorkMinutes` heeft werk R × I. Een regel
// die werk beschermt legt dat werk vast (schrijft het veld) op het moment dat ze het nodig heeft;
// een regel die de inzet beschermt laat een afwezig veld afwezig (byte-identiek gedrag van vandaag).
import type { WorkRule } from '@/types/workRule';

export interface TriangleAssignment {
  id: string;
  /** Inzet in eenheden per werkdag (> 0). */
  unitsPerDay: number;
  /** Resterend werk in werkminuten; afwezig ⇒ afgeleid als R × unitsPerDay. */
  remainingWorkMinutes?: number;
  /** false voor materiaal (spec §4.3): telt niet mee voor de duur en wordt door geen regel
   *  aangeraakt; zijn "werk" is een hoeveelheid, geen tijd. */
  drivesDuration: boolean;
}

export interface TriangleState {
  rule: WorkRule;
  /** Bewaard MS Project-vinkje (beslispunt 8-B). `undefined` ⇒ zuiver P6-gedrag. Alleen gelezen op
   *  de twee cellen waar MSP van P6 afwijkt: FIXED_RATE + `false` (resource erbij/eraf verandert
   *  werk in plaats van duur) en FIXED_DURATION_WORK + `true` (duur gewijzigd verandert werk in
   *  plaats van inzet). */
  effortDriven?: boolean;
  /** Resterende duur van de taak in WERKminuten (zonder gaten). */
  remainingMinutes: number;
  /** Werkminuten per werkdag (`hoursPerDay × 60`). */
  slotMinutes: number;
  /** Dagmodus: R wordt naar boven op hele werkdagen (veelvouden van `slotMinutes`) afgerond;
   *  uurmodus: op hele minuten. */
  wholeDays: boolean;
  assignments: readonly TriangleAssignment[];
}

export type TriangleRejection =
  | 'invalid-duration'   // restduur ≤ 0 of niet eindig
  | 'invalid-units'      // inzet ≤ 0 of niet eindig (dezelfde grens als `isValidUnits`)
  | 'invalid-work'       // werk ≤ 0 of niet eindig
  | 'unknown-assignment'
  | 'duplicate-assignment';

export type TriangleResult =
  | { ok: true; state: TriangleState }
  | { ok: false; reason: TriangleRejection };

// ── Hulpfuncties ────────────────────────────────────────────────────────────────────────────────

const EPS = 1e-9;

const isPositive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Beschermt de regel het (rest)werk bij een duur-/inzetwijziging? */
export function ruleProtectsWork(rule: WorkRule): boolean {
  return rule === 'FIXED_WORK' || rule === 'FIXED_DURATION_WORK';
}

/** Beschermt de regel de duur (P6 "Fixed Duration & …")? */
export function ruleProtectsDuration(rule: WorkRule): boolean {
  return rule === 'FIXED_DURATION_RATE' || rule === 'FIXED_DURATION_WORK';
}

/** Resterend werk van een toewijzing bij restduur `remainingMinutes` — het veld als het er is,
 *  anders afgeleid (R × I). */
export function remainingWorkOf(a: TriangleAssignment, remainingMinutes: number): number {
  return a.remainingWorkMinutes ?? remainingMinutes * a.unitsPerDay;
}

/** Afronding van een afgeleide restduur (regel 3): naar boven op hele werkdagen in dagmodus,
 *  op hele minuten in uurmodus. Nooit onder één slot resp. één minuut. */
export function roundUpRemaining(minutes: number, state: Pick<TriangleState, 'slotMinutes' | 'wholeDays'>): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  if (state.wholeDays) {
    const slot = Math.max(1, state.slotMinutes);
    return Math.max(slot, Math.ceil(minutes / slot - EPS) * slot);
  }
  return Math.max(1, Math.ceil(minutes - EPS));
}

/** R = max_i(W_i / I_i) over de werkresources, met W_i afgeleid waar het veld ontbreekt (regel 2),
 *  daarna afgerond (regel 3). Zonder werkresources blijft de huidige restduur staan. */
function derivedRemaining(state: TriangleState, assignments: readonly TriangleAssignment[]): number {
  let max = 0;
  let any = false;
  for (const a of assignments) {
    if (!a.drivesDuration || !isPositive(a.unitsPerDay)) continue;
    any = true;
    max = Math.max(max, remainingWorkOf(a, state.remainingMinutes) / a.unitsPerDay);
  }
  if (!any) return state.remainingMinutes;
  return roundUpRemaining(max, state);
}

/** Nadat R is herleid: de ANDERE toewijzingen volgen de beschermde hoek van de regel — werk vast ⇒
 *  inzet = W / R; inzet vast ⇒ een aanwezig werkveld wordt R × I, een afwezig veld blijft afwezig. */
function followRule(
  state: TriangleState,
  assignments: readonly TriangleAssignment[],
  newRemaining: number,
  edited: ReadonlySet<string>,
): TriangleAssignment[] {
  const protectsWork = ruleProtectsWork(state.rule);
  return assignments.map((a) => {
    if (!a.drivesDuration || edited.has(a.id)) return a;
    if (protectsWork) {
      const w = remainingWorkOf(a, state.remainingMinutes);
      if (w <= 0) return { ...a, remainingWorkMinutes: w };
      return { ...a, remainingWorkMinutes: w, unitsPerDay: w / newRemaining };
    }
    if (a.remainingWorkMinutes === undefined) return a;
    return { ...a, remainingWorkMinutes: newRemaining * a.unitsPerDay };
  });
}

/** Verdeel `totalWork` naar rato van inzet over de werkresources (regel 1). Niet-werkresources
 *  blijven onaangeraakt. */
function splitByUnits(assignments: readonly TriangleAssignment[], totalWork: number): TriangleAssignment[] {
  const driving = assignments.filter((a) => a.drivesDuration);
  const sumUnits = driving.reduce((s, a) => s + a.unitsPerDay, 0);
  if (sumUnits <= 0) return [...assignments];
  return assignments.map((a) => (a.drivesDuration
    ? { ...a, remainingWorkMinutes: totalWork * (a.unitsPerDay / sumUnits) }
    : a));
}

function totalRemainingWork(state: TriangleState, assignments: readonly TriangleAssignment[]): number {
  return assignments.reduce((s, a) => (a.drivesDuration ? s + remainingWorkOf(a, state.remainingMinutes) : s), 0);
}

const drivingCount = (assignments: readonly TriangleAssignment[]): number =>
  assignments.filter((a) => a.drivesDuration).length;

// ── Bewerkingen ─────────────────────────────────────────────────────────────────────────────────

/**
 * Restduur gewijzigd (spec §5 rij 1). Werk beschermd ⇒ inzet = W / R' (het werk wordt daarbij
 * vastgelegd); inzet beschermd ⇒ een aanwezig werkveld wordt R' × I. Uitzondering beslispunt 8-B:
 * FIXED_DURATION_WORK mét bewaard `effortDriven: true` volgt MS Project (werk = R' × I).
 */
export function applyDurationEdit(state: TriangleState, newRemainingMinutes: number): TriangleResult {
  if (!isPositive(newRemainingMinutes)) return { ok: false, reason: 'invalid-duration' };
  const R = roundUpRemaining(newRemainingMinutes, state);
  const keepWork = ruleProtectsWork(state.rule)
    && !(state.rule === 'FIXED_DURATION_WORK' && state.effortDriven === true);
  const assignments = state.assignments.map((a) => {
    if (!a.drivesDuration) return a;
    if (keepWork) {
      const w = remainingWorkOf(a, state.remainingMinutes);
      if (w <= 0) return { ...a, remainingWorkMinutes: w };
      return { ...a, remainingWorkMinutes: w, unitsPerDay: w / R };
    }
    if (a.remainingWorkMinutes === undefined) return a;
    return { ...a, remainingWorkMinutes: R * a.unitsPerDay };
  });
  return { ok: true, state: { ...state, remainingMinutes: R, assignments } };
}

/**
 * Inzet van één toewijzing gewijzigd (spec §5 rij 2). Duur beschermd ⇒ werk = R × I' (alleen een
 * aanwezig veld wordt herschreven); anders R = max_i(W_i / I_i) met het werk van deze toewijzing
 * vastgelegd, waarna de andere toewijzingen hun beschermde hoek volgen (§6.2).
 */
export function applyUnitsEdit(state: TriangleState, assignmentId: string, newUnitsPerDay: number): TriangleResult {
  if (!isPositive(newUnitsPerDay)) return { ok: false, reason: 'invalid-units' };
  const idx = state.assignments.findIndex((a) => a.id === assignmentId);
  if (idx < 0) return { ok: false, reason: 'unknown-assignment' };
  const target = state.assignments[idx];
  if (!target.drivesDuration || ruleProtectsDuration(state.rule)) {
    const edited: TriangleAssignment = {
      ...target,
      unitsPerDay: newUnitsPerDay,
      ...(target.drivesDuration && target.remainingWorkMinutes !== undefined
        ? { remainingWorkMinutes: state.remainingMinutes * newUnitsPerDay }
        : {}),
    };
    return { ok: true, state: { ...state, assignments: replaceAt(state.assignments, idx, edited) } };
  }
  const edited: TriangleAssignment = {
    ...target,
    unitsPerDay: newUnitsPerDay,
    remainingWorkMinutes: remainingWorkOf(target, state.remainingMinutes),
  };
  const withEdit = replaceAt(state.assignments, idx, edited);
  const R = derivedRemaining(state, withEdit);
  const assignments = followRule(state, withEdit, R, new Set([assignmentId]));
  return { ok: true, state: { ...state, remainingMinutes: R, assignments } };
}

/**
 * Resterend werk van één toewijzing gewijzigd (spec §5 rij 3). Duur beschermd ⇒ inzet = W' / R;
 * anders R = max_i(W_i / I_i) en de andere toewijzingen volgen hun beschermde hoek.
 */
export function applyWorkEdit(state: TriangleState, assignmentId: string, newWorkMinutes: number): TriangleResult {
  if (!isPositive(newWorkMinutes)) return { ok: false, reason: 'invalid-work' };
  const idx = state.assignments.findIndex((a) => a.id === assignmentId);
  if (idx < 0) return { ok: false, reason: 'unknown-assignment' };
  const target = state.assignments[idx];
  if (!target.drivesDuration) {
    return { ok: true, state: { ...state, assignments: replaceAt(state.assignments, idx, { ...target, remainingWorkMinutes: newWorkMinutes }) } };
  }
  if (ruleProtectsDuration(state.rule)) {
    const edited: TriangleAssignment = { ...target, remainingWorkMinutes: newWorkMinutes, unitsPerDay: newWorkMinutes / state.remainingMinutes };
    return { ok: true, state: { ...state, assignments: replaceAt(state.assignments, idx, edited) } };
  }
  const withEdit = replaceAt(state.assignments, idx, { ...target, remainingWorkMinutes: newWorkMinutes });
  const R = derivedRemaining(state, withEdit);
  const assignments = followRule(state, withEdit, R, new Set([assignmentId]));
  return { ok: true, state: { ...state, remainingMinutes: R, assignments } };
}

/**
 * Resterend werk op TAAKniveau gewijzigd (spec §6.2): naar rato van het bestaande restwerk over de
 * werkresources verdeeld (bij nul bestaand werk naar rato van inzet), daarna per regel zoals een
 * werkwijziging op elke toewijzing.
 */
export function applyTaskWorkEdit(state: TriangleState, newTotalWorkMinutes: number): TriangleResult {
  if (!isPositive(newTotalWorkMinutes)) return { ok: false, reason: 'invalid-work' };
  if (drivingCount(state.assignments) === 0) return { ok: true, state };
  const oldTotal = totalRemainingWork(state, state.assignments);
  const split: TriangleAssignment[] = oldTotal > 0
    ? state.assignments.map((a) => (a.drivesDuration
      ? { ...a, remainingWorkMinutes: newTotalWorkMinutes * (remainingWorkOf(a, state.remainingMinutes) / oldTotal) }
      : a))
    : splitByUnits(state.assignments, newTotalWorkMinutes);
  if (ruleProtectsDuration(state.rule)) {
    const assignments = split.map((a) => (a.drivesDuration && a.remainingWorkMinutes !== undefined && a.remainingWorkMinutes > 0
      ? { ...a, unitsPerDay: a.remainingWorkMinutes / state.remainingMinutes }
      : a));
    return { ok: true, state: { ...state, assignments } };
  }
  const R = derivedRemaining(state, split);
  const edited = new Set(split.filter((a) => a.drivesDuration).map((a) => a.id));
  const assignments = followRule(state, split, R, edited);
  return { ok: true, state: { ...state, remainingMinutes: R, assignments } };
}

/**
 * Resource erbij (spec §5 rij 4). Eerste werkresource, of een regel die de inzet beschermt en de
 * duur vastzet (FIXED_DURATION_RATE; FIXED_RATE mét bewaard `effortDriven: false`, beslispunt
 * 8-B) ⇒ de nieuwe toewijzing krijgt afgeleid werk R × I_n en de rest blijft ongemoeid. Anders
 * blijft het totale restwerk staan en wordt het naar rato van inzet verdeeld (regel 1);
 * FIXED_DURATION_WORK herleidt daaruit de inzet (R blijft), FIXED_WORK/FIXED_RATE de duur
 * (R = max_i(W_i / I_i), ná de verdeling W / ΣI; inzet blijft zoals ingevoerd).
 */
export function applyAssignmentAdded(
  state: TriangleState,
  added: { id: string; unitsPerDay: number; drivesDuration?: boolean },
): TriangleResult {
  if (!isPositive(added.unitsPerDay)) return { ok: false, reason: 'invalid-units' };
  if (state.assignments.some((a) => a.id === added.id)) return { ok: false, reason: 'duplicate-assignment' };
  const newcomer: TriangleAssignment = { id: added.id, unitsPerDay: added.unitsPerDay, drivesDuration: added.drivesDuration ?? true };
  const plain = { ok: true as const, state: { ...state, assignments: [...state.assignments, newcomer] } };
  if (!newcomer.drivesDuration || drivingCount(state.assignments) === 0) return plain;
  if (state.rule === 'FIXED_DURATION_RATE') return plain;
  if (state.rule === 'FIXED_RATE' && state.effortDriven === false) return plain;
  const total = totalRemainingWork(state, state.assignments);
  const split = splitByUnits([...state.assignments, newcomer], total);
  if (state.rule === 'FIXED_DURATION_WORK') {
    const assignments = split.map((a) => (a.drivesDuration && a.remainingWorkMinutes !== undefined && a.remainingWorkMinutes > 0
      ? { ...a, unitsPerDay: a.remainingWorkMinutes / state.remainingMinutes }
      : a));
    return { ok: true, state: { ...state, assignments } };
  }
  const R = derivedRemaining(state, split);
  return { ok: true, state: { ...state, remainingMinutes: R, assignments: split } };
}

/**
 * Resource eraf (spec §5 rij 5): spiegelbeeld van erbij. FIXED_DURATION_RATE en FIXED_RATE mét
 * `effortDriven: false` ⇒ het werk van de verwijderde toewijzing vervalt, de rest blijft. Anders
 * blijft het totale restwerk (inclusief dat van de verwijderde) staan en wordt het over de
 * blijvers verdeeld; FIXED_DURATION_WORK herleidt de inzet, FIXED_WORK/FIXED_RATE de duur.
 */
export function applyAssignmentRemoved(state: TriangleState, assignmentId: string): TriangleResult {
  const idx = state.assignments.findIndex((a) => a.id === assignmentId);
  if (idx < 0) return { ok: false, reason: 'unknown-assignment' };
  const removed = state.assignments[idx];
  const rest = state.assignments.filter((a) => a.id !== assignmentId);
  const plain = { ok: true as const, state: { ...state, assignments: rest } };
  if (!removed.drivesDuration || drivingCount(rest) === 0) return plain;
  if (state.rule === 'FIXED_DURATION_RATE') return plain;
  if (state.rule === 'FIXED_RATE' && state.effortDriven === false) return plain;
  const total = totalRemainingWork(state, state.assignments);
  const split = splitByUnits(rest, total);
  if (state.rule === 'FIXED_DURATION_WORK') {
    const assignments = split.map((a) => (a.drivesDuration && a.remainingWorkMinutes !== undefined && a.remainingWorkMinutes > 0
      ? { ...a, unitsPerDay: a.remainingWorkMinutes / state.remainingMinutes }
      : a));
    return { ok: true, state: { ...state, assignments } };
  }
  const R = derivedRemaining(state, split);
  return { ok: true, state: { ...state, remainingMinutes: R, assignments: split } };
}

/**
 * Typewissel (spec §5 rij 6, besluit 2): geen enkel getal verandert. Alleen wanneer de nieuwe regel
 * werk beschermt wordt het huidige restwerk van de werkresources vastgelegd zoals het is (het
 * veld wordt geschreven), zodat latere bewerkingen een vast anker hebben.
 */
export function applyRuleChange(state: TriangleState, rule: WorkRule): TriangleResult {
  const assignments = ruleProtectsWork(rule)
    ? state.assignments.map((a) => (a.drivesDuration && a.remainingWorkMinutes === undefined
      ? { ...a, remainingWorkMinutes: remainingWorkOf(a, state.remainingMinutes) }
      : a))
    : [...state.assignments];
  return { ok: true, state: { ...state, rule, assignments } };
}

function replaceAt(list: readonly TriangleAssignment[], idx: number, item: TriangleAssignment): TriangleAssignment[] {
  const out = [...list];
  out[idx] = item;
  return out;
}
