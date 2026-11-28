import { EXPORT_FORMATS, type ExportFormat } from '@/services/formatRegistry';
import type { BuiltInProfileId, SchedulingProfile } from '@/types/project';
import { profileLabel, type ProfileLabel } from './schedulingProfileDraft';
import { BUILT_IN_PROFILE_BRANDS } from './schedulingProfileNotice';
import { SCHEDULING_PROFILE_HELP_ARTICLE_ID } from './helpArticles';
import type { NotifyInput } from './slices/types';

export interface ExportProfileAdvice {
  current: ProfileLabel;
  target: BuiltInProfileId;
}

export function exportProfileAdvice(format: ExportFormat, profile: SchedulingProfile | undefined): ExportProfileAdvice | null {
  const meta = EXPORT_FORMATS.find(f => f.format === format);
  const target = meta && 'recommendedProfile' in meta ? meta.recommendedProfile : undefined;
  if (!target) return null;
  const current = profileLabel(profile);
  if (current.kind === 'builtIn' && current.baseId === target && !current.modified) return null;
  return { current, target };
}

export function exportProfileAdviceParams(
  advice: ExportProfileAdvice,
  modifiedName: (name: string) => string,
): { name: string; target: string } {
  const { current, target } = advice;
  const brand = current.kind === 'builtIn' ? BUILT_IN_PROFILE_BRANDS[current.baseId] : current.name;
  return {
    name: current.kind === 'builtIn' && current.modified ? modifiedName(brand) : brand,
    target: BUILT_IN_PROFILE_BRANDS[target],
  };
}

export function exportProfileNotice(
  format: ExportFormat,
  profile: SchedulingProfile | undefined,
  modifiedName: (name: string) => string,
): NotifyInput | null {
  const advice = exportProfileAdvice(format, profile);
  if (!advice) return null;
  return {
    severity: 'info',
    messageKey: 'menu:export.profileHint',
    params: exportProfileAdviceParams(advice, modifiedName),
    helpArticleId: SCHEDULING_PROFILE_HELP_ARTICLE_ID,
    dedupeKey: `export-profile-advice:${format}`,
  };
}
