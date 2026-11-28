import {
  EXTENSION_ZIP_LIMITS,
  ZipCompressionUnsupportedError,
  ZipValidationError,
  parseZipEntries,
  type ZipReadLimits,
} from '@/services/zip/zipReader';
import { crc32 } from '@/services/zip/crc32';
import { writeZip, type ZipFileInput } from '@/services/zip/zipWriter';

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

interface RawZipEntry {
  name: string;
  method: number;
  comp: Uint8Array;
  uncompSize: number;
  crc?: number;
  centralUncompSize?: number;
}

interface RawZipOptions {
  eocdTotal?: number;
  cdOffset?: number;
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
    view.setUint32(14, entry.crc ?? 0, true);
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
    view.setUint32(16, entry.crc ?? 0, true);
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
  ({ name, method: 0, comp: data, uncompSize: data.length, crc: crc32(data) });

const deflatedEntry = async (name: string, data: Uint8Array): Promise<RawZipEntry> =>
  ({ name, method: 8, comp: await deflateRaw(data), uncompSize: data.length, crc: crc32(data) });

const caught = async (fn: () => Promise<unknown>): Promise<unknown> => {
  try { await fn(); } catch (err) { return err; }
  return undefined;
};

const BUDGET = 64 * 1024;
const BOMB_LIMITS: ZipReadLimits = {
  maxEntryBytes: BUDGET,
  maxTotalBytes: BUDGET,
  maxEntries: 16,
  maxRatio: 1_000_000,
};

const bomb: RawZipEntry = {
  ...await deflatedEntry('bom.bin', new Uint8Array(8 * 1024 * 1024)),
  uncompSize: 1024,
};

{
  const err = await caught(() => parseZipEntries(rawZip([bomb]), BOMB_LIMITS));
  eq('1 bom: weigering', err instanceof ZipValidationError, true);
  const bytesSeen = err instanceof ZipValidationError ? err.bytesSeen ?? -1 : -1;
  ok('1a …vóórdat alles is uitgepakt', bytesSeen > 0 && bytesSeen <= BUDGET + 1024 * 1024);
}

{
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
  eq('3a onder de grens leest hij normaal',
    (await parseZipEntries(rawZip(many), EXTENSION_ZIP_LIMITS)).map((e) => e.name),
    ['a.txt', 'b.txt', 'c.txt']);
}

{
  const err = await caught(() => parseZipEntries(
    rawZip([storedEntry('a.txt', bytes('a'))], { cdOffset: 0xffffffff }), EXTENSION_ZIP_LIMITS));
  eq('4 Zip64-sentinel in de EOCD weigert',
    err instanceof ZipValidationError && err.message.includes('Zip64'), true);

  const entryErr = await caught(() => parseZipEntries(
    rawZip([{ ...storedEntry('a.txt', bytes('a')), centralUncompSize: 0xffffffff }]),
    EXTENSION_ZIP_LIMITS));
  eq('4a Zip64-sentinel op een entry weigert',
    entryErr instanceof ZipValidationError && entryErr.message.includes('Zip64'), true);
}

{
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
  const alles = await parseZipEntries(rawZip([
    storedEntry('a.txt', bytes('een')),
    storedEntry('b.txt', bytes('twee')),
  ]), EXTENSION_ZIP_LIMITS);
  eq('6 zonder select komt alles eruit', alles.map((e) => e.name), ['a.txt', 'b.txt']);
  eq('6a …met de juiste inhoud', new TextDecoder().decode(alles[1].data), 'twee');
}

{
  const err = await caught(() => parseZipEntries(
    rawZip([bomb], { localOnly: true }), BOMB_LIMITS));
  eq('7 de fallbackroute weigert de bom ook', err instanceof ZipValidationError, true);
}

eq('8 crc32 leeg', crc32(bytes('')) >>> 0, 0x00000000);
eq('8a crc32 check-waarde "123456789"', crc32(bytes('123456789')) >>> 0, 0xCBF43926);
eq('8b crc32 quick brown fox',
  crc32(bytes('The quick brown fox jumps over the lazy dog')) >>> 0, 0x414FA339);

const hex = (data: Uint8Array): string =>
  Array.from(data, (b) => b.toString(16).padStart(2, '0')).join('');

const methodsOf = (zip: Uint8Array): number[] => {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const out: number[] = [];
  let offset = 0;
  while (offset + 30 <= zip.length && view.getUint32(offset, true) === 0x04034b50) {
    out.push(view.getUint16(offset + 8, true));
    const compSize = view.getUint32(offset + 18, true);
    offset += 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true) + compSize;
  }
  return out;
};

