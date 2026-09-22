import type {
  BuiltInProfileId, LegacySchedulingOptions, ProjectSchedulingOptions, SchedulingConventions, SchedulingProfile,
} from '@/types/project';
import {
  CONVENTIONS, diffAgainstBase, isBuiltInProfileId, isDefaultProfile, resolveConventions,
} from '@/engine/scheduler/conventions/registry';
import { optionKeysOnly, legacyOptionsToProfile } from '@/services/ifc/schedulingProfileMigration';

/**
 * Eindreview XER-etappe, bevinding 4 — het `OPS_SchedulingOptions`-JSON uit een IFC is BUITEN-
 * invoer: een willekeurig IFC-bestand kon vóór deze poort `p6Source: 'XER'`, alle p6-vlaggen en een
 * onzin-`criticalDefinition` (niet-bestaande `mode`, een string als `thresholdHours`) ongefilterd
 * in `project.schedulingOptions` zetten (`JSON.parse` + cast, probe gedraaid). Deze functie is de
 * saaie whitelist-/typevalidator: bekende sleutels, bekende enum-waarden, eindige getallen voor de
 * getallen, booleans voor de vlaggen. Alles wat daar niet aan voldoet wordt WEGGELATEN (het veld
 * blijft op zijn solver-default), nooit "gerepareerd" — een half geldig object mag geen ander
 * gedrag activeren dan het bestand letterlijk beschrijft.
 *
 * Wat deze poort bewust NIET doet: `p6Source: 'XER'` weigeren. Een uit XER geïmporteerd project
 * round-tript zijn P6-opties via ditzelfde pset (`ifcWriter.ts`, `writeSchedulingOptionsMeta`), dus
 * de IFC-lezer is — naast de XER-lezer — een legitieme schrijver van `p6Source`. De
 * `CPMSolver`-hardening op de sequences (X12, `p6StartAtPredecessorFinishBoundary` wordt gestript
 * zonder `p6Source`) beschermt tegen een LOSSE relatievlag zonder projectniveau-bron; ze beschermt
 * niet tegen een vervalst projectbestand, en beweert dat sinds deze bijstelling ook niet meer.
 *
 * Leesmigratie-vrij: sleutels die de app niet (meer) kent verdwijnen stil; dat is hetzelfde
 * gedrag als voorheen voor onbekende psets. Headless getest in `check-ifc-roundtrip.ts`.
 */
const BOOLEAN_KEYS = [
  'makeOpenEndedCritical', 'useExpectedFinishDates', 'preserveActualDatesInBackwardPass',
  'clampNegativeFreeFloat', 'p6ZeroDurationUsesPlannedBoundary', 'p6UseTaskPlannedStartFloor',
  'p6FinishMilestoneBoundaryWindow', 'p6PreserveActualInstants', 'p6UseRemainingStartForProgress',
  'p6PreserveZeroDurationConstraintInstants', 'useProjectEndDateForFloat', 'resumeFromActualElapsed',
  'unstartedIgnoresStatusDate', 'p6CompletedLateFromRemainingWindow',
  // Rekenprofielen, groep B (bijlage A): conventiesleutels. In de overgang (tot de integratie met
  // baan B) mogen ze nog in dit blok staan; `sanitizeProjectOptions` hieronder stript ze wel.
  'p6RelationFinishBoundary', 'p6BackwardLagFinishBoundary', 'p6CompletedDataDateWindow',
  'p6CompletedLoeActualFinish', 'p6OpenLoeTargetSpan',
] as const satisfies ReadonlyArray<keyof LegacySchedulingOptions>;

const LAG_CALENDARS = ['predecessor', 'successor', '24hour', 'projectDefault'] as const;
const TOTAL_FLOAT_MODES = ['start', 'finish', 'smallest'] as const;
const CRITICAL_MODES = ['totalFloat', 'longestPath'] as const;
const FLOAT_PATH_METHODS = ['FREE_FLOAT', 'TOTAL_FLOAT'] as const;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Compile-time: elke sleutel van `LegacySchedulingOptions` moet hieronder een tak hebben. */
type HandledKeys =
  | (typeof BOOLEAN_KEYS)[number]
  | 'p6Source' | 'lagCalendar' | 'criticalDefinition' | 'totalFloatMode'
  | 'nearCriticalThreshold' | 'floatPaths';
