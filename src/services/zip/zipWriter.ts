/**
 * Minimale ZIP-**schrijver** (issue #27, etappe 3, X3). Puur en injecteerbaar: geen store, geen
 * React, geen `@tauri-apps/*`, geen module-level muteerbare state.
 *
 * De keuzes die dit bestand dragen:
 *
 * - **Store is de bodem, deflate is de bonus.** Een ZIP met methode 0 is volledig geldig; Excel en
 *   LibreOffice openen hem zonder morren. Ontbreekt `CompressionStream('deflate-raw')` — oudere
 *   WebKitGTK-webviews zijn de reële twijfel — dan blijft het blad gewoon werken, alleen wat groter.
 *   Een entry waarvan de deflate-uitkomst niet kleiner is dan de bron wordt als store opgeslagen.
 * - **CRC-32 altijd over de ONGECOMPRIMEERDE data.** Zie `crc32.ts`.
 * - **Geen data descriptor.** We kennen alle maten vóór het schrijven, dus vlag 0x08 blijft uit.
 * - **Deterministisch.** Vaste DOS-datum/tijd (1980-01-01 00:00), geen klok en geen locale: twee
 *   exports van hetzelfde project geven byte-identieke bestanden. De wijzigingsdatum van een
 *   gegenereerd blad zegt toch niets — die draagt het bestandssysteem al.
 * - **ASCII-namen verplicht** en **32-bits grenzen zijn een weigering**: geen stille
 *   Zip64-improvisatie, geen onduidelijke codepage.
 */

import { crc32 } from './crc32';

export interface ZipFileInput {
  name: string;
  data: Uint8Array;
}

/** De 16-bits en 32-bits plafonds van het klassieke ZIP-formaat; erboven begint Zip64. */
const MAX_ENTRIES = 0xffff;
const MAX_U32 = 0xffffffff;

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_EOCD = 0x06054b50;

/** 1980-01-01 00:00 — de DOS-epoch. `((jaar−1980) << 9) | (maand << 5) | dag`. */
const DOS_TIME = 0x0000;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/** OOXML-consumers verwachten deze part als eerste entry. Geen spec-eis, wel wat elke echte
 *  schrijver doet — en sommige strikte lezers leunen erop. */
const CONTENT_TYPES = '[Content_Types].xml';

/** Printbare ASCII, zonder stuurtekens. Al onze partnamen voldoen daaraan; daarmee is de
 *  UTF-8-vlag (bit 11) een non-issue in plaats van een stilzwijgende gok. */
const ASCII_NAME = /^[\x20-\x7e]+$/;

async function deflateViaCompressionStream(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  void writer.write(data as Uint8Array<ArrayBuffer>).catch(() => {});
  void writer.close().catch(() => {});

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) { out.set(chunk, pos); pos += chunk.length; }
  return out;
}

function assertWritableName(name: string): void {
  if (!ASCII_NAME.test(name)) {
    throw new Error(`ZIP-entrynaam moet printbare ASCII zijn: ${JSON.stringify(name)}`);
  }
  if (name.startsWith('/') || name.includes('\\')) {
    throw new Error(`Onveilige ZIP-entrynaam: ${JSON.stringify(name)}`);
  }
}

interface PreparedEntry {
  nameBytes: Uint8Array;
  method: number;
  crc: number;
  comp: Uint8Array;
  uncompressedSize: number;
}

/**
 * Bouw een ZIP uit `files`. `deflate` is injecteerbaar zodat beide takken (deflate én store) getest
 * kunnen worden zonder de omgeving te vervalsen: `null` dwingt store af, `undefined` kiest
 * `CompressionStream` als die bestaat.
 */
