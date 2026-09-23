/**
 * Rekenprofielen — het conventieregister (spec `docs/superpowers/specs/2026-09-22-rekenprofielen-design.md`
 * v3, tweelagenmodel).
 *
 * Twee lagen, disjuncte sleutels:
 *  - **Conventies** (`ConventionKey`, zevenentwintig booleans): regels die per planningspakket verschillen.
 *    Ze leven in het profiel (`Project.schedulingProfile`), als basis + afwijkingen.
 *  - **Projectopties** (`ProjectOptionKey`, elf sleutels): per-bestand projectinstellingen
 *    (lagCalendar, kritiek-definitie, TF-modus, SS-lag-variant, nivelleerinstellingen als data, …). Ze blijven in `Project.schedulingOptions`.
 *
 * De solver krijgt één `EffectiveSchedulingOptions` via `effectiveSchedulingOptions(project)`.
 *
 * Deze module is puur en importeert uitsluitend types: `services/` (de XER-lezer, de IFC-lezer)
 * importeren hieruit, nooit andersom (`npm run verify:cycles`).
 */
import type {
  BuiltInProfileId, ConventionKey, EffectiveSchedulingOptions, Project, ProjectOptionKey, ProjectSchedulingOptions, SchedulingConventions, SchedulingProfile,
} from '@/types/project';

export const BUILT_IN_PROFILE_IDS = ['p6', 'msproject', 'ops'] as const satisfies readonly BuiltInProfileId[];

export interface ConventionDescriptor {
  /** Stabiele sleutel; tegelijk de sleutel in `SchedulingOptions` en in de IFC-JSON. */
  id: ConventionKey;
  /** Alle conventies zijn booleans. Komt er ooit een andere soort bij, dan breidt die de unie uit
   *  samen met de sanitizers (die nu alleen booleans accepteren). */
  kind: 'boolean';
  builtIn: Record<BuiltInProfileId, boolean>;
  /** Bijlage A: groep A (al benoemd in `SchedulingOptions`) of groep B (was alleen achter de XER-bronmarkering);
   *  groep C: ná de rekenprofielen uit de X12-corpusmeting toegevoegd, nooit achter een bronmarkering
   *  geweest. Een legacy-XER-blob (zonder profiel-pset) migreert naar het P6-profiel zonder
   *  afwijkingen, dus met C aan; een profiel-pset die de sleutel niet kent krijgt `legacyValue`. */
  group: 'A' | 'B' | 'C';
  /** De waarde die geldt wanneer een bestand MÉT `OPS_SchedulingProfile` deze sleutel niet kent (een
   *  bestand van vóór `since`). Per constructie de OPS-waarde (`builtIn.ops`, dus voor elke conventie
   *  `false`): zo'n bestand rekende zonder de regel, en onder een P6-basis verschijnt de ontbrekende
   *  sleutel dan eerlijk als afwijking. Nooit de waarde van de GEKOZEN basis. Geldt niet voor de
   *  legacy-migratie van bestanden zonder die pset — daarvoor zie `legacyOptionsToProfile`. */
  legacyValue: boolean;
  /** Was deze conventie vóór de rekenprofielen alleen actief onder de XER-bronmarkering? Zo ja, dan
   *  was een losse vlag zonder die markering inert en gooit de legacy-migratie hem weg (risico 1). */
  gatedByP6Source: boolean;
  /** BESCHRIJVEND: komt de waarde per BESTAND uit de bron (A19 uit `rem_target_link_flag`), niet uit
   *  de school? Het register is hiervoor de ene bron; het bewerkmodel (`PER_FILE_CONVENTION_KEYS` in
   *  `state/schedulingProfileDraft.ts`) leidt er zijn lijst uit af en draagt zulke waarden bij elke
   *  profielwissel over. `switchProfile` beslist hier bewust NIET op (baan A misbruikte het veld
   *  daarvoor; op een ingebouwd id blijven alle afwijkingen letterlijk staan, ongeacht dit veld). */
  perFile: boolean;
  /** i18n-sleutel (namespace common): `<labelKey>.label` / `<labelKey>.help`. De vertalingen komen
   *  met het profielpaneel; deze baan legt alleen de sleutelnaam vast. */
  labelKey: string;
  /** ISO-datum waarop de conventie in het register kwam (documentatie bij `legacyValue`). */
  since: string;
}

/** Groep C: sinds de X12-corpusmeting (goal prompt "X12 naar nul", brok 2). */
const SINCE_X12_BROK2 = '2026-09-23';
/** Groep C, brok 3 (out-of-sequence, CP_Phys en de SS-lag uit een lopende voorganger). */
const SINCE_X12_BROK3 = '2026-09-23';
/** Groep C, brok 4 (FF naar een startmijlpaal, geplande-startvloer niet voor lopende taken). */
const SINCE_X12_BROK4 = '2026-09-23';
const SINCE_X12_BROK6 = '2026-09-23';
/** Groep C, brok 8 (Progress Override aan de late kant, FF-grens, C5-vrije speling). Nummering: C10 is
 *  bezet door de geparkeerde ALAP-conventie (plan XER §9), dus deze brok telt verder vanaf C11. */
