import type { ImportResult } from '@/services/importTypes';
import type { WriteIFCInput } from '@/services/ifc/ifcWriter';
import { withRenamedPlanningIds } from '@/services/ifc/foreign/planningIdentity';
import { stepAssignmentIds } from '@/services/ifc/assignmentKeys';
import { precomputeSha256, sha256Hex } from '@/services/xerSourceArchive';

export type RecoveryIdentityRow = readonly [seed: string, sessionGlobalId: string, writtenIdentity: string];

export interface RecoverySnapshotIdentities {
  readonly sha256: string;
  readonly rows: readonly RecoveryIdentityRow[];
}

const KINDS = ['task', 'res', 'cal', 'seq', 'asgn', 'bl'] as const;
type Kind = typeof KINDS[number];
const SHA256_HEX = /^[0-9a-f]{64}$/;
const isKind = (kind: string): kind is Kind => (KINDS as readonly string[]).includes(kind);
const kindOf = (seed: string) => seed.slice(0, Math.max(seed.indexOf(':'), 0));
const hasOwn = (record: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(record, key);
const ownValue = (record: Readonly<Record<string, string>>, key: string) => hasOwn(record, key) ? record[key] : undefined;
const textSha256 = (text: string) => sha256Hex(new TextEncoder().encode(text));

type Planning = Pick<ImportResult, 'tasks' | 'resources' | 'resourceCalendars' | 'sequences' | 'calendar'>;

function objectIds(planning: Planning): ReadonlyMap<Kind, readonly string[]> {
  return new Map<Kind, readonly string[]>([
    ['task', planning.tasks.map(t => t.id)],
    ['res', planning.resources.map(r => r.id)],
    ['cal', (planning.resourceCalendars ?? []).filter(c => c.id !== planning.calendar.id).map(c => c.id)],
    ['seq', planning.sequences.map(s => s.id)],
  ]);
}

function ifcxStepKeys(input: ImportResult, resourceGuid: (id: string) => string): Map<string, string> {
  const keys = new Map<string, string>();
  stepAssignmentIds(input.assignments, resourceGuid).forEach((key, i) => keys.set(`asgn:${input.assignments[i].id}`, key));
  for (const baseline of input.baselines ?? []) keys.set(`bl:${baseline.id}`, baseline.id);
  return keys;
}

function filledText(row: readonly unknown[], position: number): string | null {
  const value = row[position];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function recoveryIdentityRows(raw: unknown): RecoveryIdentityRow[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const rows: RecoveryIdentityRow[] = [], seeds = new Set<string>(), written = new Set<string>();
  for (let index = 0; index < raw.length; index++) {
    const row: unknown = raw[index];
    if (!Array.isArray(row) || row.length !== 3) return null;
    const seed = filledText(row, 0), sessionGlobalId = filledText(row, 1), writtenGlobalId = filledText(row, 2);
    if (seed === null || sessionGlobalId === null || writtenGlobalId === null) return null;
    const kind = kindOf(seed), writtenKey = JSON.stringify([kind, writtenGlobalId]);
    if (!isKind(kind) || seed.length === kind.length + 1 || seeds.has(seed) || written.has(writtenKey)) return null;
    seeds.add(seed);
    written.add(writtenKey);
    rows.push([seed, sessionGlobalId, writtenGlobalId]);
  }
  return rows;
}

export function recoverySnapshotIdentities(raw: unknown): RecoverySnapshotIdentities | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const sha256 = hasOwn(raw, 'sha256') ? (raw as { sha256: unknown }).sha256 : undefined;
  if (typeof sha256 !== 'string' || !SHA256_HEX.test(sha256)) return null;
  const rows = recoveryIdentityRows(hasOwn(raw, 'rows') ? (raw as { rows: unknown }).rows : undefined);
  return rows ? { sha256, rows } : null;
}

export async function recoveryIdentitiesForSnapshot(
  ifc: string, raw: unknown, knownSha256?: string,
): Promise<readonly RecoveryIdentityRow[] | null> {
  const identities = recoverySnapshotIdentities(raw);
  if (!identities) return null;
  const sha256 = knownSha256 ?? await precomputeSha256(new TextEncoder().encode(ifc));
  return sha256 === identities.sha256 ? identities.rows : null;
}

export function snapshotWrittenAt(ifc: string): Date | null {
  const stamp = /^FILE_NAME\('(?:[^']|'')*','(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})'/m.exec(ifc)?.[1];
  return stamp ? new Date(`${stamp}Z`) : null;
}

function globalIdHolders(kept: Readonly<Record<string, string>>): Map<string, number> | null {
  const holders = new Map<string, number>();
  let shared = false;
  for (const globalId of Object.values(kept)) {
    const count = (holders.get(globalId) ?? 0) + 1;
    holders.set(globalId, count);
    if (count === 2) shared = true;
  }
  return shared ? holders : null;
}

export const hasSharedGlobalIds = (kept: Readonly<Record<string, string>> | null | undefined): boolean =>
  !!kept && globalIdHolders(kept) !== null;

