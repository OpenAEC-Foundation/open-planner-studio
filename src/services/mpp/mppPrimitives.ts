/**
 * Native MPP14-lezer (MS Project 2010–2021), alleen-lezen.
 * Afgeleid van de MPXJ-broncode (https://github.com/joniles/mpxj, © Jon Iles e.a.,
 * LGPL-2.1) — structuurkennis en veldconstanten geport naar TypeScript voor
 * Open Planner Studio (LGPL-3.0).
 *
 * Laagste laag boven de CFB-container (`cfb.ts`): de generieke MPP-blokformaten
 * (FixedMeta/FixedData/VarMeta/Var2Data) plus de MPPUtility-equivalente byte-lezers
 * (datums/duraties/unicode-strings/GUID's). Kent geen taak/resource/kalender-semantiek —
 * dat zit in `fieldMap14.ts`, `mppReader.ts`, `mppCalendars.ts` en `mppEntities.ts`.
 *
 * Poort-bronnen (allemaal in org.mpxj.mpp, behalve genoemd): FixedMeta.java, FixedData.java,
 * AbstractVarMeta.java + VarMeta12.java, Var2Data.java, MPPUtility.java en
 * org.mpxj.common.ByteArrayHelper (getShort/getInt — hier ondergebracht omdat er geen aparte
 * "common"-laag is).
 *
 * Alleen geport wat de lezers daadwerkelijk aanroepen (MPP14Reader.java, ConstraintFactory.java,
 * AbstractCalendarFactory.java) — geen speculatieve extra's.
 */

import { MS_PER_DAY } from '@/utils/dateUtils';

// ── Laagste-niveau byte-lezers (ByteArrayHelper-equivalent; LE) ─────────────────────────────
//
// Elke read is vooraf grensgecontroleerd en gooit een duidelijke `MPP:`-fout i.p.v. een rauwe
// DataView-RangeError. In MPXJ bewaken de AANROEPERS dit; hier zit de garantie ook op het laagste
// niveau, zodat een vergeten aanroeper-check nooit een onleesbare crash oplevert.

/** Foutboodschap met optionele context (`ctx` — meestal het label van de aanroepende klasse,
 *  bv. "FixedMeta[TBkndTask/FixedMeta]"). `ctx` is puur diagnostisch, nooit onderdeel van de
 *  bounds-logica. */
function boundsError(kind: string, offset: number, length: number, dataLen: number, ctx?: string): Error {
  const bits = [`MPP: ${kind} buiten grenzen (offset=${offset}, lengte=${length}, bufferlengte=${dataLen})`];
  if (ctx) bits.push(`[${ctx}]`);
  return new Error(bits.join(' '));
}

/** LE unsigned 16-bit (ByteArrayHelper.getShort — ondanks de Java-naam "short" altijd
 *  niet-negatief: de twee bytes worden zonder sign-extend geOR't). Handmatige shift-lezing i.p.v.
 *  een `DataView`-allocatie per aanroep: ~40× sneller op de hot path van FixedData/VarMeta12. */
export function getShort(data: Uint8Array, offset: number, ctx?: string): number {
  if (offset < 0 || offset + 2 > data.length) {
    throw boundsError('getShort', offset, 2, data.length, ctx);
  }
  return data[offset] | (data[offset + 1] << 8);
}

/** LE signed 32-bit (ByteArrayHelper.getInt). Zelfde shift-lezing als `getShort` — de `<< 24` op de
 *  hoogste byte zet bit 31, dus identiek aan `DataView.getInt32(offset, true)`. */
export function getInt(data: Uint8Array, offset: number, ctx?: string): number {
  if (offset < 0 || offset + 4 > data.length) {
    throw boundsError('getInt', offset, 4, data.length, ctx);
  }
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
}

/** Magic-getal dat zowel FixedMeta- als VarMeta12-blokken (toevallig dezelfde constante,
 *  geverifieerd tegen beide Java-bronnen) vooraan dragen. `| 0` dwingt de correcte
 *  sign-extended 32-bit-waarde af (0xFADFADBA heeft bit 31 gezet), zodat de vergelijking met
 *  `getInt`'s signed resultaat klopt — net als Java's `int MAGIC = 0xFADFADBA` impliciet doet. */
const BLOCK_MAGIC = 0xfadfadba | 0;

