// Het pure bewerkmodel achter het blok "Rekenprofiel en reken-opties" (rekenprofielen, spec v3.1
// §3.2/§6; plan 2026-09-22 taak D2). Geen store, geen React: de UI (SchedulingProfileSection) en de
// store-actie (applySchedulingSettings) delen deze regels. Geen modulestaat.
import type {
  BuiltInProfileId, ConventionKey, ProjectSchedulingOptions, SchedulingConventions, SchedulingProfile,
} from '@/types/project';
import {
  CONVENTIONS, CONVENTION_KEYS, builtInProfile, defaultOptionsFor, diffAgainstBase, isBuiltInProfileId,
  isDefaultProfile, resolveConventions, switchProfile,
} from '@/engine/scheduler/conventions/registry';
import { MAX_PROFILE_ID_LENGTH, MAX_PROFILE_NAME_LENGTH } from '@/services/ifc/schedulingOptionsRead';

/** Wat het blok bewerkt: het profiel en de projectopties van één project. */
export interface SchedulingSettingsDraft {
  profile: SchedulingProfile | undefined;
  options: ProjectSchedulingOptions | undefined;
}

/** De waarde in de keuzelijst: een ingebouwd profiel, een sjabloon (op id), of het eigen profiel
 *  van dit project dat (nog) geen sjabloon is. */
export type ProfileChoice = `builtin:${BuiltInProfileId}` | `template:${string}` | 'current';

/**
 * Conventies waarvan de waarde per BESTAND uit de bron komt, niet uit de school — afgeleid uit het
 * register (`ConventionDescriptor.perFile`, nu alleen A19 uit `rem_target_link_flag`). Het bewerkmodel
 * draagt ze bij ELKE profielwissel over (ingebouwd én sjabloon, ook vanaf een eigen profiel), want
 * `switchProfile` levert vanaf een eigen profiel de kale basis en een sjabloon kent het bestand niet.
 */
export const PER_FILE_CONVENTION_KEYS: readonly ConventionKey[] = CONVENTIONS.filter(d => d.perFile).map(d => d.id);

export function copyProfile(p: SchedulingProfile): SchedulingProfile {
  return { baseId: p.baseId, id: p.id, name: p.name, overrides: { ...p.overrides } };
}

export function choiceOf(profile: SchedulingProfile | undefined, templates: readonly SchedulingProfile[]): ProfileChoice {
  const p = profile ?? builtInProfile('ops');
  if (isBuiltInProfileId(p.id)) return `builtin:${p.id}`;
  if (templates.some(t => t.id === p.id)) return `template:${p.id}`;
  return 'current';
}

/** `target` met de per-bestand-waarden van `current` (afwijkingen minimaal tegen de basis van `target`). */
function withPerFileFrom(target: SchedulingProfile, current: SchedulingProfile | undefined): SchedulingProfile {
  const values = resolveConventions(target);
  const fromCurrent = resolveConventions(current);
  for (const key of PER_FILE_CONVENTION_KEYS) values[key] = fromCurrent[key];
  return { baseId: target.baseId, id: target.id, name: target.name, overrides: diffAgainstBase(target.baseId, values) };
}

/**
 * Keuzelijst-wissel. De per-bestand-conventies (`PER_FILE_CONVENTION_KEYS`) van het huidige profiel
 * blijven bij ELKE wissel staan.
 *  - Ingebouwd vanaf een INGEBOUWD id: `switchProfile` (spec v3.1 §3.2) — alle afwijkingen blijven
 *    letterlijk, ook als ze onder de nieuwe basis gelijk aan die basis zijn (P6 {A13: uit} → OPS → P6
 *    geeft het origineel). Zo'n profiel wordt dus nooit tot `undefined` genormaliseerd:
 *    `isDefaultProfile` is letterlijk "ops zonder enige afwijking".
 *  - Ingebouwd vanaf een EIGEN profiel: de basis plus alleen de per-bestand-waarden — de handmatige
 *    afwijkingen verlaat de gebruiker juist met deze keuze.
 *  - Sjabloon: een kopie van het sjabloon (het project draagt zijn eigen profiel; matching op id, nooit
 *    op naam), met de per-bestand-waarden van het huidige profiel.
 *  - Alleen het kale standaardprofiel (ops zonder afwijking) wordt `undefined` (afwezig ≡ ops).
 */