function identityRows(input: WriteIFCInput, issuedGlobalIds: ReadonlyMap<string, string>): RecoveryIdentityRow[] {
  const holders = input.ifcGlobalIds ? globalIdHolders(input.ifcGlobalIds) : null;
  if (!holders) return [];
  const kept = input.ifcGlobalIds!;
  const rows: RecoveryIdentityRow[] = [];
  for (const [kind, ids] of objectIds(input)) {
    for (const id of ids) {
      const seed = `${kind}:${id}`, sessionGlobalId = ownValue(kept, seed), written = issuedGlobalIds.get(seed);
      if (sessionGlobalId === undefined || written === undefined || (holders.get(sessionGlobalId) ?? 0) < 2) continue;
      rows.push([seed, sessionGlobalId, written]);
    }
  }
  return rows;
}

function ifcxRows(input: WriteIFCInput, keys: ReadonlyMap<string, string>): RecoveryIdentityRow[] {
  const rows: RecoveryIdentityRow[] = [];
  const kept = input.ifcGlobalIds ?? {};
  for (const [seed, key] of keys) {
    const globalId = ownValue(kept, seed);
    if (globalId !== undefined) rows.push([seed, globalId, key]);
  }
  return rows;
}

export function snapshotIdentities(
  input: WriteIFCInput, issuedGlobalIds: ReadonlyMap<string, string>, ifc: string, ifcx = false,
): RecoverySnapshotIdentities | undefined {
  const rows = ifcx ? ifcxRows(input, ifcxStepKeys(input, id => issuedGlobalIds.get(`res:${id}`)!)) : identityRows(input, issuedGlobalIds);
  return rows.length > 0 && recoveryIdentityRows(rows) ? { sha256: textSha256(ifc), rows } : undefined;
}

export function reproducesIdentities(
  rows: readonly RecoveryIdentityRow[], input: WriteIFCInput, issuedGlobalIds: ReadonlyMap<string, string>,
): boolean {
  const kept = input.ifcGlobalIds ?? {};
  const coupled = new Set(rows.map(row => JSON.stringify(row)));
  return rows.every(([seed, sessionGlobalId, written]) => issuedGlobalIds.get(seed) === written && ownValue(kept, seed) === sessionGlobalId)
    && identityRows(input, issuedGlobalIds).every(row => coupled.has(JSON.stringify(row)));
}

export function withRecoveryIdentities<T extends ImportResult>(parsed: T, rows: readonly RecoveryIdentityRow[], ifcx = false): T {
  const globalIds = parsed.ifcGlobalIds ?? {};
  const byWritten = new Map<Kind, Map<string, string[]>>(KINDS.map(kind => [kind, new Map()]));
  const index = (kind: Kind, id: string, written: string | undefined) => {
    if (written === undefined) return;
    const holders = byWritten.get(kind)!;
    holders.set(written, [...(holders.get(written) ?? []), id]);
  };
  if (ifcx) {
    for (const [seed, written] of ifcxStepKeys(parsed, id => globalIds[`res:${id}`])) {
      const kind = kindOf(seed) as Kind;
      index(kind, seed.slice(kind.length + 1), written);
    }
  } else {
    for (const [kind, ids] of objectIds(parsed)) {
      for (const id of ids) index(kind, id, ownValue(globalIds, `${kind}:${id}`));
    }
  }
  const renames = new Map<Kind, Map<string, string>>(KINDS.map(kind => [kind, new Map()]));
  const removedSeeds = new Set<string>(), restoredGlobalIds = new Map<string, string>();
  for (const [seed, sessionGlobalId, written] of rows) {
    const kind = kindOf(seed) as Kind, sessionId = seed.slice(kind.length + 1);
    const found = byWritten.get(kind)!.get(written);
    if (found?.length !== 1) return parsed;
    const readSeed = `${kind}:${found[0]}`;
    if (ifcx) {
      restoredGlobalIds.set(readSeed, sessionGlobalId);
    } else {
      renames.get(kind)!.set(found[0], sessionId);
      removedSeeds.add(readSeed);
      restoredGlobalIds.set(seed, sessionGlobalId);
    }
  }
  const nextGlobalIds = new Map(Object.entries(globalIds).filter(([seed]) => !removedSeeds.has(seed)));
  for (const [seed, globalId] of restoredGlobalIds) nextGlobalIds.set(seed, globalId);
  if (ifcx) return { ...parsed, ifcGlobalIds: Object.fromEntries(nextGlobalIds) };
  const resource = renames.get('res')!, calendar = renames.get('cal')!, sequence = renames.get('seq')!;
  const renamed = withRenamedPlanningIds(parsed, {
    resource: id => resource.get(id) ?? id,
    calendar: id => calendar.get(id) ?? id,
    ifcGlobalIds: Object.fromEntries(nextGlobalIds),
  });
  return sequence.size === 0 ? renamed
    : { ...renamed, sequences: renamed.sequences.map(s => sequence.has(s.id) ? { ...s, id: sequence.get(s.id)! } : s) };
}

export function snapshotIdentityFields(record: object | null | undefined): { snapshotIdentities?: RecoverySnapshotIdentities } {
  const value = (record as { snapshotIdentities?: unknown } | null | undefined)?.snapshotIdentities;
  return value !== undefined ? { snapshotIdentities: value as RecoverySnapshotIdentities } : {};
}
