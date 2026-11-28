// Bron: MPXJ van Jon Iles e.a., structuurkennis en veldconstanten geport naar TypeScript (LGPL-2.1, github.com/joniles/mpxj).

import { MS_PER_DAY } from '@/utils/dateUtils';

function boundsError(kind: string, offset: number, length: number, dataLen: number, ctx?: string): Error {
  const bits = [`MPP: ${kind} buiten grenzen (offset=${offset}, lengte=${length}, bufferlengte=${dataLen})`];
  if (ctx) bits.push(`[${ctx}]`);
  return new Error(bits.join(' '));
}

export function getShort(data: Uint8Array, offset: number, ctx?: string): number {
  if (offset < 0 || offset + 2 > data.length) {
    throw boundsError('getShort', offset, 2, data.length, ctx);
  }
  return data[offset] | (data[offset + 1] << 8);
}

export function getInt(data: Uint8Array, offset: number, ctx?: string): number {
  if (offset < 0 || offset + 4 > data.length) {
    throw boundsError('getInt', offset, 4, data.length, ctx);
  }
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
}

const BLOCK_MAGIC = 0xfadfadba | 0;

const FIXED_META_HEADER_SIZE = 16;

export class FixedMeta {
  private readonly clampedItemCount: number;
  private readonly items: ReadonlyArray<Uint8Array | null>;

  private constructor(clampedItemCount: number, items: ReadonlyArray<Uint8Array | null>) {
    this.clampedItemCount = clampedItemCount;
    this.items = items;
  }

  static withItemSize(bytes: Uint8Array, itemSize: number, label = 'FixedMeta'): FixedMeta {
    if (itemSize <= 0) {
      throw new Error(`MPP: FixedMeta[${label}] ongeldige itemSize ${itemSize}`);
    }
    if (bytes.length < FIXED_META_HEADER_SIZE) {
      throw new Error(
        `MPP: FixedMeta[${label}] te klein voor header (${bytes.length} bytes, minimaal ${FIXED_META_HEADER_SIZE})`,
      );
    }
    const magic = getInt(bytes, 0, `FixedMeta[${label}]`);
    if (magic !== BLOCK_MAGIC) {
      throw new Error(`MPP: FixedMeta[${label}] ongeldig magic-getal (0x${(magic >>> 0).toString(16)})`);
    }
    const adjustedItemCount = Math.max(0, Math.floor((bytes.length - FIXED_META_HEADER_SIZE) / itemSize));
    const clampedItemCount = Math.max(0, Math.min(getInt(bytes, 8, `FixedMeta[${label}]`), adjustedItemCount));
    const items: (Uint8Array | null)[] = new Array(adjustedItemCount);
    let pos = FIXED_META_HEADER_SIZE;
    for (let i = 0; i < adjustedItemCount; i++) {
      items[i] = bytes.subarray(pos, pos + itemSize);
      pos += itemSize;
    }
    return new FixedMeta(clampedItemCount, items);
  }

  static withHeuristicItemSize(
    bytes: Uint8Array,
    otherFixedBlock: FixedData,
    itemSizes: number[],
    label = 'FixedMeta',
  ): FixedMeta {
    if (itemSizes.length === 0) {
      throw new Error(`MPP: FixedMeta[${label}] heuristiek heeft minstens één itemSize nodig`);
    }
    if (bytes.length < FIXED_META_HEADER_SIZE) {
      throw new Error(
        `MPP: FixedMeta[${label}] te klein voor header (${bytes.length} bytes, minimaal ${FIXED_META_HEADER_SIZE})`,
      );
    }
    const rawItemCountHint = getInt(bytes, 8, `FixedMeta[${label}] (heuristiek)`);
    const available = bytes.length - FIXED_META_HEADER_SIZE;
    const otherCount = otherFixedBlock.getItemCount();

    let chosen = itemSizes[0];
    let distance = -Infinity;
    for (const testSize of itemSizes) {
      if (testSize <= 0 || available % testSize !== 0) continue;
      if (available / testSize === otherCount) {
        chosen = testSize;
        break;
      }
      const testDistance = rawItemCountHint * testSize - available;
      if (testDistance <= 0 && testDistance > distance) {
        chosen = testSize;
        distance = testDistance;
      }
    }
    return FixedMeta.withItemSize(bytes, chosen, label);
  }

  getItemCount(): number {
    return this.clampedItemCount;
  }

  getAdjustedItemCount(): number {
    return this.items.length;
  }

  getByteArrayValue(index: number): Uint8Array | null {
    if (index < 0 || index >= this.items.length) return null;
    return this.items[index];
  }
}

export class FixedData {
  private readonly items: ReadonlyArray<Uint8Array | null>;
  private readonly indexByOffset: Map<number, number>;