// ── FixedMeta (FixedMeta.java) ───────────────────────────────────────────────────────────────
//
// Header (16 bytes): magic(4) + ongebruikt(4) + itemCount(4, RUWE headerwaarde — NIET
// vertrouwen voor arraygrootte, zie hieronder) + ongebruikt(4). Items van vaste `itemSize` bytes
// vullen de rest van het blok; het WERKELIJKE aantal items volgt uit de blokgrootte
// (`adjustedItemCount`), nooit uit de ruwe headerwaarde — MPXJ's eigen commentaar: "we already
// know the block size, so we ignore the item count in the block and work it out for ourselves."

const FIXED_META_HEADER_SIZE = 16;

export class FixedMeta {
  /** Headerwaarde, GEKLEMD op `adjustedItemCount` (zie `getItemCount()`). */
  private readonly clampedItemCount: number;
  private readonly items: ReadonlyArray<Uint8Array | null>;

  private constructor(clampedItemCount: number, items: ReadonlyArray<Uint8Array | null>) {
    this.clampedItemCount = clampedItemCount;
    this.items = items;
  }

  /** Poort van `FixedMeta(InputStream, int itemSize)` — vaste itemgrootte, letterlijk opgegeven
   *  door de aanroeper (bv. TBkndTask/FixedMeta met itemSize=47, MPP14Reader.java r. 993). */
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
    // De RUWE headerwaarde niet ongeclampt blootstellen: MPXJ's `ConstraintFactory` gebruikt hem als
    // lusbovengrens, en een geprepareerd bestand kan tot 0x7FFFFFFF claimen. Geklemd op
    // `adjustedItemCount`; op een geldig bestand zijn beide gelijk.
    const clampedItemCount = Math.max(0, Math.min(getInt(bytes, 8, `FixedMeta[${label}]`), adjustedItemCount));
    const items: (Uint8Array | null)[] = new Array(adjustedItemCount);
    let pos = FIXED_META_HEADER_SIZE;
    for (let i = 0; i < adjustedItemCount; i++) {
      items[i] = bytes.subarray(pos, pos + itemSize);
      pos += itemSize;
    }
    return new FixedMeta(clampedItemCount, items);
  }

  /** Poort van `FixedMeta(InputStream, FixedData otherFixedBlock, int... itemSizes)` — de
   *  afgeleide/heuristische variant (MPP14Reader.java r. 995: taskFixed2Meta met kandidaten
   *  92/93/94/95/96, itemcount-hint uit taskFixedData). Kiest de itemSize die exact op de
   *  blokgrootte past én matcht met `otherFixedBlock`'s itemcount; anders de "dichtstbijzijnde"
   *  kandidaat volgens dezelfde vuistregel als de Java-bron. Delegeert daarna aan
   *  `withItemSize` met de gekozen grootte — geen aparte parse-loop nodig. */
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
    // Puur een heuristiek-hint (vermenigvuldigd tegen kandidaat-groottes, nooit gebruikt voor
    // allocatie) — geen clamp nodig zoals bij `withItemSize` hierboven, wel dezelfde `ctx` voor
    // een diagnoseerbare foutmelding als de read zelf al buiten grenzen valt.
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

  /** Headerwaarde, GEKLEMD op `getAdjustedItemCount()`. MPXJ gebruikt de ongeclampte variant soms
   *  als lusbovengrens (bv. `ConstraintFactory` over TBkndCons); hier bewust niet, want dat zou een
   *  geprepareerd bestand een vijandig lusbudget geven. Op een geldig bestand is de waarde gelijk aan
   *  de rauwe headerwaarde. */
  getItemCount(): number {
    return this.clampedItemCount;
  }

  /** Betrouwbare itemcount, afgeleid van de blokgrootte — dit is de lengte van de onderliggende
   *  array (en dus ook wat `getByteArrayValue` daadwerkelijk kan teruggeven). */
  getAdjustedItemCount(): number {
    return this.items.length;
  }

  getByteArrayValue(index: number): Uint8Array | null {
    if (index < 0 || index >= this.items.length) return null;
    return this.items[index];
  }
}

