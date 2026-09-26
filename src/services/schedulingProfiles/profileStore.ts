/**
 * Rekenprofielen — opslag van EIGEN profielen. App-globaal, niet per document: een
 * eigen profiel is een sjabloon. Een project draagt zijn eigen kopie in het IFC; wijzigen of
 * verwijderen van een sjabloon hier werkt dus NIET door naar projecten, en koppelen gebeurt op `id`,
 * nooit op naam.
 *
 * Persistentie: localStorage-sleutel `ops-schedulingProfiles` (JSON-lijst van `SchedulingProfile`),
 * hetzelfde `ops-`-pad als de overige instellingen in `utils/settingsStore.ts`. Bewust synchroon
 * (net als `loadMcpPort`/`loadConstructionMode`): de lijst is klein en een profielkeuze moet direct
 * kunnen renderen. De opslag wordt als parameter doorgegeven (default: `localStorage` indien
 * aanwezig) — geen module-level toestand, en headless testbaar zonder globale mock.
 *
 * Lezen valideert elk item met `sanitizeStoredSchedulingProfile`; een corrupt of onbekend item valt
 * weg, corrupte JSON levert een lege lijst plus `console.warn` — lezen gooit nooit.
 */
import type { BuiltInProfileId, SchedulingProfile } from '@/types/project';
import { sanitizeStoredSchedulingProfile } from '@/services/ifc/schedulingOptionsRead';
import { builtInProfile as builtInProfileFromRegistry } from '@/engine/scheduler/conventions/registry';

export { displayNameKey } from '@/engine/scheduler/conventions/registry';

export const SCHEDULING_PROFILES_KEY = 'ops-schedulingProfiles';
/** Bovengrens op het aantal eigen profielen en op de rauwe opslaggrootte: een handmatig
 *  opgeblazen waarde mag de opstart niet laten vastlopen. */
export const MAX_CUSTOM_PROFILES = 100;
export const MAX_STORED_PROFILES_LENGTH = 256 * 1024;

export type ProfileStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** De app-opslag, of `undefined`. Al het LEZEN van de `localStorage`-global kan gooien (SecurityError
 *  bij uitgeschakelde of afgeschermde opslag); daarom binnen een try — de aanroepers evalueren dit als
 *  default-parameter, dus buiten hun eigen try. */
function defaultStorage(): ProfileStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Het ingebouwde profiel (basis zonder afwijkingen; weergavenaam via `displayNameKey`). */
export function builtInProfile(id: BuiltInProfileId): SchedulingProfile {
  return builtInProfileFromRegistry(id);
}

export function loadCustomProfiles(storage: ProfileStorage | undefined = defaultStorage()): SchedulingProfile[] {
  if (!storage) return [];
  let raw: string | null;
  try {
    raw = storage.getItem(SCHEDULING_PROFILES_KEY);
  } catch (error) {
    // Bijv. een geblokkeerde opslag (privacymodus, SecurityError): geen eigen profielen, geen crash.
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

/** Schrijft de lijst weg. Geeft `false` als de opslag ontbreekt of het schrijven mislukt (bijv.
 *  QuotaExceededError) — gooit nooit. */
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
    return true;
  } catch (error) {
    console.warn(`[rekenprofielen] ${SCHEDULING_PROFILES_KEY} niet opgeslagen`, error);
    return false;
  }
}

/** Voegt een eigen profiel toe of vervangt het profiel met dezelfde `id`. Een ongeldig profiel
 *  (bijv. een ingebouwde id) wordt niet opgeslagen; de functie meldt of het gelukt is. */
export function upsertCustomProfile(
  profile: SchedulingProfile, storage: ProfileStorage | undefined = defaultStorage(),
): boolean {
  if (!sanitizeStoredSchedulingProfile(profile)) return false;
  const list = loadCustomProfiles(storage);
  const index = list.findIndex(p => p.id === profile.id);
  if (index >= 0) list[index] = profile;
  else if (list.length >= MAX_CUSTOM_PROFILES) return false;
  else list.push(profile);
  return saveCustomProfiles(list, storage);
}

/** Verwijdert het eigen profiel met deze id. Geeft `false` als het wegschrijven mislukt. */
export function deleteCustomProfile(id: string, storage: ProfileStorage | undefined = defaultStorage()): boolean {
  const list = loadCustomProfiles(storage);
  const next = list.filter(p => p.id !== id);
  return next.length === list.length ? true : saveCustomProfiles(next, storage);
}
