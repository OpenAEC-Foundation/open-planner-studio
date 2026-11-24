import type { ImportResult } from '@/services/importTypes';
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import { withRenamedPlanningIds } from '@/services/ifc/foreign/planningIdentity';

export type RecoveryIdentityRow = readonly [seed: string, sessionGlobalId: string, writtenGlobalId: string];

const KINDS = ['task', 'res', 'cal', 'seq'] as const;
type Kind = typeof KINDS[number];
const KEEPS_ID: ReadonlySet<string> = new Set<Kind>(['task']);
const isKind = (kind: string): kind is Kind => (KINDS as readonly string[]).includes(kind);
const kindOf = (seed: string) => seed.slice(0, Math.max(seed.indexOf(':'), 0));
const ownValue = (record: Readonly<Record<string, string>>, key: string) =>
  Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;

type Planning = Pick<ImportResult, 'tasks' | 'resources' | 'resourceCalendars' | 'sequences' | 'calendar'>;

function objectIds(planning: Planning): ReadonlyMap<Kind, readonly string[]> {
  return new Map<Kind, readonly string[]>([
    ['task', planning.tasks.map(t => t.id)],
    ['res', planning.resources.map(r => r.id)],
    ['cal', (planning.resourceCalendars ?? []).filter(c => c.id !== planning.calendar.id).map(c => c.id)],
    ['seq', planning.sequences.map(s => s.id)],
  ]);
}

export function recoveryIdentityRows(raw: unknown): readonly RecoveryIdentityRow[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const seeds = new Set<string>(), written = new Set<string>();
  for (const row of raw as unknown[]) {
    if (!Array.isArray(row) || row.length !== 3 || !row.every(value => typeof value === 'string' && value.length > 0)) return null;
    const [seed, , writtenGlobalId] = row as string[];
    const kind = kindOf(seed);
    const writtenKey = JSON.stringify([kind, writtenGlobalId]);
    if (!isKind(kind) || seed.length === kind.length + 1 || seeds.has(seed) || written.has(writtenKey)) return null;
    seeds.add(seed);
    written.add(writtenKey);
  }
  return raw as readonly RecoveryIdentityRow[];
}

export function sameRecoveryIdentityRows(a: readonly RecoveryIdentityRow[] | undefined, b: readonly RecoveryIdentityRow[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((row, i) => row[0] === b[i][0] && row[1] === b[i][1] && row[2] === b[i][2]);
}

export function snapshotIdentityRows(
  input: WriteIFCInput, issuedGlobalIds: ReadonlyMap<string, string>,
): readonly RecoveryIdentityRow[] | undefined {
  const kept = input.ifcGlobalIds;
  if (!input.recoveryForeignSource || !kept) return undefined;
  const holders = new Map<string, number>();
  for (const globalId of Object.values(kept)) holders.set(globalId, (holders.get(globalId) ?? 0) + 1);
  const rows: RecoveryIdentityRow[] = [];
  for (const [kind, ids] of objectIds(input)) {
    for (const id of ids) {
      const seed = `${kind}:${id}`, sessionGlobalId = ownValue(kept, seed), written = issuedGlobalIds.get(seed);
      if (sessionGlobalId === undefined || written === undefined || (holders.get(sessionGlobalId) ?? 0) < 2) continue;
      rows.push([seed, sessionGlobalId, written]);
    }
  }
  return rows.length > 0 && recoveryIdentityRows(rows) ? rows : undefined;
}

export function withRecoveryIdentities<T extends ImportResult>(parsed: T, raw: unknown): T {
  const rows = recoveryIdentityRows(raw);
  if (!rows) return parsed;
  const globalIds = parsed.ifcGlobalIds ?? {};
  const ids = objectIds(parsed);
  const byWritten = new Map<Kind, Map<string, string[]>>(KINDS.map(kind => [kind, new Map()]));
  for (const [kind, list] of ids) {
    for (const id of list) {
      const written = ownValue(globalIds, `${kind}:${id}`);
      if (written === undefined) continue;
      const holders = byWritten.get(kind)!;
      holders.set(written, [...(holders.get(written) ?? []), id]);
    }
  }
  const renames = new Map<Kind, Map<string, string>>(KINDS.map(kind => [kind, new Map()]));
  const removedSeeds = new Set<string>(), restoredGlobalIds = new Map<string, string>();
  for (const [seed, sessionGlobalId, written] of rows) {
    const kind = kindOf(seed) as Kind, sessionId = seed.slice(kind.length + 1);
    const found = byWritten.get(kind)!.get(written);
    if (found?.length !== 1 || (KEEPS_ID.has(kind) && found[0] !== sessionId)) return parsed;
    renames.get(kind)!.set(found[0], sessionId);
    removedSeeds.add(`${kind}:${found[0]}`);
    restoredGlobalIds.set(seed, sessionGlobalId);
  }
  for (const [kind, list] of ids) {
    const rename = renames.get(kind)!, finalIds = new Set<string>();
    for (const id of list) {
      const next = rename.get(id) ?? id;
      if (finalIds.has(next)) return parsed;
      finalIds.add(next);
    }
  }
  const nextGlobalIds = new Map(Object.entries(globalIds).filter(([seed]) => !removedSeeds.has(seed)));
  for (const [seed, globalId] of restoredGlobalIds) nextGlobalIds.set(seed, globalId);
  const resource = renames.get('res')!, calendar = renames.get('cal')!, sequence = renames.get('seq')!;
  const renamed = withRenamedPlanningIds(parsed, {
    resource: id => resource.get(id) ?? id,
    calendar: id => calendar.get(id) ?? id,
    ifcGlobalIds: Object.fromEntries(nextGlobalIds),
  });
  return sequence.size === 0 ? renamed
    : { ...renamed, sequences: renamed.sequences.map(s => sequence.has(s.id) ? { ...s, id: sequence.get(s.id)! } : s) };
}

export function snapshotIdentityFields(record: object | null | undefined): { snapshotIdentities?: readonly RecoveryIdentityRow[] } {
  const value = (record as { snapshotIdentities?: unknown } | null | undefined)?.snapshotIdentities;
  return Array.isArray(value) ? { snapshotIdentities: value as readonly RecoveryIdentityRow[] } : {};
}
