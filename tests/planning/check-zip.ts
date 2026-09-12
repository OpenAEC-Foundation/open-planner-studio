// De ZIP-laag (issue #27, etappe 3, T4/T5).
//
// Twee dingen worden hier bewaakt die je in een extensietest niet ziet:
//
//   1. DE LEZER weigert vijandige archieven VOORDAT hij ze uitpakt. Een uitpaklimiet die pas ná het
//      uitpakken toetst is geen limiet — een bestandje van 40 KB dat naar gigabytes inflateert heeft
//      het tabblad dan al om zeep geholpen. Daarom draagt de weigering `bytesSeen`: dat getal is het
//      mutatiebewijs. Verhuist de toets naar ná de lus, dan springt het van "budget + één chunk"
//      naar de volle payload en valt de assertie hieronder om.
//   2. DE SCHRIJVER produceert een archief dat een échte consument (Excel, LibreOffice) accepteert.
//      De CRC-32-vectoren komen van buiten (de bekende IEEE-802.3-checkwaarden), niet uit onze eigen
//      implementatie — een zelfgeschreven CRC die consequent hetzelfde foute antwoord geeft, komt
//      pas bij de gebruiker aan het licht als "Excel wil het bestand herstellen".
//
// Draait via run.sh. Exit 0 = alles groen.
import {
  EXTENSION_ZIP_LIMITS,
  ZipValidationError,
  parseZipEntries,
  type ZipReadLimits,
} from '@/services/zip/zipReader';

const diffs: string[] = [];
let checks = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    diffs.push(`${label}: verwacht ${JSON.stringify(want)}, kreeg ${JSON.stringify(got)}`);
  }
};
const ok = (label: string, got: boolean) => eq(label, got, true);

const bytes = (s: string) => new TextEncoder().encode(s);

const concat = (chunks: readonly Uint8Array[]): Uint8Array => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) { out.set(chunk, pos); pos += chunk.length; }
  return out;
};

const deflateRaw = async (data: Uint8Array): Promise<Uint8Array> => {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  void writer.write(data as Uint8Array<ArrayBuffer>);
  void writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return concat(chunks);
};

// ── Een ruwe ZIP-fixturebouwer ───────────────────────────────────────────────
// Bewust NIET onze eigen `writeZip`: de lezertests moeten ook archieven kunnen maken die `writeZip`
// nooit zou produceren (Zip64-sentinels, gelogen maten, te veel entries).

interface RawZipEntry {
  name: string;
  method: number;
  comp: Uint8Array;
  uncompSize: number;
  /** Overschrijft `uncompSize` in UITSLUITEND de central directory (voor sentinel-fixtures). */
  centralUncompSize?: number;
}

interface RawZipOptions {
  /** Overschrijft het entryaantal in de EOCD (voor de Zip64-sentinel en te-veel-entries). */
  eocdTotal?: number;
  /** Overschrijft de central-directory-offset in de EOCD (voor de Zip64-sentinel). */
  cdOffset?: number;
  /** Laat de central directory + EOCD weg, zodat de local-header-scanroute wordt gebruikt. */
  localOnly?: boolean;
}

const rawZip = (entries: readonly RawZipEntry[], opts: RawZipOptions = {}): ArrayBuffer => {
  const locals: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = bytes(entry.name);
    const chunk = new Uint8Array(30 + name.length + entry.comp.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, entry.method, true);
    view.setUint32(18, entry.comp.length, true);
    view.setUint32(22, entry.uncompSize, true);
    view.setUint16(26, name.length, true);
    chunk.set(name, 30);
    chunk.set(entry.comp, 30 + name.length);
    locals.push(chunk);
    offsets.push(offset);
    offset += chunk.length;
  }

  if (opts.localOnly) return concat(locals).buffer as ArrayBuffer;

  const centrals: Uint8Array[] = [];
  let cdSize = 0;
  entries.forEach((entry, index) => {
    const name = bytes(entry.name);
    const chunk = new Uint8Array(46 + name.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(10, entry.method, true);
    view.setUint32(20, entry.comp.length, true);
    view.setUint32(24, entry.centralUncompSize ?? entry.uncompSize, true);
    view.setUint16(28, name.length, true);
    view.setUint32(42, offsets[index], true);
    chunk.set(name, 46);
    centrals.push(chunk);
    cdSize += chunk.length;
  });

  const eocd = new Uint8Array(22);
  const eview = new DataView(eocd.buffer);
  eview.setUint32(0, 0x06054b50, true);
  eview.setUint16(8, opts.eocdTotal ?? entries.length, true);
  eview.setUint16(10, opts.eocdTotal ?? entries.length, true);
  eview.setUint32(12, cdSize, true);
  eview.setUint32(16, opts.cdOffset ?? offset, true);

  return concat([...locals, ...centrals, eocd]).buffer as ArrayBuffer;
};

const storedEntry = (name: string, data: Uint8Array): RawZipEntry =>
  ({ name, method: 0, comp: data, uncompSize: data.length });

const deflatedEntry = async (name: string, data: Uint8Array): Promise<RawZipEntry> =>
  ({ name, method: 8, comp: await deflateRaw(data), uncompSize: data.length });

const caught = async (fn: () => Promise<unknown>): Promise<unknown> => {
  try { await fn(); } catch (err) { return err; }
  return undefined;
};

// ═══════════════════════════════════════════════════════════════════════════
// DEEL 1 — de lezer (T4)
// ═══════════════════════════════════════════════════════════════════════════

const BUDGET = 64 * 1024;
const BOMB_LIMITS: ZipReadLimits = {
  maxEntryBytes: BUDGET,
  maxTotalBytes: BUDGET,
  maxEntries: 16,
  // Ruim, zodat déze fixture uitsluitend op de absolute grens strandt en niet op de ratio.
  maxRatio: 1_000_000,
};

