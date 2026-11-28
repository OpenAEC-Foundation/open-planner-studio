import type { BuiltInProfileId, SchedulingProfile } from '@/types/project';
import { sanitizeStoredSchedulingProfile } from '@/services/ifc/schedulingOptionsRead';
import { builtInProfile as builtInProfileFromRegistry } from '@/engine/scheduler/conventions/registry';
import { noteSiteHostSettingChanged } from '@/services/fileAccess/siteHostSettings';

export { displayNameKey } from '@/engine/scheduler/conventions/registry';

export const SCHEDULING_PROFILES_KEY = 'ops-schedulingProfiles';
export const MAX_CUSTOM_PROFILES = 100;
export const MAX_STORED_PROFILES_LENGTH = 256 * 1024;

export type ProfileStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): ProfileStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function builtInProfile(id: BuiltInProfileId): SchedulingProfile {
  return builtInProfileFromRegistry(id);
}

export function loadCustomProfiles(storage: ProfileStorage | undefined = defaultStorage()): SchedulingProfile[] {
  if (!storage) return [];
  let raw: string | null;
  try {
    raw = storage.getItem(SCHEDULING_PROFILES_KEY);
  } catch (error) {
    console.warn(`[rekenprofielen] ${SCHEDULING_PROFILES_KEY} niet leesbaar — genegeerd`, error);
    return [];
  }
  if (raw === null) return [];
  if (raw.length > MAX_STORED_PROFILES_LENGTH) {
    console.warn(`[rekenprofielen] ${SCHEDULING_PROFILES_KEY} is te groot (${raw.length} tekens) — genegeerd`);
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[rekenprofielen] ${SCHEDULING_PROFILES_KEY} bevat geen geldige JSON — genegeerd`);
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: SchedulingProfile[] = [];
  const seen = new Set<string>();
  for (const item of parsed.slice(0, MAX_CUSTOM_PROFILES)) {
    const profile = sanitizeStoredSchedulingProfile(item);
    if (!profile || seen.has(profile.id)) continue;
    seen.add(profile.id);
    out.push(profile);
  }
  return out;
}

export function saveCustomProfiles(
  list: readonly SchedulingProfile[], storage: ProfileStorage | undefined = defaultStorage(),
): boolean {
  if (!storage) return false;
  const clean: SchedulingProfile[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const profile = sanitizeStoredSchedulingProfile(item);
    if (!profile || seen.has(profile.id)) continue;
    seen.add(profile.id);
    clean.push(profile);
    if (clean.length >= MAX_CUSTOM_PROFILES) break;
  }
  try {
    storage.setItem(SCHEDULING_PROFILES_KEY, JSON.stringify(clean));
    noteSiteHostSettingChanged(SCHEDULING_PROFILES_KEY);
    return true;
  } catch (error) {
    console.warn(`[rekenprofielen] ${SCHEDULING_PROFILES_KEY} niet opgeslagen`, error);
    return false;
  }
}

export type UpsertProfileResult = 'saved' | 'invalid' | 'limit' | 'storage';

export function upsertCustomProfileResult(
  profile: SchedulingProfile, storage: ProfileStorage | undefined = defaultStorage(),
): UpsertProfileResult {
  if (!sanitizeStoredSchedulingProfile(profile)) return 'invalid';
  const list = loadCustomProfiles(storage);
  const index = list.findIndex(p => p.id === profile.id);
  if (index >= 0) list[index] = profile;
  else if (list.length >= MAX_CUSTOM_PROFILES) return 'limit';
  else list.push(profile);
  return saveCustomProfiles(list, storage) ? 'saved' : 'storage';
}

export function deleteCustomProfile(id: string, storage: ProfileStorage | undefined = defaultStorage()): boolean {
  const list = loadCustomProfiles(storage);
  const next = list.filter(p => p.id !== id);
  return next.length === list.length ? true : saveCustomProfiles(next, storage);
}
