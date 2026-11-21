import type { CustomTaskType, CustomTaskTypeDraft } from '@/types/taskType';
import { generateId } from '@/utils/id';
import { sameTaskTypeName } from './customTaskTypeRules';
import { isTaskTypeColor, withTaskTypeColors } from './customTaskTypeColors';
import { noteSiteHostSettingChanged } from '@/services/fileAccess/siteHostSettings';

const KEY = 'ops-personalTaskTypes';
let cached: CustomTaskType[] | null = null;
const listeners = new Set<() => void>();

function normalize(raw: unknown): CustomTaskType[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const ids = new Set<string>();
  const result: CustomTaskTypeDraft[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const candidate = value as { id?: unknown; name?: unknown; color?: unknown };
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const key = name.toLocaleLowerCase();
    if (!id || !name || seen.has(key) || ids.has(id)) continue;
    seen.add(key);
    ids.add(id);
    result.push({ id, name, ...(isTaskTypeColor(candidate.color) ? { color: candidate.color } : {}) });
  }
  // Een werksoort van vóór de kleur (#856) krijgt hier de eerste vrije, op volgorde van id; `save` bewaart haar.
  return withTaskTypeColors(result).sort((a, b) => a.name.localeCompare(b.name));
}

function load(): CustomTaskType[] {
  if (cached) return cached;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    // Lezen schrijft niets: ingebed zou dat de lijst naar de host sturen voordat die geantwoord heeft (#818). De
    // toegekende kleur hangt alleen af van de inhoud, dus elk lezen geeft dezelfde; de eerste wijziging bewaart haar.
    cached = normalize(raw);
  } catch { cached = []; }
  return cached;
}

function persist(types: CustomTaskType[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(types));
    noteSiteHostSettingChanged(KEY); // ingebed ook bij de host bewaren (#818)
  } catch { /* opslag kan geblokkeerd zijn */ }
}

function save(next: CustomTaskTypeDraft[]): void {
  cached = normalize(next);
  persist(cached);
  for (const listener of listeners) listener();
}

// Een tweede venster of een oudere tab kan localStorage wijzigen. Herlees dan defensief in plaats
// van op de modulecache te blijven hangen; corruptie normaliseert naar een lege, bruikbare lijst.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    try { cached = normalize(JSON.parse(event.newValue ?? '[]')); }
    catch { cached = []; }
    for (const listener of listeners) listener();
  });
}

export function getPersonalTaskTypes(): CustomTaskType[] { return load(); }
export function subscribePersonalTaskTypes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** Voegt een werksoort toe. Een gegeven geldige kleur (bijvoorbeeld van de projectkopie) blijft; anders
 *  krijgt ze de eerste kleur die vrij is in de bibliotheek én in `inUse` (de werksoorten van het geopende
 *  document, #856). */
export function addPersonalTaskType(
  name: string, preferredId?: string, color?: string, inUse: readonly CustomTaskType[] = [],
): CustomTaskType | null {
  const clean = name.trim();
  if (!clean) return null;
  const all = load();
  const existingById = preferredId ? all.find(t => t.id === preferredId) : undefined;
  if (existingById) return sameTaskTypeName(existingById.name, clean) ? existingById : null;
  const existing = all.find(t => sameTaskTypeName(t.name, clean));
  if (existing) return preferredId && existing.id !== preferredId ? null : existing;
  const [type] = withTaskTypeColors([{ id: preferredId ?? generateId('tasktype'), name: clean, color }], [...all, ...inUse]);
  save([...all, type]);
  return type;
}
export function renamePersonalTaskType(id: string, name: string): CustomTaskType | null {
  const clean = name.trim();
  if (!clean) return null;
  const all = load();
  const duplicate = all.find(t => t.id !== id && sameTaskTypeName(t.name, clean));
  if (duplicate) return null;
  const old = all.find(t => t.id === id);
  if (!old) return null;
  const next = { ...old, name: clean };
  save(all.map(t => t.id === id ? next : t));
  return next;
}
export function removePersonalTaskType(id: string): void { save(load().filter(t => t.id !== id)); }