const SINCE_X12_BROK8 = '2026-09-23';
/** Groep C, brok 10 (ALAP vanuit de opvolgers). Plan XER §9 noemt deze conventie "C10" (vóór 23-09
 *  "C9"); C11–C13 waren al vergeven toen ze gebouwd werd, dus in het register heet ze C14. */
const SINCE_X12_BROK10 = '2026-09-24';

const P6_ONLY = { p6: true, msproject: false, ops: false } as const;
const MSP_ONLY = { p6: false, msproject: true, ops: false } as const;
const NONE = { p6: false, msproject: false, ops: false } as const;
const SINCE = '2026-09-22';

function convention(
  id: ConventionKey, group: 'A' | 'B' | 'C', builtIn: Record<BuiltInProfileId, boolean>, gatedByP6Source: boolean,
  perFile = false, since = SINCE,
): ConventionDescriptor {
  return {
    id, kind: 'boolean', builtIn, group, legacyValue: builtIn.ops, gatedByP6Source, perFile,
    labelKey: `conventions.${id}`, since,
  };
}

/** Het register, in vaste volgorde (die volgorde is ook de sleutelvolgorde in de IFC-JSON).
  *  Bijlage-A-nummers: A12, A13, A15–A20, A22, A23, B1–B5; daarna C1–C3 (X12 naar nul, brok 2), C4–C6 (brok 3), C7–C8 (brok 4), C9 (brok 6), C11–C12 (brok 8), C14 (brok 10: de ALAP-conventie die plan XER §9 "C10" noemt). */
export const CONVENTIONS: readonly ConventionDescriptor[] = [
  // A17, B3 en B4 staan sinds 2026-09-23 in elk ingebouwd profiel uit (eigenaarsvraag §1d-7): P6: uit —
  // geen effect op P6-doorgerekende bestanden; gebouwd op rehab-2 (P3). Gemeten op de motor mét C5/C6:
  // elk apart en alle drie samen 0 nieuw / 0 verslechterd / 0 groter / 0 verbeterd, X12 blijft 192.
  // Na integratieronde 2 (C11–C13, C2-breed, C6-optie) herbevestigd: measure:profiles NULDOEL 175, 0/0/0.
  convention('preserveActualDatesInBackwardPass', 'A', P6_ONLY, false),        // A12
  convention('clampNegativeFreeFloat', 'A', P6_ONLY, false),                   // A13
  convention('p6ZeroDurationUsesPlannedBoundary', 'A', P6_ONLY, true),         // A15
  convention('p6UseTaskPlannedStartFloor', 'A', P6_ONLY, true),                // A16
  convention('p6FinishMilestoneBoundaryWindow', 'A', NONE, true),              // A17 (P6: uit, zie hieronder)
  convention('p6PreserveActualInstants', 'A', P6_ONLY, true),                  // A18
  // A19: per bestand (`rem_target_link_flag`); de P6-basis is uit, de XER-lezer zet hem als override.
  convention('p6UseRemainingStartForProgress', 'A', NONE, true, true),         // A19 (per bestand)
  convention('p6PreserveZeroDurationConstraintInstants', 'A', P6_ONLY, true),  // A20
  convention('resumeFromActualElapsed', 'A', MSP_ONLY, false),                 // A22
  convention('unstartedIgnoresStatusDate', 'A', MSP_ONLY, false),              // A23
  convention('p6RelationFinishBoundary', 'B', P6_ONLY, true),                  // B1
  convention('p6BackwardLagFinishBoundary', 'B', P6_ONLY, true),               // B2
  convention('p6CompletedDataDateWindow', 'B', NONE, true),                    // B3 (P6: uit)
  convention('p6CompletedLoeActualFinish', 'B', NONE, true),                   // B4 (P6: uit)
  convention('p6OpenLoeTargetSpan', 'B', P6_ONLY, true),                       // B5
  // C1–C9: docblok met P6/MS Project/OPS en bron bij de sleutel in `types/project.ts`. C1 en C4
  // staan sinds 2026-09-23 in elk ingebouwd profiel uit (besluit: alleen P6-doorgerekende orakels;
  // op die populatie 0 effect, alleen rehab-2 = P3-uitvoer droeg ze). C3 blijft in P6 aan: C5 rekent
  // de lag tussen zijn statusdatumpunt en een opvolger met rekenregel C3, en C3 uit kost 640 exacte
  // cellen in Roads (503) en HarbourPointe (137), gemeten 2026-09-23 (regel A).
  convention('p6CompletedPredecessorAtDataDate', 'C', NONE, false, false, SINCE_X12_BROK2), // C1
  convention('p6FreeFloatOnOwnCalendar', 'C', P6_ONLY, false, false, SINCE_X12_BROK2),         // C2
  convention('p6CompletedRemainingLag', 'C', P6_ONLY, false, false, SINCE_X12_BROK2),          // C3
  convention('p6CompletedOutOfSequenceWindow', 'C', NONE, false, false, SINCE_X12_BROK3),   // C4
  convention('p6CompletedPhysicalAtDataDate', 'C', P6_ONLY, false, false, SINCE_X12_BROK3),    // C5
  convention('p6InProgressStartLagElapsed', 'C', P6_ONLY, false, false, SINCE_X12_BROK3),      // C6
  convention('p6FinishFinishStartMilestoneLateFinish', 'C', P6_ONLY, false, false, SINCE_X12_BROK4), // C7
  convention('p6StartedTaskIgnoresPlannedStartFloor', 'C', P6_ONLY, false, false, SINCE_X12_BROK4),  // C8
  convention('p6LateFinishOnOwnCalendar', 'C', P6_ONLY, false, false, SINCE_X12_BROK6),              // C9
  // C10 bestaat niet in het register: plan XER §9 noemde de ALAP-conventie zo; ze staat hieronder als C14.
  convention('p6ProgressOverrideIgnoresStartedSuccessor', 'C', P6_ONLY, false, false, SINCE_X12_BROK8), // C11
  convention('p6FinishNotBeforeFinishFinishBound', 'C', P6_ONLY, false, false, SINCE_X12_BROK8),        // C12
  // C13 is geen registerconventie (brok 8: een regel binnen C5). C14 = plan XER §9 "C10".
  convention('p6AlapPositionedFromSuccessors', 'C', P6_ONLY, false, false, SINCE_X12_BROK10),           // C14
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
  p6CompletedPredecessorAtDataDate: true, p6FreeFloatOnOwnCalendar: true, p6CompletedRemainingLag: true,
  p6CompletedOutOfSequenceWindow: true, p6CompletedPhysicalAtDataDate: true, p6InProgressStartLagElapsed: true,
  p6FinishFinishStartMilestoneLateFinish: true, p6StartedTaskIgnoresPlannedStartFloor: true,
  p6LateFinishOnOwnCalendar: true, p6ProgressOverrideIgnoresStartedSuccessor: true,
  p6FinishNotBeforeFinishFinishBound: true, p6AlapPositionedFromSuccessors: true,
};
export const CONVENTION_KEYS = Object.keys(_everyConventionNamed) as readonly ConventionKey[];
type Overlap = Extract<ProjectOptionKey, ConventionKey>;
const _disjoint: [Overlap] extends [never] ? true : Overlap = true;
void _disjoint;

