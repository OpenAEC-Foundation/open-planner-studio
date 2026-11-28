// Bron: MS-CFB-specificatie van Microsoft, ter controle de containerlezer van MPXJ van Jon Iles e.a. (LGPL-2.1, github.com/joniles/mpxj).

export class CfbParseError extends Error {
  readonly cfbCode = 'CFB_INVALID';

  constructor(detail: string) {
    super(detail);
    this.name = 'CfbParseError';
  }
}

const MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const FAT_FREESECT = 0xffffffff;
const FAT_ENDOFCHAIN = 0xfffffffe;

const NOSTREAM = 0xffffffff;

const HEADER_SIZE = 512;
const DIR_ENTRY_SIZE = 128;
const DIFAT_ENTRIES_IN_HEADER = 109;

type DirType = 'unknown' | 'storage' | 'stream' | 'root';

interface RawDirEntry {
  name: string;
  type: DirType;
  left: number;
  right: number;
  child: number;
  startSector: number;
  size: number;
}

export interface CfbEntry {
  name: string;
  type: 'storage' | 'stream';
  size: number;
  readonly startSector: number;
  children: Map<string, CfbEntry>;
}

export class CfbFile {
  readonly root: CfbEntry;

  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  private readonly sectorSize: number;
  private readonly miniSectorSize: number;
  private readonly miniStreamCutoff: number;
  private readonly fat: Uint32Array;
  private readonly miniFat: Uint32Array;
  private readonly miniStreamStartSector: number;
  private readonly miniStreamSize: number;
  private readonly maxSectorSteps: number;
  private readonly maxMiniSteps: number;
  private miniStreamCache: Uint8Array | null = null;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (bytes.byteLength < HEADER_SIZE) {
      throw new CfbParseError(
        `CFB: file too small for a valid header (${bytes.byteLength} bytes, minimum ${HEADER_SIZE})`,
      );
    }
    for (let i = 0; i < MAGIC.length; i++) {
      if (bytes[i] !== MAGIC[i]) {
        throw new CfbParseError('CFB: invalid signature — not a Compound File Binary');
      }
    }

    const majorVersion = this.view.getUint16(26, true);
    if (majorVersion !== 3 && majorVersion !== 4) {
      throw new CfbParseError(`CFB: unknown major version ${majorVersion} (expected 3 or 4)`);
    }
    const sectorShift = this.view.getUint16(30, true);
    const miniSectorShift = this.view.getUint16(32, true);
    const expectedSectorShift = majorVersion === 3 ? 9 : 12;
    if (sectorShift !== expectedSectorShift) {
      throw new CfbParseError(
        `CFB: sectorShift ${sectorShift} does not match major version ${majorVersion} (expected ${expectedSectorShift})`,
      );
    }
    if (miniSectorShift !== 6) {
      throw new CfbParseError(`CFB: unexpected miniSectorShift ${miniSectorShift} (expected 6)`);
    }
    this.sectorSize = 1 << sectorShift;
    this.miniSectorSize = 1 << miniSectorShift;

    const numFatSectors = this.view.getUint32(44, true);
    const firstDirSector = this.view.getUint32(48, true);
    this.miniStreamCutoff = this.view.getUint32(56, true);
    if (this.miniStreamCutoff !== 4096) {
      throw new CfbParseError(`CFB: unexpected miniStreamCutoff ${this.miniStreamCutoff} (expected 4096)`);
    }
    const firstMiniFatSector = this.view.getUint32(60, true);
    const numMiniFatSectors = this.view.getUint32(64, true);
    const firstDifatSector = this.view.getUint32(68, true);
    const numDifatSectors = this.view.getUint32(72, true);

    const maxSectors = Math.ceil(bytes.byteLength / this.sectorSize);
    this.maxSectorSteps = Math.max(16, maxSectors + 16);
    this.maxMiniSteps = Math.max(16, Math.ceil(bytes.byteLength / this.miniSectorSize) + 16);

