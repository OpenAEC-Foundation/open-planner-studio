// Minimale, alleen-lezen Compound File Binary (CFB/OLE2) parser — het containerformaat van
// .mpp-bestanden (MS Project 2010+/MPP14) en oudere Office-formaten. Eigen implementatie, geen
// dependency (conform de eigen-parser-traditie van dit project, vgl. de IFC-parser).
//
// Structuurkennis is gebaseerd op de MS-CFB-specificatie (Microsoft) en, ter verificatie, op de
// vergelijkbare sector/FAT/directory-afhandeling in MPXJ (Jon Iles e.a., LGPL-2.1, POI-achtig):
// https://github.com/joniles/mpxj — met name `org.mpxj.mpp` (leest hetzelfde containerformaat).
// Deze module kent geen MPP-specifieke semantiek (die zit in `mppContainer.ts` e.v.); ze levert
// alleen de generieke storage/stream-boom en ruwe streambytes.
//
// Hardening: elke lus over bestandsinhoud is begrensd door een bovengrens die uitsluitend uit de
// ECHTE bestandsgrootte volgt (`maxSectorSteps`/`maxMiniSteps`), nooit door een ongevalideerde
// teller uit het bestand zelf (zoals `numDifatSectors` of `numFatSectors`) — een geprepareerd bestand
// mag nooit meer CPU/geheugen claimen dan zijn eigen omvang rechtvaardigt. Synthetische fixtures in
// `tests/planning/check-mpp-import.ts` bewijzen dit (o.a. een zelf-lussende DIFAT-sector met een
// vijandig grote `numFatSectors`, en dubbele siblings voor de gedeelde visited-set).

const MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const FAT_FREESECT = 0xffffffff;
const FAT_ENDOFCHAIN = 0xfffffffe;
// FAT_FATSECT (0xFFFFFFFD) en FAT_DIFSECT (0xFFFFFFFC) markeren sectoren die zelf FAT- resp.
// DIFAT-inhoud dragen; deze lezer volgt ze nooit als data-keten (ze duiken alleen op ín de FAT
// zelf, nooit als "volgende sector" tijdens het lezen van een gewone stream), dus er is geen
// aparte afhandeling nodig — alleen de twee sentinels hierboven sturen de leeslussen.

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
  /** UTF-16LE-naam; kan \x01/\x05-prefixtekens bevatten (bv. "\x01CompObj"). */
  name: string;
  type: 'storage' | 'stream';
  size: number;
  /** Startsector (normale FAT-sector, of ministart-sector wanneer `size` onder de
   *  mini-stream-cutoff valt) — intern boekhoudkundig veld dat `getStream()` gebruikt; buiten
   *  deze module zelden relevant, maar publiek zodat er geen zijtabel nodig is om 'm op te zoeken. */
  readonly startSector: number;
  /** Alleen gevuld bij storages. */
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
  /** Bovengrens voor elke begrensde lus over GEWONE sectoren (DIFAT/FAT/directory/gewone-stream-
   *  ketens) — afgeleid van de ECHTE bestandsgrootte gedeeld door `sectorSize`, nooit van een
   *  teller die het bestand zelf beweert. Bewust apart van `maxMiniSteps`: de fijnere
   *  minisector-korrel zou hier tot 8× te ruim zijn (20 MB invoer gaf zo 932 MB piekgeheugen). */
  private readonly maxSectorSteps: number;
  /** Zelfde soort bovengrens, maar voor MINI-sector-ketens (readMiniChain) — afgeleid van de
   *  bestandsgrootte gedeeld door `miniSectorSize` (64 bytes), de fijnste korrel. Een minisector-
   *  keten heeft per byte data tot 8x zoveel schakels nodig als een gewone sectorketen, dus deze
   *  grens moet ruimer zijn dan `maxSectorSteps` om legitieme mini-streams niet af te wijzen. */
  private readonly maxMiniSteps: number;
  /** Mini-stream-inhoud (= de stream van de root-entry), lazy gelezen en hergebruikt: zonder cache
   *  zou elke kleine stream de hele mini-stream opnieuw via de gewone FAT moeten lezen. */
  private miniStreamCache: Uint8Array | null = null;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (bytes.byteLength < HEADER_SIZE) {
      throw new Error(
        `CFB: bestand te klein voor een geldige header (${bytes.byteLength} bytes, minimaal ${HEADER_SIZE})`,
      );
    }
    for (let i = 0; i < MAGIC.length; i++) {
      if (bytes[i] !== MAGIC[i]) {
        throw new Error('CFB: ongeldige magic — geen Compound File Binary');
      }
    }

    const majorVersion = this.view.getUint16(26, true);
    if (majorVersion !== 3 && majorVersion !== 4) {
      throw new Error(`CFB: onbekende major version ${majorVersion} (verwacht 3 of 4)`);
    }
    // sectorShift/miniSectorShift/miniStreamCutoff zijn voor CFB vaste waarden per major version —
    // expliciet valideren i.p.v. `1 << sectorShift` blind te vertrouwen (dat wrapt stil modulo 32).
    const sectorShift = this.view.getUint16(30, true);
    const miniSectorShift = this.view.getUint16(32, true);
    const expectedSectorShift = majorVersion === 3 ? 9 : 12;
    if (sectorShift !== expectedSectorShift) {
      throw new Error(
        `CFB: sectorShift ${sectorShift} hoort niet bij major version ${majorVersion} (verwacht ${expectedSectorShift})`,
      );
    }
    if (miniSectorShift !== 6) {
      throw new Error(`CFB: onverwachte miniSectorShift ${miniSectorShift} (verwacht 6)`);
    }
    this.sectorSize = 1 << sectorShift;
    this.miniSectorSize = 1 << miniSectorShift;

    const numFatSectors = this.view.getUint32(44, true);
    const firstDirSector = this.view.getUint32(48, true);
    this.miniStreamCutoff = this.view.getUint32(56, true);
    if (this.miniStreamCutoff !== 4096) {
      throw new Error(`CFB: onverwachte miniStreamCutoff ${this.miniStreamCutoff} (verwacht 4096)`);
    }
    const firstMiniFatSector = this.view.getUint32(60, true);
    const numMiniFatSectors = this.view.getUint32(64, true);
    const firstDifatSector = this.view.getUint32(68, true);
    const numDifatSectors = this.view.getUint32(72, true);

    // Sector n begint op byteoffset (n + 1) * sectorSize (geldt voor v3 én v4 — bij v4 is de
    // header zelf met nullen opgevuld tot de volledige sectorgrootte). `maxSectors` — de fysieke
    // sectortelling — is de ENIGE bron voor beide stapbudgetten: geen lus mag zijn budget laten
    // meegroeien met een teller uit het bestand zelf.
    const maxSectors = Math.ceil(bytes.byteLength / this.sectorSize);
    this.maxSectorSteps = Math.max(16, maxSectors + 16);
    this.maxMiniSteps = Math.max(16, Math.ceil(bytes.byteLength / this.miniSectorSize) + 16);

    const difat = this.readDifat(firstDifatSector, numDifatSectors, numFatSectors, maxSectors);
    this.fat = this.readFat(difat, maxSectors);
    if (this.fat.length === 0 || numFatSectors === 0) {
      throw new Error('CFB: geen FAT-sectoren gevonden');
    }

    const dirBytes = this.readChain(firstDirSector, undefined, 'directory');
    const rawEntries = this.parseDirectory(dirBytes);

    const rootIdx = rawEntries.findIndex((e) => e.type === 'root');
    if (rootIdx < 0) {
      throw new Error('CFB: geen root-directory-entry gevonden');
    }
    const rootRaw = rawEntries[rootIdx];
    this.miniStreamStartSector = rootRaw.startSector;
    this.miniStreamSize = rootRaw.size;

    this.miniFat = this.readMiniFat(firstMiniFatSector, numMiniFatSectors);

    this.root = this.buildTree(rawEntries, rootRaw);
  }

  // ── DIFAT/FAT ──────────────────────────────────────────────────────────────────────────────

  /** Sommeert de FAT-sectornummers: 109 header-entries + eventueel geketende DIFAT-sectoren.
   *  Begrensd door `maxSectorSteps`, NOOIT door het ongevalideerde `numDifatSectors`/`numFatSectors`.
   *  `cap` is `Math.min(numFatSectors || maxSectors, maxSectors)`: een vijandig grote `numFatSectors`
   *  (bv. 0xFFFFFFFF) mag de `difat`-array nooit voorbij het fysieke aantal sectoren laten groeien. */
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
        throw new Error(this.fmtErr('DIFAT-keten te lang of cyclisch', 'DIFAT', difatSector, this.sectorOffset(difatSector)));
      }
      const off = this.sectorOffset(difatSector);
      if (off + this.sectorSize > this.bytes.byteLength) {
        throw new Error(this.fmtErr('DIFAT-sector buiten bestandsgrenzen', 'DIFAT', difatSector, off));
      }
      const entriesPerSector = this.sectorSize / 4 - 1; // laatste u32 = volgende DIFAT-sector
      for (let i = 0; i < entriesPerSector && difat.length < cap; i++) {
        const v = this.view.getUint32(off + i * 4, true);
        if (v !== FAT_FREESECT) difat.push(v);
      }
      difatSector = this.view.getUint32(off + entriesPerSector * 4, true);
    }
    return difat;
  }

  /** Bouwt de FAT: u32-array, per sector de volgende sector in zijn keten. Gekapt op `maxSectors`
   *  (meer entries zijn zinloos). `maxSectors` komt van de constructor, zodat deze functie en
   *  `readDifat` gegarandeerd dezelfde grens hanteren. */
  private readFat(difat: number[], maxSectors: number): Uint32Array {
    const entriesPerFatSector = this.sectorSize / 4;
    const values: number[] = [];
    for (const fatSector of difat) {
      if (values.length >= maxSectors) break;
      if (fatSector === FAT_FREESECT) continue;
      const off = this.sectorOffset(fatSector);
      if (off + this.sectorSize > this.bytes.byteLength) {
        throw new Error(this.fmtErr('FAT-sector buiten bestandsgrenzen', 'FAT', fatSector, off));
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

  // ── Directory ──────────────────────────────────────────────────────────────────────────────

  private parseDirectory(dirBytes: Uint8Array): RawDirEntry[] {
    const entryCount = Math.floor(dirBytes.length / DIR_ENTRY_SIZE);
    if (entryCount === 0) {
      throw new Error('CFB: lege of onleesbare directory-keten');
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
        // nameLenBytes telt de terminerende NUL mee; charCount is inclusief eventuele
        // \x01/\x05-prefixtekens die MS Project/Office gebruiken voor speciale streams.
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
        // Streamgrootte is u64 @120; alleen de laagste 32 bits lezen volstaat ruimschoots voor
        // .mpp-bestanden (die blijven ver onder 4 GiB).
        size: view.getUint32(base + 120, true),
      });
    }
    return entries;
  }

  // ── Boom ───────────────────────────────────────────────────────────────────────────────────

  /** Bouwt de storage/stream-boom uit de platte directory-lijst. Volledig iteratief via een
   *  expliciete worklist (geen recursie, dus geen stack-overflow bij diep geneste storages) en met
   *  ÉÉN gedeelde visited-set over de hele boom: een cyclische child/left/right-verwijzing wordt
   *  hoe dan ook maar één keer verwerkt. */
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
        throw new Error('CFB: directory-boom te diep of cyclisch');
      }
      const item = worklist.pop();
      if (!item) continue;
      const { id, target } = item;
      if (id === NOSTREAM || id < 0 || id >= rawEntries.length) continue;
      if (visited[id]) continue; // al bezocht — cyclus/self-reference, stilzwijgend overslaan
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

  // ── Sector-/ketenlezers ────────────────────────────────────────────────────────────────────

  private sectorOffset(sector: number): number {
    return (sector + 1) * this.sectorSize;
  }

  /** Elke `CFB:`-fout krijgt context mee: welk pad/welke structuur (`label`), welke sector, welke
   *  byte-offset en de totale bestandslengte. De offset wordt door de aanroeper berekend, met de
   *  juiste korrel (gewone sector of minisector). */
  private fmtErr(detail: string, label: string, sector?: number, offset?: number): string {
    const bits = [`CFB: ${detail}`, `[${label}]`];
    if (sector !== undefined) bits.push(`sector=${sector}`);
    if (offset !== undefined) bits.push(`offset=${offset}`);
    bits.push(`bestandslengte=${this.bytes.byteLength}`);
    return bits.join(' ');
  }

  /** Leest een volledige sectorketen vanaf `startSector` via de gewone FAT. `byteLimit` (indien
   *  gegeven) is de verwachte streamgrootte: het resultaat is dan altijd exact zo lang, of deze
   *  methode gooit — een keten die eindigt vóór `byteLimit` bereikt is (een afgekapt/corrupt
   *  bestand) geeft dus nooit stilzwijgend minder bytes terug dan beloofd. */
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
        throw new Error(this.fmtErr('sectorketen te lang of cyclisch', label, sector, this.sectorOffset(sector)));
      }
      if (sector < 0 || sector >= this.fat.length) {
        throw new Error(this.fmtErr(`ongeldig sectornummer ${sector} in keten`, label, sector));
      }
      const off = this.sectorOffset(sector);
      if (off + this.sectorSize > this.bytes.byteLength) {
        throw new Error(this.fmtErr('sector buiten bestandsgrenzen', label, sector, off));
      }
      chunks.push(this.bytes.subarray(off, off + this.sectorSize));
      collected += this.sectorSize;
      if (byteLimit !== undefined && collected >= byteLimit) break;
      sector = this.fat[sector];
    }
    if (byteLimit !== undefined && collected < byteLimit) {
      throw new Error(this.fmtErr(`keten eindigde voortijdig (${collected} van ${byteLimit} bytes)`, label));
    }
    const out = new Uint8Array(collected);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return byteLimit !== undefined ? out.subarray(0, byteLimit) : out;
  }

  /** De mini-stream (= de stream van de root-entry) wordt één keer gelezen en daarna hergebruikt. */
  private getMiniStream(): Uint8Array {
    if (!this.miniStreamCache) {
      this.miniStreamCache = this.readChain(this.miniStreamStartSector, this.miniStreamSize, 'mini-stream');
    }
    return this.miniStreamCache;
  }

  /** Leest een volledige minisectorketen vanaf `startSector` via de mini-FAT, uit de mini-stream.
   *  Zelfde niet-korter-dan-`byteLimit`-garantie als `readChain`. */
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
        throw new Error(this.fmtErr('minisectorketen te lang of cyclisch', label, sector, sector * this.miniSectorSize));
      }
      // Bereikcontrole vooraan (zoals readChain) — vóór we de sector gebruiken, niet pas
      // vlak vóór de volgende stap.
      if (sector < 0 || sector >= this.miniFat.length) {
        throw new Error(this.fmtErr(`ongeldig minisectornummer ${sector} in keten`, label, sector));
      }
      // Offset relatief aan de mini-stream (niet aan het bestand) en met de minisector-korrel
      // (64 bytes), niet de gewone sectorgrootte.
      const off = sector * this.miniSectorSize;
      if (off + this.miniSectorSize > miniStreamBytes.length) {
        throw new Error(this.fmtErr('minisector buiten mini-stream-grenzen', label, sector, off));
      }
      chunks.push(miniStreamBytes.subarray(off, off + this.miniSectorSize));
      collected += this.miniSectorSize;
      if (collected >= byteLimit) break;
      sector = this.miniFat[sector];
    }
    if (collected < byteLimit) {
      throw new Error(this.fmtErr(`ministream-keten eindigde voortijdig (${collected} van ${byteLimit} bytes)`, label));
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

  /** Storage-entry op pad; null als afwezig (of als het pad op een stream uitkomt). */
  getStorage(path: string[]): CfbEntry | null {
    const node = this.resolve(path);
    return node && node.type === 'storage' ? node : null;
  }

  /** Stream-inhoud op pad door storages, bv. getStream(['   114', 'TBkndTask', 'FixedData']).
   *  Het resultaat is altijd exact `entry.size` bytes lang — een afgekapte keten (minder data dan
   *  de directory-entry belooft) is een `CFB:`-fout, nooit een stille gedeeltelijke read. */
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
