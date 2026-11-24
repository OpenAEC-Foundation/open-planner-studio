import { ifcGuid128 } from '@/services/ifc/ifcWriter';
import { withRenamedPlanningIds } from '@/services/ifc/foreign/planningIdentity';
import { DEFAULT_CALENDAR_ID } from '@/engine/calendar/defaultCalendar';
import type { ImportResult } from '@/services/importTypes';

export type SharedGlobalId = readonly [seed: string, globalId: string];

export interface RecoverySnapshotGlobalIds {
  readonly snapshotGlobalIds: Readonly<Record<string, string>>;
  readonly shared: readonly SharedGlobalId[];
}

const SNAPSHOT_ID_PREFIX: ReadonlyMap<string, string | null> = new Map([
  ['task', null], ['res', 'res'], ['cal', 'rescal'], ['seq', 'seq'],
]);
const PROJECT_CALENDAR_SEED = `cal:${DEFAULT_CALENDAR_ID}`;
const SEED = /^(task|res|cal|seq):./;
const GLOBAL_ID = /^[0-9A-Za-z_$]{22}$/;

const kindOf = (seed: string) => seed.slice(0, seed.indexOf(':'));
const withheld = (seed: string) => SNAPSHOT_ID_PREFIX.has(kindOf(seed)) && seed !== PROJECT_CALENDAR_SEED;

const computed = new WeakMap<Readonly<Record<string, string>>, RecoverySnapshotGlobalIds | null>();

export function recoverySnapshotGlobalIds(
  ifcGlobalIds: Readonly<Record<string, string>> | null | undefined,
): RecoverySnapshotGlobalIds | null {
  if (!ifcGlobalIds) return null;
  const known = computed.get(ifcGlobalIds);
  if (known !== undefined) return known;
  const entries = Object.entries(ifcGlobalIds);
  const holders = new Map<string, number>();
  for (const [, globalId] of entries) holders.set(globalId, (holders.get(globalId) ?? 0) + 1);
  const shared = entries.filter(([seed, globalId]) => holders.get(globalId)! > 1 && withheld(seed));
  const sharedSeeds = new Set(shared.map(([seed]) => seed));
  const result = shared.length === 0 ? null : {
    snapshotGlobalIds: Object.fromEntries(entries.filter(([seed]) => !sharedSeeds.has(seed))),
    shared: shared.map(([seed, globalId]): SharedGlobalId => [seed, globalId]),
  };
  computed.set(ifcGlobalIds, result);
  return result;
}

export function parseSharedGlobalIds(raw: unknown): SharedGlobalId[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const bySeed = new Map<string, string>();
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2) return undefined;
    const [seed, globalId] = entry as unknown[];
    if (typeof seed !== 'string' || !SEED.test(seed) || seed === PROJECT_CALENDAR_SEED) return undefined;
    if (typeof globalId !== 'string' || !GLOBAL_ID.test(globalId)) return undefined;
    bySeed.set(seed, globalId);
  }
  return [...bySeed];
}

export function sameSharedGlobalIds(a: readonly SharedGlobalId[] | undefined, b: readonly SharedGlobalId[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every(([seed, globalId], i) => seed === b[i][0] && globalId === b[i][1]);
}

export function withSharedGlobalIdsRestored<T extends ImportResult>(parsed: T, shared: readonly SharedGlobalId[]): T {
  const globalIds = new Map(Object.entries(parsed.ifcGlobalIds ?? {}));
  const taken = new Set([
    ...parsed.resources.map(r => r.id), ...(parsed.resourceCalendars ?? []).map(c => c.id), ...parsed.sequences.map(s => s.id),
  ]);
  const renames = new Map<string, Map<string, string>>([['res', new Map()], ['cal', new Map()], ['seq', new Map()]]);
  let restored = 0;
  for (const [seed, globalId] of shared) {
    const kind = kindOf(seed), id = seed.slice(kind.length + 1), prefix = SNAPSHOT_ID_PREFIX.get(kind);
    if (prefix === undefined || seed === PROJECT_CALENDAR_SEED) continue;
    const written = ifcGuid128(seed);
    const snapshotId = prefix === null ? id : `${prefix}-ifc-${written}`;
    const snapshotSeed = `${kind}:${snapshotId}`;
    if (globalIds.get(snapshotSeed) === written) {
      if (snapshotId !== id) {
        if (taken.has(id)) continue;
        taken.add(id);
        renames.get(kind)!.set(snapshotId, id);
        globalIds.delete(snapshotSeed);
      }
    } else if (globalIds.has(seed)) continue;
    globalIds.set(seed, globalId);
    restored++;
  }
  if (restored === 0) return parsed;
  const resource = renames.get('res')!, calendar = renames.get('cal')!, sequence = renames.get('seq')!;
  const renamed = withRenamedPlanningIds(parsed, {
    resource: id => resource.get(id) ?? id,
    calendar: id => calendar.get(id) ?? id,
    ifcGlobalIds: Object.fromEntries(globalIds),
  });
  return sequence.size === 0 ? renamed
    : { ...renamed, sequences: renamed.sequences.map(s => sequence.has(s.id) ? { ...s, id: sequence.get(s.id)! } : s) };
}
