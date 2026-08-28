import type { CustomTaskType } from '@/types/taskType';
import { generateId } from '@/utils/id';

const KEY = 'ops-personalTaskTypes';
let cached: CustomTaskType[] | null = null;
const listeners = new Set<() => void>();

function normalize(raw: unknown): CustomTaskType[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const ids = new Set<string>();
  const result: CustomTaskType[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const candidate = value as { id?: unknown; name?: unknown };
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const key = name.toLocaleLowerCase();
    if (!id || !name || seen.has(key) || ids.has(id)) continue;
    seen.add(key);
    ids.add(id);
    result.push({ id, name });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function load(): CustomTaskType[] {
  if (cached) return cached;
  try { cached = normalize(JSON.parse(localStorage.getItem(KEY) ?? '[]')); }
  catch { cached = []; }
  return cached;
}

function save(next: CustomTaskType[]): void {
  cached = normalize(next);
  try { localStorage.setItem(KEY, JSON.stringify(cached)); } catch { /* opslag kan geblokkeerd zijn */ }
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
export function addPersonalTaskType(name: string, preferredId?: string): CustomTaskType | null {
  const clean = name.trim();
  if (!clean) return null;
  const all = load();
  const existingById = preferredId ? all.find(t => t.id === preferredId) : undefined;
  if (existingById) return existingById.name.localeCompare(clean, undefined, { sensitivity: 'accent' }) === 0 ? existingById : null;
  const existing = all.find(t => t.name.localeCompare(clean, undefined, { sensitivity: 'accent' }) === 0);
  if (existing) return preferredId && existing.id !== preferredId ? null : existing;
  const type = { id: preferredId ?? generateId('tasktype'), name: clean };
  save([...all, type]);
  return type;
}
export function renamePersonalTaskType(id: string, name: string): CustomTaskType | null {
  const clean = name.trim();
  if (!clean) return null;
  const all = load();
  const duplicate = all.find(t => t.id !== id && t.name.localeCompare(clean, undefined, { sensitivity: 'accent' }) === 0);
  if (duplicate) return null;
  const old = all.find(t => t.id === id);
  if (!old) return null;
  const next = { ...old, name: clean };
  save(all.map(t => t.id === id ? next : t));
  return next;
}
export function removePersonalTaskType(id: string): void { save(load().filter(t => t.id !== id)); }
