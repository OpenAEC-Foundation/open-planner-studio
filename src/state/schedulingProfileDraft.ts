import type {
  BuiltInProfileId, ConventionKey, ProjectSchedulingOptions, SchedulingConventions, SchedulingProfile,
} from '@/types/project';
import {
  CONVENTION_KEYS, builtInProfile, defaultOptionsFor, diffAgainstBase, isBuiltInProfileId,
  isDefaultProfile, resolveConventions, switchProfile,
} from '@/engine/scheduler/conventions/registry';
import { MAX_PROFILE_ID_LENGTH, MAX_PROFILE_NAME_LENGTH } from '@/services/ifc/schedulingOptionsRead';
import { fileHasHourData } from '@/services/subdayIo';
import type { Task } from '@/types/task';
import { isHourModeCalendar, type WorkCalendar } from '@/types/calendar';

export interface SchedulingSettingsDraft {
  profile: SchedulingProfile | undefined;
  options: ProjectSchedulingOptions | undefined;
}

export type ProfileChoice = `builtin:${BuiltInProfileId}` | 'modified' | `template:${string}` | 'current';

export function copyProfile(p: SchedulingProfile): SchedulingProfile {
  return { baseId: p.baseId, id: p.id, name: p.name, overrides: { ...p.overrides } };
}

export function choiceOf(profile: SchedulingProfile | undefined, templates: readonly SchedulingProfile[]): ProfileChoice {
  const p = profile ?? builtInProfile('ops');
  if (isBuiltInProfileId(p.id)) return isModifiedBuiltIn(p) ? 'modified' : `builtin:${p.id}`;
  if (templates.some(t => t.id === p.id)) return `template:${p.id}`;
  return 'current';
}

export function isModifiedBuiltIn(profile: SchedulingProfile | undefined): boolean {
  return !!profile && isBuiltInProfileId(profile.id)
    && Object.keys(diffAgainstBase(profile.baseId, resolveConventions(profile))).length > 0;
}

export function selectProfile(
  current: SchedulingProfile | undefined, choice: ProfileChoice, templates: readonly SchedulingProfile[],
  modified?: SchedulingProfile,
): SchedulingProfile | undefined {
  if (choice === 'current') return current;
  if (choice === 'modified') return modified ? copyProfile(modified) : current;
  if (choice.startsWith('builtin:')) {
    const baseId = choice.slice('builtin:'.length);
    if (!isBuiltInProfileId(baseId)) return current;
    const next = current && isBuiltInProfileId(current.id) && current.baseId !== baseId
      ? switchProfile(current, baseId) : builtInProfile(baseId);
    return isDefaultProfile(next) ? undefined : next;
  }
  const template = templates.find(t => t.id === choice.slice('template:'.length));
  return template ? copyProfile(template) : current;
}

function clampName(name: string): string {
  const start = name.search(/\S/);
  if (start < 0) return '';
  return name.slice(start, start + MAX_PROFILE_NAME_LENGTH).trimEnd();
}

function validCustomId(id: string): boolean {
  return id.trim().length > 0 && id.length <= MAX_PROFILE_ID_LENGTH && !isBuiltInProfileId(id);
}

export function editConvention(
  current: SchedulingProfile | undefined, key: ConventionKey, value: boolean,
): SchedulingProfile | undefined {
  if (!current || !conventionsEditable(current)) return current;
  const values = resolveConventions(current);
  if (values[key] === value) return current;
  values[key] = value;
  return { ...current, overrides: diffAgainstBase(current.baseId, values) };
}

export function newProfileFrom(
  current: SchedulingProfile | undefined, copy: { id: string; name: string },
): SchedulingProfile | undefined {
  const p = current ?? builtInProfile('ops');
  const name = clampName(copy.name);
  if (!validCustomId(copy.id) || name.length === 0) return current;
  return { baseId: p.baseId, id: copy.id, name, overrides: diffAgainstBase(p.baseId, resolveConventions(p)) };
}