const firstEntryName = (zip: Uint8Array): string => {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  return new TextDecoder().decode(zip.subarray(30, 30 + view.getUint16(26, true)));
};

const centralCrcsKloppen = async (zip: Uint8Array): Promise<boolean> => {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let p = zip.length - 22; p >= 0; p--) {
    if (view.getUint32(p, true) === 0x06054b50) { eocd = p; break; }
  }
  if (eocd < 0) return false;

  const total = view.getUint16(eocd + 10, true);
  let cd = view.getUint32(eocd + 16, true);
  const declared = new Map<string, number>();
  for (let i = 0; i < total; i++) {
    if (view.getUint32(cd, true) !== 0x02014b50) return false;
    const nameLen = view.getUint16(cd + 28, true);
    const name = new TextDecoder().decode(zip.subarray(cd + 46, cd + 46 + nameLen));
    declared.set(name, view.getUint32(cd + 16, true) >>> 0);
    cd += 46 + nameLen + view.getUint16(cd + 30, true) + view.getUint16(cd + 32, true);
  }

  const entries = await parseZipEntries(
    zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer,
    EXTENSION_ZIP_LIMITS,
  );
  if (entries.length !== declared.size) return false;
  return entries.every((entry) => declared.get(entry.name) === (crc32(entry.data) >>> 0));
};

const files: ZipFileInput[] = [
  { name: '[Content_Types].xml', data: bytes('<Types/>') },
  { name: 'xl/workbook.xml', data: bytes('<workbook>'.repeat(40)) },
  { name: 'leeg.bin', data: new Uint8Array(0) },
];

const roundTrip = async (
  input: readonly ZipFileInput[],
  opts: { deflate?: ((data: Uint8Array) => Promise<Uint8Array>) | null },
): Promise<string> => {
  const zip = await writeZip(input, opts);
  const back = await parseZipEntries(
    zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer,
    EXTENSION_ZIP_LIMITS,
  );
  if (back.length !== input.length) return `aantal ${back.length} ≠ ${input.length}`;
  for (const original of input) {
    const found = back.find((entry) => entry.name === original.name);
    if (!found) return `ontbreekt: ${original.name}`;
    if (hex(found.data) !== hex(original.data)) return `bytes verschillen: ${original.name}`;
  }
  return 'ok';
};

eq('9 store: round-trip', await roundTrip(files, { deflate: null }), 'ok');
eq('9a deflate: round-trip', await roundTrip(files, {}), 'ok');

{
  const big: ZipFileInput[] = [{ name: 'groot.txt', data: bytes('herhaal '.repeat(20000)) }];
  eq('10 deflate is kleiner',
    (await writeZip(big)).length < (await writeZip(big, { deflate: null })).length, true);
}

{
  const random = new Uint8Array(4096);
  for (let i = 0; i < random.length; i++) random[i] = (i * 2654435761) % 251 ^ ((i >> 3) * 97);
  const zip = await writeZip([{ name: 'ruis.bin', data: crypto.getRandomValues(random) }]);
  eq('11 incompressibel blijft store', methodsOf(zip)[0], 0);
}

eq('12 Content_Types eerst', firstEntryName(await writeZip([
  { name: 'xl/workbook.xml', data: bytes('<workbook/>') },
  { name: '[Content_Types].xml', data: bytes('<Types/>') },
])), '[Content_Types].xml');

eq('13 deterministisch', hex(await writeZip(files)), hex(await writeZip(files)));

eq('14 crc in de central directory klopt', await centralCrcsKloppen(await writeZip(files)), true);
eq('14a …ook in de store-tak',
  await centralCrcsKloppen(await writeZip(files, { deflate: null })), true);

{
  ok('15 niet-ASCII naam gooit',
    (await caught(() => writeZip([{ name: 'blad€.xml', data: bytes('x') }]))) instanceof Error);
  ok('15a lege naam gooit',
    (await caught(() => writeZip([{ name: '', data: bytes('x') }]))) instanceof Error);
}

{
  const tooMany: ZipFileInput[] = [];
  for (let i = 0; i <= 0xffff; i++) tooMany.push({ name: `f${i}.txt`, data: bytes('x') });
  ok('16 >65535 entries gooit', (await caught(() => writeZip(tooMany))) instanceof Error);
}

