// #804 fase 1c, T1 en knownbug 1131 stap 4: de voorbereide IFC-bytes alleen naar een nieuw lokaal doel (op de desktop
// via een eigen tijdelijk bestand en `place_file_exclusive`), download of siteversie.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { installNodeFileIpc, writeFileCall as fileWrite } from './nodeFileIpc';
import { saveNewBytesDialog, saveNewBytesToRef, sourceTargetContent } from '@/services/fileAccess';
import { TARGET_CHUNK_BYTES } from '@/services/fileAccess/sourceTargetContent';
import { ByteWriteError } from '@/services/fileAccess/byteWrite';
import { NEW_NAME_LOG_CHANNEL } from '@/services/fileAccess/atomicWrite';
import { appLog } from '@/services/debug/appLog';
import { saveNewSiteFileBytes, saveSiteFileVersionBytes } from '@/services/fileAccess/siteBackend';

// Latin-1, CRLF, ongeldige UTF-8 en een geldige UTF-8-reeks: de bytes gaan ongewijzigd door, nooit als tekst.
const bytes = new Uint8Array([
  0x49, 0x46, 0x43, 0x0d, 0x0a, 0xe9, 0x0d, 0x0a, 0xc3, 0x28, 0xff, 0xe2, 0x82, 0xac, 0x0d, 0x0a,
]);
const expected = Buffer.from(bytes);
const typedFailure = (error: unknown): boolean => error instanceof ByteWriteError;
const reason = (expected: ByteWriteError['reason']) => (error: unknown): boolean =>
  error instanceof ByteWriteError && error.reason === expected;
