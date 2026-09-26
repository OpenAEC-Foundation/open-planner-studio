/**
 * Rekenprofielen — het conventieregister.
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

/**
 * BESCHRIJVEND thema van een conventie: waar gaat de regel over, in de woorden van een planner. Alleen
 * de weergave (het profielblok in Projectinfo, de gids) gebruikt dit; de motor, de migratie en de
 * IFC-laag lezen het nooit. De volgorde van `CONVENTION_THEMES` is de volgorde van de koppen in de UI.
 *  - `completedWork`: gestarte en voltooide taken rond de statusdatum (voortgang).
 *  - `relationsLag`: hoe een relatie of haar lag de opvolger of de late kant van de voorganger bindt.
 *  - `milestones`: mijlpalen (nulduur) en LOE-activiteiten, die een eigen venster in plaats van een duur hebben.
 *  - `float`: vrije/totale speling en de late datums waaruit die volgt.
 *  - `instants`: een datum of tijdstip uit het bestand dat letterlijk blijft staan (geplande start,
 *    werkelijke datums, constraintmoment).
 *  - `msproject`: de twee voortgangsconventies van Microsoft Project.
 */
export type ConventionTheme = 'completedWork' | 'relationsLag' | 'milestones' | 'float' | 'instants' | 'msproject';
export const CONVENTION_THEMES = [
  'completedWork', 'relationsLag', 'milestones', 'float', 'instants', 'msproject',
] as const satisfies readonly ConventionTheme[];

export interface ConventionDescriptor {
  /** Stabiele sleutel; tegelijk de sleutel in `SchedulingOptions` en in de IFC-JSON. */
  id: ConventionKey;
  /** Alle conventies zijn booleans. Komt er ooit een andere soort bij, dan breidt die de unie uit
   *  samen met de sanitizers (die nu alleen booleans accepteren). */
  kind: 'boolean';
  builtIn: Record<BuiltInProfileId, boolean>;
  /** Herkomstgroep: A = al een `SchedulingOptions`-sleutel vóór de profielen, B = was alleen actief
   *  achter de XER-bronmarkering, C = nooit achter een bronmarkering geweest. Een legacy-XER-blob
   *  (zonder profiel-pset) migreert naar het P6-profiel zonder afwijkingen, dus met C aan; een
   *  profiel-pset die de sleutel niet kent krijgt `legacyValue`. */
  group: 'A' | 'B' | 'C';
  /** BESCHRIJVEND: het thema waaronder de conventie in de UI staat (zie `ConventionTheme`). Geen
   *  motorgedrag; los van `group` (dat is de herkomst in het register, geen onderwerp). */
  theme: ConventionTheme;
  /** De waarde die geldt wanneer een bestand MÉT `OPS_SchedulingProfile` deze sleutel niet kent (een
   *  bestand van vóór `since`). Per constructie de OPS-waarde (`builtIn.ops`, dus voor elke conventie
   *  `false`): zo'n bestand rekende zonder de regel, en onder een P6-basis verschijnt de ontbrekende
   *  sleutel dan eerlijk als afwijking. Nooit de waarde van de GEKOZEN basis. Geldt niet voor de
   *  legacy-migratie van bestanden zonder die pset — daarvoor zie `legacyOptionsToProfile`. */
  legacyValue: boolean;
  /** Was deze conventie vóór de rekenprofielen alleen actief onder de XER-bronmarkering? Zo ja, dan
   *  was een losse vlag zonder die markering inert en gooit de legacy-migratie hem weg. */
  gatedByP6Source: boolean;
  /** i18n-sleutel (namespace common): `<labelKey>.label` / `<labelKey>.help`. */
  labelKey: string;
  /** ISO-datum waarop de conventie in het register kwam (documentatie bij `legacyValue`). */
  since: string;
}

/** `since`-datums van groep C (C1–C9, C11, C12, C14). */
const SINCE_X12_BROK2 = '2026-09-23';
const SINCE_X12_BROK3 = '2026-09-23';
const SINCE_X12_BROK4 = '2026-09-23';
const SINCE_X12_BROK6 = '2026-09-23';
const SINCE_X12_BROK8 = '2026-09-23';
const SINCE_X12_BROK10 = '2026-09-24';

