// Gedeelde synthetische-CFB/MPP-fixturebouwers voor de `tests/planning/check-mpp-import.ts`-
// familie (fase 3.8 etappe 1). M6 (kwaliteitsreview op T4): de headerwriter + de directory-
// naamschrijver stonden 3× met de hand herhaald in `check-mpp-import.ts` (T3's `buildSyntheticCfb`
// en `buildDuplicateSiblingCfb`, T4's `buildTwoRootStreamsCfb`) — hier één keer, zodat T5–T9 (die
// eigen backend-storage-boompjes gaan fabriceren voor TBkndTask/TBkndCal/TBkndCons/TBkndRsc/
// TBkndAssn) daarop kunnen voortbouwen i.p.v. de CFB-headerboilerplate opnieuw uit te schrijven.
//
// Structuurkennis: zie `src/services/mpp/cfb.ts` (MS-CFB-specificatie) en
// `src/services/mpp/mppContainer.ts` (CompObj-/Props14-blokformaten, afgeleid van MPXJ).
import { CfbFile } from '@/services/mpp/cfb';

// ── CFB-header/-directory-boilerplate ────────────────────────────────────────────────────────

export const SECTOR = 512;
export const HEADER = 512;
export const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
export const DIR_ENTRY = 128;

export interface CfbHeaderOpts {
  numFatSectors: number;
  firstDirSector: number;
  firstMiniFatSector: number;
  numMiniFatSectors: number;
  /** Default 3 (512-byte sectoren). */
  majorVersion?: number;
  /** Default 9 (2^9 = 512). */
  sectorShift?: number;
  /** Default 6 (2^6 = 64, de vaste minisectorgrootte). */
  miniSectorShift?: number;
  /** Default 4096. */
  miniStreamCutoff?: number;
  /** Default ENDOFCHAIN (0xFFFFFFFE) — geen DIFAT-keten nodig voor deze kleine fixtures. */
  firstDifatSector?: number;
  /** Default 0. */
  numDifatSectors?: number;
}

/** Schrijft de CFB-header (magic + versie-/sectorshift-velden + FAT-/mini-FAT-/DIFAT-pointers +
 *  de 109 header-DIFAT-entries) in `view`. DIFAT[0] wijst altijd naar sector 0 (de FAT-sector,
 *  entry `i===0`) — dat klopt voor elke fixture hier: ze gebruiken allemaal precies 1
 *  FAT-sector, dus nooit een geketende DIFAT-vervolgsector nodig. */
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

/** Schrijft een directory-entrynaam: UTF-16LE-tekens vanaf `entryBase`, plus het lengteveld
 *  (bytes-incl.-terminator) op `entryBase + 64`. */
export function writeDirEntryName(view: DataView, entryBase: number, name: string): void {
  for (let c = 0; c < name.length; c++) view.setUint16(entryBase + c * 2, name.charCodeAt(c), true);
  view.setUint16(entryBase + 64, (name.length + 1) * 2, true);
}

// ── Fixturebouwers (verhuisd uit check-mpp-import.ts, gedrag ongewijzigd) ───────────────────────

/** Bouwt een minimale, geldige CFB met twee streams: StreamA (4095 bytes — net onder de
 *  4096-mini-stream-cutoff, dus het mini-FAT-pad) en StreamB (4096 bytes — precies op de cutoff,
 *  dus het gewone-FAT-pad). Sectorlayout: 0=FAT, 1=directory, 2=mini-FAT, 3-10=root-ministream
 *  (StreamA's data, 8×512=4096 bytes), 11-18=StreamB's data (8×512=4096 bytes). */
