import type {
  BuiltInProfileId, ConventionKey, LegacySchedulingOptions, Project, ProjectSchedulingOptions, SchedulingConventions,
  SchedulingOptions, SchedulingProfile,
} from '@/types/project';
import {
  CONVENTIONS, builtInProfile, conventionsFor, diffAgainstBase, isConventionKey, resolveConventions,
  type ConventionDescriptor,
} from '@/engine/scheduler/conventions/registry';

/**
 * De conventies die in een oud XER-IFC (`p6Source: 'XER'`, zonder `OPS_SchedulingProfile`) vanzelf
 * AAN gingen: B1–B5, die zonder rekenprofiel uitsluitend aan `p6Source` hingen, plus A19.
 * Bewust een GEPINDE lijst en niet "elke groep-B-conventie": een later toegevoegde conventie bestond
 * in zo'n bestand niet en mag daar niet stil aangaan. Zie `docs/recepten/conventie.md`.
 * Een afwezige sleutel volgt de P6-profielwaarde, zodat zo'n bestand rekent als een herimport van
 * dezelfde XER: B1, B2, B5 en A19 aan, B3/B4 uit. Een expliciet gezette waarde blijft staan en wordt
 * dan een afwijking van p6. A19 (`p6UseRemainingStartForProgress`) staat hier omdat de XER-lezer hem
 * niet per bestand uit `rem_target_link_flag` zet en een oud blok de sleutel bij een lege/N-vlag
 * wegliet.
 *
 * Voor bestanden MÉT `OPS_SchedulingProfile` (niet deze migratie, maar `sanitizeSchedulingProfile`):
 * een A19-override `true` onder basis p6 is gelijk aan de basis en telt nergens als afwijking; de
 * sanitizer laat die letterlijke override bij het lezen vervallen — anders zou een wissel P6 → OPS
 * A19 onder OPS aanzetten. Een expliciete A19 `false` onder p6 blijft een echte afwijking. Bewaakt in
 * `tests/planning/check-scheduling-profile-roundtrip.ts`.
 */
export const LEGACY_XER_ALWAYS_ON: ReadonlySet<ConventionKey> = new Set<ConventionKey>([
  'p6RelationFinishBoundary', 'p6BackwardLagFinishBoundary', 'p6CompletedDataDateWindow',
  'p6CompletedLoeActualFinish', 'p6OpenLoeTargetSpan',
  'p6UseRemainingStartForProgress', // A19 (zie hierboven)
]);

/**
 * De groep-C-conventies die in een oud XER-IFC hun P6-waarde krijgen, zodat zo'n bestand rekent als
 * een herimport van dezelfde XER. `legacyXerDefault` geeft `d.builtIn.p6` terug; voor C1 en C4 is dat
 * UIT. Oude XER-IFC's bestaan alleen in dev-builds (de XER-lezer is nooit uitgebracht zonder
 * rekenprofielen); elke conventie hier is per cel tegen P6 gemeten zonder verslechtering.
 * Ook hier een GEPINDE lijst: een latere conventie gaat voor oude bestanden nooit vanzelf aan, tenzij
 * ze met een meting expliciet in zo'n set wordt gezet (`docs/recepten/conventie.md` stap 2).
 */
export const LEGACY_XER_ALSO_ON_X12: ReadonlySet<ConventionKey> = new Set<ConventionKey>([
  'p6CompletedPredecessorAtDataDate', 'p6FreeFloatOnOwnCalendar', 'p6CompletedRemainingLag',
  'p6CompletedOutOfSequenceWindow', 'p6CompletedPhysicalAtDataDate', 'p6InProgressStartLagElapsed',
  // C7, C8
  'p6FinishFinishStartMilestoneLateFinish', 'p6StartedTaskIgnoresPlannedStartFloor',
  'p6LateFinishOnOwnCalendar', // C9
  'p6ProgressOverrideIgnoresStartedSuccessor', // C11
  'p6FinishNotBeforeFinishFinishBound', // C12
  'p6AlapPositionedFromSuccessors', // C14
]);

/** De waarde van een conventie die in een oud XER-blok ontbreekt: A19, B1–B5, C1–C9, C11, C12 en C14 op hun
 *  P6-waarde (B3/B4, C1 en C4 uit; A19 aan), al het andere uit. */
export function legacyXerDefault(d: ConventionDescriptor): boolean {
  if (LEGACY_XER_ALWAYS_ON.has(d.id)) return d.builtIn.p6;
  if (LEGACY_XER_ALSO_ON_X12.has(d.id)) return d.builtIn.p6;
  return false;
}

