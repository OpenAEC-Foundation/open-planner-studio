import type {
  BuiltInProfileId, LegacySchedulingOptions, LevelingPriorityKey, LevelingResourceSetting, LevelingSettings,
  ProjectSchedulingOptions, SchedulingConventions, SchedulingProfile,
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
 * `p6Source: 'XER'` blijft doorgelaten, maar is sinds de rekenprofielen geen poort meer: niets in de
 * motor leest hem (`npm run verify:conventions`). Hij bestaat alleen nog in OUDE bestanden, en de
 * enige afnemer is de migratie `legacyOptionsToProfile` (bestand zonder `OPS_SchedulingProfile` ⇒
 * profiel Primavera P6); `sanitizeProjectOptions` stript hem, dus hij komt nooit op het project. Het
 * P6-gedrag hangt aan de conventies van het profiel. De `CPMSolver`-hardening op de sequences (X12,
 * `p6StartAtPredecessorFinishBoundary` wordt gestript zonder conventie B1 `p6RelationFinishBoundary`)
 * beschermt tegen een LOSSE relatievlag; niet tegen een vervalst projectbestand, en dat beweert hij
 * ook niet.
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
  'p6CompletedPredecessorAtDataDate', 'p6FreeFloatOnOwnCalendar', 'p6CompletedRemainingLag',
  'p6CompletedOutOfSequenceWindow', 'p6CompletedPhysicalAtDataDate', 'p6InProgressStartLagElapsed',
  'p6FinishFinishStartMilestoneLateFinish', 'p6StartedTaskIgnoresPlannedStartFloor',
  'p6LateFinishOnOwnCalendar', 'p6ProgressOverrideIgnoresStartedSuccessor', 'p6FinishNotBeforeFinishFinishBound',
] as const satisfies ReadonlyArray<keyof LegacySchedulingOptions>;

const LAG_CALENDARS = ['predecessor', 'successor', '24hour', 'projectDefault'] as const;
const TOTAL_FLOAT_MODES = ['start', 'finish', 'smallest'] as const;
const START_TO_START_LAG_FROM = ['earlyStart', 'actualStart'] as const;
const CRITICAL_MODES = ['totalFloat', 'longestPath'] as const;
const FLOAT_PATH_METHODS = ['FREE_FLOAT', 'TOTAL_FLOAT'] as const;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Bovengrenzen voor het nivelleerblok: een geldige P6-lijst is ruim kleiner (14 prioriteitssleutels;
 *  resources hooguit de hele resourcepool). Groter ⇒ de overmaat valt weg, geen allocatie op
 *  ongevalideerde lengtes. */
export const MAX_LEVELING_PRIORITY_KEYS = 64;
export const MAX_LEVELING_RESOURCES = 20_000;
const MAX_LEVELING_ID_LENGTH = 256;
const LEVELING_FIELD_RE = /^[A-Za-z0-9_]{1,64}$/;
const LEVELING_DIRECTIONS = ['ASC', 'DESC'] as const;

/**
 * Het nivelleerblok (`SchedulingOptions.leveling`, etappe P6-nivellering fundament). Zelfde regels
 * als de rest: onbekend of verkeerd getypeerd valt weg, niets wordt gerepareerd. `enabled` is verplicht
 * (zonder geldige boolean vervalt het hele blok); ongeldige lijstelementen vallen los weg. Vaste
 * sleutelvolgorde = de volgorde van de XER-lezer, zodat lezen → schrijven byte-identiek blijft.
 */
function sanitizeLeveling(value: unknown): LevelingSettings | undefined {
  if (!isRecord(value) || typeof value.enabled !== 'boolean') return undefined;
  const out: LevelingSettings = { enabled: value.enabled };
  if (typeof value.preserveScheduledDates === 'boolean') out.preserveScheduledDates = value.preserveScheduledDates;
  if (typeof value.levelAllResources === 'boolean') out.levelAllResources = value.levelAllResources;
  if (Array.isArray(value.priority)) {
    const priority: LevelingPriorityKey[] = [];
    for (const item of value.priority.slice(0, MAX_LEVELING_PRIORITY_KEYS)) {
      if (isRecord(item) && typeof item.field === 'string' && LEVELING_FIELD_RE.test(item.field)
        && oneOf(item.direction, LEVELING_DIRECTIONS)) {
        priority.push({ field: item.field, direction: item.direction });
      }
    }
    out.priority = priority;
  }
  if (Array.isArray(value.resources)) {
    const resources: LevelingResourceSetting[] = [];
    for (const item of value.resources.slice(0, MAX_LEVELING_RESOURCES)) {
      if (!isRecord(item) || typeof item.resourceId !== 'string' || !item.resourceId
        || item.resourceId.length > MAX_LEVELING_ID_LENGTH) continue;
      resources.push({
        resourceId: item.resourceId,
        ...(isFiniteNumber(item.maxUnitsPerHour) && item.maxUnitsPerHour >= 0
          ? { maxUnitsPerHour: item.maxUnitsPerHour } : {}),
      });
    }
    out.resources = resources;
  }
  return out;
}

