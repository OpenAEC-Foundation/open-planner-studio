// Bron: MPXJ `CompObj`, `Props14` en `MPP14CalendarFactory` als referentie voor de blokformaten van de fixtures (LGPL-2.1, github.com/joniles/mpxj).
import { CfbFile } from '@/services/mpp/cfb';

export const SECTOR = 512;
export const HEADER = 512;
export const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
export const DIR_ENTRY = 128;

export interface CfbHeaderOpts {
  numFatSectors: number;
  firstDirSector: number;
  firstMiniFatSector: number;
  numMiniFatSectors: number;
  majorVersion?: number;
  sectorShift?: number;
  miniSectorShift?: number;
  miniStreamCutoff?: number;
  firstDifatSector?: number;
  numDifatSectors?: number;
}

export function writeCfbHeader(view: DataView, opts: CfbHeaderOpts): void {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  CFB_MAGIC.forEach((b, i) => (bytes[i] = b));
  view.setUint16(26, opts.majorVersion ?? 3, true);
  view.setUint16(30, opts.sectorShift ?? 9, true);
  view.setUint16(32, opts.miniSectorShift ?? 6, true);
  view.setUint32(44, opts.numFatSectors, true);
  view.setUint32(48, opts.firstDirSector, true);
  view.setUint32(56, opts.miniStreamCutoff ?? 4096, true);
  view.setUint32(60, opts.firstMiniFatSector, true);
  view.setUint32(64, opts.numMiniFatSectors, true);
  view.setUint32(68, opts.firstDifatSector ?? 0xfffffffe, true);
  view.setUint32(72, opts.numDifatSectors ?? 0, true);
  for (let i = 0; i < 109; i++) view.setUint32(76 + i * 4, i === 0 ? 0 : 0xffffffff, true);
}

export function writeDirEntryName(view: DataView, entryBase: number, name: string): void {
  for (let c = 0; c < name.length; c++) view.setUint16(entryBase + c * 2, name.charCodeAt(c), true);
  view.setUint16(entryBase + 64, (name.length + 1) * 2, true);
}

export function buildSyntheticCfb(): { bytes: Uint8Array; streamA: Uint8Array; streamB: Uint8Array } {
  const totalSectors = 19;
  const buf = new ArrayBuffer(HEADER + totalSectors * SECTOR);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  const streamA = new Uint8Array(4095);
  for (let i = 0; i < streamA.length; i++) streamA[i] = i & 0xff;
  const streamB = new Uint8Array(4096);
  for (let i = 0; i < streamB.length; i++) streamB[i] = (255 - (i & 0xff)) & 0xff;

  writeCfbHeader(view, { numFatSectors: 1, firstDirSector: 1, firstMiniFatSector: 2, numMiniFatSectors: 1 });

  const sectorOff = (n: number) => HEADER + n * SECTOR;

  const fat = new Array<number>(128).fill(0xffffffff);
  fat[0] = 0xfffffffd;
  fat[1] = 0xfffffffe;
  fat[2] = 0xfffffffe;
  for (let s = 3; s <= 9; s++) fat[s] = s + 1;
  fat[10] = 0xfffffffe;
  for (let s = 11; s <= 17; s++) fat[s] = s + 1;
  fat[18] = 0xfffffffe;
  fat.forEach((v, i) => view.setUint32(sectorOff(0) + i * 4, v, true));

  const dirOff = sectorOff(1);
  writeDirEntryName(view, dirOff, 'Root Entry');
  view.setUint8(dirOff + 66, 5);
  view.setUint32(dirOff + 68, 0xffffffff, true);
  view.setUint32(dirOff + 72, 0xffffffff, true);
  view.setUint32(dirOff + 76, 1, true);
  view.setUint32(dirOff + 116, 3, true);
  view.setUint32(dirOff + 120, 4096, true);
  const e1 = dirOff + 128;
  writeDirEntryName(view, e1, 'StreamA');
  view.setUint8(e1 + 66, 2);
  view.setUint32(e1 + 68, 0xffffffff, true);
  view.setUint32(e1 + 72, 2, true);
  view.setUint32(e1 + 76, 0xffffffff, true);
  view.setUint32(e1 + 116, 0, true);
  view.setUint32(e1 + 120, streamA.length, true);
  const e2 = dirOff + 256;
  writeDirEntryName(view, e2, 'StreamB');
  view.setUint8(e2 + 66, 2);
  view.setUint32(e2 + 68, 0xffffffff, true);
  view.setUint32(e2 + 72, 0xffffffff, true);
  view.setUint32(e2 + 76, 0xffffffff, true);
  view.setUint32(e2 + 116, 11, true);
  view.setUint32(e2 + 120, streamB.length, true);

  const mfOff = sectorOff(2);
  for (let i = 0; i < 64; i++) view.setUint32(mfOff + i * 4, i === 63 ? 0xfffffffe : i + 1, true);
  for (let i = 64; i < 128; i++) view.setUint32(mfOff + i * 4, 0xffffffff, true);

  bytes.set(streamA, sectorOff(3));
  bytes.set(streamB, sectorOff(11));

  return { bytes, streamA, streamB };
}