export function buildSyntheticCfb(): { bytes: Uint8Array; streamA: Uint8Array; streamB: Uint8Array } {
  const totalSectors = 19; // 0..18
  const buf = new ArrayBuffer(HEADER + totalSectors * SECTOR);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  const streamA = new Uint8Array(4095);
  for (let i = 0; i < streamA.length; i++) streamA[i] = i & 0xff;
  const streamB = new Uint8Array(4096);
  for (let i = 0; i < streamB.length; i++) streamB[i] = (255 - (i & 0xff)) & 0xff;

  writeCfbHeader(view, { numFatSectors: 1, firstDirSector: 1, firstMiniFatSector: 2, numMiniFatSectors: 1 });

  const sectorOff = (n: number) => HEADER + n * SECTOR;

  // Sector 0: FAT (128 u32-entries; alleen 0..18 zinvol, rest FREE)
  const fat = new Array<number>(128).fill(0xffffffff);
  fat[0] = 0xfffffffd; // FATSECT
  fat[1] = 0xfffffffe; // directory: één sector
  fat[2] = 0xfffffffe; // mini-FAT: één sector
  for (let s = 3; s <= 9; s++) fat[s] = s + 1; // root-ministream-keten 3→4→…→10
  fat[10] = 0xfffffffe;
  for (let s = 11; s <= 17; s++) fat[s] = s + 1; // StreamB-keten 11→…→18
  fat[18] = 0xfffffffe;
  fat.forEach((v, i) => view.setUint32(sectorOff(0) + i * 4, v, true));

  // Sector 1: directory — 4 entries van 128 bytes (Root, StreamA, StreamB, ongebruikt)
  const dirOff = sectorOff(1);
  // Entry 0: Root
  writeDirEntryName(view, dirOff, 'Root Entry');
  view.setUint8(dirOff + 66, 5); // type root
  view.setUint32(dirOff + 68, 0xffffffff, true); // left
  view.setUint32(dirOff + 72, 0xffffffff, true); // right
  view.setUint32(dirOff + 76, 1, true); // child = StreamA
  view.setUint32(dirOff + 116, 3, true); // ministream start-sector
  view.setUint32(dirOff + 120, 4096, true); // ministream size
  // Entry 1: StreamA
  const e1 = dirOff + 128;
  writeDirEntryName(view, e1, 'StreamA');
  view.setUint8(e1 + 66, 2);
  view.setUint32(e1 + 68, 0xffffffff, true);
  view.setUint32(e1 + 72, 2, true); // right = StreamB
  view.setUint32(e1 + 76, 0xffffffff, true);
  view.setUint32(e1 + 116, 0, true); // ministart-sector 0
  view.setUint32(e1 + 120, streamA.length, true);
  // Entry 2: StreamB
  const e2 = dirOff + 256;
  writeDirEntryName(view, e2, 'StreamB');
  view.setUint8(e2 + 66, 2);
  view.setUint32(e2 + 68, 0xffffffff, true);
  view.setUint32(e2 + 72, 0xffffffff, true);
  view.setUint32(e2 + 76, 0xffffffff, true);
  view.setUint32(e2 + 116, 11, true); // sector 11
  view.setUint32(e2 + 120, streamB.length, true);
  // Entry 3: ongebruikt (alle bytes 0 ⇒ typeByte 0)

  // Sector 2: mini-FAT — 64 minisectoren van StreamA, keten 0→1→…→62→63=ENDOFCHAIN
  const mfOff = sectorOff(2);
  for (let i = 0; i < 64; i++) view.setUint32(mfOff + i * 4, i === 63 ? 0xfffffffe : i + 1, true);
  for (let i = 64; i < 128; i++) view.setUint32(mfOff + i * 4, 0xffffffff, true);

  // Sectoren 3-10: root-ministream = StreamA's bytes (laatste byte van sector 10 is padding)
  bytes.set(streamA, sectorOff(3));
  // Sectoren 11-18: StreamB
  bytes.set(streamB, sectorOff(11));

  return { bytes, streamA, streamB };
}

/** Bouwt een CFB waarin `levels` directory-entries elk ZOWEL hun `left` als `right` naar hetzelfde
 *  volgende niveau laten wijzen (duplicaat-siblings) — betrapt een boomopbouw die de gedeelde
 *  visited-set kwijtraakt (zie `cfb.ts`'s C1-toelichting): zonder dedup verdubbelt elk niveau het
 *  werk (O(2^levels)), mét dedup is het O(levels). */