export function selectProfile(
  current: SchedulingProfile | undefined, choice: ProfileChoice, templates: readonly SchedulingProfile[],
): SchedulingProfile | undefined {
  if (choice === 'current') return current;
  if (choice.startsWith('builtin:')) {
    const baseId = choice.slice('builtin:'.length);
    if (!isBuiltInProfileId(baseId)) return current;
    let next = switchProfile(current, baseId);
    if (current && !isBuiltInProfileId(current.id)) next = withPerFileFrom(next, current);
    return isDefaultProfile(next) ? undefined : next;
  }
  const template = templates.find(t => t.id === choice.slice('template:'.length));
  return template ? withPerFileFrom(copyProfile(template), current) : current;
}

/** Naam begrensd ZONDER de hele invoer te kopiëren: eerst de eerste niet-witruimte zoeken (geen
 *  allocatie), dan hooguit `MAX_PROFILE_NAME_LENGTH` tekens nemen en achteraan trimmen (H1). */
function clampName(name: string): string {
  const start = name.search(/\S/);
  if (start < 0) return '';
  return name.slice(start, start + MAX_PROFILE_NAME_LENGTH).trimEnd();
}

/** Een geldig id voor een eigen profiel: niet leeg, ≤ `MAX_PROFILE_ID_LENGTH`, geen ingebouwd id
 *  (dezelfde grens als de IFC- en sjabloon-sanitizers, anders valt het profiel bij lezen terug). */
function validCustomId(id: string): boolean {
  return id.trim().length > 0 && id.length <= MAX_PROFILE_ID_LENGTH && !isBuiltInProfileId(id);
}

/** Handmatige conventiewijziging. Op een ingebouwd id maakt dat automatisch een eigen profiel
 *  ("Kopie van P6", spec v3.1 §6) met álle huidige waarden (ook die uit het bestand); op een eigen
 *  profiel blijft het id. Een ongewijzigde waarde, of een ongeldig kopie-id, geeft hetzelfde object terug. */
export function editConvention(
  current: SchedulingProfile | undefined, key: ConventionKey, value: boolean, copy: { id: string; name: string },
): SchedulingProfile | undefined {
  const p = current ?? builtInProfile('ops');
  const values = resolveConventions(p);
  if (values[key] === value) return current;
  values[key] = value;
  const overrides = diffAgainstBase(p.baseId, values);
  if (isBuiltInProfileId(p.id)) {
    if (!validCustomId(copy.id)) return current;
    return { baseId: p.baseId, id: copy.id, name: clampName(copy.name), overrides };
  }
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

function sameConventions(a: SchedulingConventions, b: SchedulingConventions, keys: readonly ConventionKey[]): boolean {
  return keys.every(key => a[key] === b[key]);
}

/** Het sjabloon beschrijft de school, niet het bestand: per-bestand-conventies tellen niet mee. */
const TEMPLATE_KEYS: readonly ConventionKey[] = CONVENTION_KEYS.filter(key => !PER_FILE_CONVENTION_KEYS.includes(key));

export type TemplateRelation = 'none' | 'same' | 'deviates';
/** Verhouding tot het sjabloon met hetzelfde id (spec v3.1 §3.2: matching op id). */
export function templateRelation(profile: SchedulingProfile | undefined, templates: readonly SchedulingProfile[]): TemplateRelation {
  if (!profile || isBuiltInProfileId(profile.id)) return 'none';
  const t = templates.find(x => x.id === profile.id);
  if (!t) return 'none';
  return t.baseId === profile.baseId && t.name === profile.name
    && sameConventions(resolveConventions(t), resolveConventions(profile), TEMPLATE_KEYS) ? 'same' : 'deviates';
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
/** Rekenen twee profielen inhoudelijk hetzelfde? Zelfde id, basis en naam, en dezelfde OPGELOSTE
 *  conventies — niet de structuur van `overrides` (een afwijking gelijk aan de basis is geen verschil;
 *  afwezig ≡ ops). */
function sameProfile(a: SchedulingProfile | undefined, b: SchedulingProfile | undefined): boolean {
  const pa = a ?? builtInProfile('ops');
  const pb = b ?? builtInProfile('ops');
  return pa.id === pb.id && pa.baseId === pb.baseId && pa.name === pb.name
    && sameConventions(resolveConventions(pa), resolveConventions(pb), CONVENTION_KEYS);
}
/** Zijn twee concepten inhoudelijk gelijk? Profiel: zie `sameProfile`; opties: dezelfde data,
 *  sleutelvolgorde en `undefined`-velden genegeerd. */
export function sameSettings(a: SchedulingSettingsDraft, b: SchedulingSettingsDraft): boolean {
  return sameProfile(a.profile, b.profile)
    && canonicalJson(normalizeOptions(a.options)) === canonicalJson(normalizeOptions(b.options));
}
