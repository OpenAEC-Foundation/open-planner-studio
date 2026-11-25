import { relationRoles, slotTableNamed, slotTableOf } from '../ifcSlotTables';
import { applyForeignRule, type ForeignChange, type RestoredForeignPiece } from './changeList';
import type { ElementLink } from './elementLinks';
import { pieceReferences, pieceRefs, renumberedPiece, withoutReferences } from './foreignReferences';
import {
  CONTROL, formatRefs, NESTS, refList, refOf, relArgs, setArgs, SINGLE_MEMBERSHIP, type OwnLine,
} from './ownLine';
import { OWNED_BY_TABLE, type SourcePieceSlots } from './sourceSlots';
import { sourceEntity, sourceSlotArgs } from './sourceSlotWrite';
import { skipBlank, splitStepArgs } from './stepScanner';

export interface DetachedPiece {
  readonly bytes: Uint8Array;
  readonly objects: ReadonlyMap<number, string>;
  readonly at?: number;
}

export interface DetachedObject {
  readonly slots?: SourcePieceSlots;
  readonly links?: readonly ElementLink[];
}

export interface DetachedRelation {
  readonly type: string;
  readonly relating: string;
  readonly members: readonly string[];
  readonly slots: SourcePieceSlots;
}

export interface Detached {
  readonly pieces: ReadonlyMap<number, DetachedPiece>;
  readonly objects: ReadonlyMap<string, DetachedObject>;
  readonly relations: ReadonlyMap<string, DetachedRelation>;
}

export type PieceTarget = { readonly seed: string } | { readonly piece: number } | { readonly source: number };

export interface RestorablePiece {
  readonly key: number;
  readonly bytes: Uint8Array;
  readonly targets: ReadonlyMap<number, PieceTarget>;
  readonly complete: boolean;
  readonly at: number | undefined;
}

export interface SourceView {
  readonly kept: (id: number) => boolean;
  readonly chunkBytes: (id: number) => Uint8Array | undefined;
  readonly type: (id: number) => string | undefined;
}

export function restorablePieces(detached: Detached | undefined, present: (seed: string) => boolean, source: SourceView): RestorablePiece[] {
  if (!detached || detached.pieces.size === 0) return [];
  const pieces = [...detached.pieces].sort(([a], [b]) => a - b);
  const synthetic = new Map<string, number>(), gone = new Set<number>();
  const syntheticId = (key: string) => {
    let id = synthetic.get(key);
    if (id === undefined) synthetic.set(key, id = -1 - synthetic.size);
    return id;
  };
  const targetsOf = new Map<number, Map<number, PieceTarget | undefined>>();
  for (const [key, piece] of pieces) {
    const targets = new Map<number, PieceTarget | undefined>();
    for (const ref of pieceRefs(piece.bytes)) {
      if (targets.has(ref)) continue;
      const seed = piece.objects.get(ref);
      targets.set(ref, seed !== undefined ? (present(seed) ? { seed } : undefined)
        : detached.pieces.has(ref) ? { piece: ref } : source.kept(ref) ? { source: ref } : undefined);
    }
    targetsOf.set(key, targets);
  }
  const unified = (key: number, ref: number) => {
    const target = targetsOf.get(key)!.get(ref);
    if (target && 'piece' in target) return target.piece;
    const id = syntheticId(!target ? `weg ${key} ${ref}` : 'seed' in target ? `seed ${target.seed}` : `bron ${target.source}`);
    if (!target) gone.add(id);
    return id;
  };
  const references = pieceReferences(pieces.map(([id, piece]) => ({ id, bytes: piece.bytes })), unified);
  const { dropped } = applyForeignRule(references, gone);
  return pieces.filter(([key]) => !dropped.has(key)).map(([key, piece]) => {
    const targets = targetsOf.get(key)!;
    const lost = new Set([...targets].filter(([, t]) => !t || ('piece' in t && dropped.has(t.piece))).map(([ref]) => ref));
    const bytes = lost.size === 0 ? piece.bytes : withoutReferences(piece.bytes, 0, skipBlank(piece.bytes, 0), piece.bytes.length, lost);
    const kept = new Map<number, PieceTarget>();
    for (const [ref, t] of targets) if (t && !lost.has(ref)) kept.set(ref, t);
    const at = piece.at ?? (source.chunkBytes(key) ? key : undefined);
    return { key, bytes, targets: kept, complete: lost.size === 0, at: at !== undefined && source.chunkBytes(at) ? at : undefined };
  });
}

