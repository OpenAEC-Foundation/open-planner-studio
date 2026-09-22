/**
 * Rekenprofielen — het conventieregister (spec `docs/superpowers/specs/2026-09-22-rekenprofielen-design.md`
 * v3, tweelagenmodel).
 *
 * Twee lagen, disjuncte sleutels:
 *  - **Conventies** (`ConventionKey`, vijftien booleans): regels die per planningspakket verschillen.
 *    Ze leven in het profiel (`Project.schedulingProfile`), als basis + afwijkingen.
 *  - **Projectopties** (`ProjectOptionKey`, negen sleutels): per-bestand projectinstellingen
 *    (lagCalendar, kritiek-definitie, TF-modus, …). Ze blijven in `Project.schedulingOptions`.
 *
 * De solver krijgt één `EffectiveSchedulingOptions` via `effectiveSchedulingOptions(project)`.
 *
 * Deze module is puur en importeert uitsluitend types: `services/` (de XER-lezer, de IFC-lezer)
 * importeren hieruit, nooit andersom (`npm run verify:cycles`).
 */
import type {
  BuiltInProfileId,
  ConventionKey,
  EffectiveSchedulingOptions,
  Project,
  ProjectOptionKey,
  ProjectSchedulingOptions,
  SchedulingConventions,
  SchedulingOptions,
  SchedulingProfile,
} from '@/types/project';

export const BUILT_IN_PROFILE_IDS = ['p6', 'msproject', 'ops'] as const satisfies readonly BuiltInProfileId[];

export interface ConventionDescriptor {
  /** Stabiele sleutel; tegelijk de sleutel in `SchedulingOptions` en in de IFC-JSON. */
  id: ConventionKey;
  /** Alle conventies zijn booleans. Komt er ooit een andere soort bij, dan breidt die de unie uit
   *  samen met de sanitizers (die nu alleen booleans accepteren). */
  kind: 'boolean';
  builtIn: Record<BuiltInProfileId, boolean>;
  /** Bijlage A: groep A (al benoemd in `SchedulingOptions`) of groep B (was alleen `p6Source`). */
  group: 'A' | 'B';
  /** De waarde die geldt wanneer een bestand MÉT `OPS_SchedulingProfile` deze sleutel niet kent (een
   *  bestand van vóór `since`). Nooit de basiswaarde. Geldt niet voor de legacy-migratie van
   *  bestanden zonder die pset — daarvoor zie `legacyOptionsToProfile`. */
  legacyValue: boolean;
  /** Was deze conventie vóór de rekenprofielen alleen actief onder `p6Source === 'XER'`? Zo ja, dan
   *  was een losse vlag zonder `p6Source` inert en gooit de legacy-migratie hem weg (risico 1). */
  gatedByP6Source: boolean;
  /** i18n-sleutel (namespace common): `<labelKey>.label` / `<labelKey>.help`. De vertalingen komen
   *  met het profielpaneel; deze baan legt alleen de sleutelnaam vast. */
  labelKey: string;
  /** ISO-datum waarop de conventie in het register kwam (documentatie bij `legacyValue`). */
  since: string;
}

const P6_ONLY = { p6: true, msproject: false, ops: false } as const;
const MSP_ONLY = { p6: false, msproject: true, ops: false } as const;
const NONE = { p6: false, msproject: false, ops: false } as const;
const SINCE = '2026-09-22';

function convention(
  id: ConventionKey, group: 'A' | 'B', builtIn: Record<BuiltInProfileId, boolean>, gatedByP6Source: boolean,
): ConventionDescriptor {
  return {
    id, kind: 'boolean', builtIn, group, legacyValue: builtIn.ops, gatedByP6Source,
    labelKey: `conventions.${id}`, since: SINCE,
  };
}

/** Het register, in vaste volgorde (die volgorde is ook de sleutelvolgorde in de IFC-JSON).
 *  Bijlage-A-nummers: A12, A13, A15–A20, A22, A23, B1–B5. */