export async function writeZip(
  files: readonly ZipFileInput[],
  opts: { deflate?: ((data: Uint8Array) => Promise<Uint8Array>) | null } = {},
): Promise<Uint8Array> {
  if (files.length > MAX_ENTRIES) {
    throw new Error(`ZIP kan maximaal ${MAX_ENTRIES} entries dragen, niet ${files.length}`);
  }

  const deflate = opts.deflate === undefined
    ? (typeof CompressionStream !== 'undefined' ? deflateViaCompressionStream : null)
    : opts.deflate;

  // `[Content_Types].xml` naar voren; de rest houdt zijn opgegeven volgorde.
  const ordered = [
    ...files.filter((file) => file.name === CONTENT_TYPES),
    ...files.filter((file) => file.name !== CONTENT_TYPES),
  ];

  const seen = new Set<string>();
  const prepared: PreparedEntry[] = [];
  for (const file of ordered) {
    assertWritableName(file.name);
    if (seen.has(file.name)) throw new Error(`Dubbele ZIP-entrynaam: ${JSON.stringify(file.name)}`);
    seen.add(file.name);
    if (file.data.length > MAX_U32) {
      throw new Error(`ZIP-entry "${file.name}" is te groot voor een 32-bits ZIP`);
    }

    let method = 0;
    let comp: Uint8Array = file.data;
    if (deflate && file.data.length > 0) {
      const deflated = await deflate(file.data);
      // Alleen als het écht kleiner is: anders zou elk al-gecomprimeerd part onnodig opzwellen.
      if (deflated.length < file.data.length) {
        method = 8;
        comp = deflated;
      }
    }

    prepared.push({
      nameBytes: new TextEncoder().encode(file.name),
      method,
      crc: crc32(file.data),
      comp,
      uncompressedSize: file.data.length,
    });
  }

  const localSize = prepared.reduce((sum, e) => sum + 30 + e.nameBytes.length + e.comp.length, 0);
  const centralSize = prepared.reduce((sum, e) => sum + 46 + e.nameBytes.length, 0);
  if (localSize > MAX_U32 || localSize + centralSize + 22 > MAX_U32) {
    throw new Error('ZIP is te groot voor het 32-bits formaat');
  }

  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);

  const localOffsets: number[] = [];
  let pos = 0;
  for (const entry of prepared) {
    localOffsets.push(pos);
    view.setUint32(pos, SIG_LOCAL, true);
    view.setUint16(pos + 4, 20, true);              // version needed
    view.setUint16(pos + 6, 0, true);               // flags — géén data descriptor
    view.setUint16(pos + 8, entry.method, true);
    view.setUint16(pos + 10, DOS_TIME, true);
    view.setUint16(pos + 12, DOS_DATE, true);
    view.setUint32(pos + 14, entry.crc, true);
    view.setUint32(pos + 18, entry.comp.length, true);
    view.setUint32(pos + 22, entry.uncompressedSize, true);
    view.setUint16(pos + 26, entry.nameBytes.length, true);
    view.setUint16(pos + 28, 0, true);              // extra
    out.set(entry.nameBytes, pos + 30);
    out.set(entry.comp, pos + 30 + entry.nameBytes.length);
    pos += 30 + entry.nameBytes.length + entry.comp.length;
  }

  const cdStart = pos;
  prepared.forEach((entry, index) => {
    view.setUint32(pos, SIG_CENTRAL, true);
    view.setUint16(pos + 4, 20, true);              // version made by
    view.setUint16(pos + 6, 20, true);              // version needed
    view.setUint16(pos + 8, 0, true);               // flags
    view.setUint16(pos + 10, entry.method, true);
    view.setUint16(pos + 12, DOS_TIME, true);
    view.setUint16(pos + 14, DOS_DATE, true);
    view.setUint32(pos + 16, entry.crc, true);
    view.setUint32(pos + 20, entry.comp.length, true);
    view.setUint32(pos + 24, entry.uncompressedSize, true);
    view.setUint16(pos + 28, entry.nameBytes.length, true);
    view.setUint16(pos + 30, 0, true);              // extra
    view.setUint16(pos + 32, 0, true);              // comment
    view.setUint16(pos + 34, 0, true);              // disk
    view.setUint16(pos + 36, 0, true);              // internal attrs
    view.setUint32(pos + 38, 0, true);              // external attrs
    view.setUint32(pos + 42, localOffsets[index], true);
    out.set(entry.nameBytes, pos + 46);
    pos += 46 + entry.nameBytes.length;
  });

  view.setUint32(pos, SIG_EOCD, true);
  view.setUint16(pos + 4, 0, true);                 // disk
  view.setUint16(pos + 6, 0, true);                 // disk met central directory
  view.setUint16(pos + 8, prepared.length, true);
  view.setUint16(pos + 10, prepared.length, true);
  view.setUint32(pos + 12, centralSize, true);
  view.setUint32(pos + 16, cdStart, true);
  view.setUint16(pos + 20, 0, true);                // comment

  return out;
}
