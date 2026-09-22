// TIJDELIJK — rekenprofielen baan B (spec `docs/superpowers/specs/2026-09-22-rekenprofielen-design.md`
// §3.5 punt 4, bijlage A groep B). Verwijderen zodra de XER-lezer (en de IFC-migratie) de vijf
// benoemde conventies hieronder zelf zet via het rekenprofiel.
//
// Waarom dit bestaat: de motor leest sinds baan B nergens meer het bronformaat, alleen benoemde
// vlaggen in `SchedulingOptions`. De XER-lezer (`xerScheduleOptions.ts`, buiten deze baan) zet de
// vijf nieuwe vlaggen nog NIET, en een eerder als IFC opgeslagen XER-import draagt ze evenmin.
// Deze vertaling houdt het rekengedrag daarom byte-identiek: een project met de oude
// bronmarkering krijgt de vijf vlaggen AAN, tenzij het ze zelf expliciet zet.
//
// Dit is het ENIGE bestand onder `src/engine/` dat de bronmarkering nog leest. De motor zelf
// leest uitsluitend de vlaggen; de aanroepers passen deze vertaling toe op hun invoer.
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

/**
 * TIJDELIJK. Vul de vijf groep-B-vlaggen in vanuit de oude bronmarkering.
 *
 * - `legacyTranslation` aan (default) en de bron is XER ⇒ elke AFWEZIGE vlag wordt `true`;
 *   een expliciet gezette vlag (true of false) wint altijd.
 * - `legacyTranslation` uit (testhaak `CPMOptions.legacyP6SourceTranslation: false`) en de bron
 *   is XER ⇒ elke afwezige vlag wordt expliciet `false`. Zo kan een helper verderop die dezelfde
 *   vertaling nogmaals toepast (de publieke `explain*`-diagnoses doen dat voor directe
 *   aanroepers) haar niet alsnog aanzetten.
 * - Geen XER-bron ⇒ dezelfde referentie terug, ongewijzigd.
 *
 * Idempotent: na één toepassing staan alle vijf vlaggen expliciet en verandert een tweede
 * toepassing niets meer. Muteert de invoer nooit.
 */
export function resolveLegacyP6SourceConventions(
  schedulingOptions: SchedulingOptions | undefined,
  legacyTranslation = true,
): SchedulingOptions | undefined {
  if (schedulingOptions?.p6Source !== 'XER') return schedulingOptions;
  if (LEGACY_P6_SOURCE_CONVENTION_KEYS.every(key => schedulingOptions[key] !== undefined)) {
    return schedulingOptions;
  }
  const resolved: SchedulingOptions = { ...schedulingOptions };
  for (const key of LEGACY_P6_SOURCE_CONVENTION_KEYS) {
    if (resolved[key] === undefined) resolved[key] = legacyTranslation;
  }
  return resolved;
}