const CONVENTION_KEY_SET: ReadonlySet<string> = new Set(CONVENTION_KEYS);
export const isConventionKey = (key: string): key is ConventionKey => CONVENTION_KEY_SET.has(key);
export const isBuiltInProfileId = (value: unknown): value is BuiltInProfileId =>
  typeof value === 'string' && (BUILT_IN_PROFILE_IDS as readonly string[]).includes(value);

export function conventionsFor(pick: (d: ConventionDescriptor) => boolean): SchedulingConventions {
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

/** Basis + afwijkingen ⇒ alle zevenentwintig conventies. Afwezig profiel ≡ `ops` zonder afwijkingen.
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

/** Is dit profiel het standaardprofiel: ingebouwd `ops` zonder ENIGE afwijking? Zo'n profiel wordt
 *  niet weggeschreven en na lezen niet op het project gezet (afwezig ≡ ops). Letterlijk, niet
 *  semantisch (besluit orkestrator 2026-09-22): een afwijking die onder ops toevallig gelijk is aan de
 *  basis (P6 {A13: uit} → OPS) blijft staan, zodat P6 → OPS → P6 het origineel teruggeeft. Alleen
 *  bekende conventiesleutels met een boolean tellen (zoals in `resolveConventions`). */
export function isDefaultProfile(profile: SchedulingProfile | undefined): boolean {
  if (!profile) return true;
  const overrides = profile.overrides as Partial<Record<string, unknown>>;
  return profile.id === 'ops' && profile.baseId === 'ops'
    && CONVENTION_KEYS.every(key => typeof overrides[key] !== 'boolean');
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
  startToStartLagFrom: 'earlyStart';
} {
  return {
    lagCalendar: 'predecessor',
    criticalDefinition: { mode: 'totalFloat', thresholdHours: 0 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: false,
    useExpectedFinishDates: true,
    p6CompletedLateFromRemainingWindow: true,
    // P6-standaard "Calculate Start-to-Start lag from: Early Start" (de variant van C6).
    startToStartLagFrom: 'earlyStart',
  };
}

/** Standaard-PROJECTOPTIES voor een nieuw of bronloos project per basis. P6 = de optie-defaults
 *  van de XER-lezer (`XER_SCHEDULING_DEFAULTS` zonder bronmarkering en zonder conventies; die
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