export function buildDuplicateSiblingCfb(levels: number): Uint8Array {
  const dirSectors = Math.ceil(((levels + 1) * DIR_ENTRY) / SECTOR);
  const totalSectors = 1 + dirSectors;
  const buf = new ArrayBuffer(HEADER + totalSectors * SECTOR);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  writeCfbHeader(view, {
    numFatSectors: 1,
    firstDirSector: 1,
    firstMiniFatSector: 0xfffffffe,
    numMiniFatSectors: 0,
  });

  const sectorOff = (n: number) => HEADER + n * SECTOR;

  const fat = new Array<number>(128).fill(0xffffffff);
  fat[0] = 0xfffffffd;
  for (let s = 1; s <= dirSectors; s++) fat[s] = s === dirSectors ? 0xfffffffe : s + 1;
  fat.forEach((v, i) => view.setUint32(sectorOff(0) + i * 4, v, true));

  const entryOffset = (idx: number) => sectorOff(1) + idx * DIR_ENTRY;

  const rootBase = entryOffset(0);
  writeDirEntryName(view, rootBase, 'Root Entry');
  view.setUint8(rootBase + 66, 5);
  view.setUint32(rootBase + 68, 0xffffffff, true);
  view.setUint32(rootBase + 72, 0xffffffff, true);
  view.setUint32(rootBase + 76, 1, true);

  for (let i = 1; i <= levels; i++) {
    const base = entryOffset(i);
    writeDirEntryName(view, base, `Dup${i}`);
    view.setUint8(base + 66, 2);
    const next = i < levels ? i + 1 : 0xffffffff;
    view.setUint32(base + 68, next, true);
    view.setUint32(base + 72, next, true);
    view.setUint32(base + 76, 0xffffffff, true);
    view.setUint32(base + 116, 0xfffffffe, true);
    view.setUint32(base + 120, 0, true);
  }

  return bytes;
}

