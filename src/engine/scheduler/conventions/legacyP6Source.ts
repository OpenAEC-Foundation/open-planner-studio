// TIJDELIJK — rekenprofielen baan B (spec `docs/superpowers/specs/2026-09-22-rekenprofielen-design.md`
// §3.4 rij 4, §3.5 punt 4, bijlage A groep A en B). Verwijderen zodra de XER-lezer (en de
// IFC-migratie) de conventies zelf zet via het rekenprofiel.
//
// Waarom dit bestaat: de motor leest sinds baan B nergens meer het bronformaat, alleen benoemde
// vlaggen in `SchedulingOptions`. Vóór baan B gold echter:
//   - de vijf groep-B-regels werkten uitsluitend met de XER-bronmarkering (er was geen vlag);
//   - de zes A-vlaggen A15–A20 werkten uitsluitend MÉT die bronmarkering — zonder waren ze inert.
// De XER-lezer (`xerScheduleOptions.ts`, buiten deze baan) zet de B-vlaggen nog niet, en een
// bestaand IFC kan A-vlaggen zonder bronmarkering dragen. Deze vertaling houdt het rekengedrag
// daarom byte-identiek aan vóór baan B.
//
// Dit is het ENIGE bestand onder `src/engine/` dat de bronmarkering nog leest
// (`check-conventions-p6-flags.ts` scant dat). De motor zelf leest uitsluitend de vlaggen; de
// `CPMSolver`-constructor en de publieke `explain*`-diagnoses passen deze vertaling toe op hun
// invoer, en de solverpaden gebruiken daarna de `*Resolved`-varianten die niet opnieuw vertalen.
import type { SchedulingOptions } from '@/types/project';

/** De vijf conventies uit bijlage A groep B die vóór baan B uitsluitend achter de bronmarkering
 *  stonden en nog geen eigen vlag hadden. */
export const LEGACY_P6_SOURCE_CONVENTION_KEYS = [
  'p6RelationFinishBoundary',
  'p6BackwardLagFinishBoundary',
  'p6CompletedDataDateWindow',
  'p6CompletedLoeActualFinish',
  'p6OpenLoeTargetSpan',
] as const satisfies readonly (keyof SchedulingOptions)[];

export type LegacyP6SourceConventionKey = typeof LEGACY_P6_SOURCE_CONVENTION_KEYS[number];

/** A15–A20: bestaande vlaggen die vóór baan B alleen onder de bronmarkering effect hadden
 *  (`CPMSolver.p6XerOption` en de A17-tak in `scheduleAnalysis`). A21 hoort er niet bij: die
 *  vereist conventie B3, en B3 staat zonder bronmarkering al uit. */
export const LEGACY_P6_SOURCE_GATED_FLAGS = [
  'p6ZeroDurationUsesPlannedBoundary',
  'p6UseTaskPlannedStartFloor',
  'p6FinishMilestoneBoundaryWindow',
  'p6PreserveActualInstants',
  'p6UseRemainingStartForProgress',
  'p6PreserveZeroDurationConstraintInstants',
] as const satisfies readonly (keyof SchedulingOptions)[];

/**
 * TIJDELIJK. Vertaal de oude bronmarkering naar de benoemde vlaggen.
 *
 * - Bron is XER ⇒ elke AFWEZIGE groep-B-vlag wordt `true`; een expliciet gezette vlag (true of
 *   false) wint altijd.
 * - Geen XER-bron ⇒ elke A15–A20-vlag die `true` staat wordt `false` (vóór baan B waren ze
 *   zonder bron inert, spec §3.4 rij 4). Groep-B-vlaggen blijven zoals ze staan.
 * - Alle vijf groep-B-vlaggen expliciet gezet (een opgeloste set, rekenprofielen C1) ⇒ ongewijzigd
 *   terug, met of zonder bron.
 * - Niets te doen ⇒ dezelfde referentie terug. Muteert de invoer nooit; idempotent.
 * - `legacyTranslation: false` (testhaak `CPMOptions.legacyP6SourceTranslation`) ⇒ helemaal
 *   geen vertaling: de invoer ongewijzigd terug. Daarmee bewijst `check-conventions-p6-flags.ts`
 *   dat de motor de bronmarkering zelf nergens leest.
 */
export function resolveLegacyP6SourceConventions(
  schedulingOptions: SchedulingOptions | undefined,
  legacyTranslation = true,
): SchedulingOptions | undefined {
  if (!legacyTranslation || !schedulingOptions) return schedulingOptions;
  // Rekenprofielen C1: een OPGELOSTE set (`EffectiveSchedulingOptions`, via `solveOptionsFor`) draagt
  // alle groep-B-vlaggen expliciet en geen bronmarkering; die is al vertaald en mag hier niet
  // nogmaals door de "zonder bron ⇒ A15–A20 uit"-tak. Vertalen gebeurt alleen voor rauwe blobs.
  if (LEGACY_P6_SOURCE_CONVENTION_KEYS.every(key => schedulingOptions[key] !== undefined)) {
    return schedulingOptions;
  }
  if (schedulingOptions.p6Source === 'XER') {
    const resolved: SchedulingOptions = { ...schedulingOptions };
    for (const key of LEGACY_P6_SOURCE_CONVENTION_KEYS) {
      if (resolved[key] === undefined) resolved[key] = true;
    }
    return resolved;
  }
  if (!LEGACY_P6_SOURCE_GATED_FLAGS.some(key => schedulingOptions[key] === true)) {
    return schedulingOptions;
  }
  const resolved: SchedulingOptions = { ...schedulingOptions };
  for (const key of LEGACY_P6_SOURCE_GATED_FLAGS) {
    if (resolved[key] === true) resolved[key] = false;
  }
  return resolved;
}
