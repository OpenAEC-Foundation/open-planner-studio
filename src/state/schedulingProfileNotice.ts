// De melding "dit project rekent als …" bij het openen van een bestand (rekenprofielen, spec v3.1 §6).
// Puur: de store roept hem aan in `applyOpenedImport`. Eén melding per geopend BESTAND: een XER met N
// projecten geeft er één, samengevoegd met de bestaande XER-openingsmelding; andere formaten met een
// voorstel ≠ 'ops' krijgen een eigen melding. Heropenen uit eigen IFC (geen voorstel) en crashherstel
// (loopt niet door applyOpenedImport) melden niets.
import type { BuiltInProfileId, SchedulingProfile } from '@/types/project';
import type { ImportResult } from '@/services/importTypes';
import type { NotificationAction, NotifyInput } from '@/state/slices/types';
import { builtInProfile, isBuiltInProfileId } from '@/engine/scheduler/conventions/registry';

export const SCHEDULING_PROFILE_HELP_ARTICLE_ID = 'gids-rekenprofielen';

/** Merknamen — bewust onvertaald (ook `profiles.builtIn.*` in de locales zijn deze merknamen). De
 *  store heeft geen `t()`, en een merknaam hoort niet per taal te verschillen. */
export const BUILT_IN_PROFILE_BRANDS: Readonly<Record<BuiltInProfileId, string>> = {
  p6: 'Primavera P6', msproject: 'Microsoft Project', ops: 'Open Planner Studio',
};

export const OPEN_PROJECT_INFO_ACTION: NotificationAction = {
  kind: 'openBackstageSection', section: 'project-info', labelKey: 'notifications.actions.openProjectInfo',
};

export function profileBrand(profile: SchedulingProfile): string {
  if (isBuiltInProfileId(profile.id)) return BUILT_IN_PROFILE_BRANDS[profile.id];
  return profile.name || BUILT_IN_PROFILE_BRANDS[profile.baseId];
}

export function withSchedulingProfileNotice(
  results: readonly ImportResult[], xerNotice: NotifyInput | undefined, importKey: string,
): NotifyInput | undefined {
  const suggesting = results.find(r => r.suggestedProfileId !== undefined && r.suggestedProfileId !== 'ops');
  if (!suggesting || suggesting.suggestedProfileId === undefined) return xerNotice;
  const profile = suggesting.project.schedulingProfile ?? builtInProfile(suggesting.suggestedProfileId);
  const params = { profile: profileBrand(profile) };
  if (xerNotice) {
    return {
      ...xerNotice,
      detailLines: [{ messageKey: 'notifications.schedulingProfileApplied', params }, ...(xerNotice.detailLines ?? [])],
      action: OPEN_PROJECT_INFO_ACTION,
    };
  }
  return {
    severity: 'info',
    messageKey: 'notifications.schedulingProfileApplied',
    params,
    helpArticleId: SCHEDULING_PROFILE_HELP_ARTICLE_ID,
    action: OPEN_PROJECT_INFO_ACTION,
    dedupeKey: `scheduling-profile-applied:${importKey}`,
  };
}