export function buildDuplicateSiblingCfb(levels: number): Uint8Array {
  const dirSectors = Math.ceil(((levels + 1) * DIR_ENTRY) / SECTOR);
  const totalSectors = 1 + dirSectors; // sector 0 = FAT, sectoren 1..dirSectors = directory
  const buf = new ArrayBuffer(HEADER + totalSectors * SECTOR);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  writeCfbHeader(view, {
    numFatSectors: 1,
    firstDirSector: 1,
    firstMiniFatSector: 0xfffffffe, // geen mini-FAT nodig in deze fixture
    numMiniFatSectors: 0,
  });

  const sectorOff = (n: number) => HEADER + n * SECTOR;

  // Sector 0: FAT — beschrijft zichzelf (FATSECT) en de geketende directory-sectoren 1..dirSectors.
  const fat = new Array<number>(128).fill(0xffffffff);
  fat[0] = 0xfffffffd;
  for (let s = 1; s <= dirSectors; s++) fat[s] = s === dirSectors ? 0xfffffffe : s + 1;
  fat.forEach((v, i) => view.setUint32(sectorOff(0) + i * 4, v, true));

  // Directory-entries liggen aaneengesloten vanaf sector 1 — dat spoort met de FAT-keten
  // hierboven, dus een simpele stride van DIR_ENTRY bytes is hier geoorloofd.
  const entryOffset = (idx: number) => sectorOff(1) + idx * DIR_ENTRY;

  // Entry 0: root — child wijst naar entry 1, het begin van de duplicaat-keten.
  const rootBase = entryOffset(0);
  writeDirEntryName(view, rootBase, 'Root Entry');
  view.setUint8(rootBase + 66, 5);
  view.setUint32(rootBase + 68, 0xffffffff, true);
  view.setUint32(rootBase + 72, 0xffffffff, true);
  view.setUint32(rootBase + 76, 1, true);

  // Entries 1..levels: streams (geen eigen kinderen nodig) waarvan left én right naar hetzelfde
  // volgende niveau wijzen.
  for (let i = 1; i <= levels; i++) {
    const base = entryOffset(i);
    writeDirEntryName(view, base, `Dup${i}`);
    view.setUint8(base + 66, 2); // type stream
    const next = i < levels ? i + 1 : 0xffffffff;
    view.setUint32(base + 68, next, true); // left
    view.setUint32(base + 72, next, true); // right — zelfde id als left
    view.setUint32(base + 76, 0xffffffff, true); // child: n.v.t. voor een stream
    view.setUint32(base + 116, 0xfffffffe, true); // startSector: nooit gelezen in deze test
    view.setUint32(base + 120, 0, true); // size 0
  }

  return bytes;
}

/** Bouwt een minimale, geldige CFB met twee ROOT-level streams (`nameA`/`nameB`), allebei via
 *  het mini-stream-pad. Generiek genoeg voor eender welke kleine (<4096 bytes) payload — anders
 *  dan `buildSyntheticCfb` (toegesneden op de mini-/gewone-FAT-grens, niet op meerdere
 *  root-streams). Gebruikt door de MPP-containerlaag-fixtures (`\x01CompObj` + `Props14`). */
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
  const totalSectors = 3 + ministreamSectors; // 0=FAT, 1=directory, 2=mini-FAT, 3..=root-ministream

  const buf = new ArrayBuffer(HEADER + totalSectors * SECTOR);
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);

  writeCfbHeader(view, { numFatSectors: 1, firstDirSector: 1, firstMiniFatSector: 2, numMiniFatSectors: 1 });

  const sectorOff = (n: number) => HEADER + n * SECTOR;

  // Sector 0: FAT
  const fat = new Array<number>(128).fill(0xffffffff);
  fat[0] = 0xfffffffd; // FATSECT
  fat[1] = 0xfffffffe; // directory: 1 sector
  fat[2] = 0xfffffffe; // mini-FAT: 1 sector
  for (let s = 3; s < 3 + ministreamSectors - 1; s++) fat[s] = s + 1;
  fat[3 + ministreamSectors - 1] = 0xfffffffe;
  fat.forEach((v, i) => view.setUint32(sectorOff(0) + i * 4, v, true));

  // Sector 1: directory — Root, entry A, entry B, ongebruikt.
  const dirOff = sectorOff(1);
  writeDirEntryName(view, dirOff, 'Root Entry');
  view.setUint8(dirOff + 66, 5); // type root
  view.setUint32(dirOff + 68, 0xffffffff, true);
  view.setUint32(dirOff + 72, 0xffffffff, true);
  view.setUint32(dirOff + 76, 1, true); // child = entry A
  view.setUint32(dirOff + 116, 3, true); // ministream start-sector
  view.setUint32(dirOff + 120, ministreamBytes, true);

  const e1 = dirOff + 128;
  writeDirEntryName(view, e1, nameA);
  view.setUint8(e1 + 66, 2); // type stream
  view.setUint32(e1 + 68, 0xffffffff, true);
  view.setUint32(e1 + 72, 2, true); // right = entry B
  view.setUint32(e1 + 76, 0xffffffff, true);
  view.setUint32(e1 + 116, 0, true); // ministart-sector 0
  view.setUint32(e1 + 120, dataA.length, true);

  const e2 = dirOff + 256;
  writeDirEntryName(view, e2, nameB);
  view.setUint8(e2 + 66, 2);
  view.setUint32(e2 + 68, 0xffffffff, true);
  view.setUint32(e2 + 72, 0xffffffff, true);
  view.setUint32(e2 + 76, 0xffffffff, true);
  view.setUint32(e2 + 116, miniCountA, true); // ministart = na A's minisectoren
  view.setUint32(e2 + 120, dataB.length, true);
  // Entry 3: ongebruikt (alle bytes 0 ⇒ typeByte 0, buildTree slaat 'm over)

  // Sector 2: mini-FAT
  const mfOff = sectorOff(2);
  for (let i = 0; i < 128; i++) view.setUint32(mfOff + i * 4, 0xffffffff, true); // FREE default
  for (let i = 0; i < miniCountA; i++) {
    view.setUint32(mfOff + i * 4, i === miniCountA - 1 ? 0xfffffffe : i + 1, true);
  }
  for (let i = 0; i < miniCountB; i++) {
    const idx = miniCountA + i;
    view.setUint32(mfOff + idx * 4, i === miniCountB - 1 ? 0xfffffffe : idx + 1, true);
  }

  // Root-ministream: A's bytes gevolgd door B's bytes, elk op een minisector-grens (64 bytes).
  bytes.set(dataA, sectorOff(3));
  bytes.set(dataB, sectorOff(3) + miniCountA * MINI);

  return bytes;
}

