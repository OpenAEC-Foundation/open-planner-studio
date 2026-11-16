// #804 fase 1c, T1: byte-delen alleen naar een nieuw lokaal doel, download of siteversie.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { installNodeFileIpc } from './nodeFileIpc';
import { saveBytePartsDialog, saveBytePartsToRef, sourceTargetContent } from '@/services/fileAccess';
import { TARGET_CHUNK_BYTES } from '@/services/fileAccess/sourceTargetContent';
import { BytePartsWriteError } from '@/services/fileAccess/byteParts';
import { saveNewSiteFileParts, saveSiteFileVersionParts } from '@/services/fileAccess/siteBackend';

// Latin-1, CRLF, ongeldige UTF-8 en een geldige UTF-8-reeks over de deelgrens.
const parts: readonly Uint8Array[] = [
  new Uint8Array([0x49, 0x46, 0x43, 0x0d, 0x0a, 0xe9, 0x0d]),
  new Uint8Array([0x0a, 0xc3, 0x28, 0xff, 0xe2]),
  new Uint8Array([0x82, 0xac, 0x0d, 0x0a]),
];
const expected = Buffer.concat(parts);
const typedFailure = (error: unknown): boolean => error instanceof BytePartsWriteError;
let passed = 0;
let failed = 0;
async function check(name: string, run: () => Promise<void>) {
  try { await run(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}`, error); }
}

/** Een bron van ruim drie stukken, met afwijkingen aan het begin, op en vlak na een stukgrens, in het midden en aan
 * het eind, en een kortere en een langere variant. */
function contentFixture() {
  const source = new Uint8Array(3 * TARGET_CHUNK_BYTES + 12_345);
  for (let i = 0, x = 7; i < source.length; i++) { x = (x * 1103515245 + 12345) >>> 0; source[i] = x >>> 24; }
  const flipped = (at: number) => { const copy = new Uint8Array(source); copy[at] ^= 0x20; return copy; };
  const variants = new Map<string, Uint8Array>([
    ['begin', flipped(0)],
    ['laatste byte van stuk 1', flipped(TARGET_CHUNK_BYTES - 1)],
    ['eerste byte van stuk 2', flipped(TARGET_CHUNK_BYTES)],
    ['midden', flipped(Math.floor(source.length / 2))],
    ['eind', flipped(source.length - 1)],
    ['korter', source.subarray(0, source.length - 1)],
    ['langer', Buffer.concat([source, new Uint8Array([0x0a])])],
  ]);
  return { source, variants };
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-byte-parts-'));
  const ipc = installNodeFileIpc();
  try {
    await check('Tauri: nieuw doel bytegelijk, korte writes afgemaakt, geen tekstroute', async () => {
      ipc.faults.writeChunkSize = 2;
      const target = path.join(dir, 'nieuw.ifc');
      assert.equal(await saveBytePartsToRef({ kind: 'path', path: target }, parts), true);
      assert.deepEqual(fs.readFileSync(target), expected);
      assert.equal(ipc.openHandles(), 0);
      assert.equal(ipc.calls.find(c => c.command === 'plugin:fs|open')?.options?.createNew, true);
      assert.equal(ipc.calls.some(c => c.command === 'plugin:fs|write_text_file'), false);
    });
    await check('Tauri: bestand verschijnt bij aanmaken; botsing laat het intact', async () => {
      const target = path.join(dir, 'botsing.ifc');
      ipc.faults.beforeOpen = p => { if (p === target) fs.writeFileSync(target, 'INTUSSEN'); };
      try {
        await assert.rejects(saveBytePartsToRef({ kind: 'path', path: target }, parts), typedFailure);
        assert.equal(fs.readFileSync(target, 'utf8'), 'INTUSSEN');
      } finally { ipc.faults.beforeOpen = null; }
    });
    await check('Tauri: bestaand doel blijft intact; ook geen oude rename/directe terugval', async () => {
      const target = path.join(dir, 'bestaand.ifc');
      fs.writeFileSync(target, 'OUD');
      const before = ipc.calls.length;
      ipc.faults.renameError = new Error('Plaatsing geweigerd');
      try {
        let error: unknown;
        try { await saveBytePartsToRef({ kind: 'path', path: target }, parts); } catch (caught) { error = caught; }
        assert.equal(fs.readFileSync(target, 'utf8'), 'OUD');
        assert.ok(typedFailure(error));
        // T1 maakt het uiteindelijke doel exclusief: een vervangende rename is nooit bereikbaar.
        assert.equal(ipc.calls.slice(before).some(c => ['plugin:fs|rename', 'plugin:fs|write_file'].includes(c.command)), false);
      } finally { ipc.faults.renameError = null; }
    });
    await check('Tauri: schrijf-/sluitfout getypeerd, geen directe terugval of geslaagde opslag', async () => {
      for (const fault of ['write', 'close'] as const) {
        const target = path.join(dir, `${fault}.ifc`);
        const before = ipc.calls.length;
        if (fault === 'write') ipc.faults.writeErrorAfter = 2;
        else ipc.faults.closeError = new Error('Sluiten geweigerd');
        try {
          await assert.rejects(saveBytePartsToRef({ kind: 'path', path: target }, parts), typedFailure);
          assert.equal(fs.existsSync(target), false);
          assert.equal(ipc.openHandles(), 0);
          assert.equal(ipc.calls.slice(before).some(c => c.command === 'plugin:fs|write_file'), false);
        } finally { ipc.faults.writeErrorAfter = null; ipc.faults.closeError = null; }
      }
    });

    // #804, knownbug 1131 stap 1: staat op het eigen doel nog precies de bron? Grootte eerst, dan stukken van 1 MiB.
    const content = contentFixture();
    const reads: number[] = [];
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
    const invoke = internals.invoke;
    let failReadAt: number | null = null;
    internals.invoke = async (command, args, options) => {
      if (command === 'plugin:fs|read') {
        reads.push(Number((args as { len: number }).len));
        if (failReadAt !== null && reads.length === failReadAt) throw new Error('Input/output error (os error 5)');
      }
      return invoke(command, args, options);
    };
    const pathTarget = path.join(dir, 'bron.ifc');
    const pathContent = async (bytes: Uint8Array) => {
      fs.writeFileSync(pathTarget, bytes);
      return sourceTargetContent({ kind: 'path', path: pathTarget }, content.source);
    };
    await check('Tauri-pad: inhoudscontrole gelijk, en elke afwijking de juiste uitkomst', async () => {
      assert.equal(await pathContent(content.source), 'same');
      for (const [name, bytes] of content.variants) assert.equal(await pathContent(bytes), 'changed', name);
      fs.rmSync(pathTarget);
      assert.equal(await sourceTargetContent({ kind: 'path', path: pathTarget }, content.source), 'missing');
      assert.equal(ipc.openHandles(), 0);
    });
    await check('Tauri-pad: leesfout halverwege is onleesbaar, de handle gaat dicht', async () => {
      reads.length = 0; failReadAt = 2;
      try { assert.equal(await pathContent(content.source), 'unreadable'); }
      finally { failReadAt = null; }
      assert.equal(ipc.openHandles(), 0);
    });
    await check('Tauri-pad: nooit meer dan één stuk per lezing, nooit het hele bestand', async () => {
      reads.length = 0;
      const before = ipc.calls.length;
      assert.equal(await pathContent(content.source), 'same');
      assert.equal(reads.length, Math.ceil(content.source.length / TARGET_CHUNK_BYTES) + 1, 'stukken plus het einde');
      assert(reads.every(len => len <= TARGET_CHUNK_BYTES), `grootste lezing ${Math.max(...reads)} bytes`);
      assert.equal(ipc.calls.slice(before).some(c => c.command === 'plugin:fs|read_file'), false);
      // Een andere grootte leest niets; een verschil in het eerste stuk leest één stuk.
      reads.length = 0;
      assert.equal(await pathContent(content.variants.get('korter')!), 'changed');
      assert.equal(reads.length, 0);
      assert.equal(await pathContent(content.variants.get('begin')!), 'changed');
      assert.equal(reads.length, 1);
      console.log(`  bron ${content.source.length} bytes in ${Math.ceil(content.source.length / TARGET_CHUNK_BYTES)} stukken van hoogstens ${TARGET_CHUNK_BYTES} bytes`);
    });
    internals.invoke = invoke;
  } finally { ipc.dispose(); fs.rmSync(dir, { recursive: true, force: true }); }

  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const createUrl = URL.createObjectURL;
  const revokeUrl = URL.revokeObjectURL;
  const win: Record<string, unknown> = {};
  win.parent = win;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  const downloads: Blob[] = [];
  let clicks = 0;
  let downloadName = '';
  URL.createObjectURL = blob => { assert.ok(blob instanceof Blob); downloads.push(blob); return 'blob:byte-parts'; };
  URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ href: '', download: '', click() { clicks++; downloadName = this.download; } }),
  } });
  try {
    await check('Browserhandle: geen createNew beschikbaar, getypeerd geweigerd vóór schrijven', async () => {
      let writes = 0;
      const handle = { createWritable: () => { writes++; throw new Error('Mag niet schrijven'); } } as unknown as FileSystemFileHandle;
      await assert.rejects(saveBytePartsToRef({ kind: 'handle', handle }, parts), typedFailure);
      assert.equal(writes, 0);
    });
    await check('Download: bytegelijk, ook met aanwezige browserkiezer', async () => {
      win.showSaveFilePicker = () => { throw new Error('Handle kan T1 niet garanderen'); };
      const saved = await saveBytePartsDialog('nieuw.ifc', parts, [], { refuseTarget: null });
      assert.deepEqual(saved, { ref: null, name: 'nieuw.ifc', viaDownload: true });
      assert.equal(downloadName, 'nieuw.ifc');
      assert.equal(clicks, 1);
      assert.deepEqual(Buffer.from(await downloads[0].arrayBuffer()), expected);
    });
    await check('Download: weigering start geen download', async () => {
      assert.equal(await saveBytePartsDialog('nieuw.ifc', parts, [], { refuseTarget: null, refuseDownload: () => true }), null);
      assert.equal(clicks, 1);
    });

    let calls = 0;
    const siteBlobs: Blob[] = [];
    let lastBase: string | undefined;
    win.openaecHost = { storage: {
      list: async () => [], open: async () => null, versions: async () => [],
      save: async (request: { id?: string; data: Blob; baseVersion?: string }) => {
        calls++; siteBlobs.push(request.data); lastBase = request.baseVersion;
        return { id: request.id ?? 'nieuw', name: 'nieuw.ifc', version: 'v2' };
      },
    } };
    await check('Site: nieuwe naam als Blob, bytegelijk', async () => {
      assert.equal((await saveNewSiteFileParts('nieuw.ifc', parts)).id, 'nieuw');
      assert.deepEqual(Buffer.from(await siteBlobs.at(-1)!.arrayBuffer()), expected);
    });
    await check('Site: ontbrekende basisversie weigert met nul schrijfacties', async () => {
      const before = calls;
      for (const version of [null, '']) {
        await assert.rejects(saveSiteFileVersionParts('bron', 'bron.ifc', parts, version), typedFailure);
      }
      assert.equal(calls, before);
    });
    await check('Site: basisversie gaat mee; bytes ongewijzigd', async () => {
      assert.equal((await saveSiteFileVersionParts('bron', 'bron.ifc', parts, 'v1')).version, 'v2');
      assert.equal(lastBase, 'v1');
      assert.deepEqual(Buffer.from(await siteBlobs.at(-1)!.arrayBuffer()), expected);
    });
    await check('Site: echte SuperCloud-adapter geeft conflictkopie terug en houdt bron intact', async () => {
      const files = new Map([['bron', Buffer.from('COLLEGA')]]);
      const original = Buffer.from(files.get('bron')!);
      let copied: Uint8Array | undefined;
      win.openaecHost = {
        list: async () => [], open: async () => null, versions: async () => [],
        save: async (bytes: Uint8Array, options: { id?: string; expectedVersion?: string }) => {
          const id = options.expectedVersion === 'v2' ? options.id : 'kopie';
          assert.equal(options.id, 'bron'); assert.equal(options.expectedVersion, 'v1');
          copied = bytes;
          files.set(id!, Buffer.from(bytes));
          return { id, name: 'bron (conflict).ifc', version: 'v1', conflictCopy: true };
        },
      };
      assert.deepEqual(await saveSiteFileVersionParts('bron', 'bron.ifc', parts, 'v1'), {
        id: 'kopie', name: 'bron (conflict).ifc', version: 'v1', conflictCopy: true,
      });
      assert.deepEqual(Buffer.from(copied!), expected);
      assert.deepEqual(files.get('bron'), original);
      assert.deepEqual(files.get('kopie'), expected);
    });
  } finally {
    URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }

  await check('Browserhandle: inhoudscontrole gelijk, en elke afwijking de juiste uitkomst', async () => {
    const content = contentFixture();
    const slices: number[] = [];
    let failSliceAt: number | null = null;
    const handleFor = (bytes: Uint8Array | null, error?: string) => ({
      kind: 'file',
      async getFile() {
        if (error) throw new DOMException('weg', error);
        const file = new File([new Uint8Array(bytes!).buffer], 'bron.ifc');
        return { size: file.size, slice(start: number, end: number) {
          slices.push(end - start);
          if (failSliceAt !== null && slices.length === failSliceAt) return { arrayBuffer: () => Promise.reject(new DOMException('gewijzigd', 'NotReadableError')) };
          return file.slice(start, end);
        }, arrayBuffer() { throw new Error('nooit het hele bestand in één buffer'); } };
      },
    }) as unknown as FileSystemFileHandle;
    const handleContent = (bytes: Uint8Array | null, error?: string) =>
      sourceTargetContent({ kind: 'handle', handle: handleFor(bytes, error) }, content.source);
    assert.equal(await handleContent(content.source), 'same');
    assert.equal(slices.length, Math.ceil(content.source.length / TARGET_CHUNK_BYTES));
    assert(slices.every(len => len <= TARGET_CHUNK_BYTES));
    for (const [name, bytes] of content.variants) assert.equal(await handleContent(bytes), 'changed', name);
    assert.equal(await handleContent(null, 'NotFoundError'), 'missing');
    assert.equal(await handleContent(null, 'NotAllowedError'), 'unreadable');
    failSliceAt = slices.length + 2;
    assert.equal(await handleContent(content.source), 'unreadable', 'leesfout halverwege');
  });
  console.log(`Byte-delen: ${passed} geslaagd, ${failed} mislukt.`);
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