/**
 * Migratie- en compatibiliteitslaag voor het legacy `OPS_SchedulingOptions`-blok. Bewust BUITEN
 * `src/engine/`: deze helpers kennen `p6Source` en de bestandsvorm, en de motor mag geen bronkennis
 * dragen (`check-conventions-p6-flags` grept `p6Source` onder `src/engine/` weg; het register zelf
 * blijft bronvrij).
 */

/** Alleen de projectopties (geen conventies, geen `p6Source`), sleutelvolgorde behouden.
 *  Leeg resultaat ⇒ `undefined`, net als een afwezig blok. */
export function optionKeysOnly(options: LegacySchedulingOptions | undefined): ProjectSchedulingOptions | undefined {
  if (!options) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (key === 'p6Source' || isConventionKey(key)) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? (out as ProjectSchedulingOptions) : undefined;
}

/**
 * Migratie van een legacy `OPS_SchedulingOptions`-blob uit een bestand ZONDER `OPS_SchedulingProfile`
 * naar profiel + projectopties. `legacyValue` speelt hier geen rol:
 *  - blob afwezig ⇒ `ops` zonder afwijkingen;
 *  - `p6Source: 'XER'` ⇒ basis `p6`. Per A-conventie: sleutel aanwezig ⇒ die waarde, afwezig ⇒ UIT
 *    (niet de p6-basis: de solver rekende een ontbrekende vlag als uit) — behalve A19, die in
 *    `LEGACY_XER_ALWAYS_ON` staat. Afwezige A19 en B1–B5 ⇒ hun P6-waarde (B1/B2/B5 aan, B3/B4 uit),
 *    afwezige C1–C9, C11, C12 en C14 op hun P6-waarde (`LEGACY_XER_ALSO_ON_X12`). Afwijkingen =
 *    verschil met p6;
 *  - geen `p6Source` ⇒ de p6Source-gepoorte conventies (A15–A20) worden weggegooid (ze waren
 *    zonder `p6Source` inert); A12/A13/A22/A23 worden afwijkingen; basis = `msproject` als
 *    `resumeFromActualElapsed` én `unstartedIgnoresStatusDate` allebei true zijn (de `.mpp`-lezer),
 *    anders `ops`;
 *  - projectopties gaan altijd naar `options` (conventies en `p6Source` gestript).
 */
export function legacyOptionsToProfile(blob: LegacySchedulingOptions | undefined): {
  profile: SchedulingProfile;
  options: ProjectSchedulingOptions | undefined;
} {
  const options = optionKeysOnly(blob);
  if (!blob) return { profile: builtInProfile('ops'), options };
  if (blob.p6Source === 'XER') {
    const resolved = conventionsFor(d => {
      const value = blob[d.id];
      // Een expliciet gezette vlag wint altijd (ook voor B1–B5); afwezig ⇒ de gepinde lijsten
      // (`legacyXerDefault`).
      if (typeof value === 'boolean') return value;
      return legacyXerDefault(d);
    });
    return { profile: { ...builtInProfile('p6'), overrides: diffAgainstBase('p6', resolved) }, options };
  }
  const kept: Partial<SchedulingConventions> = {};
  for (const d of CONVENTIONS) {
    const value = blob[d.id];
    if (!d.gatedByP6Source && typeof value === 'boolean') kept[d.id] = value;
  }
  const baseId: BuiltInProfileId =
    kept.resumeFromActualElapsed === true && kept.unstartedIgnoresStatusDate === true ? 'msproject' : 'ops';
  return { profile: { ...builtInProfile(baseId), overrides: diffAgainstBase(baseId, kept) }, options };
}

/**
 * Neerwaartse compatibiliteit: het `OPS_SchedulingOptions`-blok dat de schrijver wegschrijft = de
 * projectopties + ALLEEN `resumeFromActualElapsed` en
 * `unstartedIgnoresStatusDate`, en alleen wanneer `true`. Uitgebrachte OPS-versies kennen A12/A13
 * niet als losse projectkeuze, en een OPS-project zonder opties krijgt geen pset. Aanroeper: `writeIFC`
 * (`ifcWriter.ts`).
 */
export function legacyOptionsBlobFor(
  project: Pick<Project, 'schedulingProfile' | 'schedulingOptions'>,
): SchedulingOptions | undefined {
  const out: SchedulingOptions = { ...optionKeysOnly(project.schedulingOptions) };
  const conventions = resolveConventions(project.schedulingProfile);
  if (conventions.resumeFromActualElapsed) out.resumeFromActualElapsed = true;
  if (conventions.unstartedIgnoresStatusDate) out.unstartedIgnoresStatusDate = true;
  return Object.keys(out).length > 0 ? out : undefined;
}