export interface RestoredOutput {
  readonly inPlace: ReadonlyMap<number, Uint8Array>;
  readonly appended: readonly Uint8Array[];
  readonly entries: readonly RestoredForeignPiece[];
  readonly placed: ReadonlyMap<number, number>;
}

const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, k) => byte === b[k]);

export function renderedRestorations(pieces: readonly RestorablePiece[], outOf: (seed: string) => number | undefined,
  firstNewId: number, source: SourceView): RestoredOutput {
  const placed = new Map<number, number>();
  let next = firstNewId;
  for (const piece of pieces) placed.set(piece.key, piece.at ?? next++);
  const inPlace = new Map<number, Uint8Array>(), appended: Uint8Array[] = [], entries: RestoredForeignPiece[] = [];
  for (const piece of pieces) {
    const id = placed.get(piece.key)!;
    const bytes = renumberedPiece(piece.bytes, id, ref => {
      const t = piece.targets.get(ref)!;
      const out = 'seed' in t ? outOf(t.seed) : 'piece' in t ? placed.get(t.piece) : t.source;
      if (out === undefined) throw new Error(`detached: #${ref} van #${piece.key} heeft geen plek in de uitvoer`);
      return out;
    });
    if (piece.at !== undefined) {
      if (sameBytes(source.chunkBytes(piece.at)!, bytes)) continue;
      inPlace.set(piece.at, bytes);
      entries.push({ kind: 'teruggezet', id, newBytes: bytes });
    } else {
      const entity = bytes.subarray(skipBlank(bytes, 0));
      appended.push(entity);
      entries.push({ kind: 'teruggezet', id, newBytes: entity });
    }
  }
  return { inPlace, appended, entries, placed };
}

function pieceLine(bytes: Uint8Array): { type: string; args: string[] } | undefined {
  const text = new TextDecoder('latin1').decode(bytes.subarray(skipBlank(bytes, 0)));
  const m = /^#\d+\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*)\)\s*;\s*$/.exec(text);
  return m ? { type: m[1], args: splitStepArgs(m[2]) } : undefined;
}

export interface WriterView {
  readonly lines: readonly OwnLine[];
  readonly idOf: (seed: string) => number | undefined;
  readonly scheduleSeed: string;
  readonly tasks: readonly { readonly id: string; readonly parentId: string | null }[];
}

export function withoutRestoredMembers(pieces: readonly RestorablePiece[], writer: WriterView, source: SourceView): void {
  const taken = new Map<string, number[]>(), banned = new Map<string, Set<number>>(), scheduled = new Set<string>();
  for (const piece of pieces) {
    const line = pieceLine(piece.bytes);
    const roles = line && relArgs(line.type);
    if (!line || !roles) continue;
    const relating = piece.targets.get(refOf(line.args[roles.relating]));
    const members = refList(line.args[roles.related]).flatMap(ref => {
      const t = piece.targets.get(ref);
      return t && 'seed' in t ? [t.seed] : [];
    });
    if (!relating || members.length === 0) continue;
    if ('seed' in relating) {
      const out = writer.idOf(relating.seed);
      if (out === undefined) continue;
      const key = `${line.type}|${out}`;
      taken.set(key, [...(taken.get(key) ?? []), ...members.flatMap(m => writer.idOf(m) ?? [])]);
      continue;
    }
    if (SINGLE_MEMBERSHIP.has(line.type)) {
      const set = banned.get(line.type) ?? new Set<number>();
      for (const m of members) { const out = writer.idOf(m); if (out !== undefined) set.add(out); }
      banned.set(line.type, set);
    }
    if ((line.type === NESTS || line.type === CONTROL) && 'source' in relating && source.type(relating.source) === 'IFCWORKSCHEDULE') {
      for (const m of members) if (m.startsWith('task:')) scheduled.add(m.slice('task:'.length));
    }
  }
  const outsideSchedule = new Set<number>();
  if (scheduled.size > 0) {
    const parent = new Map(writer.tasks.map(t => [t.id, t.parentId]));
    for (const t of writer.tasks) {
      for (let cur: string | null | undefined = t.id, guard = 0; cur && guard < 10000; cur = parent.get(cur), guard++) {
        if (!scheduled.has(cur)) continue;
        const out = writer.idOf(`task:${t.id}`);
        if (out !== undefined) outsideSchedule.add(out);
        break;
      }
    }
  }
  if (taken.size === 0 && banned.size === 0 && outsideSchedule.size === 0) return;
  const schedule = writer.idOf(writer.scheduleSeed);
  for (const line of writer.lines) {
    const roles = relArgs(line.type);
    if (!roles || line.drop) continue;
    const relating = refOf(line.args[roles.relating]);
    const before = refList(line.args[roles.related]);
    const pool = [...(taken.get(`${line.type}|${relating}`) ?? [])];
    const scheduleRel = relating === schedule && (line.type === NESTS || line.type === CONTROL);
    const after = before.filter(m => {
      const at = pool.indexOf(m);
      if (at >= 0) { pool.splice(at, 1); return false; }
      return !banned.get(line.type)?.has(m) && !(scheduleRel && outsideSchedule.has(m));
    });
    if (after.length === before.length) continue;
    if (after.length === 0) line.drop = true;
    else {
      const args = [...line.args];
      args[roles.related] = formatRefs(after);
      setArgs(line, args);
    }
  }
}