export function buildTwoRootStreamsCfb(nameA: string, dataA: Uint8Array, nameB: string, dataB: Uint8Array): Uint8Array {
  const MINI = 64;
  const minisectorsFor = (len: number) => Math.max(1, Math.ceil(len / MINI));
  const miniCountA = minisectorsFor(dataA.length);
  const miniCountB = minisectorsFor(dataB.length);
  if (miniCountA + miniCountB > 128) {
    throw new Error('buildTwoRootStreamsCfb: fixture te groot voor één mini-FAT-sector');
  }
  const ministreamBytes = (miniCountA + miniCountB) * MINI;
  const ministreamSectors = Math.max(1, Math.ceil(ministreamBytes / SECTOR));
  const totalSectors = 3 + ministreamSectors;

  const buf = new ArrayBuffer(HEADER + totalSectors * SECTOR);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  writeCfbHeader(view, { numFatSectors: 1, firstDirSector: 1, firstMiniFatSector: 2, numMiniFatSectors: 1 });

  const sectorOff = (n: number) => HEADER + n * SECTOR;

  const fat = new Array<number>(128).fill(0xffffffff);
  fat[0] = 0xfffffffd;
  fat[1] = 0xfffffffe;
  fat[2] = 0xfffffffe;
  for (let s = 3; s < 3 + ministreamSectors - 1; s++) fat[s] = s + 1;
  fat[3 + ministreamSectors - 1] = 0xfffffffe;
  fat.forEach((v, i) => view.setUint32(sectorOff(0) + i * 4, v, true));

  const dirOff = sectorOff(1);
  writeDirEntryName(view, dirOff, 'Root Entry');
  view.setUint8(dirOff + 66, 5);
  view.setUint32(dirOff + 68, 0xffffffff, true);
  view.setUint32(dirOff + 72, 0xffffffff, true);
  view.setUint32(dirOff + 76, 1, true);
  view.setUint32(dirOff + 116, 3, true);
  view.setUint32(dirOff + 120, ministreamBytes, true);

  const e1 = dirOff + 128;
  writeDirEntryName(view, e1, nameA);
  view.setUint8(e1 + 66, 2);
  view.setUint32(e1 + 68, 0xffffffff, true);
  view.setUint32(e1 + 72, 2, true);
  view.setUint32(e1 + 76, 0xffffffff, true);
  view.setUint32(e1 + 116, 0, true);
  view.setUint32(e1 + 120, dataA.length, true);

  const e2 = dirOff + 256;
  writeDirEntryName(view, e2, nameB);
  view.setUint8(e2 + 66, 2);
  view.setUint32(e2 + 68, 0xffffffff, true);
  view.setUint32(e2 + 72, 0xffffffff, true);
  view.setUint32(e2 + 76, 0xffffffff, true);
  view.setUint32(e2 + 116, miniCountA, true);
  view.setUint32(e2 + 120, dataB.length, true);

  const mfOff = sectorOff(2);
  for (let i = 0; i < 128; i++) view.setUint32(mfOff + i * 4, 0xffffffff, true);
  for (let i = 0; i < miniCountA; i++) {
    view.setUint32(mfOff + i * 4, i === miniCountA - 1 ? 0xfffffffe : i + 1, true);
  }
  for (let i = 0; i < miniCountB; i++) {
    const idx = miniCountA + i;
    view.setUint32(mfOff + idx * 4, i === miniCountB - 1 ? 0xfffffffe : idx + 1, true);
  }

  bytes.set(dataA, sectorOff(3));
  bytes.set(dataB, sectorOff(3) + miniCountA * MINI);

  return bytes;
}

export interface CfbTreeNode {
  data?: Uint8Array;
  children?: Record<string, CfbTreeNode>;
}