export const CONVENTIONS: readonly ConventionDescriptor[] = [
  convention('preserveActualDatesInBackwardPass', 'A', P6_ONLY, false),        // A12
  convention('clampNegativeFreeFloat', 'A', P6_ONLY, false),                   // A13
  convention('p6ZeroDurationUsesPlannedBoundary', 'A', P6_ONLY, true),         // A15
  convention('p6UseTaskPlannedStartFloor', 'A', P6_ONLY, true),                // A16
  convention('p6FinishMilestoneBoundaryWindow', 'A', P6_ONLY, true),           // A17
  convention('p6PreserveActualInstants', 'A', P6_ONLY, true),                  // A18
  // A19: per bestand (`rem_target_link_flag`); de P6-basis is uit, de XER-lezer zet hem als override.
  convention('p6UseRemainingStartForProgress', 'A', NONE, true),               // A19
  convention('p6PreserveZeroDurationConstraintInstants', 'A', P6_ONLY, true),  // A20
  convention('resumeFromActualElapsed', 'A', MSP_ONLY, false),                 // A22
  convention('unstartedIgnoresStatusDate', 'A', MSP_ONLY, false),              // A23
  convention('p6RelationFinishBoundary', 'B', P6_ONLY, true),                  // B1
  convention('p6BackwardLagFinishBoundary', 'B', P6_ONLY, true),               // B2
  convention('p6CompletedDataDateWindow', 'B', P6_ONLY, true),                 // B3
  convention('p6CompletedLoeActualFinish', 'B', P6_ONLY, true),                // B4
  convention('p6OpenLoeTargetSpan', 'B', P6_ONLY, true),                       // B5
];

// ── Compile-time: register ⇔ ConventionKey, en projectopties ⊥ conventies ─────────────────────────
// Een Record over ConventionKey dwingt dat elke conventie hier staat (de runtime-check in
// `check-conventions-registry.ts` legt de lijst hierboven ernaast); een sleutel die zowel optie als
// conventie is, is per constructie onmogelijk (`ProjectOptionKey` is het complement) — de assertie
// hieronder maakt dat expliciet.
const _everyConventionNamed: Record<ConventionKey, true> = {
  preserveActualDatesInBackwardPass: true, clampNegativeFreeFloat: true,
  p6ZeroDurationUsesPlannedBoundary: true, p6UseTaskPlannedStartFloor: true,
  p6FinishMilestoneBoundaryWindow: true, p6PreserveActualInstants: true,
  p6UseRemainingStartForProgress: true, p6PreserveZeroDurationConstraintInstants: true,
  resumeFromActualElapsed: true, unstartedIgnoresStatusDate: true,
  p6RelationFinishBoundary: true, p6BackwardLagFinishBoundary: true,
  p6CompletedDataDateWindow: true, p6CompletedLoeActualFinish: true, p6OpenLoeTargetSpan: true,
};
export const CONVENTION_KEYS = Object.keys(_everyConventionNamed) as readonly ConventionKey[];
type Overlap = Extract<ProjectOptionKey, ConventionKey>;
const _disjoint: [Overlap] extends [never] ? true : Overlap = true;
void _disjoint;

const CONVENTION_KEY_SET: ReadonlySet<string> = new Set(CONVENTION_KEYS);
export const isConventionKey = (key: string): key is ConventionKey => CONVENTION_KEY_SET.has(key);
export const isBuiltInProfileId = (value: unknown): value is BuiltInProfileId =>
  typeof value === 'string' && (BUILT_IN_PROFILE_IDS as readonly string[]).includes(value);

function conventionsFor(pick: (d: ConventionDescriptor) => boolean): SchedulingConventions {
  const out: Partial<SchedulingConventions> = {};
  for (const d of CONVENTIONS) out[d.id] = pick(d);
  return out as SchedulingConventions;
}

/** De opgeloste conventies per ingebouwd profiel. Levert steeds een verse kopie. */
export function builtInConventions(baseId: BuiltInProfileId): SchedulingConventions {
  return conventionsFor(d => d.builtIn[baseId]);
}

/** De conventiewaarden voor een opgeslagen profiel dat een sleutel niet kent. */
export function legacyConventions(): SchedulingConventions {
  return conventionsFor(d => d.legacyValue);
}

/** Het ingebouwde profiel zelf: basis zonder afwijkingen; de naam komt uit i18n. */
export function builtInProfile(id: BuiltInProfileId): SchedulingProfile {
  return { baseId: id, id, name: '', overrides: {} };
}

/** i18n-sleutel (namespace common) voor de weergavenaam van een ingebouwd profiel. */
export function displayNameKey(id: BuiltInProfileId): string {
  return `profiles.builtIn.${id}`;
}

/** Basis + afwijkingen ⇒ alle vijftien conventies. Afwezig profiel ≡ `ops` zonder afwijkingen.
 *  Alleen bekende conventiesleutels met een boolean tellen; de rest van `overrides` wordt genegeerd. */
export function resolveConventions(profile: SchedulingProfile | undefined): SchedulingConventions {
  const out = builtInConventions(profile?.baseId ?? 'ops');
  const overrides = profile?.overrides;
  if (overrides) {
    for (const key of CONVENTION_KEYS) {
      const value = overrides[key];
      if (typeof value === 'boolean') out[key] = value;
    }
  }
  return out;
}