    const difat = this.readDifat(firstDifatSector, numDifatSectors, numFatSectors, maxSectors);
    this.fat = this.readFat(difat, maxSectors);
    if (this.fat.length === 0 || numFatSectors === 0) {
      throw new CfbParseError('CFB: no FAT sectors found');
    }

    const dirBytes = this.readChain(firstDirSector, undefined, 'directory');
    const rawEntries = this.parseDirectory(dirBytes);

    const rootIdx = rawEntries.findIndex((e) => e.type === 'root');
    if (rootIdx < 0) {
      throw new CfbParseError('CFB: no root directory entry found');
    }
    const rootRaw = rawEntries[rootIdx];
    this.miniStreamStartSector = rootRaw.startSector;
    this.miniStreamSize = rootRaw.size;

    this.miniFat = this.readMiniFat(firstMiniFatSector, numMiniFatSectors);

    this.root = this.buildTree(rawEntries, rootRaw);
  }

  private readDifat(firstDifatSector: number, numDifatSectors: number, numFatSectors: number, maxSectors: number): number[] {
    const cap = Math.min(numFatSectors || maxSectors, maxSectors);
    const difat: number[] = [];
    for (let i = 0; i < DIFAT_ENTRIES_IN_HEADER && difat.length < cap; i++) {
      const v = this.view.getUint32(76 + i * 4, true);
      if (v !== FAT_FREESECT) difat.push(v);
    }
    let difatSector = firstDifatSector;
    let steps = 0;
    while (
      numDifatSectors > 0 &&
      difatSector !== FAT_ENDOFCHAIN &&
      difatSector !== FAT_FREESECT &&
      difat.length < cap
    ) {
      if (steps++ > this.maxSectorSteps) {
        throw new CfbParseError(this.fmtErr('DIFAT chain too long or cyclic', 'DIFAT', difatSector, this.sectorOffset(difatSector)));
      }
      const off = this.sectorOffset(difatSector);
      if (off + this.sectorSize > this.bytes.byteLength) {
        throw new CfbParseError(this.fmtErr('DIFAT sector outside file bounds', 'DIFAT', difatSector, off));
      }
      const entriesPerSector = this.sectorSize / 4 - 1;
      for (let i = 0; i < entriesPerSector && difat.length < cap; i++) {
        const v = this.view.getUint32(off + i * 4, true);
        if (v !== FAT_FREESECT) difat.push(v);
      }
      difatSector = this.view.getUint32(off + entriesPerSector * 4, true);
    }
    return difat;
  }

  private readFat(difat: number[], maxSectors: number): Uint32Array {
    const entriesPerFatSector = this.sectorSize / 4;
    const values: number[] = [];
    for (const fatSector of difat) {
      if (values.length >= maxSectors) break;
      if (fatSector === FAT_FREESECT) continue;
      const off = this.sectorOffset(fatSector);
      if (off + this.sectorSize > this.bytes.byteLength) {
        throw new CfbParseError(this.fmtErr('FAT sector outside file bounds', 'FAT', fatSector, off));
      }
      for (let i = 0; i < entriesPerFatSector && values.length < maxSectors; i++) {
        values.push(this.view.getUint32(off + i * 4, true));
      }
    }
    return new Uint32Array(values);
  }

  private readMiniFat(firstMiniFatSector: number, numMiniFatSectors: number): Uint32Array {
    if (numMiniFatSectors === 0 || firstMiniFatSector === FAT_ENDOFCHAIN || firstMiniFatSector === FAT_FREESECT) {
      return new Uint32Array(0);
    }
    const bytes = this.readChain(firstMiniFatSector, undefined, 'mini-FAT');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = Math.floor(bytes.length / 4);
    const values = new Uint32Array(count);
    for (let i = 0; i < count; i++) values[i] = view.getUint32(i * 4, true);
    return values;
  }

  private parseDirectory(dirBytes: Uint8Array): RawDirEntry[] {
    const entryCount = Math.floor(dirBytes.length / DIR_ENTRY_SIZE);
    if (entryCount === 0) {
      throw new CfbParseError('CFB: empty or unreadable directory chain');
    }
    const view = new DataView(dirBytes.buffer, dirBytes.byteOffset, dirBytes.byteLength);
    const entries: RawDirEntry[] = [];
    for (let i = 0; i < entryCount; i++) {
      const base = i * DIR_ENTRY_SIZE;
      const nameLenBytes = view.getUint16(base + 64, true);
      const typeByte = view.getUint8(base + 66);
      let type: DirType = 'unknown';
      if (typeByte === 1) type = 'storage';
      else if (typeByte === 2) type = 'stream';
      else if (typeByte === 5) type = 'root';

      let name = '';
      if (nameLenBytes >= 2) {
        const charCount = Math.max(0, Math.min(31, Math.floor(nameLenBytes / 2 - 1)));
        const codeUnits: number[] = [];
        for (let c = 0; c < charCount; c++) {
          codeUnits.push(view.getUint16(base + c * 2, true));
        }
        name = String.fromCharCode(...codeUnits);
      }

      entries.push({
        name,
        type,
        left: view.getUint32(base + 68, true),
        right: view.getUint32(base + 72, true),
        child: view.getUint32(base + 76, true),
        startSector: view.getUint32(base + 116, true),
        size: view.getUint32(base + 120, true),
      });
    }
    return entries;
  }

  private buildTree(rawEntries: RawDirEntry[], rootRaw: RawDirEntry): CfbEntry {
    interface WorkItem {
      id: number;
      target: Map<string, CfbEntry>;
    }
    const visited = new Uint8Array(rawEntries.length);
    const rootChildren = new Map<string, CfbEntry>();
    const worklist: WorkItem[] = [];
    if (rootRaw.child !== NOSTREAM) worklist.push({ id: rootRaw.child, target: rootChildren });

    let steps = 0;
    while (worklist.length > 0) {
      if (steps++ > rawEntries.length + this.maxSectorSteps) {
        throw new CfbParseError('CFB: directory tree too deep or cyclic');
      }
      const item = worklist.pop();
      if (!item) continue;
      const { id, target } = item;
      if (id === NOSTREAM || id < 0 || id >= rawEntries.length) continue;
      if (visited[id]) continue;
      visited[id] = 1;
      const raw = rawEntries[id];
      if (raw.type !== 'storage' && raw.type !== 'stream') continue;
      if (raw.left !== NOSTREAM) worklist.push({ id: raw.left, target });
      if (raw.right !== NOSTREAM) worklist.push({ id: raw.right, target });
      const children = new Map<string, CfbEntry>();
      const entry: CfbEntry = {
        name: raw.name,
        type: raw.type,
        size: raw.size,
        startSector: raw.startSector,
        children,
      };
      target.set(raw.name, entry);
      if (raw.type === 'storage' && raw.child !== NOSTREAM) {
        worklist.push({ id: raw.child, target: children });
      }
    }

    return {
      name: rootRaw.name,
      type: 'storage',
      size: rootRaw.size,
      startSector: rootRaw.startSector,
      children: rootChildren,
    };
  }

  private sectorOffset(sector: number): number {
    return (sector + 1) * this.sectorSize;
  }

  private fmtErr(detail: string, label: string, sector?: number, offset?: number): string {
    const bits = [`CFB: ${detail}`, `[${label}]`];
    if (sector !== undefined) bits.push(`sector=${sector}`);
    if (offset !== undefined) bits.push(`offset=${offset}`);
    bits.push(`fileLength=${this.bytes.byteLength}`);
    return bits.join(' ');
  }

  private readChain(startSector: number, byteLimit: number | undefined, label: string): Uint8Array {
    if (startSector === FAT_ENDOFCHAIN || startSector === FAT_FREESECT) {
      return new Uint8Array(0);
    }
    const chunks: Uint8Array[] = [];
    let sector = startSector;
    let steps = 0;
    let collected = 0;
    while (sector !== FAT_ENDOFCHAIN && sector !== FAT_FREESECT) {
      if (steps++ > this.maxSectorSteps) {
        throw new CfbParseError(this.fmtErr('sector chain too long or cyclic', label, sector, this.sectorOffset(sector)));
      }
      if (sector < 0 || sector >= this.fat.length) {
        throw new CfbParseError(this.fmtErr(`invalid sector number ${sector} in chain`, label, sector));
      }
      const off = this.sectorOffset(sector);
      if (off + this.sectorSize > this.bytes.byteLength) {
        throw new CfbParseError(this.fmtErr('sector outside file bounds', label, sector, off));
      }
      chunks.push(this.bytes.subarray(off, off + this.sectorSize));
      collected += this.sectorSize;
      if (byteLimit !== undefined && collected >= byteLimit) break;
      sector = this.fat[sector];
    }
    if (byteLimit !== undefined && collected < byteLimit) {
      throw new CfbParseError(this.fmtErr(`chain ended prematurely (${collected} of ${byteLimit} bytes)`, label));
    }
    const out = new Uint8Array(collected);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return byteLimit !== undefined ? out.subarray(0, byteLimit) : out;
  }

  private getMiniStream(): Uint8Array {
    if (!this.miniStreamCache) {
      this.miniStreamCache = this.readChain(this.miniStreamStartSector, this.miniStreamSize, 'mini-stream');
    }
    return this.miniStreamCache;
  }

  private readMiniChain(startSector: number, byteLimit: number, label: string): Uint8Array {
    if (startSector === FAT_ENDOFCHAIN || startSector === FAT_FREESECT || byteLimit <= 0) {
      return new Uint8Array(0);
    }
    const miniStreamBytes = this.getMiniStream();
    const chunks: Uint8Array[] = [];
    let sector = startSector;
    let steps = 0;
    let collected = 0;
    while (sector !== FAT_ENDOFCHAIN && sector !== FAT_FREESECT) {
      if (steps++ > this.maxMiniSteps) {
        throw new CfbParseError(this.fmtErr('mini-sector chain too long or cyclic', label, sector, sector * this.miniSectorSize));
      }
      if (sector < 0 || sector >= this.miniFat.length) {
        throw new CfbParseError(this.fmtErr(`invalid mini-sector number ${sector} in chain`, label, sector));
      }
      const off = sector * this.miniSectorSize;
      if (off + this.miniSectorSize > miniStreamBytes.length) {
        throw new CfbParseError(this.fmtErr('mini-sector outside mini-stream bounds', label, sector, off));
      }
      chunks.push(miniStreamBytes.subarray(off, off + this.miniSectorSize));
      collected += this.miniSectorSize;
      if (collected >= byteLimit) break;
      sector = this.miniFat[sector];
    }
    if (collected < byteLimit) {
      throw new CfbParseError(this.fmtErr(`mini-stream chain ended prematurely (${collected} of ${byteLimit} bytes)`, label));
    }
    const out = new Uint8Array(collected);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out.subarray(0, byteLimit);
  }

  private resolve(path: string[]): CfbEntry | null {
    let node = this.root;
    for (const part of path) {
      const next = node.children.get(part);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  getStorage(path: string[]): CfbEntry | null {
    const node = this.resolve(path);
    return node && node.type === 'storage' ? node : null;
  }

  getStream(path: string[]): Uint8Array | null {
    const node = this.resolve(path);
    if (!node || node.type !== 'stream') return null;
    if (node.size === 0) return new Uint8Array(0);
    const label = path.join('/');
    if (node.size < this.miniStreamCutoff) {
      return this.readMiniChain(node.startSector, node.size, label);
    }
    return this.readChain(node.startSector, node.size, label);
  }
}