  private constructor(items: ReadonlyArray<Uint8Array | null>, offsets: ReadonlyArray<number>) {
    this.items = items;
    this.indexByOffset = new Map();
    for (let i = 0; i < offsets.length; i++) {
      if (!this.indexByOffset.has(offsets[i])) this.indexByOffset.set(offsets[i], i);
    }
  }

  static fromMeta(meta: FixedMeta, bytes: Uint8Array, maxExpectedSize = 0, minSize = 0, label = 'FixedData'): FixedData {
    const itemCount = meta.getAdjustedItemCount();
    const items: (Uint8Array | null)[] = new Array(itemCount).fill(null);
    const offsets: number[] = new Array(itemCount).fill(0);
    const ctx = `FixedData[${label}]`;

    for (let i = 0; i < itemCount; i++) {
      const metaData = meta.getByteArrayValue(i);
      if (!metaData || metaData.length < 8) continue;
      const itemOffset = getInt(metaData, 4, ctx);
      if (itemOffset < 0 || itemOffset > bytes.length) continue;

      let itemSize: number;
      if (i + 1 === itemCount) {
        itemSize = bytes.length - itemOffset;
      } else {
        const nextMetaData = meta.getByteArrayValue(i + 1);
        const nextItemOffset = nextMetaData && nextMetaData.length >= 8 ? getInt(nextMetaData, 4, ctx) : itemOffset;
        itemSize = nextItemOffset - itemOffset;
      }
      if (itemSize === 0) itemSize = minSize;

      const available = bytes.length - itemOffset;
      if (itemSize < 0 || itemSize > available) {
        itemSize = maxExpectedSize === 0 ? available : Math.min(maxExpectedSize, available);
      }
      if (maxExpectedSize !== 0 && itemSize > maxExpectedSize) {
        itemSize = maxExpectedSize;
      }

      if (itemSize > 0) {
        items[i] = bytes.subarray(itemOffset, itemOffset + itemSize);
        offsets[i] = itemOffset;
      }
    }
    return new FixedData(items, offsets);
  }

  static withItemSizeOverride(meta: FixedMeta, itemSize: number, bytes: Uint8Array, label = 'FixedData'): FixedData {
    const itemCount = meta.getAdjustedItemCount();
    const items: (Uint8Array | null)[] = new Array(itemCount).fill(null);
    const offsets: number[] = new Array(itemCount).fill(0);
    const ctx = `FixedData[${label}]`;

    for (let i = 0; i < itemCount; i++) {
      const metaData = meta.getByteArrayValue(i);
      if (!metaData || metaData.length < 8) continue;
      const itemOffset = getInt(metaData, 4, ctx);
      if (itemOffset < 0 || itemOffset > bytes.length) continue;
      const available = bytes.length - itemOffset;
      const size = itemSize < 0 ? available : Math.min(itemSize, available);
      items[i] = bytes.subarray(itemOffset, itemOffset + size);
      offsets[i] = itemOffset;
    }
    return new FixedData(items, offsets);
  }

  static withoutMeta(itemSize: number, bytes: Uint8Array, label = 'FixedData'): FixedData {
    if (itemSize <= 0) {
      throw new Error(`MPP: FixedData[${label}].withoutMeta ongeldige itemSize ${itemSize}`);
    }
    const itemCount = Math.floor(bytes.length / itemSize);
    const items: (Uint8Array | null)[] = new Array(itemCount);
    const offsets: number[] = new Array(itemCount);
    let offset = 0;
    for (let i = 0; i < itemCount; i++) {
      items[i] = bytes.subarray(offset, offset + itemSize);
      offsets[i] = offset;
      offset += itemSize;
    }
    return new FixedData(items, offsets);
  }

  getItemCount(): number {
    return this.items.length;
  }

  getByteArrayValue(index: number): Uint8Array | null {
    if (index < 0 || index >= this.items.length) return null;
    return this.items[index];
  }

  getIndexFromOffset(offset: number): number {
    return this.indexByOffset.get(offset) ?? -1;
  }
}

const VAR_META_HEADER_SIZE = 24;
const VAR_META_ENTRY_SIZE = 12;

export class VarMeta12 {
  private readonly itemCount: number;
  private readonly dataSize: number;
  private readonly sortedOffsets: ReadonlyArray<number>;
  private readonly table = new Map<number, Map<number, number>>();