// ── Willekeurig geneste storage/stream-boom (T5-kwaliteitsreview, I4) ───────────────────────────
//
// `buildTwoRootStreamsCfb` hierboven dekt alleen twee ROOT-level streams — T5's end-to-end-fixture
// (en T6/T7's TBkndCal/TBkndCons/TBkndRsc/TBkndAssn-fixtures straks) hebben een ECHTE geneste boom
// nodig: `"   114"` (storage) met daarin een `Props`-stream ÉN een `TBkndTask`-storage, die op zijn
// beurt `FixedMeta`/`FixedData`/`VarMeta`/`Var2Data`-streams draagt. `buildNestedCfb` generaliseert
// daarom naar een willekeurig geneste boom, opgegeven als gewoon geneste JS-objecten.

/** Eén knoop in de boom die `buildNestedCfb` opbouwt: een stream draagt `data` (de ruwe bytes),
 *  een storage draagt `children` (genest, zelfde vorm). Precies één van beide moet gezet zijn. */
export interface CfbTreeNode {
  data?: Uint8Array;
  children?: Record<string, CfbTreeNode>;
}

/** Bouwt een CFB met een willekeurig geneste storage/stream-boom. Streams < 4096 bytes gaan via het
 *  mini-stream-pad (root-ministream + mini-FAT); streams ≥ 4096 bytes (T6-kwaliteitsreview, C1 —
 *  nodig voor de "veel-kalenders"-hostile-fixture, die een FixedData-blok ver boven de mini-stream-
 *  grens vereist) krijgen sinds deze uitbreiding hun EIGEN gewone-sectorketen (512 bytes/sector),
 *  analoog aan `buildSyntheticCfb`'s StreamB — géén aparte vlag nodig, de grootte beslist. Maximaal
 *  128 minisectoren (8192 bytes gezamenlijke mini-streaminhoud) en — omdat deze bouwer, net als
 *  `buildTwoRootStreamsCfb`, met precies 1 FAT-sector werkt (`writeCfbHeader`'s DIFAT[0]-aanname) —
 *  maximaal 128 gewone sectoren TOTAAL (FAT + directory + mini-FAT + root-ministream + alle grote-
 *  streamketens samen). Gooit een duidelijke fout als een fixture die grens overschrijdt i.p.v.
 *  stilzwijgend corrupte bytes te schrijven; een fixture die ook dát budget nodig heeft, breidt dit
 *  verder uit met geketende FAT-sectoren (meer dan 1) i.p.v. de aanname hier los te laten. */
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

  // Streamdata → minisectoren (elk 64 bytes) toewijzen, in entry-volgorde — alleen voor streams
  // ONDER de mini-stream-cutoff; grotere streams (zie hieronder) gaan via gewone sectoren.
  const MINI = 64;
  const minisectorsFor = (len: number) => Math.max(0, Math.ceil(len / MINI));
  let miniCursor = 0;
  const miniStart = new Map<number, number>(); // entry-id → ministart-sector
  for (const e of entries) {
    if (e.type !== 'stream' || !e.data || e.data.length >= MINI_CUTOFF) continue;
    const count = minisectorsFor(e.data.length);
    if (count === 0) continue; // lege stream: geen ministream-ruimte nodig (startSector blijft ENDOFCHAIN)
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

  // Grote streams (≥ MINI_CUTOFF): elk zijn EIGEN aaneengesloten gewone-sectorketen, ná de
  // root-ministream. `largeStart`/`largeSectorCount` spiegelen `miniStart`/`minisectorsFor` maar dan
  // op 512-byte-sectorniveau.
  const largeSectorsFor = (len: number) => Math.max(1, Math.ceil(len / SECTOR));
  const largeStart = new Map<number, number>(); // entry-id → eerste gewone sector
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

  // FAT: sector 0 = zichzelf (FATSECT), dan directory-sectoren, mini-FAT-sector(en),
  // root-ministream-sectoren, dan elke grote-streamketen — elk een simpele lineaire keten.
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

  // Directory: basisvelden per entry, dan de sibling-keten (`right`) per ouder — in twee passes
  // zodat childIds al bekend zijn wanneer de keten geschreven wordt.
  for (const e of entries) {
    const base = sectorOff(firstDirSector) + e.id * DIR_ENTRY;
    writeDirEntryName(view, base, e.name);
    view.setUint8(base + 66, e.id === 0 ? 5 : e.type === 'storage' ? 1 : 2);
    view.setUint32(base + 68, 0xffffffff, true); // left (ongebruikt — alle siblings via right-keten)
    view.setUint32(base + 72, 0xffffffff, true); // right (default; hieronder overschreven waar nodig)
    view.setUint32(base + 76, e.childIds.length > 0 ? e.childIds[0] : 0xffffffff, true); // child
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
      view.setUint32(base + 72, e.childIds[i + 1], true); // right = volgende sibling
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

// ── MPP-blokencoders (Props14.java/CompObj.java-formaat, spiegelt mppContainer.ts) ─────────────

export function encodeAsciiWithTerminator(s: string): Uint8Array {
  const out = new Uint8Array(s.length + 1);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  out[s.length] = 0;
  return out;
}

/** Spiegelt CompObj.java: 28 filler-bytes, dan lengte-geprefixte ASCII-strings (elke lengte telt
 *  de null-terminator mee). We stoppen na `fileFormat` — de applicationID-lengte (0, dus
 *  "overslaan") sluit het blok consistent af.
 *
 *  `applicationName` (Z2-fixronde, optioneel — default `'OPS synthetic'`, dus BYTE-IDENTIEK voor
 *  élke bestaande aanroeper die 'm niet meegeeft): `mppContainer.ts`'s `detectApplicationVersion`
 *  leest dit veld en matcht 'm tegen `Microsoft.Project.(\d+).0` om Project-≤2010 vs. 2013+ te
 *  onderscheiden (bit-vlag-tabellen voor milestone/TASK_MODE verschillen daartussen — zie
 *  `mppReader.ts`'s `isLegacyBitFlagVersion`/`taskModeBitFlag`). Zonder deze parameter matcht de
 *  vaste `'OPS synthetic'`-naam dat patroon nooit, dus `detectApplicationVersion` geeft altijd
 *  `null` en élke fixture in dit project landde tot nu toe stilzwijgend op het 2010-legacy-pad —
 *  onbedoeld, want het VOLLEDIGE corpus leest in werkelijkheid via het 2013+/moderne masker. Geef
 *  bv. `'Microsoft.Project 16.0'` mee om een moderne-versie-fixture te bouwen (spiegelt de
 *  corpus-geverifieerde vorm, zie `APPLICATION_VERSION_PATTERN`'s eigen toelichting — de punten
 *  in het patroon zijn ongeëscapete regex-jokers en matchen dus ook de spatie). */
export function encodeCompObjFileFormat(fileFormat: string, applicationName = 'OPS synthetic'): Uint8Array {
  const nameBytes = encodeAsciiWithTerminator(applicationName); // willekeurig, mits ≠ "Microsoft Project 4.0"
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
  view.setInt32(pos, 0, true); // applicationID-lengte: 0 ⇒ overslaan
  return out;
}

/** Spiegelt Props14.java: 16-byte header (headerCount @12) + N entries (lengte/sleutel/genegeerd/
 *  data, uitgelijnd op een 2-byte-grens) — algemene vorm, ondersteunt meerdere PropsKeys in één
 *  stream. */
export function encodePropsEntries(entries: { key: number; data: Uint8Array }[]): Uint8Array {
  let bodyLen = 0;
  for (const e of entries) bodyLen += 12 + e.data.length + (e.data.length % 2 !== 0 ? 1 : 0);
  const out = new Uint8Array(16 + bodyLen);
  const view = new DataView(out.buffer);
  view.setUint16(12, entries.length, true); // headerCount
  let pos = 16;
  for (const e of entries) {
    view.setInt32(pos, e.data.length, true); // attrib1: datalengte
    view.setInt32(pos + 4, e.key, true); // attrib2: sleutel
    view.setInt32(pos + 8, 0, true); // attrib3: genegeerd
    pos += 12;
    out.set(e.data, pos);
    pos += e.data.length;
    if (e.data.length % 2 !== 0) pos += 1; // uitlijnen op een 2-byte-grens, zoals de leeskant verwacht
  }
  return out;
}

/** Eén PropsKey met een 1-byte waarde — het geval van PASSWORD_FLAG. */
export function encodePropsSingleByteEntry(key: number, valueByte: number): Uint8Array {
  return encodePropsEntries([{ key, data: Uint8Array.of(valueByte) }]);
}

// ── VarMeta12-fixturebouwer (T11, fixture-consolidatie stap 0-ter e) ────────────────────────────
//
// `buildVarMetaBytes` stond 4× los: check-mpp-import.ts, check-mpp-relations.ts,
// check-mpp-calendars.ts (alle drie letterlijk dezelfde 12-regelige DataView-schrijver) en — sinds
// fb6ea03c — `mppBuildTaskVarMetaBytes` in tests/mcp/cases-doc-file.ts (een vaste-invoer-variant
// van dezelfde lay-out, met het commentaar dat cross-suite import "niet kon" omdat de drie
// planning-checks 'm zelf ook alle drie als eigen kopie aanhielden — een cirkelredenering die deze
// consolidatie doorbreekt: cases-doc-file.ts importeert hierboven al `buildNestedCfb`/
// `encodePropsEntries` cross-suite uit deze module (regel 22 aldaar), dus het precedent bestaat al.
//
// Signatuur = check-mpp-import.ts's VOLLEDIGE vorm (met de optionele `itemCountClaim`/`dataSize`,
// nodig voor haar I4-hostile-fixtures); de andere drie aanroepplekken gebruiken alleen `entries` en
// krijgen daarmee byte-voor-byte hetzelfde resultaat als hun eigen, nu verwijderde kopie.

/** FixedMeta/VarMeta12-magic-getal (`mppPrimitives.ts`'s `BLOCK_MAGIC`, VarMeta12 deelt 'm met
 *  FixedMeta) — letterlijk herhaald i.p.v. geïmporteerd uit de bronmodule, zelfde conventie als
 *  `CAL_FIXED_META_MAGIC` hieronder (fixtures bouwen bewust RUWE bytes na, leunen principieel niet
 *  op `src/services/mpp/mppPrimitives.ts`'s eigen constanten). */
const VAR_META_MAGIC = 0xfadfadba;

/** Bouwt rauwe VarMeta12-bytes: 24-byte header (magic@0 + itemCount@8 + dataSize@20) + N entries
 *  van 12 bytes (uniqueID@0/offset@4/type@8, 2 bytes pad). */
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

// ── Assert-helpers ("faalt-nette-fout"-patroon) ──────────────────────────────────────────────

const DEFAULT_TIME_LIMIT_MS = 2000;

/** Voert `run()` uit en verwacht dat 'm binnen `timeLimitMs` gooit met een boodschap die met
 *  `${prefix}:` begint (bewijst zowel "geen hang/geheugenexplosie" als "nette, herkenbare fout —
 *  geen rauwe RangeError e.d."). Registreert drie `truthy`-regels per aanroep. Gedeelde kern van
 *  `expectCfbError`/`expectMppError` hieronder. */
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
  }
  const elapsedMs = Date.now() - start;
  truthy(`${label}: binnen tijdslimiet (${elapsedMs}ms < ${timeLimitMs}ms)`, elapsedMs < timeLimitMs);
  truthy(`${label}: gooit`, threw);
  truthy(`${label}: nette ${prefix}:-foutmelding (geen RangeError e.d.)`, message.startsWith(`${prefix}:`));
}