export function buildNestedCfb(root: Record<string, CfbTreeNode>): Uint8Array {
  interface FlatEntry {
    id: number;
    name: string;
    type: 'storage' | 'stream';
    data: Uint8Array | null;
    childIds: number[];
  }
  const entries: FlatEntry[] = [{ id: 0, name: 'Root Entry', type: 'storage', data: null, childIds: [] }];

  function addChildren(parentId: number, children: Record<string, CfbTreeNode>): void {
    const ids: number[] = [];
    for (const [name, node] of Object.entries(children)) {
      if ((node.data !== undefined) === (node.children !== undefined)) {
        throw new Error(`buildNestedCfb: knoop "${name}" moet precies één van data/children hebben`);
      }
      const id = entries.length;
      const isStream = node.data !== undefined;
      entries.push({ id, name, type: isStream ? 'stream' : 'storage', data: isStream ? node.data! : null, childIds: [] });
      ids.push(id);
      if (!isStream && node.children) addChildren(id, node.children);
    }
    entries[parentId].childIds = ids;
  }
  addChildren(0, root);

  const MINI_CUTOFF = 4096;

  const MINI = 64;
  const minisectorsFor = (len: number) => Math.max(0, Math.ceil(len / MINI));
  let miniCursor = 0;
  const miniStart = new Map<number, number>();
  for (const e of entries) {
    if (e.type !== 'stream' || !e.data || e.data.length >= MINI_CUTOFF) continue;
    const count = minisectorsFor(e.data.length);
    if (count === 0) continue;
    miniStart.set(e.id, miniCursor);
    miniCursor += count;
  }
  const totalMinisectors = miniCursor;
  if (totalMinisectors > 128) {
    throw new Error(`buildNestedCfb: ${totalMinisectors} minisectoren nodig, max 128 ondersteund (1 mini-FAT-sector)`);
  }
  const ministreamBytes = totalMinisectors * MINI;
  const ministreamSectors = totalMinisectors > 0 ? Math.max(1, Math.ceil(ministreamBytes / SECTOR)) : 0;

  const dirEntryCount = entries.length;
  const dirSectors = Math.max(1, Math.ceil((dirEntryCount * DIR_ENTRY) / SECTOR));
  const miniFatSectors = totalMinisectors > 0 ? 1 : 0;

  const firstDirSector = 1;
  const firstMiniFatSector = firstDirSector + dirSectors;
  const firstMiniStreamSector = firstMiniFatSector + miniFatSectors;

  const largeSectorsFor = (len: number) => Math.max(1, Math.ceil(len / SECTOR));
  const largeStart = new Map<number, number>();
  const largeSectorCount = new Map<number, number>();
  let largeCursor = firstMiniStreamSector + ministreamSectors;
  for (const e of entries) {
    if (e.type !== 'stream' || !e.data || e.data.length < MINI_CUTOFF) continue;
    const count = largeSectorsFor(e.data.length);
    largeStart.set(e.id, largeCursor);
    largeSectorCount.set(e.id, count);
    largeCursor += count;
  }
  const totalSectors = largeCursor;
  if (totalSectors > 128) {
    throw new Error(`buildNestedCfb: ${totalSectors} sectoren nodig, max 128 ondersteund (1 FAT-sector)`);
  }

  const buf = new ArrayBuffer(HEADER + totalSectors * SECTOR);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  writeCfbHeader(view, {
    numFatSectors: 1,
    firstDirSector,
    firstMiniFatSector: miniFatSectors > 0 ? firstMiniFatSector : 0xfffffffe,
    numMiniFatSectors: miniFatSectors,
  });

  const sectorOff = (n: number) => HEADER + n * SECTOR;

  const fat = new Array<number>(128).fill(0xffffffff);
  fat[0] = 0xfffffffd;
  for (let s = firstDirSector; s < firstDirSector + dirSectors; s++) {
    fat[s] = s === firstDirSector + dirSectors - 1 ? 0xfffffffe : s + 1;
  }
  for (let s = firstMiniFatSector; s < firstMiniFatSector + miniFatSectors; s++) {
    fat[s] = s === firstMiniFatSector + miniFatSectors - 1 ? 0xfffffffe : s + 1;
  }
  for (let s = firstMiniStreamSector; s < firstMiniStreamSector + ministreamSectors; s++) {
    fat[s] = s === firstMiniStreamSector + ministreamSectors - 1 ? 0xfffffffe : s + 1;
  }
  for (const [id, start] of largeStart) {
    const count = largeSectorCount.get(id)!;
    for (let i = 0; i < count; i++) {
      fat[start + i] = i === count - 1 ? 0xfffffffe : start + i + 1;
    }
  }
  fat.forEach((v, i) => view.setUint32(sectorOff(0) + i * 4, v, true));

  for (const e of entries) {
    const base = sectorOff(firstDirSector) + e.id * DIR_ENTRY;
    writeDirEntryName(view, base, e.name);
    view.setUint8(base + 66, e.id === 0 ? 5 : e.type === 'storage' ? 1 : 2);
    view.setUint32(base + 68, 0xffffffff, true);
    view.setUint32(base + 72, 0xffffffff, true);
    view.setUint32(base + 76, e.childIds.length > 0 ? e.childIds[0] : 0xffffffff, true);
    if (e.id === 0) {
      view.setUint32(base + 116, ministreamSectors > 0 ? firstMiniStreamSector : 0xfffffffe, true);
      view.setUint32(base + 120, ministreamBytes, true);
    } else if (e.type === 'stream') {
      const largeS = largeStart.get(e.id);
      const miniS = miniStart.get(e.id);
      const start = largeS !== undefined ? largeS : miniS;
      view.setUint32(base + 116, start !== undefined ? start : 0xfffffffe, true);
      view.setUint32(base + 120, e.data!.length, true);
    } else {
      view.setUint32(base + 116, 0xfffffffe, true);
      view.setUint32(base + 120, 0, true);
    }
  }
  for (const e of entries) {
    for (let i = 0; i < e.childIds.length - 1; i++) {
      const base = sectorOff(firstDirSector) + e.childIds[i] * DIR_ENTRY;
      view.setUint32(base + 72, e.childIds[i + 1], true);
    }
  }

  if (miniFatSectors > 0) {
    const mfOff = sectorOff(firstMiniFatSector);
    for (let i = 0; i < 128; i++) view.setUint32(mfOff + i * 4, 0xffffffff, true);
    for (const e of entries) {
      if (e.type !== 'stream' || !e.data) continue;
      const start = miniStart.get(e.id);
      if (start === undefined) continue;
      const count = minisectorsFor(e.data.length);
      for (let i = 0; i < count; i++) {
        view.setUint32(mfOff + (start + i) * 4, i === count - 1 ? 0xfffffffe : start + i + 1, true);
      }
    }
  }

  for (const e of entries) {
    if (e.type !== 'stream' || !e.data) continue;
    const miniS = miniStart.get(e.id);
    if (miniS !== undefined) {
      bytes.set(e.data, sectorOff(firstMiniStreamSector) + miniS * MINI);
      continue;
    }
    const largeS = largeStart.get(e.id);
    if (largeS !== undefined) bytes.set(e.data, sectorOff(largeS));
  }

  return bytes;
}