export function conventionsEditable(profile: SchedulingProfile | undefined): boolean {
  return !!profile && !isBuiltInProfileId(profile.id);
}

export function resetConventionToBase(current: SchedulingProfile | undefined, key: ConventionKey): SchedulingProfile | undefined {
  if (!current || typeof current.overrides[key] !== 'boolean') return current;
  const overrides = { ...current.overrides };
  delete overrides[key];
  return { ...current, overrides };
}

export function renameProfile(current: SchedulingProfile | undefined, name: string): SchedulingProfile | undefined {
  if (!current || isBuiltInProfileId(current.id)) return current;
  const start = name.search(/\S/);
  return { ...current, name: start < 0 ? '' : name.slice(start, start + MAX_PROFILE_NAME_LENGTH) };
}

export function hasValidProfileName(profile: SchedulingProfile | undefined): boolean {
  return !profile || isBuiltInProfileId(profile.id) || profile.name.trim().length > 0;
}

export type ProfileLabel =
  | { kind: 'builtIn'; baseId: BuiltInProfileId; modified: boolean }
  | { kind: 'custom'; name: string };

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

export type TemplateRelation = 'none' | 'same' | 'deviates';
export function templateRelation(profile: SchedulingProfile | undefined, templates: readonly SchedulingProfile[]): TemplateRelation {
  if (!profile || isBuiltInProfileId(profile.id)) return 'none';
  const t = templates.find(x => x.id === profile.id);
  if (!t) return 'none';
  return t.baseId === profile.baseId && t.name === profile.name
    && sameConventions(resolveConventions(t), resolveConventions(profile), CONVENTION_KEYS) ? 'same' : 'deviates';
}

export type TotalFloatModeUi = 'auto' | 'start' | 'finish' | 'smallest';
export function totalFloatModeToUi(value: ProjectSchedulingOptions['totalFloatMode']): TotalFloatModeUi {
  return value ?? 'auto';
}
export function totalFloatModeFromUi(value: TotalFloatModeUi): ProjectSchedulingOptions['totalFloatMode'] {
  return value === 'auto' ? undefined : value;
}

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

export const SOURCE_ONLY_OPTION_KEYS = [
  'useExpectedFinishDates', 'useProjectEndDateForFloat', 'p6CompletedLateFromRemainingWindow', 'leveling',
] as const satisfies readonly (keyof ProjectSchedulingOptions)[];
export type SourceOnlyOptionKey = typeof SOURCE_ONLY_OPTION_KEYS[number];

export function withDefaultOptions(
  profile: SchedulingProfile | undefined, current?: ProjectSchedulingOptions,
): ProjectSchedulingOptions | undefined {
  const options: ProjectSchedulingOptions = { ...defaultOptionsFor((profile ?? builtInProfile('ops')).baseId) };
  for (const key of SOURCE_ONLY_OPTION_KEYS) {
    if (current?.[key] !== undefined) Object.assign(options, { [key]: current[key] });
  }
  return Object.keys(options).length > 0 ? options : undefined;
}

export const EDITABLE_OPTION_KEYS = [
  'criticalDefinition', 'totalFloatMode', 'makeOpenEndedCritical', 'nearCriticalThreshold', 'floatPaths',
  'lagCalendar', 'startToStartLagFrom',
] as const satisfies readonly Exclude<keyof ProjectSchedulingOptions, SourceOnlyOptionKey>[];
export type EditableOptionKey = typeof EDITABLE_OPTION_KEYS[number];