/** Voor de CFB-container-laag (`cfb.ts`) — verwacht een `CFB:`-fout. */
export function expectCfbError(
  truthy: (label: string, cond: boolean) => void,
  label: string,
  run: () => void,
  timeLimitMs = DEFAULT_TIME_LIMIT_MS,
): void {
  expectPrefixedError(truthy, 'CFB', label, run, timeLimitMs);
}

/** I4 (kwaliteitsreview): voor de MPP-primitievenlaag (`mppPrimitives.ts`/`mppContainer.ts`) —
 *  verwacht een `MPP:`-fout. Naar het model van `expectCfbError` hierboven. */
export function expectMppError(
  truthy: (label: string, cond: boolean) => void,
  label: string,
  run: () => void,
  timeLimitMs = DEFAULT_TIME_LIMIT_MS,
): void {
  expectPrefixedError(truthy, 'MPP', label, run, timeLimitMs);
}

/** Byte-voor-byte vergelijking — voor round-trip-bewijzen (`getStream(...)` teruggeeft precies
 *  wat erin ging). */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Kleine gemakshelper: bouwt een `CfbFile` uit `buildTwoRootStreamsCfb`'s resultaat. Puur voor
 *  leesbaarheid op de aanroepplekken (geen eigen logica). */
export function buildTwoRootStreamsCfbFile(nameA: string, dataA: Uint8Array, nameB: string, dataB: Uint8Array): CfbFile {
  return new CfbFile(buildTwoRootStreamsCfb(nameA, dataA, nameB, dataB));
}