export function encodeAsciiWithTerminator(s: string): Uint8Array {
  const out = new Uint8Array(s.length + 1);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  out[s.length] = 0;
  return out;
}

export function encodeCompObjFileFormat(fileFormat: string, applicationName = 'OPS synthetic'): Uint8Array {
  const nameBytes = encodeAsciiWithTerminator(applicationName);
  const fmtBytes = encodeAsciiWithTerminator(fileFormat);
  const out = new Uint8Array(28 + 4 + nameBytes.length + 4 + fmtBytes.length + 4);
  const view = new DataView(out.buffer);
  let pos = 28;
  view.setInt32(pos, nameBytes.length, true);
  pos += 4;
  out.set(nameBytes, pos);
  pos += nameBytes.length;
  view.setInt32(pos, fmtBytes.length, true);
  pos += 4;
  out.set(fmtBytes, pos);
  pos += fmtBytes.length;
  view.setInt32(pos, 0, true);
  return out;
}

export function encodePropsEntries(entries: { key: number; data: Uint8Array }[]): Uint8Array {
  let bodyLen = 0;
  for (const e of entries) bodyLen += 12 + e.data.length + (e.data.length % 2 !== 0 ? 1 : 0);
  const out = new Uint8Array(16 + bodyLen);
  const view = new DataView(out.buffer);
  view.setUint16(12, entries.length, true);
  let pos = 16;
  for (const e of entries) {
    view.setInt32(pos, e.data.length, true);
    view.setInt32(pos + 4, e.key, true);
    view.setInt32(pos + 8, 0, true);
    pos += 12;
    out.set(e.data, pos);
    pos += e.data.length;
    if (e.data.length % 2 !== 0) pos += 1;
  }
  return out;
}

export function encodePropsSingleByteEntry(key: number, valueByte: number): Uint8Array {
  return encodePropsEntries([{ key, data: Uint8Array.of(valueByte) }]);
}

