// Opgeslagen filterpresets (issue #85): losse, app-brede filters moeten robuust worden bewaard en
// geladen. Deze check dekt zowel round-trip als de parse-guard tegen handmatig beschadigde opslag.
// Draait via run.sh. Exit 0 = alles groen.

import { loadSavedFilters, saveSavedFilters } from '@/utils/settingsStore';
import type { SavedFilter } from '@/types/view';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
    key: () => null,
    get length() { return storage.size; },
  } satisfies Storage,
  configurable: true,
});

let failures = 0;
function ok(condition: unknown, message: string): void {
  if (condition) console.log(`ok ${message}`);
  else { console.error(`FAIL ${message}`); failures++; }
}

const criticalOnly: SavedFilter = {
  id: 'critical-only',
  name: 'Critical only',
  filter: {
    kind: 'group', op: 'AND', children: [
      { kind: 'rule', field: { src: 'builtin', key: 'isCritical' }, operator: 'eq', value: true },
    ],
  },
};
const startsSoon: SavedFilter = {
  id: 'starts-soon',
  name: 'Starts soon',
  filter: {
    kind: 'group', op: 'AND', children: [
      { kind: 'rule', field: { src: 'builtin', key: 'start' }, operator: 'between', value: '2026-09-01', value2: '2026-09-30' },
    ],
  },
};

await saveSavedFilters([criticalOnly, startsSoon]);
const loaded = await loadSavedFilters();
ok(loaded.length === 2, 'twee opgeslagen filters overleven een round-trip');
ok(loaded.map(filter => filter.id).join(',') === 'critical-only,starts-soon', 'volgorde en identiteit blijven behouden');
ok(loaded[0]?.filter.kind === 'group' && loaded[0].filter.children[0]?.kind === 'rule', 'de filterboom blijft bruikbaar na laden');

storage.set('ops-savedFilters', JSON.stringify([
  criticalOnly,
  { id: 'broken', name: 'Broken', filter: { kind: 'unknown' } },
  { id: '', name: 'No id', filter: criticalOnly.filter },
  'not a filter',
]));
const guarded = await loadSavedFilters();
ok(guarded.length === 1 && guarded[0]?.id === 'critical-only', 'corrupte opgeslagen filters worden veilig overgeslagen');

if (failures > 0) process.exit(1);
console.log('saved-filters: alles groen');