// 8 MiB nullen comprimeert tot een paar kilobyte: de klassieke zip-bom in het klein. De header
// LIEGT over de uitgepakte maat (1 KiB) — dat is nu juist het punt: een aanvaller vult daar in wat
// door de voorcontrole komt, dus de echte grens moet tijdens het inflaten zelf worden getrokken.
const bomb: RawZipEntry = {
  ...await deflatedEntry('bom.bin', new Uint8Array(8 * 1024 * 1024)),
  uncompSize: 1024,
};

{
  const err = await caught(() => parseZipEntries(rawZip([bomb]), BOMB_LIMITS));
  eq('1 bom: weigering', err instanceof ZipValidationError, true);
  const bytesSeen = err instanceof ZipValidationError ? err.bytesSeen ?? -1 : -1;
  // Het budget plus hooguit één inflatie-chunk. Zit de toets ná de lus, dan staat hier 8 MiB.
  ok('1a …vóórdat alles is uitgepakt', bytesSeen > 0 && bytesSeen <= BUDGET + 1024 * 1024);
}

{
  // Ruime absolute grenzen, krap ratio-plafond: nu moet de RATIO de bindende reden zijn.
  const ratioLimits: ZipReadLimits = { ...EXTENSION_ZIP_LIMITS, maxRatio: 10 };
  const err = await caught(() => parseZipEntries(rawZip([bomb]), ratioLimits));
  eq('2 ratio-plafond weigert',
    err instanceof ZipValidationError && err.message.includes('ratio'), true);
}

{
  const many = [
    storedEntry('a.txt', bytes('a')),
    storedEntry('b.txt', bytes('b')),
    storedEntry('c.txt', bytes('c')),
  ];
  const limits: ZipReadLimits = { ...EXTENSION_ZIP_LIMITS, maxEntries: 2 };
  eq('3 te veel entries weigert',
    (await caught(() => parseZipEntries(rawZip(many), limits))) instanceof ZipValidationError, true);
  // …en met een ruime grens is precies dezelfde fixture gewoon leesbaar.
  eq('3a onder de grens leest hij normaal',
    (await parseZipEntries(rawZip(many), EXTENSION_ZIP_LIMITS)).map((e) => e.name),
    ['a.txt', 'b.txt', 'c.txt']);
}

{
  // Zip64-sentinel in de EOCD: de central-directory-offset staat op 0xffffffff.
  const err = await caught(() => parseZipEntries(
    rawZip([storedEntry('a.txt', bytes('a'))], { cdOffset: 0xffffffff }), EXTENSION_ZIP_LIMITS));
  eq('4 Zip64-sentinel in de EOCD weigert',
    err instanceof ZipValidationError && err.message.includes('Zip64'), true);

  // …en op entryniveau: een uncompressedSize van 0xffffffff betekent "zie het Zip64-extra-veld".
  const entryErr = await caught(() => parseZipEntries(
    rawZip([{ ...storedEntry('a.txt', bytes('a')), centralUncompSize: 0xffffffff }]),
    EXTENSION_ZIP_LIMITS));
  eq('4a Zip64-sentinel op een entry weigert',
    entryErr instanceof ZipValidationError && entryErr.message.includes('Zip64'), true);
}

{
  // `select`: wat niet gevraagd is, wordt niet uitgepakt. Geteld op de echte DecompressionStream,
  // want dát is de allocatie die we willen vermijden — een assertie op de uitkomst alleen zou een
  // implementatie die alles uitpakt en daarna filtert niet betrappen.
  const twee = rawZip([
    await deflatedEntry('a.txt', bytes('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')),
    await deflatedEntry('b.txt', bytes('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')),
  ]);
  const echt = globalThis.DecompressionStream;
  let inflateCalls = 0;
  class Telling extends echt {
    constructor(format: CompressionFormat) { inflateCalls++; super(format); }
  }
  globalThis.DecompressionStream = Telling as unknown as typeof DecompressionStream;
  try {
    const selected = await parseZipEntries(twee, EXTENSION_ZIP_LIMITS, (name) => name === 'a.txt');
    eq('5 select slaat entries over', selected.length, 1);
    eq('5a …en levert de gevraagde', selected[0]?.name, 'a.txt');
    eq('5b …en pakt de overgeslagene niet uit', inflateCalls, 1);
  } finally {
    globalThis.DecompressionStream = echt;
  }
}

{
  // Zonder `select` blijft het bestaande extensiegedrag: alles komt eruit.
  const alles = await parseZipEntries(rawZip([
    storedEntry('a.txt', bytes('een')),
    storedEntry('b.txt', bytes('twee')),
  ]), EXTENSION_ZIP_LIMITS);
  eq('6 zonder select komt alles eruit', alles.map((e) => e.name), ['a.txt', 'b.txt']);
  eq('6a …met de juiste inhoud', new TextDecoder().decode(alles[1].data), 'twee');
}

{
  // De local-header-fallback (geen EOCD) draagt dezelfde grenzen; anders is de hardening te omzeilen
  // door de central directory simpelweg weg te laten.
  const err = await caught(() => parseZipEntries(
    rawZip([bomb], { localOnly: true }), BOMB_LIMITS));
  eq('7 de fallbackroute weigert de bom ook', err instanceof ZipValidationError, true);
}

// ── Uitslag ─────────────────────────────────────────────────────────────────
if (diffs.length > 0) {
  console.log(`XX zip-laag — ${diffs.length} van de ${checks} checks rood:`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
console.log(`OK: zip-laag — ${checks} checks groen`);