const VAR_META_MAGIC = 0xfadfadba;

export function buildVarMetaBytes(
  entries: { uniqueId: number; offset: number; type: number }[],
  itemCountClaim = entries.length,
  dataSize = 0,
): Uint8Array {
  const out = new Uint8Array(24 + entries.length * 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, VAR_META_MAGIC, true);
  view.setInt32(8, itemCountClaim, true);
  view.setUint32(20, dataSize, true);
  let pos = 24;
  for (const e of entries) {
    view.setInt32(pos, e.uniqueId, true);
    view.setInt32(pos + 4, e.offset, true);
    view.setUint16(pos + 8, e.type, true);
    pos += 12;
  }
  return out;
}

const DEFAULT_TIME_LIMIT_MS = 2000;

function expectPrefixedError(
  truthy: (label: string, cond: boolean) => void,
  prefix: string,
  label: string,
  run: () => void,
  timeLimitMs: number,
): void {
  const start = Date.now();
  let threw = false;
  let message = '';
  try {
    run();
  } catch (err) {
    threw = true;
    message = err instanceof Error ? err.message : String(err);
    if (prefix === 'CFB') {
      truthy(`${label}: herkenbare containerfout voor de UI`, (err as { cfbCode?: string })?.cfbCode === 'CFB_INVALID');
    }
  }
  const elapsedMs = Date.now() - start;
  truthy(`${label}: binnen tijdslimiet (${elapsedMs}ms < ${timeLimitMs}ms)`, elapsedMs < timeLimitMs);
  truthy(`${label}: gooit`, threw);
  truthy(`${label}: nette ${prefix}:-foutmelding (geen RangeError e.d.)`, message.startsWith(`${prefix}:`));
}

export function expectCfbError(
  truthy: (label: string, cond: boolean) => void,
  label: string,
  run: () => void,
  timeLimitMs = DEFAULT_TIME_LIMIT_MS,
): void {
  expectPrefixedError(truthy, 'CFB', label, run, timeLimitMs);
}