export function withReturnedSlots(objects: ReadonlyMap<string, DetachedObject> | undefined, byId: ReadonlyMap<number, OwnLine>,
  idOf: (seed: string) => number | undefined, carried: (id: number) => boolean): void {
  const apply = (line: OwnLine | undefined, piece: SourcePieceSlots) => {
    if (!line || line.drop) return;
    const table = slotTableOf(line.type, line.args);
    if (!table || table.naam !== piece.table || line.args.length !== table.slots.length) return;
    line.type = sourceEntity(table, piece, line.type);
    setArgs(line, sourceSlotArgs(table, piece, line.args, line.args, () => true, carried));
  };
  for (const [seed, object] of objects ?? []) {
    const id = object.slots && idOf(seed);
    if (!object.slots || id === undefined) continue;
    const line = byId.get(id);
    apply(line, object.slots);
    const owner = OWNED_BY_TABLE.get(object.slots.table);
    if (!line || !owner || !object.slots.owned) continue;
    const slot = slotTableNamed(object.slots.table)!.slots.findIndex(s => s.key === owner.slot);
    apply(byId.get(refOf(line.args[slot])), object.slots.owned);
  }
}

export function withReturnedMembers(relations: ReadonlyMap<string, DetachedRelation> | undefined, lines: OwnLine[], byId: Map<number, OwnLine>,
  idOf: (seed: string) => number | undefined, carried: ReadonlySet<string>, nextId: () => number): void {
  for (const [key, relation] of relations ?? []) {
    const roles = relationRoles(relation.type), table = slotTableNamed(relation.slots.table), relating = idOf(relation.relating);
    if (!roles || !table || relating === undefined) continue;
    const own = lines.filter(l => !l.drop && l.type === relation.type && refOf(l.args[roles.relating]) === relating && !carried.has(l.args[0]?.trim()));
    const line = lines.find(l => !l.drop && l.type === relation.type && l.args[0]?.trim() === key);
    const current = line ? refList(line.args[roles.related]) : [];
    const wanted = relation.members.flatMap(m => idOf(m) ?? []);
    const available = own.flatMap(l => refList(l.args[roles.related]));
    const take = relation.type === NESTS && !line ? available : wanted.filter(m => !current.includes(m) && available.includes(m));
    if (take.length === 0) continue;
    const pool = [...take];
    for (const l of own) {
      const before = refList(l.args[roles.related]);
      const after = before.filter(m => { const at = pool.indexOf(m); if (at < 0) return true; pool.splice(at, 1); return false; });
      if (after.length === before.length) continue;
      if (after.length === 0) { l.drop = true; continue; }
      const args = [...l.args];
      args[roles.related] = formatRefs(after);
      setArgs(l, args);
    }
    const joined = new Set([...current, ...take]);
    const members = relation.type === NESTS && !line ? take : [...wanted.filter(m => joined.has(m)), ...current.filter(m => !wanted.includes(m))];
    if (line) {
      const args = [...line.args];
      args[roles.related] = formatRefs(members);
      setArgs(line, args);
      continue;
    }
    const template = own[0]?.args.length === table.slots.length ? [...own[0].args] : table.slots.map(slot => relation.slots.slots.get(slot.key) ?? '$');
    template[roles.relating] = `#${relating}`;
    template[roles.related] = formatRefs(members);
    const added: OwnLine = { id: nextId(), type: sourceEntity(table, relation.slots, relation.type), args: [], text: '', drop: false };
    setArgs(added, sourceSlotArgs(table, relation.slots, template));
    byId.set(added.id, added);
    const at = own[0] ? lines.indexOf(own[0]) : lines.length;
    lines.splice(at, 0, added);
  }
}