type MissingKeys = Exclude<keyof LegacySchedulingOptions, HandledKeys>;
const _allKeysHandled: MissingKeys extends never ? true : MissingKeys = true;
void _allKeysHandled;

export function sanitizeSchedulingOptions(input: unknown): LegacySchedulingOptions | undefined {
  if (!isRecord(input)) return undefined;
  const out: LegacySchedulingOptions = {};
  // Sleutelvolgorde van de INVOER behouden: de round-trip-checks vergelijken via JSON.stringify,
  // en een geschreven blok moet na lezen byte-identiek terugkomen — de poort filtert, herordent niet.
  for (const key of Object.keys(input)) {
    const value = input[key];
    switch (key) {
      case 'p6Source': if (value === 'XER') out.p6Source = 'XER'; break;
      case 'lagCalendar': if (oneOf(value, LAG_CALENDARS)) out.lagCalendar = value; break;
      case 'totalFloatMode': if (oneOf(value, TOTAL_FLOAT_MODES)) out.totalFloatMode = value; break;
      case 'nearCriticalThreshold': if (isFiniteNumber(value)) out.nearCriticalThreshold = value; break;
      case 'criticalDefinition':
        if (isRecord(value) && oneOf(value.mode, CRITICAL_MODES)) {
          out.criticalDefinition = {
            mode: value.mode,
            ...(isFiniteNumber(value.threshold) ? { threshold: value.threshold } : {}),
            ...(isFiniteNumber(value.thresholdHours) ? { thresholdHours: value.thresholdHours } : {}),
          };
        }
        break;
      case 'floatPaths':
        if (isRecord(value) && typeof value.enabled === 'boolean'
          && oneOf(value.method, FLOAT_PATH_METHODS) && isFiniteNumber(value.maxPaths)) {
          out.floatPaths = { enabled: value.enabled, method: value.method, maxPaths: value.maxPaths };
        }
        break;
      default:
        if ((BOOLEAN_KEYS as readonly string[]).includes(key) && typeof value === 'boolean') {
          out[key as (typeof BOOLEAN_KEYS)[number]] = value;
        }
        // Onbekende sleutel: weglaten.
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ── Rekenprofielen (spec 2026-09-22, tweelagenmodel) ─────────────────────────────────────────────

/** Eindmodel-sanitizer voor `project.schedulingOptions`: zoals `sanitizeSchedulingOptions`, maar
 *  conventiesleutels en `p6Source` worden gestript (die horen in het profiel). */
export function sanitizeProjectOptions(input: unknown): ProjectSchedulingOptions | undefined {
  return optionKeysOnly(sanitizeSchedulingOptions(input));
}

/** Bovengrens op de rauwe JSON van één profiel: een geldig profiel is ruim onder 2 KB. Groter ⇒
 *  niet parsen (geen allocaties uit ongevalideerde bestandswaarden). */
export const MAX_PROFILE_JSON_LENGTH = 64 * 1024;
export const MAX_PROFILE_ID_LENGTH = 64;
export const MAX_PROFILE_NAME_LENGTH = 200;

const validId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_PROFILE_ID_LENGTH;
const validName = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_PROFILE_NAME_LENGTH;

/**
 * `OPS_SchedulingProfile`-JSON uit een IFC (`{ id, baseId, conventions, name? }`) ⇒ profiel.
 *  - geen object ⇒ `undefined` (de lezer valt terug op de legacy-migratie);
 *  - onbekende/ontbrekende `baseId` ⇒ `ops`;
 *  - `conventions`: per conventie een boolean ⇒ die waarde; ONTBREKENDE sleutel (een bestand van
 *    vóór die conventie) of ongeldig getypeerde waarde ⇒ `legacyValue`, nooit de basiswaarde;
 *    onbekende sleutels ⇒ genegeerd. `overrides` = verschil met de basis, dus de
 *    bestandswaarden winnen en de state blijft compact;
 *  - ongeldige/te lange `id` ⇒ de basis-id; een ingebouwde id met een andere basis ⇒ de basis-id;
 *  - `name` alleen voor eigen profielen, ≤ 200 tekens, anders leeg.
 */
export function sanitizeSchedulingProfile(input: unknown): SchedulingProfile | undefined {
  if (!isRecord(input)) return undefined;
  const baseId: BuiltInProfileId = isBuiltInProfileId(input.baseId) ? input.baseId : 'ops';
  const raw = isRecord(input.conventions) ? input.conventions : {};
  const resolved: Partial<SchedulingConventions> = {};
  for (const d of CONVENTIONS) {
    const value = raw[d.id];
    resolved[d.id] = typeof value === 'boolean' ? value : d.legacyValue;
  }
  let id = validId(input.id) ? input.id : baseId;
  if (isBuiltInProfileId(id) && id !== baseId) id = baseId;
  const name = !isBuiltInProfileId(id) && validName(input.name) ? input.name : '';
  return { baseId, id, name, overrides: diffAgainstBase(baseId, resolved) };
}

/** Het JSON-object dat de IFC-schrijver voor een profiel wegschrijft (spiegel van de sanitizer):
 *  alle vijftien conventies OPGELOST, zodat een bestand overal gelijk rekent, ook waar het eigen
 *  profiel ontbreekt. `name` alleen voor eigen profielen (ingebouwde nooit vertaald wegschrijven). */
export function schedulingProfileToJson(profile: SchedulingProfile): {
  id: string; baseId: BuiltInProfileId; conventions: SchedulingConventions; name?: string;
} {
  return {
    id: profile.id,
    baseId: profile.baseId,
    conventions: resolveConventions(profile),
    ...(!isBuiltInProfileId(profile.id) && profile.name ? { name: profile.name } : {}),
  };
}

/**
 * Een EIGEN profiel uit `ops-schedulingProfiles` (vorm `SchedulingProfile`). Strenger dan de
 * IFC-sanitizer, want een sjabloon zonder geldige kern heeft geen waarde: onbekende `baseId`,
 * een ongeldige/ingebouwde `id` of een ongeldige naam ⇒ `undefined` (het item valt weg).
 * `overrides`: alleen booleans op bekende conventiesleutels, geminimaliseerd tegen de basis.
 */
export function sanitizeStoredSchedulingProfile(input: unknown): SchedulingProfile | undefined {
  if (!isRecord(input)) return undefined;
  const baseId = input.baseId;
  if (!isBuiltInProfileId(baseId)) return undefined;
  if (!validId(input.id) || isBuiltInProfileId(input.id)) return undefined;
  if (!validName(input.name)) return undefined;
  const raw = isRecord(input.overrides) ? input.overrides : {};
  const overrides: Partial<SchedulingConventions> = {};
  for (const d of CONVENTIONS) {
    const value = raw[d.id];
    if (typeof value === 'boolean') overrides[d.id] = value;
  }
  return { baseId, id: input.id, name: input.name, overrides: diffAgainstBase(baseId, overrides) };
}

/**
 * Het profiel dat een project na het lezen krijgt: de `OPS_SchedulingProfile`-pset wint; zonder
 * (bruikbare) pset migreert het legacy `OPS_SchedulingOptions`-blok (`legacyOptionsToProfile`).
 * Het standaardprofiel (`ops` zonder afwijkingen) levert `undefined` — afwezig ≡ ops, zodat een
 * bestaand bestand na lezen dezelfde state oplevert als vóór de rekenprofielen.
 */
export function profileAfterRead(
  psetProfile: SchedulingProfile | undefined, legacyBlob: LegacySchedulingOptions | undefined,
): SchedulingProfile | undefined {
  const profile = psetProfile ?? legacyOptionsToProfile(legacyBlob).profile;
  return isDefaultProfile(profile) ? undefined : profile;
}