// ── TBkndCal-fixturebouwers (T6, verhuisd uit check-mpp-import.ts — T6-kwaliteitsreview M7) ────────
//
// Gedeeld tussen `tests/planning/check-mpp-import.ts` (het gecombineerde T5+T6 end-to-end-blok) en
// `tests/planning/check-mpp-calendars.ts` (de T6-specifieke suite: hostile varianten, corpus- en
// crawl-secties) — vandaar hier, naast de generieke CFB-/MPP-container-bouwers hierboven.

/** FixedMeta/VarMeta12-magic-getal (`mppPrimitives.ts`'s `BLOCK_MAGIC`) — letterlijk herhaald i.p.v.
 *  geïmporteerd uit de bronmodule: fixtures bouwen bewust RUWE bytes na, niet de typed structuren
 *  zelf, dus deze module leunt principieel niet op `src/services/mpp/mppPrimitives.ts`'s eigen
 *  constanten (zelfde conventie als de generieke CFB-header-bouwers hierboven). */
const CAL_FIXED_META_MAGIC = 0xfadfadba;

export function buildCalFixedMetaBlob(offsets: number[]): Uint8Array {
  const out = new Uint8Array(16 + offsets.length * 10);
  const view = new DataView(out.buffer);
  view.setUint32(0, CAL_FIXED_META_MAGIC, true);
  view.setInt32(8, offsets.length, true);
  offsets.forEach((offsetIntoFixedData, i) => view.setInt32(16 + i * 10 + 4, offsetIntoFixedData, true));
  return out;
}