// ── FixedData (FixedData.java) ───────────────────────────────────────────────────────────────
//
// Vier Java-constructor-varianten zijn hier statische fabrieksmethodes (JS/TS kent geen
// overloading op parametertype); alle vier zijn concreet nodig — geverifieerd tegen de
// aanroepplekken in MPP14Reader.java (Task/Resource/Assignment), ConstraintFactory.java
// (relaties/TBkndCons) en AbstractCalendarFactory.java (TBkndCal):
//   - fromMeta:              Task-Fixed2Data, Resource-FixedData/-Fixed2Data, TBkndCal
//                             (basisvariant + de maxExpectedSize-variant zijn in Java twee
//                             overloads die naar dezelfde 4-parameter-constructor delegeren;
//                             hier één functie met optionele parameters).
//   - withItemSizeOverride:  TBkndCons/FixedData (itemSize=20, "meta's itemSize is fout").
//   - withoutMeta:           TBkndAssn/FixedData+Fixed2Data (itemSize=110/48, géén FixedMeta
//                             beschikbaar voor assignments).

export class FixedData {
  private readonly items: ReadonlyArray<Uint8Array | null>;
  /** Offset → index, één keer opgebouwd i.p.v. een O(n)-`indexOf` per lookup (relatie-opbouw zou
   *  anders O(n²) zijn). Bewaart `Array#indexOf`-semantiek: bij een herhaald offset wint de EERSTE
   *  index — inclusief offset 0 voor slots zonder item (zoals Java's `m_offset`-array). */
  private readonly indexByOffset: Map<number, number>;

  private constructor(items: ReadonlyArray<Uint8Array | null>, offsets: ReadonlyArray<number>) {
    this.items = items;
    this.indexByOffset = new Map();
    for (let i = 0; i < offsets.length; i++) {
      if (!this.indexByOffset.has(offsets[i])) this.indexByOffset.set(offsets[i], i);
    }
  }

