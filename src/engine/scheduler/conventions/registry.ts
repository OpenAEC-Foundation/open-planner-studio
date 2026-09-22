/**
 * Rekenprofielen — het conventieregister (spec `docs/superpowers/specs/2026-09-22-rekenprofielen-design.md`,
 * tweelagenmodel na de critreview van 2026-09-22).
 *
 * Twee lagen, disjuncte sleutels:
 *  - **Conventies** (`ConventionKey`, veertien booleans): regels die per planningspakket verschillen.
 *    Ze leven in het profiel (`Project.schedulingProfile`), als basis + afwijkingen.
 *  - **Opties** (`OptionKey`): per-bestand projectinstellingen (lagCalendar, kritiek-definitie,
 *    TF-modus, …). Ze blijven in `Project.schedulingOptions`, zoals het bestand ze vastlegt.
 *
 * De solver krijgt één `SchedulingOptions` via `effectiveSchedulingOptions(project)`.
 *
 * Deze module is puur en importeert uitsluitend types: `services/` (de XER-lezer, de IFC-lezer)
 * importeren hieruit, nooit andersom (`npm run verify:cycles`).
 */
import type {
  BuiltInProfileId,
  ConventionKey,
  Project,
  SchedulingConventions,
  SchedulingOptions,
  SchedulingProfile,
} from '@/types/project';

/** De per-bestand projectinstellingen: alles in `SchedulingOptions` behalve de conventies en de
 *  overgangsvlag `p6Source` (die verdwijnt bij de integratie met baan B). */
export type OptionKey = Exclude<keyof SchedulingOptions, ConventionKey | 'p6Source'>;

export const BUILT_IN_PROFILE_IDS = ['p6', 'msproject', 'ops'] as const satisfies readonly BuiltInProfileId[];