  constructor(bytes: Uint8Array, label = 'VarMeta') {
    const ctx = `VarMeta[${label}]`;
    if (bytes.length < VAR_META_HEADER_SIZE) {
      throw new Error(
        `MPP: VarMeta[${label}] te klein voor header (${bytes.length} bytes, minimaal ${VAR_META_HEADER_SIZE})`,
      );
    }
    const magic = getInt(bytes, 0, ctx);
    if (magic !== 0 && magic !== BLOCK_MAGIC) {
      throw new Error(`MPP: VarMeta[${label}] ongeldig magic-getal (0x${(magic >>> 0).toString(16)})`);
    }
    const maxEntries = Math.floor((bytes.length - VAR_META_HEADER_SIZE) / VAR_META_ENTRY_SIZE);
    this.itemCount = Math.max(0, Math.min(getInt(bytes, 8, ctx), maxEntries));
    this.dataSize = getInt(bytes, 20, ctx);

    const offsets: number[] = new Array(this.itemCount).fill(0);
    let pos = VAR_META_HEADER_SIZE;
    for (let i = 0; i < this.itemCount; i++) {
      if (bytes.length - pos < VAR_META_ENTRY_SIZE) break;
      const uniqueId = getInt(bytes, pos, ctx);
      const offset = getInt(bytes, pos + 4, ctx);
      const type = getShort(bytes, pos + 8, ctx);
      pos += VAR_META_ENTRY_SIZE;

      let byType = this.table.get(uniqueId);
      if (!byType) {
        byType = new Map();
        this.table.set(uniqueId, byType);
      }
      byType.set(type, offset);
      offsets[i] = offset;
    }
    offsets.sort((a, b) => a - b);
    this.sortedOffsets = offsets;
  }

  getItemCount(): number {
    return this.itemCount;
  }

  getDataSize(): number {
    return this.dataSize;
  }

  getOffsets(): ReadonlyArray<number> {
    return this.sortedOffsets;
  }

  getOffset(uniqueId: number, type: number): number | null {
    return this.table.get(uniqueId)?.get(type) ?? null;
  }

  containsKey(uniqueId: number): boolean {
    return this.table.has(uniqueId);
  }

  getTypes(uniqueId: number): Set<number> {
    const byType = this.table.get(uniqueId);
    return byType ? new Set(byType.keys()) : new Set();
  }

  getUniqueIdentifierArray(): number[] {
    return Array.from(this.table.keys()).sort((a, b) => a - b);
  }

  getUniqueIdentifierSet(): Set<number> {
    return new Set(this.getUniqueIdentifierArray());
  }
}

export class Var2Data {
  private readonly meta: VarMeta12;
  private readonly map = new Map<number, Uint8Array>();

  constructor(meta: VarMeta12, bytes: Uint8Array | null) {
    this.meta = meta;
    if (!bytes) return;
    const available = bytes.length;

    for (const itemOffset of meta.getOffsets()) {
      if (itemOffset < 0 || itemOffset >= available) continue;
      if (this.map.has(itemOffset)) continue;
      if (itemOffset + 4 > available) continue;
      const size = getInt(bytes, itemOffset);
      if (size < 0 || itemOffset + 4 + size > available) continue;
      this.map.set(itemOffset, bytes.subarray(itemOffset + 4, itemOffset + 4 + size));
    }
  }

  getByteArrayByOffset(offset: number | null): Uint8Array | null {
    if (offset === null) return null;
    return this.map.get(offset) ?? null;
  }

  getByteArray(uniqueId: number, type: number): Uint8Array | null {
    return this.getByteArrayByOffset(this.meta.getOffset(uniqueId, type));
  }

  getUnicodeString(uniqueId: number, type: number, maxLength?: number, ctx?: string): string | null {
    const data = this.getByteArray(uniqueId, type);
    return data ? getUnicodeString(data, 0, maxLength, ctx) : null;
  }

  getInt(uniqueId: number, type: number, ctx?: string): number {
    const data = this.getByteArray(uniqueId, type);
    return data && data.length >= 4 ? getInt(data, 0, ctx) : 0;
  }

  getShort(uniqueId: number, type: number, ctx?: string): number {
    const data = this.getByteArray(uniqueId, type);
    return data && data.length >= 2 ? getShort(data, 0, ctx) : 0;
  }

  getTimestamp(uniqueId: number, type: number, ctx?: string): Date | null {
    const data = this.getByteArray(uniqueId, type);
    return data && data.length >= 4 ? getTimestamp(data, 0, ctx) : null;
  }

  getVarMeta(): VarMeta12 {
    return this.meta;
  }
}

const MPP_EPOCH_UTC_MS = Date.UTC(1983, 11, 31);

