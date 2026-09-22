// Het pure bewerkmodel achter het blok "Rekenprofiel en reken-opties" (rekenprofielen, spec v3.1
// §3.2/§6; plan 2026-09-22 taak D2). Geen store, geen React: de UI (SchedulingProfileSection) en de
// store-actie (applySchedulingSettings) delen deze regels. Geen modulestaat.
import type {
  BuiltInProfileId, ConventionKey, ProjectSchedulingOptions, SchedulingConventions, SchedulingProfile,
} from '@/types/project';
import {
  CONVENTION_KEYS, builtInProfile, defaultOptionsFor, diffAgainstBase, isBuiltInProfileId, isDefaultProfile,
  resolveConventions, switchProfile,
} from '@/engine/scheduler/conventions/registry';
import { MAX_PROFILE_NAME_LENGTH } from '@/services/ifc/schedulingOptionsRead';

/** Wat het blok bewerkt: het profiel en de projectopties van één project. */
export interface SchedulingSettingsDraft {
  profile: SchedulingProfile | undefined;
  options: ProjectSchedulingOptions | undefined;
}

/** De waarde in de keuzelijst: een ingebouwd profiel, een sjabloon (op id), of het eigen profiel
 *  van dit project dat (nog) geen sjabloon is. */
export type ProfileChoice = `builtin:${BuiltInProfileId}` | `template:${string}` | 'current';

/**
 * Conventies waarvan de waarde per BESTAND uit de bron komt, niet uit de school (spec v3.1 §3.1):
 * nu alleen A19 (`rem_target_link_flag` in een `.xer`). Het register kent geen `perFile`-veld meer
 * (baan A, fixronde `c7e7799e`); `switchProfile` bewaart op een ingebouwd id toch alle afwijkingen
 * letterlijk, maar vanaf een EIGEN profiel levert hij de kale basis. Zonder deze lijst zou
 * "P6 (aangepast)" → handmatige wijziging ("Kopie van P6") → terug naar P6 de bestandswaarde kwijtraken.
 * Een nieuwe per-bestand-conventie hoort hier bij (zie `docs/recepten/conventie.md`, stap 4).
 */
export const PER_FILE_CONVENTION_KEYS: readonly ConventionKey[] = ['p6UseRemainingStartForProgress'];

export function copyProfile(p: SchedulingProfile): SchedulingProfile {
  return { baseId: p.baseId, id: p.id, name: p.name, overrides: { ...p.overrides } };
}

export function choiceOf(profile: SchedulingProfile | undefined, templates: readonly SchedulingProfile[]): ProfileChoice {
  const p = profile ?? builtInProfile('ops');
  if (isBuiltInProfileId(p.id)) return `builtin:${p.id}`;
  if (templates.some(t => t.id === p.id)) return `template:${p.id}`;
  return 'current';
}

/**
 * Keuzelijst-wissel.
 *  - Ingebouwd: via `switchProfile` (spec v3.1 §3.2: afwijkingen op een ingebouwd id blijven
 *    letterlijk). Vanaf een EIGEN profiel is de uitkomst de basis plus alleen de per-bestand-
 *    conventies (`PER_FILE_CONVENTION_KEYS`) van het huidige profiel — de handmatige afwijkingen
 *    verlaat de gebruiker juist met deze keuze.
 *  - Sjabloon: een kopie (het project draagt zijn eigen profiel; matching op id, nooit op naam).
 *  - Het standaardprofiel (ops zonder afwijking) wordt `undefined` (afwezig ≡ ops).
 */
export function selectProfile(
  current: SchedulingProfile | undefined, choice: ProfileChoice, templates: readonly SchedulingProfile[],
): SchedulingProfile | undefined {
  if (choice === 'current') return current;
  if (choice.startsWith('builtin:')) {
    const baseId = choice.slice('builtin:'.length);
    if (!isBuiltInProfileId(baseId)) return current;
    let next = switchProfile(current, baseId);
    if (current && !isBuiltInProfileId(current.id)) {
      const resolved = resolveConventions(current);
      const kept: Partial<SchedulingConventions> = {};
      for (const key of PER_FILE_CONVENTION_KEYS) kept[key] = resolved[key];
      next = { ...next, overrides: diffAgainstBase(baseId, kept) };
    }
    return isDefaultProfile(next) ? undefined : next;
  }
  const template = templates.find(t => t.id === choice.slice('template:'.length));
  return template ? copyProfile(template) : current;
}

/** Naam begrensd ZONDER de hele invoer te kopiëren: eerst de eerste niet-witruimte zoeken (geen
 *  allocatie), dan hooguit `MAX_PROFILE_NAME_LENGTH` tekens nemen en achteraan trimmen (H1). */
function clampName(name: string): string {
  const start = name.search(/\S/);
  if (start < 0) return '';
  return name.slice(start, start + MAX_PROFILE_NAME_LENGTH).trimEnd();
}

/** Handmatige conventiewijziging. Op een ingebouwd id maakt dat automatisch een eigen profiel
 *  ("Kopie van P6", spec v3.1 §6) met álle huidige waarden (ook die uit het bestand); op een eigen
 *  profiel blijft het id. Een ongewijzigde waarde geeft hetzelfde object terug. */
