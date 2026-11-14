// #804 fase 1c, T1: byte-delen alleen naar een nieuw lokaal doel, download of siteversie.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { installNodeFileIpc } from './nodeFileIpc';
import { saveBytePartsDialog, saveBytePartsToRef } from '@/services/fileAccess';
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
  console.log(`Byte-delen: ${passed} geslaagd, ${failed} mislukt.`);
  if (failed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