const P6_ONLY = { p6: true, msproject: false, ops: false } as const;
const MSP_ONLY = { p6: false, msproject: true, ops: false } as const;
const NONE = { p6: false, msproject: false, ops: false } as const;
const SINCE = '2026-09-22';

function convention(
  id: ConventionKey, group: 'A' | 'B' | 'C', theme: ConventionTheme, builtIn: Record<BuiltInProfileId, boolean>,
  gatedByP6Source: boolean, since = SINCE,
): ConventionDescriptor {
  return {
    id, kind: 'boolean', builtIn, group, theme, legacyValue: builtIn.ops, gatedByP6Source,
    labelKey: `conventions.${id}`, since,
  };
}

/** Het register, in vaste volgorde (die volgorde is ook de sleutelvolgorde in de IFC-JSON).
  *  Registernummers: A12, A13, A15–A20, A22, A23, B1–B5, C1–C9, C11, C12, C14 (C10 en C13 bestaan niet). */
export const CONVENTIONS: readonly ConventionDescriptor[] = [
  // A17, B3 en B4 staan in elk ingebouwd profiel uit: geen effect op P6-doorgerekende bestanden (ze
  // komen uit rehab-2, P3-uitvoer); aan of uit verandert geen enkele gemeten cel.
  // Thema per regel: het ONDERWERP van de conventie (zie `ConventionTheme`), met de reden erachter.
  convention('preserveActualDatesInBackwardPass', 'A', 'completedWork', P6_ONLY, false),       // A12 gestarte/voltooide taak houdt haar datums aan de late kant
  convention('clampNegativeFreeFloat', 'A', 'float', P6_ONLY, false),                          // A13 gaat over de vrije speling zelf
  convention('p6ZeroDurationUsesPlannedBoundary', 'A', 'milestones', P6_ONLY, true),           // A15 kalendergrens van een nulduurmijlpaal
  convention('p6UseTaskPlannedStartFloor', 'A', 'instants', P6_ONLY, true),                    // A16 de geplande start uit het bestand blijft als ondergrens staan
  convention('p6FinishMilestoneBoundaryWindow', 'A', 'milestones', NONE, true),                // A17 (P6: uit) eindmijlpaal op twee grenzen
  convention('p6PreserveActualInstants', 'A', 'instants', P6_ONLY, true),                      // A18 werkelijke tijdstippen letterlijk, niet naar een band
  // A19 staat vast aan in P6: in alle P6-doorgerekende bestanden heeft elke lopende taak
  // early_start == restart_date. Er is geen per-bestand-koppeling aan `rem_target_link_flag`.
  convention('p6UseRemainingStartForProgress', 'A', 'completedWork', P6_ONLY, true),           // A19 vroege start van een lopende taak = restwerk
  convention('p6PreserveZeroDurationConstraintInstants', 'A', 'instants', P6_ONLY, true),      // A20 constraintmoment exact; tijdstip boven mijlpaal: de regel gaat over het moment
  convention('resumeFromActualElapsed', 'A', 'msproject', MSP_ONLY, false),                    // A22 MS Project-voortgang
  convention('unstartedIgnoresStatusDate', 'A', 'msproject', MSP_ONLY, false),                 // A23 MS Project-voortgang
  convention('p6RelationFinishBoundary', 'B', 'relationsLag', P6_ONLY, true),                  // B1 eind-startrelatie op een bandgrens
  convention('p6BackwardLagFinishBoundary', 'B', 'relationsLag', P6_ONLY, true),               // B2 lag terugrekenen
  convention('p6CompletedDataDateWindow', 'B', 'completedWork', NONE, true),                   // B3 (P6: uit) voltooide taak in het statusdatumvenster
  convention('p6CompletedLoeActualFinish', 'B', 'completedWork', NONE, true),                  // B4 (P6: uit) voltooide LOE: voltooid werk wint van LOE
  convention('p6OpenLoeTargetSpan', 'B', 'milestones', P6_ONLY, true),                         // B5 niet-gestarte LOE: venster i.p.v. duur, net als een mijlpaal
  // C1–C14: docblok met P6/MS Project/OPS en bron bij de sleutel in `types/project.ts`. C1 en C4
  // staan in elk ingebouwd profiel uit: op P6-doorgerekende bestanden geen effect, alleen rehab-2
  // (P3-uitvoer) droeg ze. C3 blijft in P6 aan: C5 rekent de lag tussen zijn statusdatumpunt en een
  // opvolger met rekenregel C3, en C3 uit maakt honderden exacte corpuscellen inexact (regel A).
  convention('p6CompletedPredecessorAtDataDate', 'C', 'completedWork', NONE, false, SINCE_X12_BROK2),     // C1 voltooide voorganger na de statusdatum
  convention('p6FreeFloatOnOwnCalendar', 'C', 'float', P6_ONLY, false, SINCE_X12_BROK2),                  // C2 vrije speling per kalender
  convention('p6CompletedRemainingLag', 'C', 'relationsLag', P6_ONLY, false, SINCE_X12_BROK2),            // C3 de LAG na een voltooide voorganger (naast C6)
  convention('p6CompletedOutOfSequenceWindow', 'C', 'completedWork', NONE, false, SINCE_X12_BROK3),       // C4 voltooide taak buiten volgorde
  convention('p6CompletedPhysicalAtDataDate', 'C', 'completedWork', P6_ONLY, false, SINCE_X12_BROK3),     // C5 voltooide fysieke-voortgangstaak; alleen CP_Phys gemeten, dus smal
  convention('p6InProgressStartLagElapsed', 'C', 'relationsLag', P6_ONLY, false, SINCE_X12_BROK3),        // C6 de start-startlag uit een lopende voorganger
  convention('p6FinishFinishStartMilestoneLateFinish', 'C', 'milestones', P6_ONLY, false, SINCE_X12_BROK4), // C7 eind-eindrelatie naar een startmijlpaal: het doel is de mijlpaal
  convention('p6StartedTaskIgnoresPlannedStartFloor', 'C', 'completedWork', P6_ONLY, false, SINCE_X12_BROK4), // C8 lopende taak (tegenhanger van A16)
  convention('p6LateFinishOnOwnCalendar', 'C', 'float', P6_ONLY, false, SINCE_X12_BROK6),                 // C9 late finish ⇒ de speling
  convention('p6ProgressOverrideIgnoresStartedSuccessor', 'C', 'completedWork', P6_ONLY, false, SINCE_X12_BROK8), // C11 voortgangsinstelling Progress Override
  convention('p6FinishNotBeforeFinishFinishBound', 'C', 'relationsLag', P6_ONLY, false, SINCE_X12_BROK8),        // C12 eind-eindgrens
  // C13 is geen registerconventie maar een regel binnen C5.
  convention('p6AlapPositionedFromSuccessors', 'C', 'float', P6_ONLY, false, SINCE_X12_BROK10),      // C14 ALAP-taak zo laat als de opvolgers toestaan
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

/** Staat de conventie in ÉLK ingebouwd profiel uit? Dan is ze alleen in een
 *  eigen profiel aan te zetten; de UI zet ze in een aparte laatste groep. Afgeleid uit `builtIn`. */
export const isOffInEveryBuiltIn = (d: ConventionDescriptor): boolean =>
  BUILT_IN_PROFILE_IDS.every(id => !d.builtIn[id]);

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
 *  semantisch: een afwijking die onder ops toevallig gelijk is aan de
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
 *  als LAATSTE gespreid, zodat het profiel altijd wint van eventuele
 *  conventiesleutels die in de overgang nog in `schedulingOptions` staan. */
export function effectiveSchedulingOptions(
  project: Pick<Project, 'schedulingProfile' | 'schedulingOptions'>,
): EffectiveSchedulingOptions {
  return { ...project.schedulingOptions, ...resolveConventions(project.schedulingProfile) };
}