export interface CarriedRelation extends DetachedRelation {
  readonly key: string;
}

export interface DetachedAfterWrite {
  readonly previous: Detached | undefined;
  readonly restorable: readonly RestorablePiece[];
  readonly placed: ReadonlyMap<number, number>;
  readonly changes: readonly ForeignChange[];
  readonly objectOf: (stepId: number) => string | undefined;
  readonly gone: readonly (readonly [string, DetachedObject])[];
  readonly present: (seed: string) => boolean;
  readonly carried: readonly CarriedRelation[];
  readonly membersOf: (key: string, type: string) => readonly string[] | undefined;
}

export function detachedAfterWrite(input: DetachedAfterWrite): Detached | undefined {
  const pieces = new Map<number, DetachedPiece>();
  const restorable = new Map(input.restorable.map(piece => [piece.key, piece]));
  for (const [key, piece] of input.previous?.pieces ?? []) {
    const at = input.placed.get(key);
    if (restorable.get(key)?.complete && at !== undefined) continue;
    pieces.set(key, { bytes: piece.bytes, objects: piece.objects, ...(at !== undefined ? { at } : {}) });
  }
  const known = new Set<number>();
  for (const [key, piece] of input.previous?.pieces ?? []) {
    known.add(key);
    const at = input.placed.get(key) ?? piece.at;
    if (at !== undefined) known.add(at);
  }
  for (const change of input.changes) {
    if (change.kind === 'teruggezet' || (change.kind === 'vervallen' && change.unusedKeyOfTask !== undefined) || known.has(change.id)) continue;
    const objects = new Map<number, string>();
    for (const ref of pieceRefs(change.oldBytes)) {
      const seed = input.objectOf(ref);
      if (seed !== undefined) objects.set(ref, seed);
    }
    pieces.set(change.id, { bytes: change.oldBytes, objects, ...(change.kind === 'gewijzigd' ? { at: change.id } : {}) });
  }
  const objects = new Map<string, DetachedObject>();
  for (const [seed, object] of input.previous?.objects ?? []) if (!input.present(seed)) objects.set(seed, object);
  for (const [seed, object] of input.gone) if (!objects.has(seed) && (object.slots || object.links)) objects.set(seed, object);
  const relations = new Map<string, DetachedRelation>();
  const complete = (key: string, relation: DetachedRelation) => {
    const written = input.membersOf(key, relation.type);
    return written !== undefined && relation.members.every(m => written.includes(m));
  };
  for (const [key, relation] of input.previous?.relations ?? []) if (!complete(key, relation)) relations.set(key, relation);
  for (const { key, ...relation } of input.carried) if (!relations.has(key) && !complete(key, relation)) relations.set(key, relation);
  return pieces.size === 0 && objects.size === 0 && relations.size === 0 ? undefined : { pieces, objects, relations };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function isDetached(value: unknown, isSlots: (value: unknown) => boolean): value is Detached {
  if (!isRecord(value) || !(value.pieces instanceof Map) || !(value.objects instanceof Map) || !(value.relations instanceof Map)) return false;
  for (const [key, piece] of value.pieces) {
    if (!Number.isSafeInteger(key) || !isRecord(piece) || !(piece.bytes instanceof Uint8Array) || !(piece.objects instanceof Map)) return false;
    if (piece.at !== undefined && !Number.isSafeInteger(piece.at)) return false;
  }
  for (const [seed, object] of value.objects) {
    if (typeof seed !== 'string' || !isRecord(object)) return false;
    if (object.slots !== undefined && !isSlots(new Map([[1, object.slots]]))) return false;
    if (object.links !== undefined && !Array.isArray(object.links)) return false;
  }
  for (const [key, relation] of value.relations) {
    if (typeof key !== 'string' || !isRecord(relation) || typeof relation.type !== 'string' || typeof relation.relating !== 'string'
      || !Array.isArray(relation.members) || !relation.members.every(m => typeof m === 'string') || !isSlots(new Map([[1, relation.slots]]))) return false;
  }
  return true;
}