  /** Poort van `FixedData(FixedMeta, InputStream[, maxExpectedSize[, minSize]])`. Elk item se
   *  offset komt uit `meta` (byte 4..7 van het meta-item); de grootte volgt uit het verschil met
   *  het VOLGENDE item se offset (of "rest van het blok" voor het laatste item), begrensd door
   *  `maxExpectedSize` zodra opgegeven (>0) — dat voorkomt dat een corrupt offset een
   *  belachelijk grote slice claimt. */
  static fromMeta(meta: FixedMeta, bytes: Uint8Array, maxExpectedSize = 0, minSize = 0, label = 'FixedData'): FixedData {
    const itemCount = meta.getAdjustedItemCount();
    const items: (Uint8Array | null)[] = new Array(itemCount).fill(null);
    const offsets: number[] = new Array(itemCount).fill(0);
    const ctx = `FixedData[${label}]`;

    for (let i = 0; i < itemCount; i++) {
      const metaData = meta.getByteArrayValue(i);
      if (!metaData || metaData.length < 8) continue; // offset staat @4, minstens 8 bytes nodig
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

  /** Poort van `FixedData(FixedMeta, int itemSize, InputStream)` — het OFFSET komt nog uit
   *  `meta`, maar de GROOTTE is de opgegeven vaste waarde i.p.v. de (onbetrouwbaar geachte)
   *  door meta gerapporteerde grootte. Gebruikt voor TBkndCons (relaties): itemSize=20. */
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

  /** Poort van `FixedData(int itemSize, InputStream)` — géén meta beschikbaar: rechttoe-
   *  rechtaan aaneengesloten brokken van `itemSize` bytes vanaf offset 0. Gebruikt voor
   *  TBkndAssn (assignments hebben geen eigen FixedMeta voor hun FixedData/Fixed2Data). */
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

  /** Aantal SLOTS in het blok (niet: aantal niet-lege items — spiegelt Java's
   *  `m_array.length`). */
  getItemCount(): number {
    return this.items.length;
  }

  getByteArrayValue(index: number): Uint8Array | null {
    if (index < 0 || index >= this.items.length) return null;
    return this.items[index];
  }

  /** -1 als het offset niet voorkomt — spiegelt Java's `getIndexFromOffset` (O(1) via
   *  `indexByOffset`). */
  getIndexFromOffset(offset: number): number {
    return this.indexByOffset.get(offset) ?? -1;
  }
}

// ── VarMeta12 (AbstractVarMeta.java + VarMeta12.java) ────────────────────────────────────────
//
// MPP14 gebruikt uitsluitend VarMeta12 (MPP14Reader.java r. 991 e.v.) — VarMeta9/VarMeta8 zijn
// niet geport (buiten scope: MPP8/9/12 worden al bij `assertReadable` geweigerd).
//
// VarMeta is in de corpusbestanden altijd aanwezig (bewaakt in `check-mpp-import.ts`), dus deze
// constructor accepteert GEEN `null` en faalt hard bij een ontbrekende stream — anders dan Var2Data.

const VAR_META_HEADER_SIZE = 24; // magic(4) + onbekend(4) + itemCount(4) + onbekend(4)*2 + dataSize(4)
const VAR_META_ENTRY_SIZE = 12; // uniqueID(4) + offset(4) + type(2) + onbekend(2)

export class VarMeta12 {
  private readonly itemCount: number;
  private readonly dataSize: number;
  /** Gesorteerd (numeriek), NIET gededupliceerd — spiegelt VarMeta12.java's
   *  `Arrays.sort(offsets)` exact; Var2Data hangt af van precies dit gedrag. */
  private readonly sortedOffsets: ReadonlyArray<number>;
  /** uniqueID → (type → offset); beide niveaus numeriek-gesorteerd itereerbaar via de
   *  getter-methodes hieronder (spiegelt Java's geneste TreeMap). */
  private readonly table = new Map<number, Map<number, number>>();

  constructor(bytes: Uint8Array, label = 'VarMeta') {
    const ctx = `VarMeta[${label}]`;
    if (bytes.length < VAR_META_HEADER_SIZE) {
      throw new Error(
        `MPP: VarMeta[${label}] te klein voor header (${bytes.length} bytes, minimaal ${VAR_META_HEADER_SIZE})`,
      );
    }
    // "Ik heb één voorbeeld waar een verder geldig VarMeta-blok nul heeft als magic-getal. MS
    // Project leest het bestand prima, dus we behandelen nul als geldige waarde." (VarMeta12.java)
    const magic = getInt(bytes, 0, ctx);
    if (magic !== 0 && magic !== BLOCK_MAGIC) {
      throw new Error(`MPP: VarMeta[${label}] ongeldig magic-getal (0x${(magic >>> 0).toString(16)})`);
    }
    // De RUWE headerwaarde niet ongeclampt gebruiken om `offsets` te dimensioneren: een geprepareerd
    // bestand kan tot 0x7FFFFFFF claimen (OOM, in de browser niet te vangen) of een negatief getal.
    // Geklemd op `maxEntries`, wat werkelijk in het blok past. Bewuste afwijking van VarMeta12.java;
    // op een geldig bestand zijn beide gelijk.
    const maxEntries = Math.floor((bytes.length - VAR_META_HEADER_SIZE) / VAR_META_ENTRY_SIZE);
    this.itemCount = Math.max(0, Math.min(getInt(bytes, 8, ctx), maxEntries));
    this.dataSize = getInt(bytes, 20, ctx);

    const offsets: number[] = new Array(this.itemCount).fill(0);
    let pos = VAR_META_HEADER_SIZE;
    for (let i = 0; i < this.itemCount; i++) {
      if (bytes.length - pos < VAR_META_ENTRY_SIZE) break; // afgekapt blok: stop, gooi niet
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

  /** Gesorteerde offsets (met duplicaten) — Var2Data itereert hier letterlijk overheen. */
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

  /** Numeriek-gesorteerde unique-ID's — spiegelt de TreeMap-iteratievolgorde van
   *  `getUniqueIdentifierArray()`/`getUniqueIdentifierSet()`; de taak- en resourcelezers leunen op
   *  precies deze volgorde. */
  getUniqueIdentifierArray(): number[] {
    return Array.from(this.table.keys()).sort((a, b) => a - b);
  }

  getUniqueIdentifierSet(): Set<number> {
    return new Set(this.getUniqueIdentifierArray());
  }
}

// ── Var2Data (Var2Data.java) ──────────────────────────────────────────────────────────────────
//
// Vereenvoudigd t.o.v. de Java-bron: Var2Data.java doet een handmatige seek/reset-dans omdat het
// werkt tegen een sequentiële `InputStream` waar items niet per se in offset-volgorde staan.
// Hier hebben we de VOLLEDIGE streambytes al in het geheugen (via `CfbFile.getStream`, die exact
// `entry.size` bytes garandeert), dus willekeurige toegang via `bytes.subarray(offset, …)`
// vervangt die dans functioneel identiek — zelfde resultaat, zonder de stream-boekhouding.
//
// Een backend-storage kan legitiem ZONDER Var2Data-stream zitten (in het corpus mist het
// 215-takenbestand hem voor TBkndCons) — vandaar `bytes: Uint8Array | null`, anders dan VarMeta12.
// Afwezig ⇒ lege variabele-veldenset.

export class Var2Data {
  private readonly meta: VarMeta12;
  /** offset (uit VarMeta) → data ZONDER de 4-byte lengte-prefix. */
  private readonly map = new Map<number, Uint8Array>();

  constructor(meta: VarMeta12, bytes: Uint8Array | null) {
    this.meta = meta;
    if (!bytes) return; // zie moduleheader: legitiem afwezig, blijft een lege dataset
    const available = bytes.length;

    for (const itemOffset of meta.getOffsets()) {
      if (itemOffset < 0 || itemOffset >= available) continue;
      // Offsets kunnen herhalen wanneer items gededupliceerde var-data delen — bij een herhaling
      // is de entry al gelezen, overslaan (spiegelt Java's `m_map.containsKey`-check).
      if (this.map.has(itemOffset)) continue;
      if (itemOffset + 4 > available) continue;
      const size = getInt(bytes, itemOffset);
      if (size < 0 || itemOffset + 4 + size > available) continue; // corrupt: probeer door te gaan
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

  /** `maxLength` begrenst zowel het resultaat als het scanwerk in `getUnicodeString` (kritiek bij een
   *  gedeelde var-data-offset). `ctx` is puur diagnostisch. */
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

// ── MPPUtility-equivalenten ───────────────────────────────────────────────────────────────────

/** MicrosoftProjectConstants.EPOCH_DATE = 1983-12-31T00:00 — UTC-verankerd (`Date.UTC`), NOOIT
 *  via lokale getters/constructie: dit project rekent overal in UTC-instants (vgl.
 *  `src/utils/dateUtils.ts`'s `parseDate`) om tijdzone-afhankelijke dagverschuivingen te
 *  vermijden. */
const MPP_EPOCH_UTC_MS = Date.UTC(1983, 11, 31);

/** LE 64-bit float (MPPUtility.getDouble — `Double.longBitsToDouble`). Voor `DataType.UNITS`-velden
 *  (resource MAX_UNITS, assignment ASSIGNMENT_UNITS — FieldMap.java's `UNITS`/`CURRENCY`/`RATE`/
 *  `WORK`-categorie leest 8 bytes). Geen hot path, dus een `DataView` per aanroep is prima.
 *
 *  Niet-eindig (NaN én ±Infinity) ⇒ 0: ruimer dan MPXJ's NaN-only-guard, want `Infinity` zou via
 *  `maxUnits`/`unitsPerDay` als `IFCREAL(Infinity)` corrupte STEP opleveren; spiegelt mspdiReader's
 *  `Number.isFinite(units) ? units : 1`. */
export function getDouble(data: Uint8Array, offset: number, ctx?: string): number {
  if (offset < 0 || offset + 8 > data.length) {
    throw boundsError('getDouble', offset, 8, data.length, ctx);
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  const value = view.getFloat64(0, true);
  return Number.isFinite(value) ? value : 0;
}

/** Datum (geen tijd) — dagen sinds het MPP-epoch. 65535 = "N/A" ⇒ `null` (MPPUtility.getDate).
 *  `ctx` is puur diagnostisch. */
export function getDate(data: Uint8Array, offset: number, ctx?: string): Date | null {
  const days = getShort(data, offset, ctx);
  if (days === 65535) return null;
  return new Date(MPP_EPOCH_UTC_MS + days * MS_PER_DAY);
}

/** Tijd-van-de-dag in SECONDEN sinds middernacht — MPP bewaart dit in tienden van een minuut
 *  (MPPUtility.getTime: `(kort/10)*60`, met een modulo-24u-vangnet voor waarden ≥ 86400s). */
export function getTime(data: Uint8Array, offset: number, ctx?: string): number {
  let seconds = Math.floor(getShort(data, offset, ctx) / 10) * 60;
  if (seconds > 86399) seconds %= 86400;
  return seconds;
}

/** Datum+tijd. Twee NA-heuristieken letterlijk uit MPPUtility.getTimestamp overgenomen:
 *  `days <= 1 of 65535` ⇒ null, en (bij `days < 100` mét een niet-nul secondedeel) eveneens
 *  null — MS Project toont zulke kleine dagwaarden zelf ook als "NB". */
export function getTimestamp(data: Uint8Array, offset: number, ctx?: string): Date | null {
  const days = getShort(data, offset + 2, ctx);
  if (days <= 1 || days === 65535) return null;
  let time = getShort(data, offset, ctx);
  if (time === 65535) time = 0;
  const result = new Date(MPP_EPOCH_UTC_MS + days * MS_PER_DAY + time * 6000);
  if (days < 100 && result.getUTCSeconds() !== 0) return null;
  return result;
}

/** `String.fromCharCode(...codeUnits)` op de hele array loopt tegen de argumentengrens van de engine
 *  aan (V8 rond ~125k, lager in JSC), en een groot tekstveld is hier geen randgeval. De string wordt
 *  daarom in brokken van `CHUNK` code-units opgebouwd. */
const UNICODE_STRING_CHUNK = 8192;

/** UTF-16LE, null-terminated (of tot einde array). `maxLength` (bytes) knipt net als
 *  MPPUtility's overload met dat derde argument. Handmatig gedecodeerd (geen `TextDecoder`) —
 *  spiegelt de Java-bron 1:1.
 *
 *  `maxLength` begrenst ook de null-terminator-SCAN, niet alleen het resultaat: bij een groot gedeeld
 *  var-data-blok (meerdere unique-ID's op dezelfde offset) kost elke aanroep zo O(maxLength) i.p.v.
 *  O(werkelijke stringlengte) — 1.000 aanroepen op een gedeelde 500 KB-string kostten anders ≈ 3 s. */
export function getUnicodeString(data: Uint8Array, offset: number, maxLength?: number, ctx?: string): string {
  // Een negatieve offset is nooit legitiem (elke aanroeper berekent 'm uit een niet-negatieve
  // Var2Data-offset) — dit is dus een programmeerfout, geen normale "geen data"-situatie, vandaar
  // een echte fout i.p.v. de stille lege-string-terugval hieronder (die blijft voor het WEL
  // legitieme "offset === data.length"-geval: een lege staart).
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

/** Microsoft-GUID-tekstrepresentatie (mixed-endian: de eerste 8 bytes zijn per veld
 *  byte-omgedraaid, de laatste 8 niet — MPPUtility.getGUID). Alles-nul ⇒ `null`. */
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

/** Duur-eenheden zoals MPP ze codeert (MPPUtility.getDurationTimeUnits) — alleen de codes die
 *  daadwerkelijk in TBkndTask/TBkndCons voorkomen (geen "confirmed"/"custom"-varianten die MPXJ
 *  zelf ook niet in deze tabel heeft). */
export type MppTimeUnit =
  | 'minutes' | 'elapsedMinutes'
  | 'hours' | 'elapsedHours'
  | 'days' | 'elapsedDays'
  | 'weeks' | 'elapsedWeeks'
  | 'months' | 'elapsedMonths'
  | 'percent' | 'elapsedPercent';

const DURATION_UNITS_MASK = 0x1f;

/** Poort van MPPUtility.getDurationTimeUnits(int, TimeUnit) — decodeert de ruwe duur-eenheid-
 *  code (bv. uit TBkndCons-relatiedata) naar een `MppTimeUnit`. Code 21 = "projectstandaard",
 *  code 7 = dagen; onbekende codes vallen terug op dagen (zelfde default als de Java-bron). */
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

/** Poort van MPPUtility.getDuration(double, TimeUnit) — zet een ruwe waarde in TIENDEN VAN EEN
 *  MINUUT (zoals MPP durations/lag intern bewaart) om naar een numerieke duur in de opgegeven
 *  eenheid. Bewust GEEN hoursPerDay/daysPerWeek-correctie (dat is `getAdjustedDuration` in de
 *  Java-bron); die hoort bij de aanroeper, net als `parseMSPDuration`'s `hoursPerDay` in mspdiReader. */
export function getDuration(value: number, unit: MppTimeUnit): number {
  switch (unit) {
    case 'minutes':
    case 'elapsedMinutes':
      return value / 10;
    case 'hours':
    case 'elapsedHours':
      return value / 600; // 60 * 10
    case 'days':
      return value / 4800; // 8 * 60 * 10
    case 'elapsedDays':
      return value / 14400; // 24 * 60 * 10
    case 'weeks':
      return value / 24000; // 5 * 8 * 60 * 10
    case 'elapsedWeeks':
      return value / 100800; // 7 * 24 * 60 * 10
    case 'months':
      return value / 96000;
    case 'elapsedMonths':
      return value / 432000; // 30 * 24 * 60 * 10
    default:
      return value; // percent/elapsedPercent: ongewijzigd, zoals de Java-default-tak
  }
}