{
  const data = bytes('voortgangsblad');
  const goed = rawZip([storedEntry('a.txt', data)]);
  eq('17 een ongeschonden entry leest gewoon',
    new TextDecoder().decode((await parseZipEntries(goed, EXTENSION_ZIP_LIMITS))[0]!.data),
    'voortgangsblad');

  const stuk = goed.slice(0);
  const payloadStart = 30 + 'a.txt'.length;
  new Uint8Array(stuk)[payloadStart] ^= 0xff;
  const err = await caught(() => parseZipEntries(stuk, EXTENSION_ZIP_LIMITS));
  eq('17a een geflipte byte ⇒ beschadigd archief',
    err instanceof ZipValidationError && err.message.includes('CRC-32'), true);

  const localStuk = rawZip([storedEntry('a.txt', data)], { localOnly: true }).slice(0);
  new Uint8Array(localStuk)[payloadStart] ^= 0xff;
  const localErr = await caught(() => parseZipEntries(localStuk, EXTENSION_ZIP_LIMITS));
  eq('17b …ook zonder central directory',
    localErr instanceof ZipValidationError && localErr.message.includes('CRC-32'), true);

  const gedeflate = rawZip([await deflatedEntry('b.txt', bytes('x'.repeat(400)))]);
  eq('17c een gedeflate entry haalt zijn eigen CRC',
    (await parseZipEntries(gedeflate, EXTENSION_ZIP_LIMITS))[0]!.data.length, 400);
  const gelogen = rawZip([{ ...await deflatedEntry('b.txt', bytes('x'.repeat(400))), crc: 0x1234 }]);
  const deflErr = await caught(() => parseZipEntries(gelogen, EXTENSION_ZIP_LIMITS));
  eq('17d …en een gelogen CRC op een gedeflate entry wordt betrapt',
    deflErr instanceof ZipValidationError && deflErr.message.includes('CRC-32'), true);
}

{
  const data = bytes('descriptor-entry');
  const naam = bytes('d.txt');
  const bit3 = (crcInDescriptor: number): ArrayBuffer => {
    const chunk = new Uint8Array(30 + naam.length + data.length + 16);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x08, true);
    view.setUint16(8, 0, true);
    view.setUint32(14, 0, true);
    view.setUint32(18, 0, true);
    view.setUint32(22, 0, true);
    view.setUint16(26, naam.length, true);
    chunk.set(naam, 30);
    chunk.set(data, 30 + naam.length);
    const desc = 30 + naam.length + data.length;
    view.setUint32(desc, 0x08074b50, true);
    view.setUint32(desc + 4, crcInDescriptor, true);
    view.setUint32(desc + 8, data.length, true);
    view.setUint32(desc + 12, data.length, true);
    return chunk.buffer as ArrayBuffer;
  };

  eq('19 bit-3-entry leest, met de CRC uit de descriptor',
    new TextDecoder().decode((await parseZipEntries(bit3(crc32(data)), EXTENSION_ZIP_LIMITS))[0]!.data),
    'descriptor-entry');
  const err = await caught(() => parseZipEntries(bit3(0xdeadbeef), EXTENSION_ZIP_LIMITS));
  eq('19a …en een gelogen descriptor-CRC wordt betrapt',
    err instanceof ZipValidationError && err.message.includes('CRC-32'), true);
}

{
  const gedeflate = rawZip([await deflatedEntry('a.txt', bytes('y'.repeat(400)))]);
  const err = await caught(() =>
    parseZipEntries(gedeflate, EXTENSION_ZIP_LIMITS, undefined, { inflate: null }));
  eq('18 geen inflater ⇒ eigen fout', err instanceof ZipCompressionUnsupportedError, true);
  eq('18a …met een reden die de gebruiker iets zegt',
    err instanceof Error && /ompressie niet ondersteund/.test(err.message), true);
  eq('18b …en niet vervlakt tot een budgetweigering',
    err instanceof Error && !err.message.includes('budget') && !err.message.includes('uitpaklimiet'),
    true);
  eq('18c een stored entry blijft leesbaar zonder inflater',
    (await parseZipEntries(rawZip([storedEntry('a.txt', bytes('hoi'))]), EXTENSION_ZIP_LIMITS,
      undefined, { inflate: null }))[0]?.name,
    'a.txt');
}

if (diffs.length > 0) {
  console.log(`XX zip-laag — ${diffs.length} van de ${checks} checks rood:`);
  for (const diff of diffs) console.log(`   XX ${diff}`);
  process.exit(1);
}
console.log(`OK: zip-laag — ${checks} checks groen`);