export interface ConventionDescriptor {
  /** Stabiele sleutel; tegelijk de sleutel in `SchedulingOptions` en in de IFC-JSON. */
  id: ConventionKey;
  /** Alle huidige conventies zijn booleans. `choice`/`number` blijven in de unie voor de conventies
   *  die het X12-vervolg of de OPS-keuze nog kan opleveren; de sanitizer weigert ze tot dan. */
  kind: 'boolean' | 'choice' | 'number';
  values?: readonly string[];
  range?: { min: number; max: number };
  builtIn: Record<BuiltInProfileId, boolean>;
  /** De waarde die geldt wanneer een OPGESLAGEN profiel deze sleutel niet kent (een bestand van
   *  vóór `since`). Nooit de basiswaarde: een bestand dat de regel niet kende rekende zonder. */
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
const SINCE = '2026-09-22';

function convention(
  id: ConventionKey, builtIn: Record<BuiltInProfileId, boolean>, gatedByP6Source: boolean,
): ConventionDescriptor {
  return {
    id, kind: 'boolean', builtIn, legacyValue: builtIn.ops, gatedByP6Source,
    labelKey: `conventions.${id}`, since: SINCE,
  };
}

/** Het register, in vaste volgorde (die volgorde is ook de sleutelvolgorde in de IFC-JSON). */
export const CONVENTIONS: readonly ConventionDescriptor[] = [
  convention('preserveActualDatesInBackwardPass', P6_ONLY, false),
  convention('clampNegativeFreeFloat', P6_ONLY, false),
  convention('p6ZeroDurationUsesPlannedBoundary', P6_ONLY, true),
  convention('p6UseTaskPlannedStartFloor', P6_ONLY, true),
  convention('p6FinishMilestoneBoundaryWindow', P6_ONLY, true),
  convention('p6PreserveActualInstants', P6_ONLY, true),
  convention('p6PreserveZeroDurationConstraintInstants', P6_ONLY, true),
  convention('resumeFromActualElapsed', MSP_ONLY, false),
  convention('unstartedIgnoresStatusDate', MSP_ONLY, false),
  convention('p6RelationFinishBoundary', P6_ONLY, true),
  convention('p6BackwardLagFinishBoundary', P6_ONLY, true),
  convention('p6CompletedDataDateWindow', P6_ONLY, true),
  convention('p6CompletedLoeActualFinish', P6_ONLY, true),
  convention('p6OpenLoeTargetSpan', P6_ONLY, true),
];

// ── Compile-time: register ⇔ ConventionKey, en opties ⊥ conventies ─────────────────────────────
// Een Record over ConventionKey dwingt dat elke conventie hier (en dus in de lijst hierboven, zie
// de runtime-check in `check-conventions-registry.ts`) staat; een sleutel die zowel optie als
// conventie zou zijn is per constructie onmogelijk (`OptionKey` is het complement).
const _everyConventionNamed: Record<ConventionKey, true> = {
  preserveActualDatesInBackwardPass: true, clampNegativeFreeFloat: true,
  p6ZeroDurationUsesPlannedBoundary: true, p6UseTaskPlannedStartFloor: true,
  p6FinishMilestoneBoundaryWindow: true, p6PreserveActualInstants: true,
  p6PreserveZeroDurationConstraintInstants: true, resumeFromActualElapsed: true,
  unstartedIgnoresStatusDate: true, p6RelationFinishBoundary: true, p6BackwardLagFinishBoundary: true,
  p6CompletedDataDateWindow: true, p6CompletedLoeActualFinish: true, p6OpenLoeTargetSpan: true,
};
export const CONVENTION_KEYS = Object.keys(_everyConventionNamed) as readonly ConventionKey[];
type Overlap = Extract<OptionKey, ConventionKey>;
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

/** Basis + afwijkingen ⇒ alle veertien conventies. Afwezig profiel ≡ `ops` zonder afwijkingen.
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

/** De P6-optie-defaults met precieze types (alle velden aanwezig), voor de XER-lezer die er zijn
 *  `XER_SCHEDULING_DEFAULTS` uit opbouwt. Levert steeds een verse kopie. */
export function p6OptionDefaults(): {
  lagCalendar: 'predecessor';
  criticalDefinition: { mode: 'totalFloat'; thresholdHours: number };
  totalFloatMode: 'finish';
  makeOpenEndedCritical: boolean;
  useExpectedFinishDates: boolean;
  p6UseRemainingStartForProgress: boolean;
  p6CompletedLateFromRemainingWindow: boolean;
} {
  return {
    lagCalendar: 'predecessor',
    criticalDefinition: { mode: 'totalFloat', thresholdHours: 0 },
    totalFloatMode: 'finish',
    makeOpenEndedCritical: false,
    useExpectedFinishDates: true,
    p6UseRemainingStartForProgress: false,
    p6CompletedLateFromRemainingWindow: true,
  };
}

/** Standaard-OPTIES voor een nieuw of bronloos project per basis. P6 = de optie-defaults van de
 *  XER-lezer (`XER_SCHEDULING_DEFAULTS` zonder `p6Source` en zonder conventies; die gelijkheid is
 *  gepind in `check-conventions-registry.ts`); MS Project = kleinste speling; OPS = niets (afwezig
 *  ≡ het huidige gedrag, dus ook géén `'auto'` wegschrijven). Levert steeds een verse kopie. */
export function defaultOptionsFor(baseId: BuiltInProfileId): SchedulingOptions {
  switch (baseId) {
    case 'p6':
      return p6OptionDefaults();
    case 'msproject':
      return { totalFloatMode: 'smallest' };
    case 'ops':
      return {};
  }
}

/** Alleen de optie-sleutels (geen conventies, geen `p6Source`), sleutelvolgorde behouden.
 *  Leeg resultaat ⇒ `undefined`, net als een afwezig blok. */
export function optionKeysOnly(options: SchedulingOptions | undefined): SchedulingOptions | undefined {
  if (!options) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (key === 'p6Source' || isConventionKey(key)) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? (out as SchedulingOptions) : undefined;
}

/**
 * Migratie van een legacy `OPS_SchedulingOptions`-blob (van vóór de rekenprofielen) naar
 * profiel + opties, per veld (spec §3.4, modelwijziging punt 4):
 *  (a) `p6Source: 'XER'` ⇒ basis `p6`; afwijkingen = de conventiesleutels uit de blob die van p6
 *      afwijken (een ontbrekende conventie was onder p6Source vandaag al aan ⇒ geen afwijking);
 *  (b) geen `p6Source` ⇒ de p6Source-gepoorte conventies worden weggegooid (ze waren inert); de
 *      niet-gepoorte worden afwijkingen; basis = `msproject` als `resumeFromActualElapsed` én
 *      `unstartedIgnoresStatusDate` allebei true zijn (de `.mpp`-lezer), anders `ops`;
 *  (c) optie-sleutels gaan altijd naar `options`.
 */
export function legacyOptionsToProfile(blob: SchedulingOptions | undefined): {
  profile: SchedulingProfile;
  options: SchedulingOptions | undefined;
} {
  const options = optionKeysOnly(blob);
  if (!blob) return { profile: builtInProfile('ops'), options };
  if (blob.p6Source === 'XER') {
    return { profile: { ...builtInProfile('p6'), overrides: diffAgainstBase('p6', blob) }, options };
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

/** De ene set die de solver krijgt: opgeloste conventies van het profiel + de projectopties.
 *  In de overgang (zolang de XER-lezer nog conventies in `schedulingOptions` zet) winnen de
 *  opties; in het eindmodel zijn de sleutels disjunct en is de volgorde irrelevant. */
export function effectiveSchedulingOptions(
  project: Pick<Project, 'schedulingProfile' | 'schedulingOptions'>,
): SchedulingOptions {
  return { ...resolveConventions(project.schedulingProfile), ...project.schedulingOptions };
}
