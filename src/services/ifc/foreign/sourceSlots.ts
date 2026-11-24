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

const OWNED_BY_TABLE: ReadonlyMap<string, { readonly slot: string; readonly table: string }> = new Map([
  ['IfcTask', { slot: 'taskTime', table: 'IfcTaskTime' }],
  ['IfcRelSequence', { slot: 'timeLag', table: 'IfcLagTime' }],
]);

interface ReadPiece {
  readonly piece: SourcePieceSlots;
  readonly positions: readonly string[];
}

function readPiece(index: StepIndex, chunk: number): ReadPiece | undefined {
  if (chunk < 0 || !index.isEntity(chunk) || index.literalText(chunk)) return undefined;
  const args = index.argTokens(chunk);
  if (!args) return undefined;
  const entity = index.type(chunk);
  const table = slotTableOf(entity, args);
  if (!table || !inSchemaLayout(table, args)) return undefined;
  const positions = table.slots.map(slot => slot.key);
  return { piece: { entity, table: table.naam, slots: new Map(positions.map((key, k) => [key, args[k]])) }, positions };
}

function slotsOf(index: StepIndex, chunk: number): SourcePieceSlots | undefined {
  const read = readPiece(index, chunk);
  if (!read) return undefined;
  const owner = OWNED_BY_TABLE.get(read.piece.table);
  if (!owner) return read.piece;
  const owned = readPiece(index, index.refAt(chunk, read.positions.indexOf(owner.slot)))?.piece;
  return owned?.table === owner.table ? { ...read.piece, owned } : read.piece;
}

export function scanSourceSlots(index: StepIndex, pieces: Iterable<number>): Map<number, SourcePieceSlots> {
  const out = new Map<number, SourcePieceSlots>();
  for (const chunk of pieces) {
    const slots = slotsOf(index, chunk);
    if (slots) out.set(Number(index.id(chunk)), slots);
  }
  return out;
}

export function* writtenForeignOrigin(index: StepIndex, written: Uint8Array): Generator<number> {
  for (let chunk = 0; chunk < index.count; chunk++) {
    if (written[chunk] === 1 && index.isEntity(chunk) && slotTablesHaveOwnerHistory(index.type(chunk))
      && !hasOwnOrigin(index, chunk)) yield chunk;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function isPieceSlots(value: unknown, mayOwn: boolean): boolean {
  return isRecord(value) && typeof value.entity === 'string' && typeof value.table === 'string'
    && value.slots instanceof Map && [...value.slots].every(([key, token]) => typeof key === 'string' && typeof token === 'string')
    && (value.owned === undefined || (mayOwn && isPieceSlots(value.owned, false)));
}

export function isSourceSlots(value: unknown): value is SourceSlots {
  return value instanceof Map
    && [...value].every(([stepId, piece]) => Number.isSafeInteger(stepId) && stepId > 0 && isPieceSlots(piece, true));
}