export function editConvention(
  current: SchedulingProfile | undefined, key: ConventionKey, value: boolean, copy: { id: string; name: string },
): SchedulingProfile | undefined {
  const p = current ?? builtInProfile('ops');
  const values = resolveConventions(p);
  if (values[key] === value) return current;
  values[key] = value;
  const overrides = diffAgainstBase(p.baseId, values);
  if (isBuiltInProfileId(p.id)) return { baseId: p.baseId, id: copy.id, name: clampName(copy.name), overrides };
  return { ...p, overrides };
}

/** Alleen een eigen profiel is hernoembaar; een lege naam wordt genegeerd. */
export function renameProfile(current: SchedulingProfile | undefined, name: string): SchedulingProfile | undefined {
  if (!current || isBuiltInProfileId(current.id)) return current;
  const clean = clampName(name);
  return clean ? { ...current, name: clean } : current;
}

export type ProfileLabel =
  | { kind: 'builtIn'; baseId: BuiltInProfileId; modified: boolean }
  | { kind: 'custom'; name: string };

/** Wat de keuzelijst toont. "(aangepast)" volgt `diffAgainstBase` op de opgeloste set — níét het
 *  aantal sleutels in `overrides`: een sleutel gelijk aan de basis is geen afwijking. */
export function profileLabel(profile: SchedulingProfile | undefined): ProfileLabel {
  const p = profile ?? builtInProfile('ops');
  if (isBuiltInProfileId(p.id)) {
    return { kind: 'builtIn', baseId: p.id, modified: Object.keys(diffAgainstBase(p.baseId, resolveConventions(p))).length > 0 };
  }
  return { kind: 'custom', name: p.name };
}

function sameConventions(a: SchedulingConventions, b: SchedulingConventions): boolean {
  return CONVENTION_KEYS.every(key => a[key] === b[key]);
}

export type TemplateRelation = 'none' | 'same' | 'deviates';
/** Verhouding tot het sjabloon met hetzelfde id (spec v3.1 §3.2: matching op id). */
export function templateRelation(profile: SchedulingProfile | undefined, templates: readonly SchedulingProfile[]): TemplateRelation {
  if (!profile || isBuiltInProfileId(profile.id)) return 'none';
  const t = templates.find(x => x.id === profile.id);
  if (!t) return 'none';
  return t.baseId === profile.baseId && t.name === profile.name
    && sameConventions(resolveConventions(t), resolveConventions(profile)) ? 'same' : 'deviates';
}

/** 'auto' bestaat alleen in de UI (spec v3.1 §3.1): in de state is het `undefined` (hybride formule). */
export type TotalFloatModeUi = 'auto' | 'start' | 'finish' | 'smallest';
export function totalFloatModeToUi(value: ProjectSchedulingOptions['totalFloatMode']): TotalFloatModeUi {
  return value ?? 'auto';
}
export function totalFloatModeFromUi(value: TotalFloatModeUi): ProjectSchedulingOptions['totalFloatMode'] {
  return value === 'auto' ? undefined : value;
}

/** Kritiekdefinitie per veld — `thresholdHours` valt nooit weg (spec v3.1 §6, A6). */
export function withCriticalMode(
  options: ProjectSchedulingOptions | undefined, mode: 'totalFloat' | 'longestPath',
): ProjectSchedulingOptions {
  return { ...(options ?? {}), criticalDefinition: { ...(options?.criticalDefinition ?? {}), mode } };
}
export function withCriticalThreshold(
  options: ProjectSchedulingOptions | undefined, field: 'threshold' | 'thresholdHours', value: number,
): ProjectSchedulingOptions {
  const previous = options?.criticalDefinition ?? { mode: 'totalFloat' as const };
  return { ...(options ?? {}), criticalDefinition: { ...previous, [field]: value } };
}

/** De standaard-projectopties van de basis van dit profiel; OPS ⇒ afwezig. */
export function withDefaultOptions(profile: SchedulingProfile | undefined): ProjectSchedulingOptions | undefined {
  const options = defaultOptionsFor((profile ?? builtInProfile('ops')).baseId);
  return Object.keys(options).length > 0 ? options : undefined;
}

export function normalizeProfile(profile: SchedulingProfile | undefined): SchedulingProfile | undefined {
  return isDefaultProfile(profile) ? undefined : profile;
}
/** Leeg of alleen `undefined`-velden ⇒ afwezig (de JSON-ronde laat `undefined`-velden weg). */
export function normalizeOptions(options: ProjectSchedulingOptions | undefined): ProjectSchedulingOptions | undefined {
  if (!options) return undefined;
  const clean = JSON.parse(JSON.stringify(options)) as ProjectSchedulingOptions;
  return Object.keys(clean).length > 0 ? clean : undefined;
}
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
    : v) ?? 'undefined';
}
/** Zijn twee concepten inhoudelijk gelijk (sleutelvolgorde en afwezig-≡-standaard genegeerd)? */
export function sameSettings(a: SchedulingSettingsDraft, b: SchedulingSettingsDraft): boolean {
  return canonicalJson(normalizeProfile(a.profile)) === canonicalJson(normalizeProfile(b.profile))
    && canonicalJson(normalizeOptions(a.options)) === canonicalJson(normalizeOptions(b.options));
}
