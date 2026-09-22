import type {
  BuiltInProfileId, Project, ProjectSchedulingOptions, SchedulingConventions, SchedulingOptions,
  SchedulingProfile,
} from '@/types/project';
import {
  CONVENTIONS, builtInProfile, conventionsFor, diffAgainstBase, isConventionKey, resolveConventions,
} from '@/engine/scheduler/conventions/registry';

/**
 * Migratie- en compatibiliteitslaag voor het legacy `OPS_SchedulingOptions`-blok (rekenprofielen,
 * spec 2026-09-22 §3.3/§3.4). Bewust BUITEN `src/engine/`: deze helpers kennen `p6Source` en de
 * bestandsvorm, en de motor mag geen bronkennis dragen (`check-conventions-p6-flags` grept
 * `p6Source` onder `src/engine/` weg; het register zelf blijft bronvrij).
 */

/** Alleen de projectopties (geen conventies, geen `p6Source`), sleutelvolgorde behouden.
 *  Leeg resultaat ⇒ `undefined`, net als een afwezig blok. */
export function optionKeysOnly(options: SchedulingOptions | undefined): ProjectSchedulingOptions | undefined {
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
 * naar profiel + projectopties (spec v3 §3.4). `legacyValue` speelt hier geen rol:
 *  - blob afwezig ⇒ `ops` zonder afwijkingen;
 *  - `p6Source: 'XER'` ⇒ basis `p6`. Per A-conventie: sleutel aanwezig ⇒ die waarde, afwezig ⇒ UIT
 *    (niet de p6-basis: vandaag rekende de solver een ontbrekende vlag als uit). Afwezige B1–B5 ⇒ AAN (ze
 *    hingen vandaag alleen aan `p6Source`). Afwijkingen = verschil met p6;
 *  - geen `p6Source` ⇒ de p6Source-gepoorte conventies (A15–A20) worden weggegooid (ze waren inert;
 *    risico 1); A12/A13/A22/A23 worden afwijkingen; basis = `msproject` als `resumeFromActualElapsed`
 *    én `unstartedIgnoresStatusDate` allebei true zijn (de `.mpp`-lezer), anders `ops`;
 *  - projectopties gaan altijd naar `options` (conventies en `p6Source` gestript).
 */
export function legacyOptionsToProfile(blob: SchedulingOptions | undefined): {
  profile: SchedulingProfile;
  options: ProjectSchedulingOptions | undefined;
} {
  const options = optionKeysOnly(blob);
  if (!blob) return { profile: builtInProfile('ops'), options };
  if (blob.p6Source === 'XER') {
    const resolved = conventionsFor(d => {
      const value = blob[d.id];
      // Een expliciet gezette vlag wint altijd (ook voor B1–B5, zoals in de oude motorvertaling —
      // M1.3 bewijst die gelijkheid); afwezig ⇒ B aan, A uit.
      if (typeof value === 'boolean') return value;
      return d.group === 'B';
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
 * Neerwaartse compatibiliteit (spec v3.1 punt 1): het `OPS_SchedulingOptions`-blok dat de schrijver
 * in het eindmodel wegschrijft = de projectopties + ALLEEN `resumeFromActualElapsed` en
 * `unstartedIgnoresStatusDate`, en alleen wanneer `true`. Uitgebrachte OPS-versies kennen A12/A13
 * niet als losse projectkeuze, en een OPS-project zonder opties mag geen pset krijgen (byte-
 * identiek aan vandaag). Nog nergens bedraad — zie `// INTEGRATIE(rekenprofielen):` in `ifcWriter.ts`.
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
