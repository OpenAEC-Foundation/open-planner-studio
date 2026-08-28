import type { CustomTaskType } from '@/types/taskType';
import { generateId } from '@/utils/id';

const KEY = 'ops-personalTaskTypes';
let cached: CustomTaskType[] | null = null;
const listeners = new Set<() => void>();

function normalize(raw: unknown): CustomTaskType[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: CustomTaskType[] = [];
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue;
    const candidate = value as { id?: unknown; name?: unknown };
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const key = name.toLocaleLowerCase();
    if (!id || !name || seen.has(key)) continue;
    seen.add(key);
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

export function getPersonalTaskTypes(): CustomTaskType[] { return load(); }
export function subscribePersonalTaskTypes(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function addPersonalTaskType(name: string, preferredId?: string): CustomTaskType | null {
  const clean = name.trim();
  if (!clean) return null;
  const existing = load().find(t => t.name.localeCompare(clean, undefined, { sensitivity: 'accent' }) === 0);
  if (existing) return existing;
  const type = { id: preferredId ?? generateId('tasktype'), name: clean };
  save([...load(), type]);
  return type;
}
export function renamePersonalTaskType(id: string, name: string): CustomTaskType | null {
  const clean = name.trim();
  if (!clean) return null;
  const all = load();
  const duplicate = all.find(t => t.id !== id && t.name.localeCompare(clean, undefined, { sensitivity: 'accent' }) === 0);
  if (duplicate) return duplicate;
  const old = all.find(t => t.id === id);
  if (!old) return null;
  const next = { ...old, name: clean };
  save(all.map(t => t.id === id ? next : t));
  return next;
}
export function removePersonalTaskType(id: string): void { save(load().filter(t => t.id !== id)); }
