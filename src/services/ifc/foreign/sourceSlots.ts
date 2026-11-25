import { inSchemaLayout, slotTableOf, slotTablesHaveOwnerHistory } from '../ifcSlotTables';
import { hasOwnOrigin } from './classify';
import type { StepIndex } from './stepScanner';

export interface SourcePieceSlots {
  readonly entity: string;
  readonly table: string;
  readonly slots: ReadonlyMap<string, string>;
  readonly owned?: SourcePieceSlots;
}

export type SourceSlots = ReadonlyMap<number, SourcePieceSlots>;

export const OWNED_BY_TABLE: ReadonlyMap<string, { readonly slot: string; readonly table: string }> = new Map([
  ['IfcTask', { slot: 'taskTime', table: 'IfcTaskTime' }],
  ['IfcRelSequence', { slot: 'timeLag', table: 'IfcLagTime' }],
]);

function pieceAt(index: StepIndex, chunk: number): SourcePieceSlots | undefined {
  if (chunk < 0 || !index.isEntity(chunk) || index.literalText(chunk)) return undefined;
  const args = index.argTokens(chunk);
  if (!args || args.some(token => token.includes('\uFFFD'))) return undefined;
  const entity = index.type(chunk);
  const table = slotTableOf(entity, args);
  if (!table || !inSchemaLayout(table, args)) return undefined;
  const slots = new Map<string, string>();
  table.slots.forEach((slot, k) => { slots.set(slot.key, args[k]); });
  return { entity, table: table.naam, slots };
}

function directReference(index: StepIndex, token: string | undefined): number {
  const label = /^#(\w+)$/.exec((token ?? '').trim())?.[1];
  const chunk = label === undefined ? -1 : index.chunkOf(label.replace(/^0+(?=\d)/, ''));
  return chunk >= 0 && index.idLabel(chunk) === label ? chunk : -1;
}

function slotsOf(index: StepIndex, chunk: number): SourcePieceSlots | undefined {
  const piece = pieceAt(index, chunk);
  const owner = piece && OWNED_BY_TABLE.get(piece.table);
  if (!piece || !owner) return piece;
  const owned = pieceAt(index, directReference(index, piece.slots.get(owner.slot)));
  return owned?.table === owner.table ? { ...piece, owned } : piece;
}

export function* mappedChunks(index: StepIndex, slots: SourceSlots): Generator<[number, SourcePieceSlots]> {
  for (const [id, piece] of slots) {
    const chunk = index.chunkOf(String(id));
    if (chunk < 0) continue;
    yield [chunk, piece];
    const owner = OWNED_BY_TABLE.get(piece.table);
    const owned = owner && piece.owned ? directReference(index, piece.slots.get(owner.slot)) : -1;
    if (owned >= 0) yield [owned, piece.owned!];
  }
}

export function scanSourceSlots(index: StepIndex, pieces: Iterable<number>): Map<number, SourcePieceSlots> {
  const out = new Map<number, SourcePieceSlots>();
  for (const chunk of pieces) {
    const slots = slotsOf(index, chunk);
    if (slots) out.set(Number(index.id(chunk)), slots);
  }
  return out;
}

export function* foreignOriginAmong(index: StepIndex, written: Iterable<number>): Generator<number> {
  for (const chunk of written) {
    if (chunk >= 0 && index.isEntity(chunk) && slotTablesHaveOwnerHistory(index.type(chunk)) && !hasOwnOrigin(index, chunk)) yield chunk;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function isPieceSlots(value: unknown, mayOwn: boolean): boolean {
  if (!isRecord(value) || typeof value.entity !== 'string' || typeof value.table !== 'string' || !(value.slots instanceof Map)) return false;
  for (const [key, token] of value.slots) if (typeof key !== 'string' || typeof token !== 'string') return false;
  return value.owned === undefined || (mayOwn && isPieceSlots(value.owned, false));
}

export function isSourceSlots(value: unknown): value is SourceSlots {
  if (!(value instanceof Map)) return false;
  for (const [stepId, piece] of value) {
    if (!Number.isSafeInteger(stepId) || stepId <= 0 || !isPieceSlots(piece, true)) return false;
  }
  return true;
}
