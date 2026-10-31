import { EXPORT_FORMATS, type ExportFormat } from '@/services/formatRegistry';
import type { BuiltInProfileId, SchedulingProfile } from '@/types/project';
import { profileLabel, type ProfileLabel } from './schedulingProfileDraft';

export interface ExportProfileAdvice {
  /** Het profiel waarmee het project nu rekent. */
  current: ProfileLabel;
  /** Het ingebouwde profiel dat bij het doelformaat past. */
  target: BuiltInProfileId;
}

/**
 * Advies bij een exportkeuze: rekent het project met een ander profiel dan het profiel dat bij het
 * doelformaat past (`recommendedProfile` in `EXPORT_FORMATS`)? Een aangepast ingebouwd profiel telt als
 * ander profiel. Een formaat zonder bijpassend profiel krijgt nooit advies (eigenaar, 2026-10-31).
 */
export function exportProfileAdvice(format: ExportFormat, profile: SchedulingProfile | undefined): ExportProfileAdvice | null {
  const meta = EXPORT_FORMATS.find(f => f.format === format);
  const target = meta && 'recommendedProfile' in meta ? meta.recommendedProfile : undefined;
  if (!target) return null;
  const current = profileLabel(profile);
  if (current.kind === 'builtIn' && current.baseId === target && !current.modified) return null;
  return { current, target };
}