export function expectMppError(
  truthy: (label: string, cond: boolean) => void,
  label: string,
  run: () => void,
  timeLimitMs = DEFAULT_TIME_LIMIT_MS,
): void {
  expectPrefixedError(truthy, 'MPP', label, run, timeLimitMs);
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function buildTwoRootStreamsCfbFile(nameA: string, dataA: Uint8Array, nameB: string, dataB: Uint8Array): CfbFile {
  return new CfbFile(buildTwoRootStreamsCfb(nameA, dataA, nameB, dataB));
}

const CAL_FIXED_META_MAGIC = 0xfadfadba;

export function buildCalFixedMetaBlob(offsets: number[]): Uint8Array {
  const out = new Uint8Array(16 + offsets.length * 10);
  const view = new DataView(out.buffer);
  view.setUint32(0, CAL_FIXED_META_MAGIC, true);
  view.setInt32(8, offsets.length, true);
  offsets.forEach((offsetIntoFixedData, i) => view.setInt32(16 + i * 10 + 4, offsetIntoFixedData, true));
  return out;
}

export function buildCalFixedDataRecord(calendarId: number, baseCalendarId: number, resourceId: number): Uint8Array {
  const out = new Uint8Array(12);
  const view = new DataView(out.buffer);
  view.setInt32(0, calendarId, true);
  view.setInt32(4, baseCalendarId, true);
  view.setInt32(8, resourceId, true);
  return out;
}

export function writeCalDayBlock(view: DataView, dayOffset: number, opts: { defaultFlag?: 0 | 1; bands?: { startMinutes: number; durationMinutes: number }[] }): void {
  view.setInt16(dayOffset, opts.defaultFlag ?? 0, true);
  const bands = opts.bands ?? [];
  view.setInt16(dayOffset + 2, bands.length, true);
  bands.forEach((b, i) => {
    view.setInt16(dayOffset + 8 + i * 2, b.startMinutes * 10, true);
    view.setInt16(dayOffset + 20 + i * 4, b.durationMinutes * 10, true);
  });
}

export function buildCalHoursBlock(days: { defaultFlag?: 0 | 1; bands?: { startMinutes: number; durationMinutes: number }[] }[]): Uint8Array {
  const out = new Uint8Array(420);
  const view = new DataView(out.buffer);
  days.forEach((d, i) => writeCalDayBlock(view, i * 60, d));
  return out;
}

export function buildCalExceptionsTail(exceptions: { fromDay: number; toDay: number; recurrenceTypeValue?: number; freq76?: number }[]): Uint8Array {
  const bodyLen = exceptions.length * 92;
  const out = new Uint8Array(4 + bodyLen);
  const view = new DataView(out.buffer);
  view.setInt16(0, exceptions.length, true);
  let pos = 4;
  for (const exc of exceptions) {
    view.setInt16(pos, exc.fromDay, true);
    view.setInt16(pos + 2, exc.toDay, true);
    view.setInt16(pos + 14, 0, true);
    view.setInt16(pos + 72, exc.recurrenceTypeValue ?? 1, true);
    view.setInt16(pos + 76, exc.freq76 ?? 256, true);
    view.setInt32(pos + 88, 0, true);
    pos += 92;
  }
  return out;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

export const MPP_NA = 65535;

export function mppTimestampBytes(time: number, days: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint16(0, time, true);
  view.setUint16(2, days, true);
  return out;
}

export function minimalMpp14Bytes(opts: { startDays: number; finishDays: number; projectStartDays: number }): Uint8Array {
  const ascii = (s: string) => {
    const out = new Uint8Array(s.length * 2);
    const view = new DataView(out.buffer);
    for (let i = 0; i < s.length; i++) view.setUint16(i * 2, s.charCodeAt(i), true);
    return out;
  };
  const int32 = (v: number) => { const o = new Uint8Array(4); new DataView(o.buffer).setInt32(0, v, true); return o; };
  const props = encodePropsEntries([
    { key: 37748738, data: mppTimestampBytes(0, opts.projectStartDays) },
    { key: 37748739, data: mppTimestampBytes(0, opts.projectStartDays + 30) },
    { key: 37748765, data: int32(480) },
    { key: 37748744, data: ascii('Fixture') },
  ]);
  const record = new Uint8Array(130);
  const rv = new DataView(record.buffer);
  rv.setInt32(0, 10, true); rv.setInt32(4, 1, true); rv.setInt16(40, 1, true);
  rv.setInt32(42, 3 * 4800, true);
  rv.setInt16(56, 0, true);
  rv.setUint16(64, 0, true); rv.setUint16(66, opts.startDays, true);
  rv.setUint16(68, 0, true); rv.setUint16(70, opts.finishDays, true);
  rv.setInt32(118, -1, true);
  const itemSize = 47, items = 4;
  const meta = new Uint8Array(16 + items * itemSize);
  const mv = new DataView(meta.buffer);
  mv.setUint32(0, 0xfadfadba, true); mv.setInt32(8, items, true);
  mv.setInt32(16 + 3 * itemSize, 0, true); mv.setInt32(16 + 3 * itemSize + 4, 0, true);
  const nameBytes = ascii('B');
  const var2 = new Uint8Array(4 + nameBytes.length);
  new DataView(var2.buffer).setInt32(0, nameBytes.length, true);
  var2.set(nameBytes, 4);
  const tree: Record<string, CfbTreeNode> = {
    '\x01CompObj': { data: encodeCompObjFileFormat('MSProject.MPP14') },
    Props14: { data: encodePropsSingleByteEntry(893386752, 0) },
    '   114': {
      children: {
        Props: { data: props },
        TBkndTask: {
          children: {
            FixedMeta: { data: meta },
            FixedData: { data: record },
            VarMeta: { data: buildVarMetaBytes([{ uniqueId: 10, offset: 0, type: 14 }]) },
            Var2Data: { data: var2 },
          },
        },
      },
    },
  };
  return buildNestedCfb(tree);
}