/** Eén TBkndCal/FixedData-record (12 bytes): calendarID@0/baseCalendarID@4/resourceID@8 — de
 *  ≤2010-veldlayout (`MPP14CalendarFactory.java`'s `else`-tak), want de fixtures hier gebruiken
 *  allemaal een CompObj-applicationName die `detectApplicationVersion`'s patroon niet matcht ⇒
 *  `applicationVersion === null` ⇒ `useModernOffsets === false` in `mppCalendars.ts`. */
export function buildCalFixedDataRecord(calendarId: number, baseCalendarId: number, resourceId: number): Uint8Array {
  const out = new Uint8Array(12);
  const view = new DataView(out.buffer);
  view.setInt32(0, calendarId, true);
  view.setInt32(4, baseCalendarId, true);
  view.setInt32(8, resourceId, true);
  return out;
}

/** Eén weekdag-blok (60 bytes) binnen een TBkndCal-kalenderdatablob — spiegelt
 *  `AbstractCalendarFactory.processCalendarHours`'s per-dag-lay-out (`mppCalendars.ts`'s
 *  `resolveOneDay`). `defaultFlag: 1` ⇒ "gebruik de default/base" (leeg `bands` genegeerd);
 *  anders expliciete banden (leeg ⇒ niet-werkend). */
