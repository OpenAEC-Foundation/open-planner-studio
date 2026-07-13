import type { FileRef } from './index';
import { idbGetAll, idbPut, idbDelete } from '@/utils/idb';
import { generateId } from '@/utils/id';

/** Recent-bestand-entry (spec §6). `ref` is herbruikbaar (Tauri-pad of Chromium-handle). */
export interface RecentEntry {
  id: string;
  name: string;
  ref: FileRef;
  addedAt: number;
}

const DB = 'ops-recent-files';
const STORE = 'recents';
const MAX = 10;
const LEGACY_KEY = 'open-planner-studio-recent-files';

const basename = (p: string): string => p.split(/[\\/]/).pop() || p;

/** Ref-identiteit voor dedupe: paden op string, handles op isSameEntry. */
async function sameRef(a: FileRef, b: FileRef): Promise<boolean> {
  if (a.kind === 'path' && b.kind === 'path') return a.path === b.path;
  if (a.kind === 'handle' && b.kind === 'handle') {
    try { return await a.handle.isSameEntry(b.handle); } catch { return false; }
  }
  return false;
}

/** Eenmalige migratie van de oude localStorage-padlijst → IDB-entries. Idempotent: na migratie
 *  wordt de legacy-sleutel verwijderd zodat dit niet opnieuw draait. */
async function migrateLegacy(existing: RecentEntry[]): Promise<RecentEntry[]> {
  if (existing.length > 0) return existing; // al IDB-data → niets te migreren
  let paths: string[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    paths = raw ? JSON.parse(raw) : [];
  } catch {
    paths = [];
  }
  if (!Array.isArray(paths) || paths.length === 0) return existing;
  const now = Date.now();
  const migrated: RecentEntry[] = paths.slice(0, MAX).map((p, i) => ({
    id: generateId('recent'),
    name: basename(p),
    ref: { kind: 'path', path: p },
    addedAt: now - i, // bewaar MRU-volgorde
  }));
  for (const e of migrated) await idbPut(DB, STORE, e);
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* geen localStorage — negeren */ }
  return migrated;
}

/** Lees de recents (MRU-gesorteerd), migreert eenmalig de oude localStorage-lijst. */
export async function loadRecents(): Promise<RecentEntry[]> {
  const all = await idbGetAll<RecentEntry>(DB, STORE);
  const migrated = await migrateLegacy(all);
  return [...migrated].sort((a, b) => b.addedAt - a.addedAt).slice(0, MAX);
}

/** Voeg een bestand toe (MRU, dedupe op ref-identiteit, cap op MAX). Geeft de nieuwe lijst terug. */
export async function addRecent(ref: FileRef, name: string): Promise<RecentEntry[]> {
  const existing = await loadRecents();
  const kept: RecentEntry[] = [];
  for (const e of existing) {
    if (!(await sameRef(e.ref, ref))) kept.push(e);
  }
  const entry: RecentEntry = { id: generateId('recent'), name, ref, addedAt: Date.now() };
  const next = [entry, ...kept].slice(0, MAX);

  // Persisteer: nieuwe entry erin, verdrongen/gededupte entries eruit.
  await idbPut(DB, STORE, entry);
  const nextIds = new Set(next.map((e) => e.id));
  for (const e of existing) {
    if (!nextIds.has(e.id)) await idbDelete(DB, STORE, e.id);
  }
  return next;
}

/** Verwijder één entry (verdwenen/geweigerd bestand). Geeft de nieuwe lijst terug. */
export async function removeRecent(id: string): Promise<RecentEntry[]> {
  await idbDelete(DB, STORE, id);
  return loadRecents();
}