export function getDouble(data: Uint8Array, offset: number, ctx?: string): number {
  if (offset < 0 || offset + 8 > data.length) {
    throw boundsError('getDouble', offset, 8, data.length, ctx);
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  const value = view.getFloat64(0, true);
  return Number.isFinite(value) ? value : 0;
}

export function getDate(data: Uint8Array, offset: number, ctx?: string): Date | null {
  const days = getShort(data, offset, ctx);
  if (days === 65535) return null;
  return new Date(MPP_EPOCH_UTC_MS + days * MS_PER_DAY);
}

export function getTime(data: Uint8Array, offset: number, ctx?: string): number {
  let seconds = Math.floor(getShort(data, offset, ctx) / 10) * 60;
  if (seconds > 86399) seconds %= 86400;
  return seconds;
}

export function getTimestamp(data: Uint8Array, offset: number, ctx?: string): Date | null {
  const days = getShort(data, offset + 2, ctx);
  if (days <= 1 || days === 65535) return null;
  let time = getShort(data, offset, ctx);
  if (time === 65535) time = 0;
  const result = new Date(MPP_EPOCH_UTC_MS + days * MS_PER_DAY + time * 6000);
  if (days < 100 && result.getUTCSeconds() !== 0) return null;
  return result;
}

const UNICODE_STRING_CHUNK = 8192;

export function getUnicodeString(data: Uint8Array, offset: number, maxLength?: number, ctx?: string): string {
  if (offset < 0) throw boundsError('getUnicodeString', offset, 0, data.length, ctx);
  if (offset >= data.length) return '';
  const scanLimit = maxLength !== undefined && maxLength > 0
    ? Math.min(data.length, offset + maxLength)
    : data.length;
  let length = scanLimit - offset;
  for (let i = offset; i < scanLimit - 1; i += 2) {
    if (data[i] === 0 && data[i + 1] === 0) {
      length = i - offset;
      break;
    }
  }
  if (length <= 0) return '';
  const codeUnits: number[] = [];
  for (let i = 0; i + 1 < length; i += 2) {
    codeUnits.push(data[offset + i] | (data[offset + i + 1] << 8));
  }
  let out = '';
  for (let i = 0; i < codeUnits.length; i += UNICODE_STRING_CHUNK) {
    out += String.fromCharCode(...codeUnits.slice(i, i + UNICODE_STRING_CHUNK));
  }
  return out;
}

export function getGUID(data: Uint8Array, offset: number): string | null {
  if (offset < 0 || offset + 16 > data.length) return null;
  let allZero = true;
  for (let i = 0; i < 16; i++) {
    if (data[offset + i] !== 0) {
      allZero = false;
      break;
    }
  }
  if (allZero) return null;
  const b = (i: number) => data[offset + i];
  const hex2 = (n: number) => n.toString(16).padStart(2, '0');
  const p1 = hex2(b(3)) + hex2(b(2)) + hex2(b(1)) + hex2(b(0));
  const p2 = hex2(b(5)) + hex2(b(4));
  const p3 = hex2(b(7)) + hex2(b(6));
  const p4 = hex2(b(8)) + hex2(b(9));
  const p5 = hex2(b(10)) + hex2(b(11)) + hex2(b(12)) + hex2(b(13)) + hex2(b(14)) + hex2(b(15));
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

export type MppTimeUnit =
  | 'minutes' | 'elapsedMinutes'
  | 'hours' | 'elapsedHours'
  | 'days' | 'elapsedDays'
  | 'weeks' | 'elapsedWeeks'
  | 'months' | 'elapsedMonths'
  | 'percent' | 'elapsedPercent';

const DURATION_UNITS_MASK = 0x1f;

export function getDurationTimeUnits(type: number, projectDefaultDurationUnits?: MppTimeUnit): MppTimeUnit {
  switch (type & DURATION_UNITS_MASK) {
    case 3: return 'minutes';
    case 4: return 'elapsedMinutes';
    case 5: return 'hours';
    case 6: return 'elapsedHours';
    case 7: return 'days';
    case 8: return 'elapsedDays';
    case 9: return 'weeks';
    case 10: return 'elapsedWeeks';
    case 11: return 'months';
    case 12: return 'elapsedMonths';
    case 19: return 'percent';
    case 20: return 'elapsedPercent';
    case 21: return projectDefaultDurationUnits ?? 'days';
    default: return 'days';
  }
}

export function getDuration(value: number, unit: MppTimeUnit): number {
  switch (unit) {
    case 'minutes':
    case 'elapsedMinutes':
      return value / 10;
    case 'hours':
    case 'elapsedHours':
      return value / 600;
    case 'days':
      return value / 4800;
    case 'elapsedDays':
      return value / 14400;
    case 'weeks':
      return value / 24000;
    case 'elapsedWeeks':
      return value / 100800;
    case 'months':
      return value / 96000;
    case 'elapsedMonths':
      return value / 432000;
    default:
      return value;
  }
}