/** De minimale afwijkingen van `baseId` die `conventions` beschrijven. Ontbrekende sleutels in
 *  `conventions` leveren geen afwijking op. `diffAgainstBase(b, resolveConventions({baseId: b, …}))`
 *  geeft voor minimale overrides exact die overrides terug (bewaakt in de registercheck). */
export function diffAgainstBase(
  baseId: BuiltInProfileId, conventions: Partial<SchedulingConventions>,
): Partial<SchedulingConventions> {
  const base = builtInConventions(baseId);
  const out: Partial<SchedulingConventions> = {};
  for (const key of CONVENTION_KEYS) {
    const value = conventions[key];
    if (typeof value === 'boolean' && value !== base[key]) out[key] = value;
  }
  return out;
}

/** Is dit profiel semantisch het standaardprofiel (ingebouwd `ops`, niets afwijkend)? Zo'n profiel
 *  wordt niet weggeschreven en na lezen niet op het project gezet (afwezig ≡ ops). */
export function isDefaultProfile(profile: SchedulingProfile | undefined): boolean {
  if (!profile) return true;
  return profile.id === 'ops' && profile.baseId === 'ops'
    && Object.keys(diffAgainstBase('ops', profile.overrides)).length === 0;
}

/** De P6-projectoptie-defaults met precieze types (alle velden aanwezig), voor de XER-lezer die er
 *  zijn `XER_SCHEDULING_DEFAULTS` uit opbouwt. Levert steeds een verse kopie. */
export function p6OptionDefaults(): {
  lagCalendar: 'predecessor';
  criticalDefinition: { mode: 'totalFloat'; thresholdHours: number };
  totalFloatMode: 'finish';
  makeOpenEndedCritical: boolean;
  useExpectedFinishDates: boolean;
  p6CompletedLateFromRemainingWindow: boolean;
} {
  return {
    lagCalendar: 'predecessor',
    criticalDefinition: { mode: 'totalFloat', thresholdHours: 0 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: false,
    useExpectedFinishDates: true,
    p6CompletedLateFromRemainingWindow: true,
  };
}

/** Standaard-PROJECTOPTIES voor een nieuw of bronloos project per basis. P6 = de optie-defaults
 *  van de XER-lezer (`XER_SCHEDULING_DEFAULTS` zonder `p6Source` en zonder conventies; die
 *  gelijkheid is gepind in `check-conventions-registry.ts`); MS Project = kleinste speling; OPS =
 *  niets (afwezig ≡ het huidige gedrag). Levert steeds een verse kopie. */
export function defaultOptionsFor(baseId: BuiltInProfileId): ProjectSchedulingOptions {
  switch (baseId) {
    case 'p6':
      return p6OptionDefaults();
    case 'msproject':
      return { totalFloatMode: 'smallest' };
    case 'ops':
      return {};
  }
}

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
 *    (niet de p6-basis: vandaag rekende de solver een ontbrekende vlag als uit). B1–B5 ⇒ AAN (ze
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
      if (d.group === 'B') return true;
      const value = blob[d.id];
      return typeof value === 'boolean' ? value : false;
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

/**
 * Profielwissel naar het ingebouwde profiel `newBaseId`.
 *  - Staat het project op een INGEBOUWD id, dan blijven ALLE afwijkingen letterlijk staan: op een
 *    ingebouwd id komen afwijkingen per definitie uit het bestand of uit de migratie (A19 uit XER,
 *    `clampNegativeFreeFloat: false` uit een pset, …) en die zijn projectdata. Niet opnieuw tegen de
 *    nieuwe basis diffen: dan zou P6 → MS Project → P6 een andere opgeloste set geven.
 *  - Staat het project op een EIGEN profiel, dan is dat een bewuste gebruikerskeuze die de wissel
 *    juist verlaat: het nieuwe profiel is de kale basis.
 * Puur; geen state.
 */
export function switchProfile(profile: SchedulingProfile | undefined, newBaseId: BuiltInProfileId): SchedulingProfile {
  const keep = !profile || isBuiltInProfileId(profile.id);
  return { ...builtInProfile(newBaseId), overrides: keep && profile ? { ...profile.overrides } : {} };
}

/** De ene set die de solver krijgt: het projectblok met de opgeloste conventies van het profiel
 *  als LAATSTE gespreid (spec v3.1 punt 2), zodat het profiel altijd wint van eventuele
 *  conventiesleutels die in de overgang nog in `schedulingOptions` staan. */
export function effectiveSchedulingOptions(
  project: Pick<Project, 'schedulingProfile' | 'schedulingOptions'>,
): EffectiveSchedulingOptions {
  return { ...project.schedulingOptions, ...resolveConventions(project.schedulingProfile) };
}