export interface EffectiveOptions {
  criticalDefinition: { mode: 'longestPath' } | { mode: 'totalFloat'; value: number; unit: 'hours' | 'days' };
  totalFloatMode: TotalFloatModeUi;
  makeOpenEndedCritical: boolean;
  nearCriticalThreshold: number | null;
  floatPaths: { method: 'FREE_FLOAT' | 'TOTAL_FLOAT'; maxPaths: number } | null;
  lagCalendar: NonNullable<ProjectSchedulingOptions['lagCalendar']>;
  startToStartLagFrom: NonNullable<ProjectSchedulingOptions['startToStartLagFrom']>;
}
export function effectiveOptions(options: ProjectSchedulingOptions | undefined): EffectiveOptions {
  const o = options ?? {};
  const crit = o.criticalDefinition;
  const fp = o.floatPaths;
  return {
    criticalDefinition: crit?.mode === 'longestPath' ? { mode: 'longestPath' }
      : crit?.thresholdHours !== undefined ? { mode: 'totalFloat', value: crit.thresholdHours, unit: 'hours' }
        : { mode: 'totalFloat', value: crit?.threshold ?? 0, unit: 'days' },
    totalFloatMode: totalFloatModeToUi(o.totalFloatMode),
    makeOpenEndedCritical: !!o.makeOpenEndedCritical,
    nearCriticalThreshold: o.nearCriticalThreshold ?? null,
    floatPaths: fp?.enabled ? { method: fp.method ?? 'FREE_FLOAT', maxPaths: fp.maxPaths ?? 10 } : null,
    lagCalendar: o.lagCalendar ?? 'predecessor',
    startToStartLagFrom: o.startToStartLagFrom ?? 'earlyStart',
  };
}
function sameEffective<K extends EditableOptionKey>(key: K, a: EffectiveOptions[K], b: EffectiveOptions[K]): boolean {
  if (key === 'criticalDefinition') {
    const ca = a as EffectiveOptions['criticalDefinition'];
    const cb = b as EffectiveOptions['criticalDefinition'];
    if (ca.mode === 'totalFloat' && cb.mode === 'totalFloat' && ca.value === 0 && cb.value === 0) return true;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export type OptionDeviation = {
  [K in EditableOptionKey]: { key: K; current: EffectiveOptions[K]; standard: EffectiveOptions[K] }
}[EditableOptionKey];

export function optionDeviations(
  profile: SchedulingProfile | undefined, options: ProjectSchedulingOptions | undefined,
): OptionDeviation[] {
  const current = effectiveOptions(options);
  const standard = effectiveOptions(defaultOptionsFor((profile ?? builtInProfile('ops')).baseId));
  const out: OptionDeviation[] = [];
  for (const key of EDITABLE_OPTION_KEYS) {
    if (!sameEffective(key, current[key], standard[key])) {
      out.push({ key, current: current[key], standard: standard[key] } as OptionDeviation);
    }
  }
  return out;
}

export function optionDeviationsSignature(profile: SchedulingProfile | undefined, deviations: readonly OptionDeviation[]): string {
  return JSON.stringify([(profile ?? builtInProfile('ops')).baseId, deviations.map(d => [d.key, d.current])]);
}

export function normalizeProfile(profile: SchedulingProfile | undefined): SchedulingProfile | undefined {
  return isDefaultProfile(profile) ? undefined : profile;
}
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
function sameProfile(a: SchedulingProfile | undefined, b: SchedulingProfile | undefined): boolean {
  const pa = a ?? builtInProfile('ops');
  const pb = b ?? builtInProfile('ops');
  return pa.id === pb.id && pa.baseId === pb.baseId && pa.name === pb.name
    && sameConventions(resolveConventions(pa), resolveConventions(pb), CONVENTION_KEYS);
}
export function sameSettings(a: SchedulingSettingsDraft, b: SchedulingSettingsDraft): boolean {
  return sameProfile(a.profile, b.profile)
    && canonicalJson(normalizeOptions(a.options)) === canonicalJson(normalizeOptions(b.options));
}

export function ssLagHasHourPlanning(
  options: ProjectSchedulingOptions | undefined, tasks: Task[], calendar: WorkCalendar, calendars: readonly WorkCalendar[],
): boolean {
  if (options?.lagCalendar === '24hour') return true;
  if (options?.lagCalendar === 'projectDefault') return isHourModeCalendar(calendar);
  return fileHasHourData(tasks, [calendar, ...calendars]);
}