/** Een schrijfaanroep die het doel zelf afkapt (geen eigen aanmaak, geen toevoegen). */
const direct = (c: { command: string; options?: { createNew?: boolean; append?: boolean } }) =>
  fileWrite(c) && !c.options?.createNew && !c.options?.append;
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-ifc-bytes-'));
  const ipc = installNodeFileIpc();
  try {
    // #804, knownbug 1131 stap 4: een nieuwe naam krijgt eerst een eigen tijdelijk bestand (de hele buffer in één
    // rauwe aanroep), en `place_file_exclusive` zet het op de naam. Elke proef heeft een eigen map, zodat de stand op
    // schijf na afloop compleet te zien is: welke bestanden er staan, met welke bytes.
    let caseNo = 0;
    const caseDir = () => { const d = path.join(dir, `geval-${++caseNo}`); fs.mkdirSync(d); return d; };
    const onDisk = (d: string) => Object.fromEntries(fs.readdirSync(d).sort().map(name => [name, fs.readFileSync(path.join(d, name)).toString('hex')]));
    const hex = (data: Uint8Array | string) => Buffer.from(data).toString('hex');
    const isTemp = (p: string | undefined) => /[\\/]save-[0-9a-z]+\.ops-save\.tmp$/.test(p ?? '');
    const callsFrom = (before: number) => ipc.calls.slice(before);
    const writesTo = (calls: typeof ipc.calls) => calls.filter(c => fileWrite(c) || c.command === 'plugin:fs|write');
    const placeCalls = (calls: typeof ipc.calls) => calls.filter(c => c.command === 'place_file_exclusive');
    const removes = (calls: typeof ipc.calls) => calls.filter(c => c.command === 'plugin:fs|remove');
    const withPlace = async (answer: NonNullable<typeof ipc.faults.place>, run: () => Promise<void>) => {
      ipc.faults.place = answer;
      try { await run(); } finally { ipc.faults.place = null; }
    };
    const save = (target: string) => saveNewBytesToRef({ kind: 'path', path: target }, bytes);
    const caught = async (run: Promise<unknown>) => { try { await run; } catch (error) { return error; } throw new Error('geen fout'); };

    await check('1. Tauri: tijdelijk bestand met de hele buffer, één plaatsing, geen append; alleen het doel blijft', async () => {
      const d = caseDir(), target = path.join(d, 'nieuw.ifc'), before = ipc.calls.length;
      assert.equal(await save(target), true);
      assert.deepEqual(onDisk(d), { 'nieuw.ifc': hex(bytes) });
      assert.equal(ipc.openHandles(), 0);
      const calls = callsFrom(before);
      // Nooit bytes in een object (Tauri maakt daar JSON van, één getal per byte), nooit een tekstroute.
      assert.equal(calls.some(c => c.bytesInObject), false);
      assert.equal(calls.some(c => c.command === 'plugin:fs|open' || c.command === 'plugin:fs|write'), false);
      const writes = writesTo(calls);
      assert.equal(writes.length, 1, 'één schrijfaanroep');
      assert.equal(isTemp(writes[0].path), true, 'in het eigen tijdelijke bestand, niet in het doel');
      assert.equal(path.dirname(writes[0].path!), d, 'in dezelfde map');
      assert.deepEqual([writes[0].command, writes[0].rawBody, writes[0].options?.createNew, writes[0].options?.append],
        ['plugin:fs|write_file', true, true, undefined]);
      assert.deepEqual(placeCalls(calls).map(c => [c.command, c.path]), [['place_file_exclusive', target]]);
      assert.equal(calls.some(c => c.command === 'plugin:fs|rename'), false, 'geen rename van plugin-fs (die vervangt)');
      assert.equal(removes(calls).length, 0);
    });
    await check('2. Tauri: crash na het tijdelijke bestand laat geen (half) einddoel achter', async () => {
      const d = caseDir(), target = path.join(d, 'crash.ifc');
      let reached!: () => void;
      const atPlace = new Promise<void>(resolve => { reached = resolve; });
      // De route blijft voor altijd in de plaatsing hangen: de stand op schijf is die van een afgebroken app.
      await withPlace(() => { reached(); return new Promise<undefined>(() => {}); }, async () => {
        const route = save(target).then(() => 'klaar', () => 'fout');
        assert.equal(await Promise.race([atPlace.then(() => 'plaatsing'), route]), 'plaatsing', 'de route kwam bij de plaatsing');
        const files = onDisk(d);
        assert.equal(fs.existsSync(target), false, 'het einddoel bestaat niet');
        assert.deepEqual(Object.values(files), [hex(bytes)], 'alleen het tijdelijke bestand, compleet');
        assert.equal(isTemp(path.join(d, Object.keys(files)[0])), true);
      });
    });
    await check('3. Tauri: schrijffout in het tijdelijke bestand: geen doel, geen hulpbestand, fout write', async () => {
      const d = caseDir(), target = path.join(d, 'schrijffout.ifc'), before = ipc.calls.length;
      ipc.faults.writeErrorAfter = 3;
      try {
        assert.ok(reason('write')(await caught(save(target))));
      } finally { ipc.faults.writeErrorAfter = null; }
      assert.deepEqual(onDisk(d), {});
      const calls = callsFrom(before);
      assert.equal(placeCalls(calls).length, 0, 'geen plaatsing');
      assert.equal(calls.some(direct), false, 'geen directe terugval');
      assert.deepEqual(removes(calls).map(c => isTemp(c.path)), [true], 'alleen het eigen bestand opgeruimd');
    });
    await check('4. Tauri: doel verschijnt tussen kiezen en plaatsen: vreemd bestand bytegelijk, fout create-new', async () => {
      const d = caseDir(), target = path.join(d, 'intussen.ifc'), before = ipc.calls.length;
      await withPlace((_from, to, real) => { fs.writeFileSync(to, 'VAN EEN ANDER'); return real(); }, async () => {
        assert.ok(reason('create-new')(await caught(save(target))));
      });
      assert.deepEqual(onDisk(d), { 'intussen.ifc': hex('VAN EEN ANDER') }, 'vreemd bestand intact, hulpbestand weg');
      const calls = callsFrom(before);
      assert.equal(writesTo(calls).length, 1, 'geen directe aanmaak als terugval');
      assert.deepEqual(removes(calls).map(c => isTemp(c.path)), [true], 'nooit het doel verwijderd');
    });
    for (const [label, answer] of [
      ['unsupported', { reject: { code: 'unsupported', message: 'geen RENAME_NOREPLACE' } }],
      ['refused/scope', { reject: { code: 'refused', reason: 'scope' } }],
    ] as const) {
      await check(`5. Tauri: ${label}: hulpbestand weg, dan de directe exclusieve aanmaak`, async () => {
        const d = caseDir(), target = path.join(d, 'direct.ifc'), before = ipc.calls.length;
        await withPlace(() => answer, async () => { assert.equal(await save(target), true); });
        assert.deepEqual(onDisk(d), { 'direct.ifc': hex(bytes) });
        const writes = writesTo(callsFrom(before));
        assert.deepEqual(writes.map(c => [isTemp(c.path), c.path === target, c.options?.createNew]), [[true, false, true], [false, true, true]]);
        assert.equal(callsFrom(before).some(c => c.options?.append), false);
      });
      await check(`5. Tauri: ${label}, en het doel verschijnt intussen: het blijft bytegelijk`, async () => {
        const d = caseDir(), target = path.join(d, 'bezet.ifc');
        await withPlace((_from, to) => { fs.writeFileSync(to, 'BEZET'); return answer; }, async () => {
          assert.ok(reason('create-new')(await caught(save(target))));
        });
        assert.deepEqual(onDisk(d), { 'bezet.ifc': hex('BEZET') });
      });
    }
    await check('6. Tauri: tijdelijk bestand buiten de scope (forbidden path): directe aanmaak, één aanroep', async () => {
      const d = caseDir(), target = path.join(d, 'buiten-thuismap.ifc'), before = ipc.calls.length;
      ipc.faults.forbidden = p => isTemp(p);
      try { assert.equal(await save(target), true); } finally { ipc.faults.forbidden = null; }
      assert.deepEqual(onDisk(d), { 'buiten-thuismap.ifc': hex(bytes) });
      const calls = callsFrom(before);
      assert.deepEqual(writesTo(calls).filter(c => c.wrote).map(c => [c.path, c.options?.createNew, c.options?.append]), [[target, true, undefined]]);
      assert.equal(placeCalls(calls).length, 0);
      assert.equal(removes(calls).length, 0, 'geen eigendom, niets opgeruimd');
    });
    await check('6b. Tauri: een andere aanmaakfout van het hulpbestand: geen terugval, niets verwijderd', async () => {
      const d = caseDir(), target = path.join(d, 'botsing-hulpnaam.ifc'), before = ipc.calls.length;
      ipc.faults.beforeOpen = p => { if (isTemp(p)) fs.writeFileSync(p, 'AL DAAR'); };
      try { assert.ok(reason('write')(await caught(save(target)))); } finally { ipc.faults.beforeOpen = null; }
      assert.deepEqual(Object.values(onDisk(d)), [hex('AL DAAR')], 'het bestaande hulpbestand blijft, geen doel');
      const calls = callsFrom(before);
      assert.equal(placeCalls(calls).length + removes(calls).length, 0);
      assert.equal(writesTo(calls).some(c => c.path === target), false);
    });
    await check('7. Tauri: source-changed: stoppen, geen schrijf- of verwijderactie meer, eigen foutreden', async () => {
      const d = caseDir(), target = path.join(d, 'onbekend.ifc'), before = ipc.calls.length;
      await withPlace((_from, _to, real) => { real(); return { reject: { code: 'source-changed' } }; }, async () => {
        assert.ok(reason('source-changed')(await caught(save(target))));
      });
      const calls = callsFrom(before), at = calls.findIndex(c => c.command === 'place_file_exclusive');
      assert.deepEqual(calls.slice(at + 1).map(c => c.command), [], 'na de plaatsing geen enkele aanroep');
      assert.deepEqual(onDisk(d), { 'onbekend.ifc': hex(bytes) }, 'de stand op schijf is wat de stap achterliet');
    });
    await check('8. Tauri: io: fout write met de oorzaak, hulpbestand weg', async () => {
      const d = caseDir(), target = path.join(d, 'io.ifc');
      await withPlace(() => ({ reject: { code: 'io', message: 'Input/output error (os error 5)' } }), async () => {
        const error = await caught(save(target));
        assert.ok(reason('write')(error));
        assert.match(String((error as ByteWriteError).cause), /os error 5/);
      });
      assert.deepEqual(onDisk(d), {});
    });
    await check('8b. Tauri: io nadat de hernoeming toch gebeurde (1795): dezelfde fout, opruimen verbergt niets', async () => {
      const d = caseDir(), target = path.join(d, 'netwerkschijf.ifc'), before = ipc.calls.length;
      await withPlace((_from, _to, real) => { real(); return { reject: { code: 'io', message: 'Stale file handle (os error 116)' } }; }, async () => {
        const error = await caught(save(target));
        assert.ok(reason('write')(error));
        assert.match(String((error as ByteWriteError).cause), /os error 116/);
      });
      // De hulpnaam bestond niet meer: het opruimen faalde stil. Het doel wordt niet teruggelezen om succes te melden.
      assert.deepEqual(onDisk(d), { 'netwerkschijf.ifc': hex(bytes) });
      const calls = callsFrom(before);
      assert.deepEqual(removes(calls).map(c => isTemp(c.path)), [true]);
      assert.equal(calls.some(c => c.command === 'plugin:fs|read_file' || c.command === 'plugin:fs|open'), false);
    });
    for (const reasonCode of ['not-regular-file', 'helper-name'] as const) {
      await check(`8c. Tauri: refused/${reasonCode}: fout, opruimen alleen als er geen ander object onder de hulpnaam kan staan`, async () => {
        const d = caseDir(), target = path.join(d, `refused-${reasonCode}.ifc`), before = ipc.calls.length;
        await withPlace(() => ({ reject: { code: 'refused', reason: reasonCode } }), async () => {
          assert.ok(reason('write')(await caught(save(target))));
        });
        assert.equal(fs.existsSync(target), false);
        assert.equal(removes(callsFrom(before)).length, reasonCode === 'not-regular-file' ? 0 : 1);
        assert.equal(writesTo(callsFrom(before)).length, 1, 'geen directe terugval');
      });
    }
    await check('8d. Tauri: refused/hard-linked (het tijdelijke bestand kreeg een tweede naam): fout, alleen de eigen naam weg, de tweede naam blijft', async () => {
      const d = caseDir(), target = path.join(d, 'tweede-naam.ifc'), second = path.join(d, 'tweede.bin'), before = ipc.calls.length;
      // De echte nabootsing beslist: eerst een tweede naam voor het tijdelijke bestand, dan de controle van het commando.
      await withPlace((from, _to, real) => { fs.linkSync(from, second); return real(); }, async () => {
        const error = await caught(save(target));
        assert.ok(reason('write')(error));
        assert.match(String((error as ByteWriteError).cause), /refused \(hard-linked\)/);
      });
      assert.deepEqual(onDisk(d), { 'tweede.bin': hex(bytes) }, 'geen doel; de inhoud staat nog onder de tweede naam');
      const calls = callsFrom(before);
      assert.deepEqual(removes(calls).map(c => isTemp(c.path)), [true], 'alleen de eigen hulpnaam opgeruimd');
      assert.equal(writesTo(calls).length, 1, 'geen directe terugval');
    });
    await check('9. Tauri: dir-not-synced: het bestand is geplaatst, dus geslaagd (met een waarschuwing)', async () => {
      const d = caseDir(), target = path.join(d, 'niet-vastgelegd.ifc');
      const warn = console.warn, warnings: unknown[][] = [];
      console.warn = (...args: unknown[]) => { warnings.push(args); };
      try {
        await withPlace((_from, _to, real) => { real(); return { resolve: { code: 'dir-not-synced', message: 'fsync van de map mislukte' } }; }, async () => {
          assert.equal(await save(target), true);
        });
      } finally { console.warn = warn; }
      assert.deepEqual(onDisk(d), { 'niet-vastgelegd.ifc': hex(bytes) });
      assert.match(warnings.map(w => w.map(String).join(' ')).join('\n'), /fsync van de map mislukte/);
    });
    await check('10. Tauri: per doel één logregel met de weg die de route nam, zonder inhoud', async () => {
      // De echte-app-proef leest deze regel terug; hier staat vast wat hij per uitkomst zegt: het doelpad en de weg,
      // verder niets (de hele regel wordt vergeleken).
      const logFor = (target: string) => appLog.snapshot()
        .filter(e => e.channel === NEW_NAME_LOG_CHANNEL && e.text.startsWith(`${target}: `))
        .map(e => e.text.slice(target.length + 2));
      const cases: [string, Parameters<typeof withPlace>[0] | null, (() => void) | null, string][] = [
        ['geplaatst.ifc', null, null, 'geplaatst (placed)'],
        ['map-niet-vast.ifc', (_f, _t, real) => { real(); return { resolve: { code: 'dir-not-synced', message: 'x' } }; }, null, 'geplaatst (dir-not-synced)'],
        ['unsupported.ifc', () => ({ reject: { code: 'unsupported', message: 'x' } }), null, 'directe aanmaak (unsupported)'],
        ['scope.ifc', () => ({ reject: { code: 'refused', reason: 'scope' } }), null, 'directe aanmaak (refused/scope)'],
        ['forbidden.ifc', null, () => { ipc.faults.forbidden = p => isTemp(p); }, 'directe aanmaak (forbidden path)'],
        ['io.ifc', () => ({ reject: { code: 'io', message: 'x' } }), null, 'niet geplaatst (io)'],
        ['bezet-log.ifc', (_f, to, real) => { fs.writeFileSync(to, 'X'); return real(); }, null, 'niet geplaatst (target-exists)'],
      ];
      const warn = console.warn;
      console.warn = () => {};
      try {
        for (const [name, answer, setup, way] of cases) {
          const target = path.join(caseDir(), name);
          setup?.();
          try {
            const run = async () => { try { await save(target); } catch { /* de fout zelf is elders bewezen */ } };
            if (answer) await withPlace(answer, run); else await run();
          } finally { ipc.faults.forbidden = null; }
          assert.deepEqual(logFor(target), [way], name);
        }
      } finally { console.warn = warn; }
    });
    await check('Tauri: bestaand doel blijft intact; geen rename van plugin-fs en geen directe terugval', async () => {
      const d = caseDir(), target = path.join(d, 'bestaand.ifc');
      fs.writeFileSync(target, 'OUD');
      const before = ipc.calls.length;
      ipc.faults.renameError = new Error('Plaatsing geweigerd');
      try {
        assert.ok(reason('create-new')(await caught(save(target))));
      } finally { ipc.faults.renameError = null; }
      assert.deepEqual(onDisk(d), { 'bestaand.ifc': hex('OUD') });
      const calls = callsFrom(before);
      assert.equal(calls.some(c => ['plugin:fs|rename', 'plugin:fs|write'].includes(c.command)), false);
      assert.equal(writesTo(calls).some(c => c.path === target), false, 'het doel zelf is nooit geopend');
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
  URL.createObjectURL = blob => { assert.ok(blob instanceof Blob); downloads.push(blob); return 'blob:ifc-bytes'; };
  URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ href: '', download: '', click() { clicks++; downloadName = this.download; } }),
  } });
  try {
    await check('Browserhandle: geen createNew beschikbaar, getypeerd geweigerd vóór schrijven', async () => {
      let writes = 0;
      const handle = { createWritable: () => { writes++; throw new Error('Mag niet schrijven'); } } as unknown as FileSystemFileHandle;
      await assert.rejects(saveNewBytesToRef({ kind: 'handle', handle }, bytes), typedFailure);
      assert.equal(writes, 0);
    });
    await check('Download: bytegelijk, ook met aanwezige browserkiezer', async () => {
      win.showSaveFilePicker = () => { throw new Error('Handle kan T1 niet garanderen'); };
      const saved = await saveNewBytesDialog('nieuw.ifc', bytes, [], { refuseTarget: null });
      assert.deepEqual(saved, { ref: null, name: 'nieuw.ifc', viaDownload: true });
      assert.equal(downloadName, 'nieuw.ifc');
      assert.equal(clicks, 1);
      assert.deepEqual(Buffer.from(await downloads[0].arrayBuffer()), expected);
    });
    await check('Download: weigering start geen download', async () => {
      assert.equal(await saveNewBytesDialog('nieuw.ifc', bytes, [], { refuseTarget: null, refuseDownload: () => true }), null);
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
      assert.equal((await saveNewSiteFileBytes('nieuw.ifc', bytes)).id, 'nieuw');
      assert.deepEqual(Buffer.from(await siteBlobs.at(-1)!.arrayBuffer()), expected);
    });
    await check('Site: ontbrekende basisversie weigert met nul schrijfacties', async () => {
      const before = calls;
      for (const version of [null, '']) {
        await assert.rejects(saveSiteFileVersionBytes('bron', 'bron.ifc', bytes, version), typedFailure);
      }
      assert.equal(calls, before);
    });
    await check('Site: basisversie gaat mee; bytes ongewijzigd', async () => {
      assert.equal((await saveSiteFileVersionBytes('bron', 'bron.ifc', bytes, 'v1')).version, 'v2');
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
      assert.deepEqual(await saveSiteFileVersionBytes('bron', 'bron.ifc', bytes, 'v1'), {
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
  console.log(`IFC-bytes: ${passed} geslaagd, ${failed} mislukt.`);
  if (failed) process.exitCode = 1;
  finished = true;
}
// Een route die blijft hangen mag de proef niet stil laten eindigen: dan is ze niet afgerond, dus rood.
let finished = false;
process.on('exit', () => {
  if (!finished) { console.error('XX de proef is niet afgerond (een route bleef hangen)'); process.exitCode = 1; }
});
main().catch(error => { console.error(error); process.exitCode = 1; });