export function writeCalDayBlock(view: DataView, dayOffset: number, opts: { defaultFlag?: 0 | 1; bands?: { startMinutes: number; durationMinutes: number }[] }): void {
  view.setInt16(dayOffset, opts.defaultFlag ?? 0, true);
  const bands = opts.bands ?? [];
  view.setInt16(dayOffset + 2, bands.length, true);
  bands.forEach((b, i) => {
    view.setInt16(dayOffset + 8 + i * 2, b.startMinutes * 10, true); // tienden-van-minuut
    view.setInt16(dayOffset + 20 + i * 4, b.durationMinutes * 10, true);
  });
}

/** De volledige 420-byte werkuren-sectie (7×60 bytes, index 0=zo..6=za — MPP-dagblokvolgorde,
 *  zie `mppCalendars.ts`'s `resolveOneDay`-toelichting). */
export function buildCalHoursBlock(days: { defaultFlag?: 0 | 1; bands?: { startMinutes: number; durationMinutes: number }[] }[]): Uint8Array {
  const out = new Uint8Array(420);
  const view = new DataView(out.buffer);
  days.forEach((d, i) => writeCalDayBlock(view, i * 60, d));
  return out;
}

/** De uitzonderingen-staart (`AbstractCalendarAndExceptionFactory.processCalendarExceptions`) —
 *  wordt ná het 420-byte urenblok geplakt. `recurrenceTypeValue` default 1 (DAILY) + `periodCount=0`
 *  (niet-werkend) ⇒ een gewone, niet-recurrente feestdag. `freq76` (blob-offset `pos+76`) default
 *  256 — BEWUST GEEN 1 — spiegelt `mppCalendars.ts`'s `parseExceptions`-toelichting (T6-spec-review-
 *  fix): bij `recurrenceTypeValue===1` NEGEERT MPXJ de bytes op `@76` volledig (frequency wordt
 *  hardgecodeerd op 1), dus een fixture die hier toevallig altijd 1 schreef zou de vroegere,
 *  BUGGY conditie (die `@76===1` ten onrechte eiste) evengoed laten slagen — 256 bewijst dat de
 *  materialisatie ONAFHANKELIJK is van deze bytes bij type 1, zoals crawl-corpusmeting ook liet
 *  zien (`@76` is daar nooit 1: 0/256/23148). `recurrenceTypeValue=7` (het ANDERE DAILY-type, waar
 *  `@76` WÉL als frequency telt) is expliciet aan te geven voor die tak van de conditie. */
export function buildCalExceptionsTail(exceptions: { fromDay: number; toDay: number; recurrenceTypeValue?: number; freq76?: number }[]): Uint8Array {
  const bodyLen = exceptions.length * 92; // geen namen in deze fixture ⇒ exceptionNameLength altijd 0
  const out = new Uint8Array(4 + bodyLen);
  const view = new DataView(out.buffer);
  view.setInt16(0, exceptions.length, true); // exceptionCount (blob-offset 420)
  let pos = 4;
  for (const exc of exceptions) {
    view.setInt16(pos, exc.fromDay, true);
    view.setInt16(pos + 2, exc.toDay, true);
    view.setInt16(pos + 14, 0, true); // periodCount = 0 ⇒ niet-werkend
    view.setInt16(pos + 72, exc.recurrenceTypeValue ?? 1, true);
    view.setInt16(pos + 76, exc.freq76 ?? 256, true); // bewust ≠ 1 — zie de toelichting hierboven
    view.setInt32(pos + 88, 0, true); // exceptionNameLength = 0 (geen naam)
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