/** Compile-time: elke sleutel van `LegacySchedulingOptions` moet hieronder een tak hebben. */
type HandledKeys =
  | (typeof BOOLEAN_KEYS)[number]
  | 'p6Source' | 'lagCalendar' | 'criticalDefinition' | 'totalFloatMode'
  | 'nearCriticalThreshold' | 'floatPaths' | 'startToStartLagFrom' | 'leveling';
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
      case 'startToStartLagFrom':
        if (oneOf(value, START_TO_START_LAG_FROM)) out.startToStartLagFrom = value;
        break;
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
      case 'leveling': {
        const leveling = sanitizeLeveling(value);
        if (leveling) out.leveling = leveling;
        break;
      }
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

/** De LETTERLIJKE afwijkingen van een profiel: alleen booleans op bekende conventiesleutels, in
 *  registervolgorde (bytevolgorde van de pset). Anders dan `diffAgainstBase` blijven ook afwijkingen
 *  staan die toevallig gelijk zijn aan de basis — die dragen de herkomst bij een profielwissel
 *  (P6{A13 uit} → OPS → opslaan → heropenen → P6 geeft exact het origineel). */
export function literalOverrides(overrides: unknown): Partial<SchedulingConventions> {
  const raw = isRecord(overrides) ? overrides : {};
  const out: Partial<SchedulingConventions> = {};
  for (const d of CONVENTIONS) {
    const value = raw[d.id];
    if (typeof value === 'boolean') out[d.id] = value;
  }
  return out;
}

/** Moet dit profiel als pset worden weggeschreven / na lezen op het project blijven staan? Alleen
 *  het ops-profiel zónder enige (ook letterlijke) afwijking is "afwezig" (byte-identiek aan vroeger). */
export function carriesProfile(profile: SchedulingProfile | undefined): profile is SchedulingProfile {
  return profile !== undefined
    && (!isDefaultProfile(profile) || Object.keys(literalOverrides(profile.overrides)).length > 0);
}

/**
 * `OPS_SchedulingProfile`-JSON uit een IFC (`{ id, baseId, conventions, overrides?, name? }`) ⇒ profiel.
 *  - geen object ⇒ `undefined` (de lezer valt terug op de legacy-migratie);
 *  - onbekende/ontbrekende `baseId` ⇒ `ops`;
 *  - `conventions`: per conventie een boolean ⇒ die waarde; ONTBREKENDE sleutel (een bestand van
 *    vóór die conventie) of ongeldig getypeerde waarde ⇒ `legacyValue`, nooit de basiswaarde;
 *    onbekende sleutels ⇒ genegeerd. `overrides` = verschil met de basis, dus de
 *    bestandswaarden winnen en de state blijft compact;
 *  - `overrides` (sinds de C2-aanvulling, letterlijk weggeschreven): elke letterlijke afwijking die
 *    met de opgeloste `conventions` klopt, blijft óók staan als ze gelijk is aan de basis (herkomst
 *    bij een profielwissel). Een letterlijke afwijking die de `conventions` tegenspreekt, wordt
 *    genegeerd: de opgeloste set is waarmee het bestand rekende. Afwezig (oudere bestanden) ⇒
 *    alleen het verschil met de basis;
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
  const overrides = diffAgainstBase(baseId, resolved);
  const literal = literalOverrides(input.overrides);
  for (const d of CONVENTIONS) {
    const value = literal[d.id];
    if (value !== undefined && value === resolved[d.id]) overrides[d.id] = value;
  }
  // Registervolgorde, zodat lezen → schrijven byte-identiek blijft.
  return { baseId, id, name, overrides: literalOverrides(overrides) };
}

/** Het JSON-object dat de IFC-schrijver voor een profiel wegschrijft (spiegel van de sanitizer):
 *  alle zesentwintig conventies OPGELOST, zodat een bestand overal gelijk rekent, ook waar het eigen
 *  profiel ontbreekt. `name` alleen voor eigen profielen (ingebouwde nooit vertaald wegschrijven). */
export function schedulingProfileToJson(profile: SchedulingProfile): {
  id: string; baseId: BuiltInProfileId; conventions: SchedulingConventions;
  overrides: Partial<SchedulingConventions>; name?: string;
} {
  return {
    id: profile.id,
    baseId: profile.baseId,
    conventions: resolveConventions(profile),
    // C2-aanvulling: de afwijkingen letterlijk, zodat ze een opslag overleven (zie `literalOverrides`).
    overrides: literalOverrides(profile.overrides),
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
  return carriesProfile(profile) ? profile : undefined;
}
