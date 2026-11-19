// #804, knownbug 1131 stap 5: het eigen bestand met een gebouwmodel op de desktop vervangen (ontwerp §4.10,
// stappen 0 tot en met 6) en het afhandelen van restbestanden na een crash of fout (deel a), en Ctrl+S en *Opslaan* in
// de sluitvraag op die vervanging, vanaf de productie-ingang (deel b, onderaan). Op echte bestanden in een tijdelijke
// map, met de echte plugin-fs-client en het nagebootste `place_file_exclusive` (`nodeFileIpc.ts`); het herstelmanifest
// en het herstelrecord van de vervanging staan als echte bestanden in een eigen app-datamap. Elke proef na een crash of
// fout leest het record en het manifest opnieuw van schijf, ook na een volgende ronde; niets komt uit een eerder
// ingelezen toestand. Bewijst niet dat de stap van het commando werkelijk exclusief en atomair is (dat doet
// `cargo test place_file`), en niets van een echte desktopapp.
import assert from 'node:assert/strict';
import { documentContentOf } from '@/state/documentSaveState';
import { createHash } from 'node:crypto';
import {
  existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import i18next from 'i18next';
import nlCommon from '@/i18n/locales/nl/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { loadStore } from './ifcAppRoute';
import { installNodeFileIpc, type PlaceAnswer } from './nodeFileIpc';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { prepareIfcWrite } from '@/services/ifc/foreign/mergeWriter';
import { runProjectFileWrite } from '@/services/fileAccess/writeCoordinator';
import {
  previousVersionPath, tauriOwnFileReplaceFs, type OwnFileReplaceFs, type ReplaceRemnantsFs,
} from '@/services/fileAccess/ownFileReplace';
import {
  parseReplaceRecord, replaceRecordId, replaceRecordName, serializeReplaceRecord, settlePendingReplaces, tauriReplaceRecords,
  type ReplaceRecord, type ReplaceRecordStore,
} from '@/services/fileAccess/replaceRecords';
import { readOpenedTauriPath } from '@/services/fileAccess/tauriBackend';
import { tauriOpenIO } from '@/services/fileAccess/tauriOpenPath';
import { userFileTempPath } from '@/services/fileAccess/atomicWrite';
import { readsAsBytes } from '@/services/formatRegistry';
import { readBytesFromRef } from '@/services/fileAccess';
import {
  ownPathReplaceNotices, remnantNotices, replaceOwnPathWithRecovery, type OwnPathReplaceResult,
} from '@/state/ownFileReplace';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { clearRecovery, loadRecovery } from '@/services/recovery/recoveryStore';
import { checkRecoveryManifestVersion } from '@/services/recovery/recoveryManifest';
import { ownRecoveryNames, recoveryNames } from '@/services/recovery/recoveryPaths';
import { flushRecoveryNow, registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { hasPendingIfcSource } from '@/services/recovery/recoveryPendingSource';
import { createCloseDocumentDialogActions } from '@/components/layout/DocumentChrome/closeDocumentActions';
import { castDraft } from 'immer';
import { mergeProblems } from './ifcMergeKern';
import { InProcessWorker } from './inProcessSaveWorker';
import { createIfcSaveWorker } from '@/services/ifc/saveWorker/ifcSaveWorker';
import type { IfcOutputCompute } from '@/state/prepareIfcOutput';
import { createExtensionApi } from '@/extensions/extensionApi';
import { saveStatusOf } from '@/state/documentSaveState';

await i18next.init({ lng: 'nl', fallbackLng: 'en', resources: { nl: { common: nlCommon }, en: { common: enCommon } } });
await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const bytes = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const work = mkdtempSync(join(tmpdir(), 'ops-own-replace-'));
const appData = join(work, 'appdata');
mkdirSync(appData);
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
/** Een versie die een ander programma schreef: één teken anders in de kop. */
const otherProgram = new Uint8Array(bytes); otherProgram[Buffer.from(otherProgram).indexOf("FILE_NAME('") + 11] ^= 1;
const otherNew = new Uint8Array([...otherProgram, 10]);
const NOW = new Date(2026, 10, 17, 14, 32);
const OTHER_COPY = 'model (versie van ander programma 2026-11-17 14.32).ifc';
const UNSAVED_COPY = 'model (niet opgeslagen planning 2026-11-17 14.32).ifc';

let passed = 0, failed = 0, cases = 0;
async function check(name: string, action: () => Promise<void>) {
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}: ${String(error instanceof Error ? error.stack ?? error.message : error).slice(0, 2400)}`); }
}

const ipc = installNodeFileIpc({ appDataDir: appData });

/** Een geopend bestand met een gebouwmodel op een eigen pad, één bewerking, en de herstelronde van `useAutoSave`. */
async function opened(content: Uint8Array = bytes, ifcSaveCompute?: IfcOutputCompute) {
  const dir = join(work, `geval-${++cases}`);
  mkdirSync(dir);
  const path = join(dir, 'model.ifc');
  writeFileSync(path, content);
  const { createAppStoreContext } = await loadStore();
  const context = createAppStoreContext(ifcSaveCompute ? { ifcSaveCompute } : {}), { store } = context;
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await store.getState().openOpenedFile({ name: 'model.ifc', content: '', bytes: content, ref: { kind: 'path', path } });
  assert(store.getState().ifcSource?.foreign, 'geopend met een vreemd deel');
  assert.equal(store.getState().filePath, path);
  const task = store.getState().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
  store.getState().updateTask(task.id, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 } });
  store.getState().runCPM();
  const tracker = new RecoveryDeltaTracker();
  const unregister = registerRecoveryFlush(async () => {
    const s = store.getState();
    await runRecoveryTick(tracker, s.activeDocumentId,
      s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
  });
  await flushRecoveryNow();
  const state = store.getState(), id = state.activeDocumentId;
  const prepared = await prepareIfcWrite(buildWriteIFCInput(state, 'merge'), state.ifcSource!);
  assert.notEqual(prepared.sha256, hash(content), 'de bewerking geeft een andere uitvoer');
  return { dir, path, context, store, state, id, prepared, unregister };
}
type Case = Awaited<ReturnType<typeof opened>>;

/** Een ander bestaand bestand als doel (Opslaan als over een bestaande naam, deel c): de verwachte inhoud is wat daar
 *  bij het begin van de opslag stond, niet de bron van het document. */
interface OtherTarget { path: string; content: Uint8Array }

async function replace(
  c: Case, fs?: OwnFileReplaceFs, records?: ReplaceRecordStore, target?: OtherTarget,
): Promise<{ result: OwnPathReplaceResult; committed: boolean }> {
  let committed = false;
  const destination = target && { filePath: target.path, fileHandle: null, siteFileId: null, siteFileVersion: null };
  const result = await runProjectFileWrite(() => replaceOwnPathWithRecovery({
    documentId: c.id, path: target?.path ?? c.path, prepared: c.prepared,
    source: target ? { bytes: target.content, sha256: hash(target.content) }
      : { bytes: c.state.ifcSource!.bytes, sha256: c.state.ifcSource!.sha256 },
    commit: () => { committed = c.store.getState().commitSavedDocument(documentContentOf(c.state, c.id)!, c.state, destination, c.prepared); },
    // De doelbewaking na de eerste herstelronde is van de route (`replaceOwnPath`); de proeven onderaan dekken haar.
    stopBeforeWrite: async () => false, refuseBeforePlace: () => false,
    now: NOW, ...(fs ? { fs } : {}), ...(records ? { records } : {}),
  }), () => { throw new Error('de schrijfpoort is dicht (afsluitfase); deze proef sluit hem nooit'); });
  return { result, committed };
}
const files = (c: Case) => readdirSync(c.dir).sort();
const fileHash = (c: Case, name: string) => hash(new Uint8Array(readFileSync(join(c.dir, name))));
/** Elke naam in de map met de inhoud ervan, als sha256. */
const disk = (c: Case) => Object.fromEntries(files(c).map(name => [name, fileHash(c, name)]));
const manifestOnDisk = () => {
  const name = readdirSync(appData).find(n => n === ownRecoveryNames.manifest);
  return name ? JSON.parse(readFileSync(join(appData, name), 'utf8')) as { version: number; documents: { id: string; ifcSource?: Record<string, unknown> }[] } : null;
};
/** De herstelrecords van vervangingen zoals ze nu op schijf staan. */
const recordsOnDisk = (): ReplaceRecord[] => readdirSync(appData).filter(n => replaceRecordId(n) !== null).sort()
  .map(n => parseReplaceRecord(readFileSync(join(appData, n), 'utf8'))!);
/** Precies één record, voor dit geval, met de twee versies van de vervanging. */
function oneRecord(c: Case, target?: OtherTarget): ReplaceRecord {
  const records = recordsOnDisk();
  assert.equal(records.length, 1, `één herstelrecord op schijf (${records.length})`);
  const [record] = records;
  assert.deepEqual(record, {
    id: record.id, path: target?.path ?? c.path, vorigeSha256: hash(target?.content ?? bytes), pendingSha256: c.prepared.sha256,
  });
  return record;
}
/** De `place_file_exclusive`-aanroepen tellen; `answers[n]` vervangt de n-de (vanaf 1) uitkomst. */
function placeCalls(answers: Record<number, (from: string, to: string, real: () => PlaceAnswer) => PlaceAnswer | undefined>) {
  let n = 0;
  ipc.faults.place = (from, to, real) => answers[++n]?.(from, to, real);
  return () => n;
}
/** Een ander programma doet iets vlak vóór (of na) de n-de plaatsing van de vervanging; los van het nagebootste
 *  commando, zodat het ook gebeurt als de plaatsing iets anders is. */
async function aroundPlace(n: number, when: 'before' | 'after', act: () => void): Promise<OwnFileReplaceFs> {
  const base = await tauriOwnFileReplaceFs();
  let calls = 0;
  return { ...base, place: async (from, to) => {
    const mine = ++calls === n;
    if (mine && when === 'before') act();
    const outcome = await base.place(from, to);
    if (mine && when === 'after') act();
    return outcome;
  } };
}
const reject = (code: string, extra: Record<string, string> = {}): { reject: Record<string, string> } => ({ reject: { code, ...extra } });
const tidy = async (c: Case) => {
  ipc.faults.place = null; ipc.faults.writeErrorAfter = null; ipc.faults.forbidden = null; ipc.faults.forbiddenMeta = false;
  ipc.faults.beforeOpen = null;
  c.unregister(); await clearRecovery();
  for (const name of readdirSync(appData)) if (replaceRecordId(name) !== null) rmSync(join(appData, name));
};
const noticeKeys = (result: OwnPathReplaceResult, path: string) => ownPathReplaceNotices(result, path).map(n => n.messageKey);
const tempOf = (c: Case, id: string) => userFileTempPath(c.path, id);
const helperId = (c: Case) => {
  const name = files(c).find(n => /^save-[0-9a-z]+\.ops-save\.tmp$/.test(n)) ?? files(c).find(n => n.includes('.ops-vorige-'))!;
  return name.startsWith('save-') ? name.slice(5, -'.ops-save.tmp'.length) : name.slice(name.indexOf('.ops-vorige-') + 12);
};
/** Een volgende ronde zoals bij de start: de records van schijf afhandelen, met de meldingen. */
const nextRound = async (fs?: ReplaceRemnantsFs) => remnantNotices(await settlePendingReplaces({ now: NOW, ...(fs ? { fs } : {}) }));
/** Afhandelen met een bestandssysteem waarop elke stap nog faalt (het bestand is bijvoorbeeld nog gedeeld). */
const blocked: ReplaceRemnantsFs = {
  read: async p => existsSync(p) ? new Uint8Array(readFileSync(p)) : null,
  remove: async () => { throw new Error('nog gedeeld'); },
  place: async () => ({ code: 'io', message: 'nog gedeeld' }),
};

// ── De goede weg ─────────────────────────────────────────────────────────────────────────────────────────────────

await check('goede weg: stap 0 legt het herstelrecord vast (manifest blijft 5), het doel krijgt de nieuwe versie, niets blijft achter', async () => {
  const c = await opened(), base = await tauriOwnFileReplaceFs();
  try {
    let atStep1: { manifest: ReturnType<typeof manifestOnDisk>; record: ReplaceRecord; temp: string } | undefined;
    const { result, committed } = await replace(c, { ...base, createNew: async (p, d, m) => {
      atStep1 = { manifest: manifestOnDisk(), record: oneRecord(c), temp: p };
      return base.createNew(p, d, m);
    } });
    assert.deepEqual(result, { code: 'replaced', otherVersion: null, leftOver: null });
    assert.equal(committed, true, 'de geschreven versie werd de bron');
    assert.equal(atStep1!.manifest!.version, 5, 'een lopende vervanging verandert de versie van het manifest niet');
    const doc = atStep1!.manifest!.documents.find(d => d.id === c.id)!;
    assert.equal(doc.ifcSource!.pendingSha256, c.prepared.sha256, 'het manifest kent de nieuwe versie als bron');
    assert.equal('pendingReplace' in doc.ifcSource!, false, 'het manifest noemt de hulpnamen niet');
    assert.equal(atStep1!.temp, tempOf(c, atStep1!.record.id), 'stap 1 schrijft naar save-<id>.ops-save.tmp met het id uit het record');
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256 }, 'het doel heeft de nieuwe versie, geen restbestand');
    assert.deepEqual(recordsOnDisk(), [], 'geen hulpbestand meer, dus het record is weg');
    const after = (await loadRecovery()).docs.find(d => d.id === c.id);
    assert.equal(after?.ifcSource?.pendingSha256, undefined, 'stap 6 wist pendingSha256');
    assert.equal(after?.ifcSource?.sha256, c.prepared.sha256, 'het manifest noemt de nieuwe bron');
    assert.equal(c.store.getState().ifcSource!.sha256, c.prepared.sha256);
    assert.equal(c.store.getState().isDirty, false);
    assert.deepEqual(noticeKeys(result, c.path), []);
    // Een tweede vervanging bouwt op de eerste.
    const task = c.store.getState().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
    c.store.getState().updateTask(task.id, { name: 'Tweede ronde' });
    const state = c.store.getState(), prepared = await prepareIfcWrite(buildWriteIFCInput(state, 'merge'), state.ifcSource!);
    const second = await replace({ ...c, state, prepared });
    assert.equal(second.result.code, 'replaced');
    assert.deepEqual(disk(c), { 'model.ifc': prepared.sha256 });
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

await check('dir-not-synced in stap 3 en 4 is geen fout', async () => {
  const c = await opened();
  try {
    placeCalls({
      1: (_f, _t, real) => { real(); return { resolve: { code: 'dir-not-synced', message: 'fsync' } }; },
      2: (_f, _t, real) => { real(); return { resolve: { code: 'dir-not-synced', message: 'fsync' } }; },
    });
    const { result } = await replace(c);
    assert.equal(result.code, 'replaced');
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256 });
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

// ── Het record en de oudere app ──────────────────────────────────────────────────────────────────────────────────

await check('een oudere app (versiepoort t/m 5) leest de herstelset van een sessie met een lopende vervanging; wissen laat het record staan', async () => {
  const c = await opened(), base = await tauriOwnFileReplaceFs();
  try {
    let checked = false;
    await replace(c, { ...base, createNew: async (p, d, m) => {
      const manifest = manifestOnDisk()!;
      // De versiepoort van deze branch is die van main (beide lezen t/m 5); het manifest heeft de vorm van main.
      checkRecoveryManifestVersion(manifest.version);
      const loaded = await loadRecovery();
      assert(loaded.docs.some(doc => doc.id === c.id), 'de herstelset is leesbaar tijdens de vervanging');
      const record = oneRecord(c);
      // Geen naamvorm van de snapshots (productie of een dev-slug): wissen en opruimen raken het record niet.
      for (const names of [ownRecoveryNames, recoveryNames('recovery'), recoveryNames('recovery.anderslug')]) {
        assert.equal(names.isOwnFile(replaceRecordName(record.id)), false);
      }
      await clearRecovery();
      assert.deepEqual(recordsOnDisk(), [record], 'wissen na de herstelkeuze laat het record staan');
      checked = true;
      return base.createNew(p, d, m);
    } });
    assert(checked);
  } finally { await tidy(c); }
});

await check('record: een ongeldige vorm valt weg, een andere base heeft eigen namen', () => {
  const ok: ReplaceRecord = { id: 'abc123', path: '/a/model.ifc', vorigeSha256: 'a'.repeat(64), pendingSha256: 'b'.repeat(64) };
  assert.deepEqual(parseReplaceRecord(serializeReplaceRecord(ok)), ok);
  for (const bad of [{ ...ok, id: 'X/..' }, { ...ok, vorigeSha256: 'x' }, { ...ok, path: '' }]) {
    assert.equal(parseReplaceRecord(serializeReplaceRecord(bad)), null);
  }
  assert.equal(parseReplaceRecord('{"kind":"ops-replace","version":2}'), null);
  assert.equal(parseReplaceRecord('geen json'), null);
  assert.equal(replaceRecordId(replaceRecordName('abc123')), 'abc123');
  assert.equal(replaceRecordId(`${ownRecoveryNames.base}.anderslug.replace.abc123.json`), null, 'een record van een andere base');
  assert.equal(replaceRecordId(`${replaceRecordName('abc123')}.tmp`), null, 'een halffabricaat');
  return Promise.resolve();
});

// ── Fouten ───────────────────────────────────────────────────────────────────────────────────────────────────────

await check('stap 0: zonder herstelronde wordt er niets geschreven (not-recorded), en het record is weg', async () => {
  const c = await opened();
  try {
    c.unregister();
    const writes = ipc.calls.length;
    const { result, committed } = await replace(c);
    assert.deepEqual(result, { code: 'not-recorded' });
    assert.equal(committed, false);
    assert.equal(ipc.calls.slice(writes).some(call => call.command === 'place_file_exclusive'
      || ((call.command === 'plugin:fs|write_file' || call.command === 'plugin:fs|open') && call.path?.startsWith(c.dir))), false);
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
    assert.deepEqual(recordsOnDisk(), []);
    assert.deepEqual(noticeKeys(result, c.path), ['notifications.ifcForeignReplaceNotRecorded']);
  } finally { await tidy(c); }
});

await check('stap 0: lukt het record niet, dan wordt er niets geschreven (not-recorded)', async () => {
  const c = await opened();
  try {
    const writes = ipc.calls.length;
    const records: ReplaceRecordStore = {
      write: async () => { throw new Error('appdata vol'); }, remove: async () => {}, list: async () => [],
    };
    const { result } = await replace(c, undefined, records);
    assert.deepEqual(result, { code: 'not-recorded' });
    assert.equal(ipc.calls.slice(writes).some(call => call.command === 'place_file_exclusive'
      || (call.path?.startsWith(c.dir) && call.command !== 'plugin:fs|lstat')), false, 'na de voorcontrole geen toegang tot de projectmap');
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
  } finally { await tidy(c); }
});

for (const kind of ['symbolische link', 'harde link'] as const) {
  await check(`een gelinkt doel (${kind}) wordt niet vervangen: alleen Opslaan als`, async () => {
    const c = await opened();
    try {
      const real = join(c.dir, 'echt.ifc');
      writeFileSync(real, bytes); rmSync(c.path);
      if (kind === 'symbolische link') symlinkSync(real, c.path); else linkSync(real, c.path);
      const { result } = await replace(c);
      assert.equal(result.code, 'save-as-only');
      assert.deepEqual(disk(c), { 'echt.ifc': hash(bytes), 'model.ifc': hash(bytes) });
      assert.deepEqual(recordsOnDisk(), [], 'geweigerd vóór stap 0');
      assert.deepEqual(noticeKeys(result, c.path), ['notifications.ifcForeignReplaceSaveAsOnly']);
    } finally { await tidy(c); }
  });
}

await check('Windows-metadata (nlink null): stap 3 weigert het doel met een tweede naam (hard-linked), niets verplaatst, alleen Opslaan als', async () => {
  const c = await opened();
  try {
    const alias = join(c.dir, 'harde-link.ifc');
    linkSync(c.path, alias);
    const base = await tauriOwnFileReplaceFs();
    // De voorcontrole ziet het aantal namen niet (plugin-fs geeft op Windows `nlink: null`); de garantie komt van
    // `place_file_exclusive` (#996), hier de nabootsing uit `nodeFileIpc.ts`, die een bron met meer namen weigert.
    const placed: string[] = [];
    const { result, committed } = await replace(c, { ...base, lstat: async p => ({ ...await base.lstat(p), nlink: null }),
      place: async (from, to) => { const outcome = await base.place(from, to); placed.push(outcome.code === 'refused' ? `refused/${outcome.reason}` : outcome.code); return outcome; } });
    assert.deepEqual(placed, ['refused/hard-linked'], 'stap 3 weigert, er volgt geen plaatsing');
    assert.equal(result.code, 'save-as-only'); assert.match(result.code === 'save-as-only' ? result.why : '', /hard-linked/);
    assert.equal(committed, false);
    assert.deepEqual(disk(c), { 'harde-link.ifc': hash(bytes), 'model.ifc': hash(bytes) }, 'het doel en zijn tweede naam ongewijzigd');
    assert.deepEqual(recordsOnDisk(), [], 'geen hulpbestand, dus geen record');
    assert.deepEqual(noticeKeys(result, c.path), ['notifications.ifcForeignReplaceSaveAsOnly']);
  } finally { await tidy(c); }
});

await check('stap 1: schrijffout ná de aanmaak ruimt het eigen tijdelijke bestand op; het doel blijft, het record is weg', async () => {
  const c = await opened();
  try {
    // Alleen het eigen tijdelijke bestand: de schrijfacties van het herstel openen ook, en schrijven dan gewoon.
    ipc.faults.beforeOpen = p => { ipc.faults.writeErrorAfter = p.endsWith('.ops-save.tmp') ? 100 : null; };
    const { result, committed } = await replace(c);
    assert.equal(result.code, 'failed'); assert.equal(committed, false);
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
    assert.deepEqual(recordsOnDisk(), []);
    assert.equal((await loadRecovery()).docs.find(d => d.id === c.id)?.ifcSource?.pendingSha256, undefined, 'pendingSha256 gewist');
    assert.deepEqual(noticeKeys(result, c.path), ['notifications.ifcForeignReplaceFailed']);
  } finally { await tidy(c); }
});

await check('stap 1: buiten de scope geen directe terugval, alleen Opslaan als', async () => {
  const c = await opened();
  try {
    ipc.faults.forbidden = p => p.endsWith('.ops-save.tmp');
    const { result } = await replace(c);
    assert.equal(result.code, 'save-as-only');
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

for (const [what, arrange, content, notice] of [
  ['gewijzigd', (c: Case) => writeFileSync(c.path, otherProgram), 'changed', 'notifications.ifcForeignTargetChanged'],
  ['weg', (c: Case) => rmSync(c.path), 'missing', 'notifications.ifcForeignTargetGone'],
] as const) {
  await check(`stap 2: doel ${what} vóór de vervanging: niets vervangen, het eigen tijdelijke bestand en het record weg`, async () => {
    const c = await opened();
    try {
      arrange(c);
      const { result } = await replace(c);
      assert.deepEqual(result, { code: 'target-changed', content });
      assert.deepEqual(disk(c), what === 'weg' ? {} : { 'model.ifc': hash(otherProgram) });
      assert.deepEqual(recordsOnDisk(), []);
      assert.deepEqual(noticeKeys(result, c.path), [notice]);
    } finally { await tidy(c); }
  });
}

for (const [answer, code, notice] of [
  [reject('target-exists'), 'failed', 'notifications.ifcForeignReplaceFailed'],
  [reject('unsupported', { message: 'EINVAL' }), 'save-as-only', 'notifications.ifcForeignReplaceSaveAsOnly'],
  [reject('refused', { reason: 'scope' }), 'save-as-only', 'notifications.ifcForeignReplaceSaveAsOnly'],
  [reject('refused', { reason: 'not-regular-file' }), 'save-as-only', 'notifications.ifcForeignReplaceSaveAsOnly'],
  [reject('io', { message: 'gedeeld met een ander programma' }), 'failed', 'notifications.ifcForeignReplaceFailed'],
] as const) {
  const label = 'reason' in answer.reject ? `${answer.reject.code}/${answer.reject.reason}` : answer.reject.code;
  await check(`stap 3 ${label}: niets verplaatst, het doel blijft, het eigen tijdelijke bestand en het record weg`, async () => {
    const c = await opened();
    try {
      placeCalls({ 1: () => answer });
      const { result } = await replace(c);
      assert.equal(result.code, code);
      assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
      assert.deepEqual(recordsOnDisk(), []);
      assert.deepEqual(noticeKeys(result, c.path), [notice]);
    } finally { await tidy(c); }
  });
}

await check('stap 3 source-changed: onbekende stand, niets aangeraakt, het record blijft; de volgende ronde handelt het af', async () => {
  const c = await opened();
  try {
    placeCalls({ 1: () => reject('source-changed') });
    const { result } = await replace(c);
    assert.deepEqual(result, { code: 'unknown' });
    const id = helperId(c);
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes), [`save-${id}.ops-save.tmp`]: c.prepared.sha256 }, 'het tijdelijke bestand blijft staan');
    assert.equal(oneRecord(c).id, id, 'het record blijft');
    assert.deepEqual(noticeKeys(result, c.path), ['notifications.ifcForeignPlaceUnknown']);
    ipc.faults.place = null;
    const notices = await nextRound();
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes), [UNSAVED_COPY]: c.prepared.sha256 });
    assert.deepEqual(notices.map(n => n.messageKey), ['notifications.ifcForeignReplaceUnsavedCopy']);
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

await check('stap 4 target-exists: alle drie blijven staan, en het record ook, ook na een volgende ronde', async () => {
  const c = await opened();
  try {
    const { result, committed } = await replace(c, await aroundPlace(2, 'before', () => writeFileSync(c.path, otherNew)));
    assert.equal(result.code, 'target-taken'); assert.equal(committed, false);
    const id = helperId(c);
    assert.deepEqual(disk(c), {
      'model.ifc': hash(otherNew), [`model.ifc.ops-vorige-${id}`]: hash(bytes), [`save-${id}.ops-save.tmp`]: c.prepared.sha256,
    }, 'de versie van de ander, de vorige versie en de eigen uitvoer staan er alle drie');
    assert.equal(oneRecord(c).id, id, 'het record noemt de twee hulpbestanden nog');
    const [notice] = ownPathReplaceNotices(result, c.path);
    assert.equal(notice.messageKey, 'notifications.ifcForeignReplaceTargetTaken');
    assert.deepEqual(notice.params, { target: c.path, temp: tempOf(c, id), previous: previousVersionPath(c.path, id) }, 'de melding noemt de drie paden');
    // Een volgende ronde: het doel is van een ander, dus de vorige versie gaat niet terug en niet weg; de eigen nieuwe
    // planning wordt een kopie onder een leesbare naam.
    const notices = await nextRound();
    assert.deepEqual(disk(c), {
      'model.ifc': hash(otherNew), [`model.ifc.ops-vorige-${id}`]: hash(bytes), [UNSAVED_COPY]: c.prepared.sha256,
    });
    assert.deepEqual(notices.map(n => [n.messageKey, n.params]), [
      ['notifications.ifcForeignReplaceLeftOver', { file: c.path, path: previousVersionPath(c.path, id) }],
      ['notifications.ifcForeignReplaceUnsavedCopy', { file: c.path, copy: join(c.dir, UNSAVED_COPY) }],
    ]);
    assert.equal(oneRecord(c).id, id, 'zolang de vorige versie er staat, blijft het record');
  } finally { await tidy(c); }
});

await check('stap 4 source-changed: onbekende stand, niets teruggezet of opgeruimd, het record blijft', async () => {
  const c = await opened();
  try {
    placeCalls({ 2: () => reject('source-changed') });
    const { result } = await replace(c);
    assert.deepEqual(result, { code: 'unknown' });
    const id = helperId(c);
    assert.deepEqual(disk(c), { [`model.ifc.ops-vorige-${id}`]: hash(bytes), [`save-${id}.ops-save.tmp`]: c.prepared.sha256 });
    assert.equal(oneRecord(c).id, id);
  } finally { await tidy(c); }
});

for (const answer of [reject('unsupported', { message: 'EINVAL' }), reject('refused', { reason: 'scope' }), reject('io', { message: 'EIO' })]) {
  await check(`stap 4 ${answer.reject.code}: de vorige versie gaat exclusief terug op het doel, het record is weg`, async () => {
    const c = await opened();
    try {
      const count = placeCalls({ 2: () => answer });
      const { result } = await replace(c);
      assert.equal(result.code, 'failed');
      assert.equal(count(), 3, 'een derde plaatsing zette de vorige versie terug');
      assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
      assert.deepEqual(recordsOnDisk(), []);
      assert.deepEqual(noticeKeys(result, c.path), ['notifications.ifcForeignReplaceFailed']);
    } finally { await tidy(c); }
  });
}

await check('stap 4 faalt en terugzetten ook: het record blijft, en de volgende start zet het doel terug', async () => {
  const c = await opened();
  try {
    placeCalls({ 2: () => reject('io', { message: 'EIO' }), 3: () => reject('io', { message: 'EIO' }) });
    const { result } = await replace(c);
    assert.equal(result.code, 'previous-stranded');
    const id = helperId(c);
    assert.deepEqual(disk(c), { [`model.ifc.ops-vorige-${id}`]: hash(bytes) });
    const [notice] = ownPathReplaceNotices(result, c.path);
    assert.equal(notice.messageKey, 'notifications.ifcForeignReplacePreviousStranded');
    assert.deepEqual(notice.params, { previous: previousVersionPath(c.path, id) });
    assert.equal(oneRecord(c).id, id, 'het record vergeet de vorige versie niet');
    // De schrijffout is voorbij; een herstart leest het record en het manifest van schijf.
    ipc.faults.place = null;
    assert.deepEqual(await nextRound(), []);
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) }, 'het doel is terug');
    assert.deepEqual(recordsOnDisk(), []);
    const loaded = await loadRecovery();
    const restored = await readRecoveryDocument(loaded.docs.find(d => d.id === c.id)!, loaded.archives, true);
    assert.equal(restored.ifcSource?.sha256, hash(bytes), 'herstel vindt de bron weer');
  } finally { await tidy(c); }
});

// ── Een ander programma schrijft tijdens de vervanging ───────────────────────────────────────────────────────────

await check('het doel verandert tussen stap 2 en 3: de versie van de ander blijft als "versie van ander programma"', async () => {
  const c = await opened();
  try {
    const { result } = await replace(c, await aroundPlace(1, 'before', () => writeFileSync(c.path, otherProgram)));
    assert.deepEqual(result, { code: 'replaced', otherVersion: join(c.dir, OTHER_COPY), leftOver: null });
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256, [OTHER_COPY]: hash(otherProgram) });
    assert.deepEqual(recordsOnDisk(), []);
    const [notice] = ownPathReplaceNotices(result, c.path);
    assert.equal(notice.messageKey, 'notifications.ifcForeignReplaceOtherVersion');
    assert.deepEqual(notice.params, { file: c.path, copy: join(c.dir, OTHER_COPY) });
  } finally { await tidy(c); }
});

await check('een ander programma schrijft na stap 3 in de vorige versie: die blijft als "versie van ander programma"', async () => {
  const c = await opened();
  try {
    const { result } = await replace(c, await aroundPlace(2, 'after', () => writeFileSync(previousVersionPath(c.path, helperId(c)), otherProgram)));
    assert.equal(result.code, 'replaced');
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256, [OTHER_COPY]: hash(otherProgram) });
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

await check('de naam van de kopie volgt de taal van de app', async () => {
  await i18next.changeLanguage('en');
  const c = await opened();
  try {
    const { result } = await replace(c, await aroundPlace(1, 'before', () => writeFileSync(c.path, otherProgram)));
    assert.equal(result.code === 'replaced' && result.otherVersion, join(c.dir, 'model (version from another program 2026-11-17 14.32).ifc'));
  } finally { await i18next.changeLanguage('nl'); await tidy(c); }
});

// ── Een onderbreking na elke stap, gevolgd door herstel ──────────────────────────────────────────────────────────

class Crash extends Error {}
/**
 * Breekt de vervanging af op `where`, zoals een echte crash: vanaf dat moment faalt elke volgende bewerking (ook als de
 * vervanging de fout opvangt), schrijft het herstel van deze sessie niets meer en wist niemand het record. Wat op
 * schijf staat, blijft de stand van dat moment; daarna mag de map niet meer veranderen.
 */
async function crashAt(
  c: Case, where: (base: OwnFileReplaceFs, crash: () => Promise<never>) => Partial<OwnFileReplaceFs>, target?: OtherTarget,
) {
  const base = await tauriOwnFileReplaceFs(), realRecords = await tauriReplaceRecords();
  let diskAtCrash: Record<string, string> | undefined;
  const crash = async (): Promise<never> => { c.unregister(); diskAtCrash ??= disk(c); throw new Crash('crash'); };
  const steps: OwnFileReplaceFs = { ...base, ...where(base, crash) };
  const dead = <A extends unknown[], R>(step: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => (diskAtCrash ? crash() : step(...args));
  const fs: OwnFileReplaceFs = {
    lstat: dead(steps.lstat), createNew: dead(steps.createNew), remove: dead(steps.remove),
    place: dead(steps.place), content: dead(steps.content),
  };
  const records: ReplaceRecordStore = { ...realRecords, remove: dead(realRecords.remove) };
  await replace(c, fs, records, target).catch(error => { if (!(error instanceof Crash)) throw error; });
  assert(diskAtCrash, 'de crash vond plaats');
  assert.deepEqual(disk(c), diskAtCrash, 'na de crash veranderde er niets meer in de map');
  return oneRecord(c, target);
}
/** Herstel zoals bij de start, alles van schijf: eerst de records, dan het manifest en het document met zijn bron. */
async function recover(c: Case) {
  const notices = await nextRound();
  const loaded = await loadRecovery();
  const doc = loaded.docs.find(d => d.id === c.id)!;
  const restored = await readRecoveryDocument(doc, loaded.archives, true);
  return { notices, restored };
}
/** Na herstel: een volledige versie op het doel, en die is de herstelde bron. */
function fullVersionOnTarget(c: Case, restored: Awaited<ReturnType<typeof recover>>['restored'], expected: string) {
  assert.equal(fileHash(c, 'model.ifc'), expected, 'het doel heeft een volledige versie');
  assert.equal(restored.ifcSource?.sha256, expected, 'herstel neemt die versie als bron');
  assert.equal(restored.filePath, c.path, 'en geeft het doel terug');
}
const sourceNow = (c: Case) => c.state.ifcSource!.sha256;

await check('crash na stap 0: herstel vindt de oude versie; er is niets op te ruimen en het record gaat weg', async () => {
  const c = await opened();
  try {
    await crashAt(c, (_b, crash) => ({ createNew: crash }));
    const { notices, restored } = await recover(c);
    fullVersionOnTarget(c, restored, sourceNow(c));
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) }); assert.deepEqual(notices, []);
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

await check('crash halverwege stap 1: het onvolledige tijdelijke bestand bewijst niets, het blijft staan met een melding', async () => {
  const c = await opened();
  try {
    const record = await crashAt(c, (base, crash) => ({
      createNew: async (p, d, m) => { await base.createNew(p, d.subarray(0, d.length >> 1), m); return crash(); },
    }));
    const { notices, restored } = await recover(c);
    fullVersionOnTarget(c, restored, sourceNow(c));
    assert.deepEqual(Object.keys(disk(c)), ['model.ifc', `save-${record.id}.ops-save.tmp`]);
    assert.deepEqual(notices.map(n => [n.messageKey, n.params]), [
      ['notifications.ifcForeignReplaceLeftOver', { file: c.path, path: tempOf(c, record.id) }],
    ]);
    assert.deepEqual(recordsOnDisk(), [record], 'het record blijft zolang het bestand er staat');
  } finally { await tidy(c); }
});

await check('naamconflict na stap 0: een vreemd bestand onder de tijdelijke naam blijft staan', async () => {
  const c = await opened();
  try {
    let helper = '';
    const record = await crashAt(c, (_base, crash) => ({
      createNew: async p => { helper = p; writeFileSync(p, otherNew); return crash(); },
    }));
    const { notices } = await recover(c);
    assert(existsSync(helper), 'herstel verwijderde een bestand dat niet door de operatie was aangemaakt');
    assert.equal(hash(readFileSync(helper)), hash(otherNew));
    assert.deepEqual(notices.map(n => n.messageKey), ['notifications.ifcForeignReplaceLeftOver']);
    assert.deepEqual(recordsOnDisk(), [record]);
  } finally { await tidy(c); }
});

await check('een onleesbaar tijdelijk bestand blijft staan met een melding', async () => {
  const c = await opened();
  try {
    const record = await crashAt(c, (_b, crash) => ({ content: crash }));
    const unreadable: ReplaceRemnantsFs = { ...blocked, read: async p => {
      if (p === tempOf(c, record.id)) throw new Error('EACCES');
      return existsSync(p) ? new Uint8Array(readFileSync(p)) : null;
    } };
    const notices = await nextRound(unreadable);
    assert(existsSync(tempOf(c, record.id)));
    assert.deepEqual(notices.map(n => n.params), [{ file: c.path, path: tempOf(c, record.id) }]);
    assert.deepEqual(recordsOnDisk(), [record]);
  } finally { await tidy(c); }
});

for (const [step, where] of [
  ['1', (_b: OwnFileReplaceFs, crash: () => Promise<never>) => ({ content: crash })],
  ['2', (_b: OwnFileReplaceFs, crash: () => Promise<never>) => ({ place: crash })],
] as const) {
  await check(`crash na stap ${step}: de volledige nieuwe planning wordt "niet opgeslagen planning", de oude versie blijft`, async () => {
    const c = await opened();
    try {
      await crashAt(c, where);
      const { notices, restored } = await recover(c);
      fullVersionOnTarget(c, restored, sourceNow(c));
      assert.deepEqual(disk(c), { 'model.ifc': hash(bytes), [UNSAVED_COPY]: c.prepared.sha256 });
      assert.deepEqual(notices.map(n => [n.messageKey, n.params]), [
        ['notifications.ifcForeignReplaceUnsavedCopy', { file: c.path, copy: join(c.dir, UNSAVED_COPY) }],
      ]);
      assert.deepEqual(recordsOnDisk(), []);
    } finally { await tidy(c); }
  });
}

await check('crash na stap 3 (doel weg): de vorige versie gaat terug, de nieuwe planning wordt een kopie; bestanden met een ander id blijven', async () => {
  const c = await opened();
  try {
    let calls = 0;
    const record = await crashAt(c, (base, crash) => ({ place: async (f, t) => (++calls === 2 ? crash() : base.place(f, t)) }));
    const id = record.id;
    assert.deepEqual(disk(c), { [`model.ifc.ops-vorige-${id}`]: hash(bytes), [`save-${id}.ops-save.tmp`]: c.prepared.sha256 });
    // Restbestanden van een andere vervanging (een ander id): herstel raakt ze niet aan.
    writeFileSync(join(c.dir, 'save-anderid1.ops-save.tmp'), otherNew);
    writeFileSync(join(c.dir, 'model.ifc.ops-vorige-anderid1'), otherProgram);
    const { notices, restored } = await recover(c);
    fullVersionOnTarget(c, restored, sourceNow(c));
    assert.deepEqual(disk(c), {
      'model.ifc': hash(bytes), [UNSAVED_COPY]: c.prepared.sha256,
      'model.ifc.ops-vorige-anderid1': hash(otherProgram), 'save-anderid1.ops-save.tmp': hash(otherNew),
    });
    assert.deepEqual(notices.map(n => n.messageKey), ['notifications.ifcForeignReplaceUnsavedCopy']);
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

await check('crash na stap 3, doel weg, met een andere inhoud onder de vorige naam: niets terug op het doel', async () => {
  const c = await opened();
  try {
    let calls = 0;
    const record = await crashAt(c, (base, crash) => ({ place: async (f, t) => (++calls === 2 ? crash() : base.place(f, t)) }));
    writeFileSync(previousVersionPath(c.path, record.id), otherProgram);
    const notices = await nextRound();
    assert.equal(existsSync(c.path), false, 'een niet bewezen vorige versie gaat niet op het doel');
    assert.equal(hash(readFileSync(previousVersionPath(c.path, record.id))), hash(otherProgram));
    assert.deepEqual(notices.map(n => n.messageKey), [
      'notifications.ifcForeignReplaceLeftOver', 'notifications.ifcForeignReplaceUnsavedCopy',
    ]);
    assert.deepEqual(recordsOnDisk(), [record]);
  } finally { await tidy(c); }
});

await check('crash na stap 4: de vorige versie blijft staan met een melding (de doelhash bewijst stap 4 niet); herstel neemt de nieuwe versie', async () => {
  const c = await opened();
  try {
    let calls = 0;
    const record = await crashAt(c, (base, crash) => ({ content: async (p, e) => (++calls === 2 ? crash() : base.content(p, e)) }));
    const { notices, restored } = await recover(c);
    fullVersionOnTarget(c, restored, c.prepared.sha256);
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256, [`model.ifc.ops-vorige-${record.id}`]: hash(bytes) });
    assert.deepEqual(notices.map(n => [n.messageKey, n.params]), [
      ['notifications.ifcForeignReplaceLeftOver', { file: c.path, path: previousVersionPath(c.path, record.id) }],
    ]);
    assert.deepEqual(recordsOnDisk(), [record], 'het record blijft zolang de vorige versie er staat');
  } finally { await tidy(c); }
});

await check('stap 4 target-exists terwijl een ander de nieuwe bytes op het doel zette: de vorige versie en het record blijven', async () => {
  const c = await opened();
  try {
    const { result, committed } = await replace(c, await aroundPlace(2, 'before', () => {
      writeFileSync(c.path, readFileSync(tempOf(c, helperId(c))), { flag: 'wx' });
    }));
    assert.equal(result.code, 'target-taken');
    assert.equal(committed, false);
    const record = oneRecord(c);
    assert.deepEqual(disk(c), {
      'model.ifc': c.prepared.sha256, [`model.ifc.ops-vorige-${record.id}`]: hash(bytes), [`save-${record.id}.ops-save.tmp`]: c.prepared.sha256,
    });
    const notices = await nextRound();
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256, [`model.ifc.ops-vorige-${record.id}`]: hash(bytes) },
      'alleen het exacte dubbel van de nieuwe uitvoer ging weg');
    assert.deepEqual(notices.map(n => n.params), [{ file: c.path, path: previousVersionPath(c.path, record.id) }]);
    assert.deepEqual(recordsOnDisk(), [record]);
  } finally { await tidy(c); }
});

await check('stap 4 io ná een geslaagde hernoeming (1795), terugzetten faalt: de vorige versie en het record blijven', async () => {
  const c = await opened();
  try {
    placeCalls({ 2: (_f, _t, move) => {
      assert.deepEqual(move(), { resolve: { code: 'placed' } });
      return reject('io', { message: 'netwerkfout na de hernoemstap' });
    } });
    const { result, committed } = await replace(c);
    assert.equal(result.code, 'previous-stranded');
    assert.equal(committed, false);
    const record = oneRecord(c);
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256, [`model.ifc.ops-vorige-${record.id}`]: hash(bytes) });
    ipc.faults.place = null;
    const notices = await nextRound();
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256, [`model.ifc.ops-vorige-${record.id}`]: hash(bytes) });
    assert.deepEqual(notices.map(n => n.params), [{ file: c.path, path: previousVersionPath(c.path, record.id) }]);
    assert.deepEqual(recordsOnDisk(), [record]);
  } finally { await tidy(c); }
});

await check('een bungelende symlink op de tijdelijke naam: het record blijft en de volgende ronde meldt het pad', async () => {
  const c = await opened(), fs = await tauriOwnFileReplaceFs();
  let link = '';
  try {
    const { result } = await replace(c, { ...fs, createNew: async (path, data, mode) => {
      link = path;
      symlinkSync(join(c.dir, 'verdwenen.ifc'), path);
      await fs.createNew(path, data, mode);
    } });
    assert.equal(result.code, 'failed');
    assert(files(c).includes(link.slice(c.dir.length + 1)), 'de hulpnaam bestaat op schijf');
    assert.equal(recordsOnDisk().length, 1, 'een mislukte stat van het referentiebestand bewijst niet dat de hulpnaam weg is');
    const notices = await nextRound();
    assert(notices.some(n => n.params?.path === link));
    assert.equal(recordsOnDisk().length, 1);
  } finally { await tidy(c); }
});

await check('crash na stap 4 met een gewijzigde vorige versie: die blijft onder haar naam staan, met een melding', async () => {
  const c = await opened();
  try {
    let calls = 0;
    const record = await crashAt(c, (base, crash) => ({ content: async (p, e) => {
      if (++calls < 2) return base.content(p, e);
      writeFileSync(p, otherProgram);
      return crash();
    } }));
    const { notices, restored } = await recover(c);
    fullVersionOnTarget(c, restored, c.prepared.sha256);
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256, [`model.ifc.ops-vorige-${record.id}`]: hash(otherProgram) });
    assert.deepEqual(notices.map(n => [n.messageKey, n.params]), [
      ['notifications.ifcForeignReplaceLeftOver', { file: c.path, path: previousVersionPath(c.path, record.id) }],
    ]);
    assert.deepEqual(recordsOnDisk(), [record]);
  } finally { await tidy(c); }
});

await check('crash na stap 5: alleen de nieuwe versie, herstel neemt haar via pendingSha256', async () => {
  const c = await opened();
  try {
    await crashAt(c, (base, crash) => ({ remove: async p => {
      await base.remove(p);
      if (p.includes('.ops-vorige-')) await crash();
    } }));
    const { notices, restored } = await recover(c);
    fullVersionOnTarget(c, restored, c.prepared.sha256);
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256 }); assert.deepEqual(notices, []);
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

// ── Openen: eerst afhandelen, dan lezen ─────────────────────────────────────────────────────────────────────────

await check('Recent: wat bij de start niet lukte, handelt Recent af vóór het ontbrekende doel gelezen wordt', async () => {
  const c = await opened();
  try {
    let calls = 0;
    const record = await crashAt(c, (base, crash) => ({ place: async (f, t) => (++calls === 2 ? crash() : base.place(f, t)) }));
    assert(!existsSync(c.path));
    const atStart = await nextRound(blocked);
    assert(atStart.length > 0 && atStart.every(n => n.messageKey === 'notifications.ifcForeignReplaceLeftOver'), 'niets afgehandeld, wel gemeld');
    assert.deepEqual(recordsOnDisk(), [record]);
    const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
    store.setState(s => {
      s.ui.featureFlags = { ifcForeignContent: true };
      s.recentFiles = [{ id: 'recent-test', name: 'model.ifc', ref: { kind: 'path', path: c.path }, addedAt: 1 }];
    });
    await store.getState().openRecentFile('recent-test');
    assert(existsSync(c.path), 'Recent stopt op het ontbrekende doel vóór een nieuwe poging');
    assert.equal(store.getState().filePath, c.path, 'en opent het teruggezette bestand');
    assert.equal(store.getState().ifcSource?.sha256, hash(bytes));
    assert(store.getState().ui.notifications.some(n => n.messageKey === 'notifications.ifcForeignReplaceUnsavedCopy'));
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

await check('Recent meldt de veilig gezette nieuwe planning ook als het doel daarna niet te openen is', async () => {
  const c = await opened();
  try {
    let calls = 0;
    const record = await crashAt(c, (base, crash) => ({ place: async (f, t) => (++calls === 2 ? crash() : base.place(f, t)) }));
    // Een ander programma schreef via de nog open oude bron: die gaat niet terug op het doel.
    writeFileSync(previousVersionPath(c.path, record.id), otherProgram);
    await nextRound(blocked);
    const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
    store.setState(s => {
      s.recentFiles = [{ id: 'recent-test', name: 'model.ifc', ref: { kind: 'path', path: c.path }, addedAt: 1 }];
    });
    await store.getState().openRecentFile('recent-test');
    assert.equal(existsSync(c.path), false);
    // Recent gebruikt de echte klok: de kopie heeft de tijd van nu in haar naam.
    const copy = files(c).find(name => name.startsWith('model (niet opgeslagen planning '));
    assert(copy, 'de nieuwe planning kreeg een leesbare kopienaam');
    assert.equal(fileHash(c, copy), c.prepared.sha256);
    assert.deepEqual(recordsOnDisk(), [record]);
    const notices = store.getState().ui.notifications;
    assert(notices.some(n => n.messageKey === 'notifications.ifcForeignReplaceUnsavedCopy'
      && n.params?.copy === join(c.dir, copy)), 'de melding met het kopiepad');
    assert(notices.some(n => n.messageKey === 'notifications.ifcForeignReplaceLeftOver'), 'de melding over de vorige versie');
    assert(notices.some(n => n.messageKey === 'notifications.openFailed'), 'en de leesfout zelf');
  } finally { await tidy(c); }
});

await check('Recent houdt de bytekeuze van main: een IFC-bestand met een andere extensie blijft bytegelijk na Opslaan als', async () => {
  const c = await opened();
  try {
    const name = 'model.bak', path = join(c.dir, name);
    const ref = { kind: 'path' as const, path };
    const original = new Uint8Array(bytes);
    const wall = Buffer.from(original).indexOf('Wand B');
    assert(wall > 0);
    original[wall + 5] = 0xe9; // geen geldige UTF-8
    const rawWall = Buffer.from([0x57, 0x61, 0x6e, 0x64, 0x20, 0xe9]);
    writeFileSync(path, original);
    assert(readsAsBytes(name, { ifcBytes: true }), 'de IFC-terugval kiest bytes');
    const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
    store.setState(s => {
      s.ui.featureFlags = { ifcForeignContent: true };
      s.recentFiles = [{ id: 'recent-bak', name, ref, addedAt: 1 }];
    });
    const from = ipc.calls.length;
    await store.getState().openRecentFile('recent-bak');
    assert.equal(store.getState().filePath, path);
    assert.deepEqual(ipc.calls.slice(from).filter(call => call.path === path).map(call => call.command).slice(-1), ['plugin:fs|read_file']);
    assert.equal(store.getState().ifcSource?.sha256, hash(original));
    assert.equal(hash((await readBytesFromRef(ref))!), hash(original));
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => Promise<unknown> } }).__TAURI_INTERNALS__;
    const invoke = internals.invoke, output = join(c.dir, 'uitvoer.ifc');
    const task = store.getState().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
    store.getState().updateTask(task.id, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 } });
    store.getState().runCPM();
    internals.invoke = (command, ...args) => command === 'plugin:dialog|save' ? Promise.resolve(output) : invoke(command, ...args);
    try { await store.getState().saveFileAs(); } finally { internals.invoke = invoke; }
    assert(readFileSync(output).includes(rawWall), 'het ruwe byte E9 staat bytegelijk in de uitvoer');
  } finally { await tidy(c); }
});

await check('dialoog en neerzetten: dezelfde kern handelt af vóór het lezen en meldt het bij het openen', async () => {
  const c = await opened();
  try {
    const record = await crashAt(c, (_b, crash) => ({ content: crash }));
    await nextRound(blocked);
    assert(existsSync(tempOf(c, record.id)), 'bij de start nog niet afgehandeld');
    const openedFile = await readOpenedTauriPath(c.path, false, await tauriOpenIO());
    assert.equal(existsSync(tempOf(c, record.id)), false, 'afgehandeld vóór het lezen');
    assert.deepEqual(openedFile.replaceRemnants?.map(e => e.kind), ['unsaved-schedule']);
    const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
    store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
    await store.getState().openOpenedFile(openedFile);
    assert(store.getState().ui.notifications.some(n => n.messageKey === 'notifications.ifcForeignReplaceUnsavedCopy'));
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

await check('zonder record voor het pad raken de start en het openen de projectmap niet extra', async () => {
  const c = await opened();
  try {
    const projectCalls = (from: number) => ipc.calls.slice(from).filter(call => call.command === 'place_file_exclusive' || call.path?.startsWith(c.dir));
    // Een record voor een ander bestand ergens anders: dat telt niet voor dit pad.
    writeFileSync(join(appData, replaceRecordName('elders1')), serializeReplaceRecord({
      id: 'elders1', path: join(work, 'elders', 'model.ifc'), vorigeSha256: 'a'.repeat(64), pendingSha256: 'b'.repeat(64),
    }));
    let from = ipc.calls.length;
    const io = await tauriOpenIO();
    assert.deepEqual(await io.settle(c.path), []);
    assert.deepEqual(projectCalls(from), [], 'afhandelen vóór het lezen leest alleen de app-datamap');
    from = ipc.calls.length;
    const openedFile = await readOpenedTauriPath(c.path, false, io);
    assert.equal(openedFile.replaceRemnants, undefined);
    assert.deepEqual(projectCalls(from).map(call => call.command), ['plugin:fs|read_text_file'], 'alleen het lezen zelf');
    // De start zonder enig record: alleen de app-datamap.
    rmSync(join(appData, replaceRecordName('elders1')));
    from = ipc.calls.length;
    assert.deepEqual(await nextRound(), []);
    assert.deepEqual(projectCalls(from), []);
  } finally { await tidy(c); }
});

await check('een lopende vervanging van deze sessie blijft buiten het afhandelen', async () => {
  const c = await opened(), base = await tauriOwnFileReplaceFs();
  try {
    let during: Awaited<ReturnType<typeof nextRound>> | undefined;
    const { result } = await replace(c, { ...base, content: async (p, e) => {
      if (!during) during = await nextRound();
      return base.content(p, e);
    } });
    assert.equal(result.code, 'replaced');
    assert.deepEqual(during, [], 'het record van een levende operatie is niet van herstel');
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256 });
  } finally { await tidy(c); }
});

// ── Deel b: Ctrl+S en *Opslaan* in de sluitvraag, vanaf de productie-ingang ──────────────────────────────────────
// De store-actie achter Ctrl+S (`saveFile`) en de handler van de sluitvraag (`createCloseDocumentDialogActions` met
// `saveFileForDocument`, zoals `CloseDocumentDialog`), niet de losse functie.

const errorKeys = (c: Case) => c.store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey);
const clearNotices = (c: Case) => c.store.setState(s => { s.ui.notifications = []; });
/** Elke `write_file` in de projectmap sinds `from`: de vervanging schrijft er precies één (haar eigen tijdelijke
 *  bestand); de gewone schrijfroutine voor een nieuwe naam schreef er nog één. */
const projectWriteFiles = (c: Case, from: number) => ipc.calls.slice(from)
  .filter(call => call.command === 'plugin:fs|write_file' && call.path?.startsWith(c.dir));
const placesSince = (from: number) => ipc.calls.slice(from).filter(call => call.command === 'place_file_exclusive');
const renameTask = (c: Case, name: string) => {
  const task = c.store.getState().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
  c.store.getState().updateTask(task.id, { name });
};
const latin1 = (path: string) => readFileSync(path).toString('latin1');
/** *Opslaan* in de sluitvraag van een tabblad (of van de app: dezelfde dialoog). `true` = het tabblad ging dicht. */
async function closeQuestionSave(c: Case): Promise<boolean> {
  let closed = false;
  await createCloseDocumentDialogActions({
    pendingId: c.id, getActiveDocumentId: () => c.store.getState().activeDocumentId,
    switchDocument: c.store.getState().switchDocument,
    closeDocument: async (id, options) => {
      const done = await c.store.getState().closeDocumentAfterSaves(id, options);
      closed = done !== false;
      return done;
    },
    saveFile: () => c.store.getState().saveFileForDocument(c.id),
    clearPending: () => {}, restoreOpenerFocus: () => {},
    onSavePendingChange: pending => c.store.getState().setUI({ closeQuestionSaving: pending }),
  }).save();
  return closed;
}
const isOpen = (c: Case) => c.store.getState().getOpenDocumentPayloads().some(d => d.id === c.id);

await check('Ctrl+S op het eigen pad: de nieuwe uitvoer op het doel, het model bytegelijk, niets achtergebleven; een tweede Ctrl+S slaagt weer', async () => {
  const c = await opened();
  try {
    for (const round of ['eerste', 'tweede'] as const) {
      if (round === 'tweede') renameTask(c, 'Tweede Ctrl+S');
      clearNotices(c);
      const before = fileHash(c, 'model.ifc'), from = ipc.calls.length;
      await c.store.getState().saveFile();
      const output = new Uint8Array(readFileSync(c.path)), s = c.store.getState();
      assert.deepEqual(errorKeys(c), [], `${round}: geen melding`);
      assert.notEqual(hash(output), before, `${round}: het bestand is vervangen`);
      assert.deepEqual(mergeProblems(bytes, output), [], `${round}: het gebouwmodel bytegelijk behouden`);
      assert.equal(s.isDirty, false, `${round}: niet meer gewijzigd`);
      assert.equal(s.ifcSource!.sha256, hash(output), `${round}: de bron in het geheugen is de geschreven versie`);
      assert.deepEqual(s.ifcSource!.bytes, output);
      assert.deepEqual(files(c), ['model.ifc'], `${round}: geen hulpbestand`);
      assert.deepEqual(recordsOnDisk(), [], `${round}: geen record`);
      assert.equal(projectWriteFiles(c, from).length, 1, `${round}: één schrijfactie, in het eigen tijdelijke bestand`);
      assert.equal(placesSince(from).length, 2, `${round}: stap 3 en 4`);
      const after = (await loadRecovery()).docs.find(d => d.id === c.id)?.ifcSource;
      assert.deepEqual([after?.sha256, after?.pendingSha256], [hash(output), undefined], `${round}: het manifest kent de nieuwe bron`);
    }
    assert(latin1(c.path).includes('Tweede Ctrl+S'), 'de tweede bewerking staat in het bestand');
  } finally { await tidy(c); }
});

await check('bewerken tijdens de opslag: het bestand heeft de momentopname, het document blijft gewijzigd; Opslaan in de sluitvraag sluit niet', async () => {
  const c = await opened();
  try {
    clearNotices(c);
    const source = c.store.getState().ifcSource;
    placeCalls({ 2: () => { renameTask(c, 'Tijdens het opslaan'); return undefined; } });
    assert.equal(await closeQuestionSave(c), false, 'het tabblad blijft open');
    const s = c.store.getState(), output = new Uint8Array(readFileSync(c.path));
    assert(isOpen(c));
    assert.notEqual(hash(output), hash(bytes), 'de momentopname is geschreven');
    assert.equal(latin1(c.path).includes('Tijdens het opslaan'), false, 'zonder de bewerking van tijdens de opslag');
    assert.equal(s.isDirty, true, 'het document blijft gewijzigd');
    assert.notEqual(s.ifcSource, source);
    assert.equal(s.ifcSource!.sha256, hash(output), 'de geschreven versie is de bron');
    assert.deepEqual(errorKeys(c), []);
    assert.deepEqual(files(c), ['model.ifc']);
    assert.deepEqual(recordsOnDisk(), []);
    // De volgende Ctrl+S bouwt op die bron en schrijft de bewerking.
    ipc.faults.place = null;
    await c.store.getState().saveFile();
    assert.deepEqual([c.store.getState().isDirty, latin1(c.path).includes('Tijdens het opslaan')], [false, true]);
  } finally { await tidy(c); }
});

await check('een ander programma wijzigde het bestand vóór Ctrl+S: niets vervangen, de melding, geen terugval', async () => {
  const c = await opened();
  try {
    writeFileSync(c.path, otherProgram);
    clearNotices(c);
    const source = c.store.getState().ifcSource, from = ipc.calls.length;
    await c.store.getState().saveFile();
    assert.deepEqual(errorKeys(c), ['notifications.ifcForeignTargetChanged']);
    assert.deepEqual(disk(c), { 'model.ifc': hash(otherProgram) }, 'de versie van het andere programma staat er nog');
    assert.equal(c.store.getState().isDirty, true);
    assert.equal(c.store.getState().ifcSource, source, 'de bron is niet vervangen');
    assert.deepEqual(recordsOnDisk(), []);
    assert.equal(projectWriteFiles(c, from).length, 1, 'alleen het eigen tijdelijke bestand: de gewone schrijfroutine liep niet');
    assert.deepEqual(placesSince(from), [], 'niets geplaatst');
  } finally { await tidy(c); }
});

for (const [label, prepare, notice, writes, places, remains] of [
  ['stap 3 target-exists', () => placeCalls({ 1: () => reject('target-exists') }), 'notifications.ifcForeignReplaceFailed', 1, 1, false],
  ['stap 3 source-changed (unknown)', () => placeCalls({ 1: () => reject('source-changed') }), 'notifications.ifcForeignPlaceUnknown', 1, 1, true],
  ['stap 3 refused/hard-linked', () => placeCalls({ 1: () => reject('refused', { reason: 'hard-linked' }) }), 'notifications.ifcForeignReplaceSaveAsOnly', 1, 1, false],
  ['not-recorded', (c: Case) => { c.unregister(); }, 'notifications.ifcForeignReplaceNotRecorded', 0, 0, false],
] as const) {
  for (const entry of ['Ctrl+S', 'sluitvraag'] as const) {
    await check(`${entry}, ${label}: de opslag stopt met haar melding, zonder terugval; het bestand van de planner staat er nog`, async () => {
      const c = await opened();
      try {
        clearNotices(c);
        (prepare as (c: Case) => void)(c);
        const source = c.store.getState().ifcSource, from = ipc.calls.length;
        if (entry === 'Ctrl+S') await c.store.getState().saveFile();
        else assert.equal(await closeQuestionSave(c), false, 'het tabblad blijft open');
        assert(isOpen(c));
        assert.deepEqual(errorKeys(c), [notice]);
        assert.equal(fileHash(c, 'model.ifc'), hash(bytes), 'het bestand van de planner is ongewijzigd');
        assert.equal(c.store.getState().isDirty, true);
        assert.equal(c.store.getState().ifcSource, source);
        assert.equal(projectWriteFiles(c, from).length, writes, 'geen terugval op de gewone schrijfroutine');
        assert.equal(placesSince(from).length, places);
        assert.equal(recordsOnDisk().length, remains ? 1 : 0, remains ? 'het record blijft (onbekende stand)' : 'geen record');
      } finally { await tidy(c); }
    });
  }
}

await check('Opslaan in de sluitvraag: na een geslaagde vervanging gaat het tabblad dicht', async () => {
  const c = await opened();
  try {
    clearNotices(c);
    assert.equal(await closeQuestionSave(c), true);
    assert.equal(isOpen(c), false);
    const output = new Uint8Array(readFileSync(c.path));
    assert.notEqual(hash(output), hash(bytes));
    assert.deepEqual(mergeProblems(bytes, output), []);
    assert.deepEqual(errorKeys(c), []);
    assert.deepEqual(files(c), ['model.ifc']);
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

for (const change of ['document gesloten', 'ander doel', 'andere bron'] as const) {
  await check(`na de eerste herstelronde: ${change}; niets geschreven in de projectmap`, async () => {
    const c = await opened();
    c.unregister();
    const tracker = new RecoveryDeltaTracker();
    let armed = true;
    const unregister = registerRecoveryFlush(async () => {
      const s = c.store.getState();
      await runRecoveryTick(tracker, s.activeDocumentId,
        s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
      // De eerste ronde binnen de vervanging: `pendingSha256` staat nu in het manifest.
      if (!armed || !hasPendingIfcSource()) return;
      armed = false;
      if (change === 'document gesloten') c.store.getState().closeDocument(c.id);
      else if (change === 'ander doel') c.store.setState(st => { st.filePath = join(c.dir, 'ander.ifc'); });
      else {
        const copy = { ...c.store.getState().ifcSource! };
        c.store.setState(st => { st.ifcSource = castDraft(copy); });
      }
    });
    try {
      clearNotices(c);
      const from = ipc.calls.length;
      assert.equal(await c.store.getState().saveFileForDocument(c.id), false);
      assert.equal(armed, false, 'de wijziging gebeurde in de eerste ronde');
      assert.deepEqual(ipc.calls.slice(from).filter(call => call.wrote && call.path?.startsWith(c.dir)), [], 'geen schrijfactie in de projectmap');
      assert.deepEqual(placesSince(from), []);
      assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
      assert.deepEqual(recordsOnDisk(), []);
      assert.deepEqual(errorKeys(c), ['notifications.ifcSaveChangedWhileWaiting']);
    } finally { unregister(); await tidy(c); }
  });
}

// Fixronde 1 van #1008 (review Sol, bevinding 2): een tweede tabblad op hetzelfde bestand. Openen via de desktoproute
// van neerzetten (`readOpenedTauriPath`), zoals de proef van de reviewer.
const openViaDrop = async (c: Case) => {
  const { droppedFilesFromPaths } = await import('@/services/fileAccess/fileDrop');
  const { openDroppedFiles } = await import('@/state/fileDrop');
  const paths = droppedFilesFromPaths([c.path], await tauriOpenIO(), { ifcBytes: true });
  await openDroppedFiles(c.store, paths, {} as Parameters<typeof openDroppedFiles>[2],
    () => c.store.getState().ui.pendingCloseDocId !== null || c.store.getState().ui.savingBeforeClose);
};
const otherTab = (c: Case) => c.store.getState().getOpenDocumentPayloads()
  .find(d => d.id !== c.id && d.payload.foreignSourceMark?.filePath === c.path);
/** De herstelronde van `opened`, met `during` één keer in de eerste ronde binnen de vervanging (`pendingSha256` staat dan
 *  in het manifest; de controle na de herstelronde komt daarna). */
function firstPendingRound(c: Case, during: () => void | Promise<void>) {
  c.unregister();
  const tracker = new RecoveryDeltaTracker();
  let armed = true;
  const unregister = registerRecoveryFlush(async () => {
    const s = c.store.getState();
    await runRecoveryTick(tracker, s.activeDocumentId,
      s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
    if (!armed || !hasPendingIfcSource()) return;
    armed = false;
    await during();
  });
  return { unregister, fired: () => !armed };
}

await check('een vooraf geopend tweede tabblad met hetzelfde bestand stopt Ctrl+S, met nul plaatsingen', async () => {
  const c = await opened();
  try {
    await openViaDrop(c);
    assert(otherTab(c), 'het tweede tabblad is open');
    c.store.getState().switchDocument(c.id);
    clearNotices(c);
    const from = ipc.calls.length;
    const result = await c.store.getState().saveFileForDocument(c.id);
    assert.deepEqual({ result, changed: fileHash(c, 'model.ifc') !== hash(bytes), places: placesSince(from).length, errors: errorKeys(c) },
      { result: false, changed: false, places: 0, errors: ['notifications.ifcForeignReplaceBlocked'] });
  } finally { await tidy(c); }
});

await check('een tweede tabblad dat tijdens de eerste herstelronde opengaat, wacht tot de vervanging klaar is en leest de nieuwe versie', async () => {
  const c = await opened();
  let opening: Promise<void> | undefined;
  // Niet afwachten in de herstelronde: die loopt binnen de schrijfactie, en het openen wacht juist daarop.
  const round = firstPendingRound(c, () => { opening = openViaDrop(c); });
  try {
    clearNotices(c);
    const from = ipc.calls.length;
    const result = await c.store.getState().saveFileForDocument(c.id);
    assert.equal(round.fired(), true, 'het openen begon tijdens de eerste herstelronde');
    await opening;
    const written = fileHash(c, 'model.ifc');
    assert.deepEqual({ result, changed: written !== hash(bytes), places: placesSince(from).length, errors: errorKeys(c) },
      { result: true, changed: true, places: 2, errors: [] }, 'de opslag slaagt');
    const second = otherTab(c);
    assert(second, 'het tweede tabblad is open');
    assert.equal(second.payload.ifcSource?.sha256, written, 'het tweede tabblad las de nieuwe versie');
  } finally { round.unregister(); await tidy(c); }
});

await check('een tweede tabblad dat er na de eerste herstelronde toch is: de vervanging stopt met nul plaatsingen en de melding van de doelbewaking', async () => {
  const c = await opened();
  // Rechtstreeks in de store (de openactie met bytes, zonder de leesroute), tussen de controle vóór en na de herstelronde.
  const round = firstPendingRound(c, () => c.store.getState().openOpenedFile({ name: 'model.ifc', content: '', bytes, ref: { kind: 'path', path: c.path } }));
  try {
    clearNotices(c);
    const from = ipc.calls.length;
    const result = await c.store.getState().saveFileForDocument(c.id);
    assert.equal(round.fired(), true);
    assert(otherTab(c), 'het tweede tabblad is open');
    assert.deepEqual({ result, changed: fileHash(c, 'model.ifc') !== hash(bytes), places: placesSince(from).length, errors: errorKeys(c) },
      { result: false, changed: false, places: 0, errors: ['notifications.ifcForeignReplaceBlocked'] });
    assert.deepEqual(ipc.calls.slice(from).filter(call => call.wrote && call.path?.startsWith(c.dir)), [], 'geen schrijfactie in de projectmap');
    assert.deepEqual(recordsOnDisk(), []);
  } finally { round.unregister(); await tidy(c); }
});

// Met de flag uit, en voor een document zonder gebouwmodel, loopt Ctrl+S zoals op main. De reeks aanroepen aan de
// bestandsrand is vastgelegd op main (`cef70233b`), met dezelfde proef. Met de flag uit opent de app geen bestand met
// een gebouwmodel; zo'n document bestaat dan alleen als de flag na het openen uitging.
// De bestandskiezer en Recent lopen ook door `readOpenedTauriPath` en wachten dus net zo; en de grens van 1837 (een
// lezing die al vóór Ctrl+S begon) vastgelegd: het tabblad krijgt de oude bron, maar Ctrl+S daarin weigert. Proeven van
// de review van #1008, ronde 2.
const internal = (window as unknown as { __TAURI_INTERNALS__: { invoke: (command: string, ...args: unknown[]) => Promise<unknown> } }).__TAURI_INTERNALS__;
const deferredOpen = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { resolve, promise };
};
const throughRecent = (c: Case) => {
  c.store.setState(s => {
    s.recentFiles = [{ id: 'review-recent', name: 'model.ifc', ref: { kind: 'path', path: c.path }, addedAt: 1 }];
  });
  return c.store.getState().openRecentFile('review-recent');
};
for (const route of ['dialoog', 'Recent'] as const) {
  await check(`${route}: opening tijdens herstel wacht en leest wat Ctrl+S schreef`, async () => {
    const c = await opened();
    const invoke = internal.invoke;
    internal.invoke = (command, ...args) => command === 'plugin:dialog|open' ? Promise.resolve(c.path) : invoke(command, ...args);
    let opening: Promise<void> | undefined;
    const round = firstPendingRound(c, async () => {
      opening = route === 'dialoog' ? c.store.getState().openFile() : throughRecent(c);
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.equal(otherTab(c), undefined);
    });
    try {
      assert.equal(await c.store.getState().saveFileForDocument(c.id), true);
      assert.ok(opening && round.fired());
      await opening;
      const written = fileHash(c, 'model.ifc');
      assert.notEqual(written, hash(bytes));
      assert.equal(otherTab(c)?.payload.ifcSource?.sha256, written);
      assert.deepEqual(errorKeys(c), []);
    } finally {
      internal.invoke = invoke;
      round.unregister();
      await tidy(c);
    }
  });
}

await check('1837: een al begonnen lezing blijft oud, maar Ctrl+S weigert ook nadat het eerste tabblad dicht is', async () => {
  const c = await opened();
  const read = deferredOpen(), release = deferredOpen();
  const invoke = internal.invoke;
  let captured = false;
  internal.invoke = async (command, ...args) => {
    if (!captured && /^plugin:fs\|read_(text_)?file$/.test(command) && (args[0] as { path?: string })?.path === c.path) {
      captured = true;
      const result = await invoke(command, ...args);
      read.resolve();
      await release.promise;
      return result;
    }
    return invoke(command, ...args);
  };
  const opening = throughRecent(c);
  try {
    await Promise.race([read.promise, opening.then(() => { throw new Error('de route heeft de verwachte leesrand niet geraakt'); })]);
    assert.equal(otherTab(c), undefined);
    assert.equal(await c.store.getState().saveFileForDocument(c.id), true);
    const written = fileHash(c, 'model.ifc');
    assert.notEqual(written, hash(bytes));
    release.resolve();
    await opening;
    const second = otherTab(c);
    assert(second, 'het tweede tabblad ging open');
    assert.equal(second.payload.ifcSource?.sha256, hash(bytes), 'het las de oude bron');
    c.store.getState().closeDocument(c.id);
    renameTask(c, 'Bewerking in het achterlopende tabblad');
    const from = ipc.calls.length;
    assert.equal(await c.store.getState().saveFileForDocument(second.id), false);
    assert.equal(fileHash(c, 'model.ifc'), written);
    assert.equal(c.store.getState().isDirty, true);
    assert.equal(placesSince(from).length, 0);
    assert.deepEqual(errorKeys(c), ['notifications.ifcForeignTargetChanged']);
  } finally {
    release.resolve();
    await opening;
    internal.invoke = invoke;
    await tidy(c);
  }
});

await check('Ctrl+S met de flag uit (na het openen uitgezet): dezelfde weigering als main, geen aanroep aan de bestandsrand', async () => {
  const c = await opened();
  try {
    c.store.setState(s => { s.ui.featureFlags = {}; });
    clearNotices(c);
    const from = ipc.calls.length;
    await c.store.getState().saveFile();
    assert.deepEqual(ipc.calls.slice(from).map(call => call.command), [], 'zoals main: niets aan de bestandsrand');
    assert.deepEqual(errorKeys(c), ['notifications.ifcForeignSaveBlocked']);
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
    assert.equal(c.store.getState().isDirty, true);
  } finally { await tidy(c); }
});

const plain = new Uint8Array(readFileSync(join(root, 'public/examples/03-kantoorgebouw-zuidas.ifc')));
const MAIN_CALLS: Record<'aan' | 'uit', string[]> = {
  // Met de flag aan leest de doelcontrole eerst het bestaande doel (`refusedWriteTarget`), dan de gewone atomaire opslag.
  aan: ['plugin:fs|open <map>/model.ifc', 'plugin:fs|read ', 'plugin:fs|read ', 'plugin:fs|seek ', 'plugin:fs|read ',
    'plugin:fs|read ', 'plugin:resources|close ', 'plugin:fs|lstat <map>/model.ifc',
    'plugin:fs|write_text_file <map>/save-<id>.ops-save.tmp', 'plugin:fs|rename '],
  uit: ['plugin:fs|lstat <map>/model.ifc', 'plugin:fs|write_text_file <map>/save-<id>.ops-save.tmp', 'plugin:fs|rename '],
};
for (const flag of [true, false]) {
  await check(`Ctrl+S zonder gebouwmodel, flag ${flag ? 'aan' : 'uit'}: dezelfde route en dezelfde aanroepen aan de bestandsrand als main`, async () => {
    const dir = join(work, `geval-${++cases}`);
    mkdirSync(dir);
    const path = join(dir, 'model.ifc');
    writeFileSync(path, plain);
    const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
    store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; });
    await store.getState().openOpenedFile({ name: 'model.ifc', content: Buffer.from(plain).toString('utf8'), bytes: plain, ref: { kind: 'path', path } });
    assert.equal(store.getState().filePath, path);
    assert.equal(!!store.getState().ifcSource?.foreign, false, 'geen vreemd deel');
    const task = store.getState().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
    store.getState().updateTask(task.id, { name: 'Gewone opslag' });
    store.setState(s => { s.ui.notifications = []; });
    const from = ipc.calls.length;
    await store.getState().saveFile();
    const seen = ipc.calls.slice(from).map(call => `${call.command} ${(call.path ?? '').replace(dir, '<map>').replace(/save-[0-9a-z]+\./, 'save-<id>.')}`);
    assert.deepEqual(seen, MAIN_CALLS[flag ? 'aan' : 'uit'], JSON.stringify(seen));
    assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey), []);
    assert.equal(store.getState().isDirty, false);
    assert(readFileSync(path).toString('latin1').includes('Gewone opslag'));
    // *Opslaan* in de sluitvraag: dezelfde aanroepen, en het tabblad gaat dicht zoals op main (fixronde 1 van #1008: de
    // controle vlak vóór het sluiten beslist voor een gewoon document niets anders).
    const id = store.getState().activeDocumentId;
    store.getState().updateTask(task.id, { name: 'Gewone opslag in de sluitvraag' });
    let closed = false;
    const fromClose = ipc.calls.length;
    await createCloseDocumentDialogActions({
      pendingId: id, getActiveDocumentId: () => store.getState().activeDocumentId,
      switchDocument: store.getState().switchDocument,
      closeDocument: async (docId, options) => {
        const done = await store.getState().closeDocumentAfterSaves(docId, options);
        closed = done !== false;
        return done;
      },
      saveFile: () => store.getState().saveFileForDocument(id),
      clearPending: () => {}, restoreOpenerFocus: () => {},
      onSavePendingChange: pending => store.getState().setUI({ closeQuestionSaving: pending }),
    }).save();
    const seenClose = ipc.calls.slice(fromClose).map(call => `${call.command} ${(call.path ?? '').replace(dir, '<map>').replace(/save-[0-9a-z]+\./, 'save-<id>.')}`);
    assert.deepEqual(seenClose, MAIN_CALLS[flag ? 'aan' : 'uit'], JSON.stringify(seenClose));
    assert.equal(closed, true, 'het tabblad gaat dicht');
    assert.equal(store.getState().getOpenDocumentPayloads().some(d => d.id === id), false);
    assert(readFileSync(path).toString('latin1').includes('Gewone opslag in de sluitvraag'));
  });
}

// ── Deel c: Opslaan als over een andere bestaande naam (#804 keuze 4, knownbug 1131 stap 8) ─────────────────────────
// De planner kiest in de bestandskiezer een bestaand bestand en bevestigt daar het vervangen. De app vervangt het langs
// dezelfde weg als Ctrl+S; de verwachte inhoud is wat er bij het begin van de opslag op het doel stond. Vanaf de
// productie-ingang (`saveFileAs`), met de echte bestandskiezer-aanroep nagebootst.

const isTempPath = (path: string) => /[\\/]save-[0-9a-z]+\.ops-save\.tmp$/.test(path);
/** Een ander bestaand bestand naast het geopende, standaard een gewone planning van de app (de doelscan laat het toe). */
const otherFile = (c: Case, content: Uint8Array = plain, name = 'ander.ifc'): OtherTarget => {
  const path = join(c.dir, name);
  writeFileSync(path, content);
  return { path, content };
};
/** *Opslaan als* (Ctrl+Shift+S) met `path` als keuze in de bestandskiezer. */
async function saveAsTo(store: Case['store'], path: string): Promise<void> {
  const invoke = internal.invoke;
  internal.invoke = (command, ...args) => command === 'plugin:dialog|save' ? Promise.resolve(path) : invoke(command, ...args);
  try { await store.getState().saveFileAs(); } finally { internal.invoke = invoke; }
}
/** Het document is zoals vóór de opslag: oud pad, oude bron, nog gewijzigd. */
function documentUnchanged(c: Case, source: unknown) {
  const s = c.store.getState();
  assert.deepEqual([s.filePath, s.isDirty, s.foreignSourceMark?.filePath], [c.path, true, c.path], 'het document houdt zijn oude pad en blijft gewijzigd');
  assert.equal(s.ifcSource, source, 'de bron is niet vervangen');
}
const otherWithModel = new Uint8Array(otherProgram);
const changedPlain = new Uint8Array([...plain, 10]);

await check('Opslaan als over een ander bestaand bestand: vervangen langs de weg van Ctrl+S, het document volgt, Ctrl+S daarna ook', async () => {
  const c = await opened();
  try {
    const target = otherFile(c);
    let atStep3: ReplaceRecord[] | undefined;
    placeCalls({ 1: () => { atStep3 = recordsOnDisk(); return undefined; } });
    clearNotices(c);
    const from = ipc.calls.length;
    await saveAsTo(c.store, target.path);
    const output = new Uint8Array(readFileSync(target.path)), s = c.store.getState();
    assert.deepEqual(errorKeys(c), [], 'geen melding');
    assert.deepEqual(mergeProblems(bytes, output), [], 'het gebouwmodel bytegelijk in het vervangen bestand');
    assert.deepEqual(disk(c), { 'ander.ifc': hash(output), 'model.ifc': hash(bytes) }, 'geen hulpbestand; het geopende bestand ongewijzigd');
    assert.deepEqual(recordsOnDisk(), [], 'het record is weg');
    assert.equal(atStep3?.length, 1, 'tijdens de vervanging stond er een herstelrecord');
    assert.deepEqual([atStep3![0].path, atStep3![0].vorigeSha256], [target.path, hash(plain)],
      'de verwachte inhoud is wat bij het begin op het doel stond');
    assert.equal(atStep3![0].pendingSha256, hash(output), 'en de komende versie is de geschreven uitvoer');
    assert.deepEqual([s.filePath, s.isDirty, s.foreignSourceMark?.filePath], [target.path, false, target.path], 'het nieuwe pad, niet gewijzigd');
    assert.equal(s.ifcSource!.sha256, hash(output), 'de geschreven bytes zijn de bron');
    assert(s.recentFiles.some(r => r.ref.kind === 'path' && r.ref.path === target.path), 'Recent kent het nieuwe pad');
    assert.equal(projectWriteFiles(c, from).length, 1, 'één schrijfactie, in het eigen tijdelijke bestand');
    assert.deepEqual(placesSince(from).map(call => call.path), [previousVersionPath(target.path, atStep3![0].id), target.path],
      'stap 3 en 4, geen gewone schrijfroutine');
    const manifest = (await loadRecovery()).docs.find(d => d.id === c.id)?.ifcSource;
    assert.deepEqual([manifest?.sha256, manifest?.pendingSha256], [hash(output), undefined], 'het manifest kent de nieuwe bron');
    // Het gewone vervolg: Ctrl+S op het zojuist vervangen bestand.
    ipc.faults.place = null;
    renameTask(c, 'Na Opslaan als');
    assert.equal(await c.store.getState().saveFileForDocument(c.id), true);
    assert(latin1(target.path).includes('Na Opslaan als'));
    assert.deepEqual(errorKeys(c), []);
    assert.deepEqual(files(c), ['ander.ifc', 'model.ifc']);
  } finally { await tidy(c); }
});

await check('Opslaan als: het doel verandert tussen het begin van de opslag en de vervanging: melding, niets vervangen', async () => {
  const c = await opened();
  try {
    const target = otherFile(c);
    clearNotices(c);
    const source = c.store.getState().ifcSource, from = ipc.calls.length;
    // Een ander programma schrijft het doel, vlak voordat de app haar eigen tijdelijke bestand aanmaakt (na het lezen van
    // de verwachte inhoud en na de doelbewaking).
    ipc.faults.beforeOpen = p => { if (isTempPath(p)) { writeFileSync(target.path, changedPlain); ipc.faults.beforeOpen = null; } };
    await saveAsTo(c.store, target.path);
    assert.deepEqual(errorKeys(c), ['notifications.ifcForeignTargetChanged']);
    assert.deepEqual(disk(c), { 'ander.ifc': hash(changedPlain), 'model.ifc': hash(bytes) }, 'het doel houdt de nieuwe inhoud van de ander');
    documentUnchanged(c, source);
    assert.deepEqual(placesSince(from), [], 'niets verplaatst');
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

await check('Opslaan als: een gebouwmodel op het doel na de bestandskiezer: de tweede doelcontrole weigert het, het model blijft', async () => {
  const c = await opened();
  const invoke = internal.invoke;
  try {
    const target = otherFile(c);
    clearNotices(c);
    const source = c.store.getState().ifcSource, from = ipc.calls.length;
    // Na de doelcontrole in de bestandskiezer, vlak voordat de app de verwachte inhoud leest, zet een ander programma een
    // gebouwmodel op het doel. Die inhoud wordt de verwachte inhoud; zonder tweede controle zou stap 5 haar weghalen.
    // De eerste `lstat` op het doel stelt direct na de kiezer vast dat er een bestand staat; de tweede gaat aan het lezen
    // van de verwachte inhoud vooraf.
    let swapped = false, lstats = 0;
    internal.invoke = (command, ...args) => {
      if (!swapped && command === 'plugin:fs|lstat' && (args[0] as { path?: string })?.path === target.path && ++lstats === 2) {
        swapped = true;
        writeFileSync(target.path, otherWithModel);
      }
      return invoke(command, ...args);
    };
    await saveAsTo(c.store, target.path);
    assert(swapped, 'de wissel gebeurde');
    assert.deepEqual(errorKeys(c), ['notifications.ifcForeignTargetSave']);
    assert.deepEqual(disk(c), { 'ander.ifc': hash(otherWithModel), 'model.ifc': hash(bytes) }, 'het gebouwmodel van de ander staat er nog');
    documentUnchanged(c, source);
    assert.deepEqual([projectWriteFiles(c, from).length, placesSince(from).length], [0, 0], 'nul schrijfacties in de map');
    assert.deepEqual(recordsOnDisk(), []);
  } finally { internal.invoke = invoke; await tidy(c); }
});

await check('Opslaan als over de bron van een ander open document: geweigerd met de bestaande melding, niets geschreven', async () => {
  const c = await opened();
  try {
    const second = otherFile(c, bytes, 'tweede.ifc');
    await c.store.getState().openOpenedFile({ name: 'tweede.ifc', content: '', bytes, ref: { kind: 'path', path: second.path } });
    assert.equal(c.store.getState().getOpenDocumentPayloads().length, 2, 'het tweede bestand staat in een eigen tabblad');
    c.store.getState().switchDocument(c.id);
    clearNotices(c);
    const source = c.store.getState().ifcSource, from = ipc.calls.length;
    await saveAsTo(c.store, second.path);
    assert.deepEqual(errorKeys(c), ['notifications.ifcForeignReplaceBlocked']);
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes), 'tweede.ifc': hash(bytes) });
    documentUnchanged(c, source);
    assert.deepEqual([projectWriteFiles(c, from).length, placesSince(from).length], [0, 0], 'nul schrijfacties');
  } finally { await tidy(c); }
});

// Fixronde 1 van #1019 (review Sol, BLOKKEERT): een gewone planning zonder vreemd deel, open in een ander tabblad. De
// doelbescherming via bronkenmerken ziet haar niet; de route kijkt daarom ook naar de paden van de open documenten.
await check('Opslaan als over een gewone planning die in een ander tabblad open staat: geweigerd, niets geschreven, beide tabbladen ongewijzigd', async () => {
  const c = await opened();
  const invoke = internal.invoke;
  try {
    const target = otherFile(c);
    internal.invoke = (command, ...args) => command === 'plugin:dialog|open' ? Promise.resolve(target.path) : invoke(command, ...args);
    await c.store.getState().openFile();
    internal.invoke = invoke;
    const secondId = c.store.getState().activeDocumentId;
    assert.notEqual(secondId, c.id, 'het bestand staat in een eigen tabblad');
    assert.deepEqual([c.store.getState().filePath, c.store.getState().foreignSourceMark], [target.path, null], 'een gewone planning');
    renameTask(c, 'Werk in het tweede tabblad');
    c.store.getState().switchDocument(c.id);
    clearNotices(c);
    const source = c.store.getState().ifcSource, from = ipc.calls.length;
    await saveAsTo(c.store, target.path);
    assert.deepEqual(errorKeys(c), ['notifications.ifcForeignTargetOpenInTab']);
    assert.deepEqual(disk(c), { 'ander.ifc': hash(plain), 'model.ifc': hash(bytes) }, 'het doel houdt zijn bytes');
    documentUnchanged(c, source);
    const second = c.store.getState().getOpenDocumentPayloads().find(d => d.id === secondId)!.payload;
    assert.deepEqual([second.filePath, second.isDirty], [target.path, true], 'het tweede tabblad houdt zijn pad en wijzigingen');
    assert.deepEqual([projectWriteFiles(c, from).length, placesSince(from).length], [0, 0], 'nul schrijfacties');
    assert.deepEqual(recordsOnDisk(), []);
  } finally { internal.invoke = invoke; await tidy(c); }
});

await check('Opslaan als: een tabblad dat tijdens de eerste herstelronde op de gewone planning opengaat, stopt de vervanging', async () => {
  const c = await opened();
  const target = otherFile(c);
  // Rechtstreeks in de store (de openactie met bytes), tussen de controle in de bestandskiezer en die na de herstelronde.
  const round = firstPendingRound(c, () => c.store.getState().openOpenedFile({
    name: 'ander.ifc', content: Buffer.from(plain).toString('utf8'), bytes: plain, ref: { kind: 'path', path: target.path },
  }));
  try {
    clearNotices(c);
    const from = ipc.calls.length;
    await saveAsTo(c.store, target.path);
    assert.equal(round.fired(), true, 'de herstelronde met de komende versie liep');
    assert(c.store.getState().getOpenDocumentPayloads().some(d => d.id !== c.id && d.payload.filePath === target.path), 'het tweede tabblad is open');
    assert.deepEqual(errorKeys(c), ['notifications.ifcForeignTargetOpenInTab']);
    assert.deepEqual(disk(c), { 'ander.ifc': hash(plain), 'model.ifc': hash(bytes) }, 'het doel houdt zijn bytes');
    const own = c.store.getState().getOpenDocumentPayloads().find(d => d.id === c.id)!.payload;
    assert.deepEqual([own.filePath, own.isDirty], [c.path, true], 'het document houdt zijn oude pad en blijft gewijzigd');
    assert.deepEqual(ipc.calls.slice(from).filter(call => call.wrote && call.path?.startsWith(c.dir)), [], 'geen schrijfactie in de projectmap');
    assert.deepEqual(placesSince(from), []);
    assert.deepEqual(recordsOnDisk(), []);
  } finally { round.unregister(); await tidy(c); }
});

// Fixronde 2 van #1019 (review Sol ronde 2, BLOKKEERT): de controle op open tabbladen hoort alleen bij een vervanging.
// Onthoudt een ander tabblad een pad waar geen bestand meer staat, dan is die naam vrij en maakt Opslaan als het
// bestand exclusief aan, zoals main.
await check('Opslaan als naar een vrije naam die een ander tabblad nog als pad onthoudt (bestand buiten de app verwijderd): exclusief aangemaakt, zoals main', async () => {
  const c = await opened();
  const invoke = internal.invoke;
  try {
    const target = otherFile(c);
    internal.invoke = (command, ...args) => command === 'plugin:dialog|open' ? Promise.resolve(target.path) : invoke(command, ...args);
    await c.store.getState().openFile();
    internal.invoke = invoke;
    const secondId = c.store.getState().activeDocumentId;
    assert.notEqual(secondId, c.id, 'het bestand staat in een eigen tabblad');
    renameTask(c, 'Werk in het tweede tabblad');
    c.store.getState().switchDocument(c.id);
    unlinkSync(target.path);
    clearNotices(c);
    const from = ipc.calls.length;
    await saveAsTo(c.store, target.path);
    const state = c.store.getState();
    assert.deepEqual(errorKeys(c), [], 'geen melding');
    assert.deepEqual([state.filePath, state.isDirty], [target.path, false], 'het document staat op de nieuwe naam en is opgeslagen');
    assert(latin1(target.path).includes('IFCWALL'), 'het nieuwe bestand bevat het gebouwmodel');
    assert.equal(fileHash(c, 'model.ifc'), hash(bytes), 'het oude bestand is onaangeroerd');
    assert.deepEqual(placesSince(from).map(call => call.path), [target.path], 'alleen de exclusieve plaatsing, geen vervanging');
    const second = state.getOpenDocumentPayloads().find(d => d.id === secondId)!.payload;
    assert.deepEqual([second.filePath, second.isDirty], [target.path, true], 'het tweede tabblad houdt zijn pad en wijzigingen');
    assert.deepEqual(recordsOnDisk(), []);
  } finally { internal.invoke = invoke; await tidy(c); }
});

// Vervolgpunt 1 van dezelfde review: was het gekozen pad leeg toen de bestandskiezer terugkwam, dan blijft het de
// exclusieve aanmaakroute houden; een bestand dat daarna verschijnt, geeft `target-exists` zoals voorheen.
await check('Opslaan als naar een vrije naam waar na de bestandskiezer een bestand verschijnt: niet vervangen, de melding van een bestaande naam', async () => {
  const c = await opened();
  const invoke = internal.invoke;
  try {
    const path = join(c.dir, 'nieuw.ifc');
    let appeared = false;
    internal.invoke = (command, ...args) => {
      if (!appeared && command === 'plugin:fs|open' && (args[0] as { path?: string })?.path === path) {
        appeared = true;
        writeFileSync(path, plain);
      }
      return invoke(command, ...args);
    };
    clearNotices(c);
    const source = c.store.getState().ifcSource, from = ipc.calls.length;
    await saveAsTo(c.store, path);
    assert(appeared, 'het bestand verscheen na de bestandskiezer');
    assert.deepEqual(errorKeys(c), ['notifications.ifcForeignNewTargetOnly']);
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes), 'nieuw.ifc': hash(plain) }, 'het verschenen bestand blijft');
    documentUnchanged(c, source);
    assert.deepEqual(placesSince(from).map(call => call.path), [path], 'alleen de exclusieve plaatsing, geen vervanging');
    assert.deepEqual(recordsOnDisk(), []);
  } finally { internal.invoke = invoke; await tidy(c); }
});

await check('Opslaan als over een bestand met een gebouwmodel van een ander: de doelbescherming weigert, zoals voorheen', async () => {
  const c = await opened();
  try {
    const target = otherFile(c, otherWithModel);
    clearNotices(c);
    const source = c.store.getState().ifcSource, from = ipc.calls.length;
    await saveAsTo(c.store, target.path);
    assert.deepEqual(errorKeys(c), ['notifications.ifcForeignTargetSave']);
    assert.deepEqual(disk(c), { 'ander.ifc': hash(otherWithModel), 'model.ifc': hash(bytes) });
    documentUnchanged(c, source);
    assert.deepEqual([projectWriteFiles(c, from).length, placesSince(from).length], [0, 0], 'nul schrijfacties');
  } finally { await tidy(c); }
});

for (const [label, prepare] of [
  ['een map waar het tijdelijke bestand niet mag ontstaan (forbidden path)', () => { ipc.faults.forbidden = isTempPath; }],
  ['stap 3 unsupported (een bestandssysteem zonder exclusieve stap)', () => placeCalls({ 1: () => reject('unsupported') })],
  ['stap 3 refused/scope', () => placeCalls({ 1: () => reject('refused', { reason: 'scope' }) })],
] as const) {
  await check(`Opslaan als, ${label}: de bestaande melding, het doel onveranderd, geen terugval`, async () => {
    const c = await opened();
    try {
      const target = otherFile(c);
      clearNotices(c);
      const source = c.store.getState().ifcSource, from = ipc.calls.length;
      prepare();
      await saveAsTo(c.store, target.path);
      assert.deepEqual(errorKeys(c), ['notifications.ifcForeignNewTargetOnly']);
      assert.deepEqual(disk(c), { 'ander.ifc': hash(plain), 'model.ifc': hash(bytes) }, 'het doel onveranderd, geen hulpbestand');
      documentUnchanged(c, source);
      assert.deepEqual(projectWriteFiles(c, from).filter(call => !isTempPath(call.path!)), [], 'nooit een schrijfactie op het doel');
      assert.deepEqual(recordsOnDisk(), []);
    } finally { await tidy(c); }
  });
}

// Een onderbreking na elke stap van de vervanging over een ander bestaand bestand, gevolgd door herstel zoals bij de
// start. Het doel was in deze sessie nooit geopend; het herstelrecord noemt het en de inhoud van het begin.
const SAVE_AS_UNSAVED_COPY = 'ander (niet opgeslagen planning 2026-11-17 14.32).ifc';
for (const [label, where, expected] of [
  ['na stap 0', (_b: OwnFileReplaceFs, crash: () => Promise<never>) => ({ createNew: crash }),
    (_c: Case, _id: string) => ({ 'ander.ifc': hash(plain) })],
  ['na stap 2 (vóór het opzijzetten)', (_b: OwnFileReplaceFs, crash: () => Promise<never>) => ({ place: crash }),
    (c: Case, _id: string) => ({ 'ander.ifc': hash(plain), [SAVE_AS_UNSAVED_COPY]: c.prepared.sha256 })],
  ['na stap 3 (doel weg)', (base: OwnFileReplaceFs, crash: () => Promise<never>) => {
    let calls = 0;
    return { place: async (f: string, t: string) => (++calls === 2 ? crash() : base.place(f, t)) };
  }, (c: Case, _id: string) => ({ 'ander.ifc': hash(plain), [SAVE_AS_UNSAVED_COPY]: c.prepared.sha256 })],
  ['na stap 4', (base: OwnFileReplaceFs, crash: () => Promise<never>) => {
    let calls = 0;
    return { content: async (p: string, e: Uint8Array) => (++calls === 2 ? crash() : base.content(p, e)) };
  }, (c: Case, id: string) => ({ 'ander.ifc': c.prepared.sha256, [`ander.ifc.ops-vorige-${id}`]: hash(plain) })],
] as const) {
  await check(`Opslaan als, crash ${label}: na afhandelen een volledig bestand, de oude inhoud terug te vinden`, async () => {
    const c = await opened();
    try {
      const target = otherFile(c);
      const record = await crashAt(c, where, target);
      const { notices, restored } = await recover(c);
      assert.deepEqual(disk(c), { ...expected(c, record.id), 'model.ifc': hash(bytes) }, JSON.stringify(disk(c)));
      const after = disk(c);
      assert([hash(plain), c.prepared.sha256].includes(after['ander.ifc']), 'op het doel staat een volledige versie');
      if (after['ander.ifc'] !== c.prepared.sha256) {
        assert.equal(after['ander.ifc'], hash(plain), 'zolang de nieuwe versie er niet staat, staat de oude er');
      } else assert(Object.values(after).includes(hash(plain)), 'de oude inhoud is terug te vinden');
      // Het herstelde document: het eigen bestand met zijn bron (Opslaan als had het nog niet vastgelegd).
      assert.deepEqual([restored.filePath, restored.ifcSource?.sha256], [c.path, hash(bytes)]);
      const kept = after[`ander.ifc.ops-vorige-${record.id}`] !== undefined;
      assert.deepEqual(recordsOnDisk().length, kept ? 1 : 0, kept ? 'het record blijft zolang de vorige versie er staat' : 'het record is weg');
      assert.deepEqual(notices.map(n => n.messageKey), kept ? ['notifications.ifcForeignReplaceLeftOver']
        : after[SAVE_AS_UNSAVED_COPY] ? ['notifications.ifcForeignReplaceUnsavedCopy'] : []);
    } finally { await tidy(c); }
  });
}

await check('Opslaan als, crash na stap 3: openen van het doel (dialoog of neerzetten) handelt eerst af, ook al was het nooit geopend', async () => {
  const c = await opened();
  try {
    const target = otherFile(c);
    let calls = 0;
    const record = await crashAt(c, (base, crash) => ({ place: async (f, t) => (++calls === 2 ? crash() : base.place(f, t)) }), target);
    assert.equal(existsSync(target.path), false, 'het doel staat opzij');
    const openedFile = await readOpenedTauriPath(target.path, false, await tauriOpenIO());
    assert.equal(hash(readFileSync(target.path)), hash(plain), 'de oude inhoud is terug op het doel, vóór het lezen');
    assert.equal(existsSync(previousVersionPath(target.path, record.id)), false);
    assert.deepEqual(openedFile.replaceRemnants?.map(e => e.kind), ['unsaved-schedule']);
    assert.deepEqual(recordsOnDisk(), []);
  } finally { await tidy(c); }
});

// Een document zonder vreemd deel, met de flag aan of uit, en een document met een gebouwmodel met de flag uit: Opslaan
// als over een bestaand bestand loopt zoals op main. De reeksen aanroepen aan de bestandsrand zijn vastgelegd op main
// (`62e7786d4`), met dezelfde proef.
const MAIN_SAVE_AS_CALLS: Record<'aan' | 'uit', string[]> = {
  // Met de flag aan leest de doelcontrole eerst het bestaande doel, dan de gewone atomaire opslag over het doel.
  aan: ['plugin:fs|open <map>/ander.ifc', 'plugin:fs|read ', 'plugin:fs|read ', 'plugin:fs|seek ', 'plugin:fs|read ',
    'plugin:fs|read ', 'plugin:resources|close ', 'plugin:fs|lstat <map>/ander.ifc',
    'plugin:fs|write_text_file <map>/save-<id>.ops-save.tmp', 'plugin:fs|rename '],
  uit: ['plugin:fs|lstat <map>/ander.ifc', 'plugin:fs|write_text_file <map>/save-<id>.ops-save.tmp', 'plugin:fs|rename '],
};
for (const flag of [true, false]) {
  await check(`Opslaan als over een bestaand bestand zonder gebouwmodel, flag ${flag ? 'aan' : 'uit'}: dezelfde aanroepen als main`, async () => {
    const dir = join(work, `geval-${++cases}`);
    mkdirSync(dir);
    const path = join(dir, 'model.ifc'), target = join(dir, 'ander.ifc');
    writeFileSync(path, plain); writeFileSync(target, changedPlain);
    const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
    store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; });
    await store.getState().openOpenedFile({ name: 'model.ifc', content: Buffer.from(plain).toString('utf8'), bytes: plain, ref: { kind: 'path', path } });
    assert.equal(!!store.getState().ifcSource?.foreign, false, 'geen vreemd deel');
    const task = store.getState().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
    store.getState().updateTask(task.id, { name: 'Gewoon Opslaan als' });
    store.setState(s => { s.ui.notifications = []; });
    const from = ipc.calls.length;
    await saveAsTo(store, target);
    const seen = ipc.calls.slice(from).map(call => `${call.command} ${(call.path ?? '').replace(dir, '<map>').replace(/save-[0-9a-z]+\./, 'save-<id>.')}`);
    assert.deepEqual(seen, MAIN_SAVE_AS_CALLS[flag ? 'aan' : 'uit'], JSON.stringify(seen));
    assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey), []);
    assert.deepEqual([store.getState().filePath, store.getState().isDirty], [target, false]);
    assert(readFileSync(target).toString('latin1').includes('Gewoon Opslaan als'), 'het bestaande bestand is vervangen, zoals op main');
  });
}

await check('Opslaan als zonder vreemd deel over een bestand dat in een ander tabblad open staat: zoals main, overschreven zonder melding', async () => {
  const dir = join(work, `geval-${++cases}`);
  mkdirSync(dir);
  const path = join(dir, 'model.ifc'), target = join(dir, 'ander.ifc');
  writeFileSync(path, plain); writeFileSync(target, changedPlain);
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const open = (p: string, data: Uint8Array) => store.getState().openOpenedFile({
    name: basename(p), content: Buffer.from(data).toString('utf8'), bytes: data, ref: { kind: 'path', path: p } });
  await open(path, plain);
  const firstId = store.getState().activeDocumentId;
  await open(target, changedPlain);
  store.getState().switchDocument(firstId);
  const task = store.getState().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
  store.getState().updateTask(task.id, { name: 'Over het open tabblad' });
  store.setState(s => { s.ui.notifications = []; });
  await saveAsTo(store, target);
  assert.deepEqual(store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey), []);
  assert(readFileSync(target).toString('latin1').includes('Over het open tabblad'), 'main vervangt het bestand van het andere tabblad');
  assert.deepEqual([store.getState().filePath, store.getState().isDirty], [target, false]);
});

await check('Opslaan als met een gebouwmodel en de flag uit (na het openen uitgezet): dezelfde weigering als main, niets aan de bestandsrand', async () => {
  const c = await opened();
  try {
    const target = otherFile(c);
    c.store.setState(s => { s.ui.featureFlags = {}; });
    clearNotices(c);
    const from = ipc.calls.length;
    await saveAsTo(c.store, target.path);
    assert.deepEqual(ipc.calls.slice(from).map(call => call.command), [], 'zoals main: niets aan de bestandsrand');
    assert.deepEqual(errorKeys(c), ['notifications.ifcForeignSaveBlocked']);
    assert.deepEqual(disk(c), { 'ander.ifc': hash(plain), 'model.ifc': hash(bytes) });
  } finally { await tidy(c); }
});

// Merge van #1019 in #1020: ook deze route toetst de identiteit van de documentinhoud (`DocumentContentRef`). Een extensie
// laadt met `api.data.loadProject` een ander project in hetzelfde tabblad: tijdens het rekenen in de opslagworker, in de
// eerste herstelronde binnen de vervanging (daarna komt `stopBeforeWrite` → `documentTargetCheck` →
// `refuseChangedDocumentWrite`), of net na de plaatsing op het doel (daarna komt de commit).
for (const moment of ['rekenen', 'herstelronde', 'plaatsing'] as const) {
  await check(`Opslaan als over een bestaande naam; een extensie laadt een ander project bij ${moment}: het nieuwe project krijgt niets van deze opslag`, async () => {
    const workers: InProcessWorker[] = [];
    const client = createIfcSaveWorker({ createWorker: () => { const w = new InProcessWorker('manual'); workers.push(w); return w; } });
    const c = await opened(bytes, client.compute);
    const loadOther = () => {
      const { data } = createExtensionApi('merge-1019', [], undefined, c.context, { app: c.context, showNotification() {} });
      data.loadProject({
        project: { ...data.getProject(), id: 'ander-project-uit-extensie', name: 'Ander project uit extensie' },
        calendar: data.getCalendar(), tasks: [], sequences: [], resources: [], assignments: [],
      });
    };
    const round = moment === 'herstelronde' ? firstPendingRound(c, loadOther) : null;
    try {
      const target = otherFile(c);
      if (moment === 'plaatsing') placeCalls({ 2: (_from, _to, real) => { const answer = real(); loadOther(); return answer; } });
      clearNotices(c);
      const before = c.store.getState(), from = ipc.calls.length;
      const saving = saveAsTo(c.store, target.path);
      for (let i = 0; i < 2000 && workers.flatMap(w => w.requests).length === 0; i++) await new Promise(r => setImmediate(r));
      const worker = workers.at(-1)!;
      assert.equal(worker.requests[0]?.job.kind, 'merge', 'de merge rekent in de opslagworker');
      if (moment === 'rekenen') loadOther();
      worker.start(); await worker.answer(0);
      await saving;
      const s = c.store.getState();
      assert.equal(s.activeDocumentId, c.id, 'hetzelfde tabblad');
      assert.notEqual(s.project.id, before.project.id, 'met het andere project');
      assert.notEqual(s.filePath, target.path, 'het nieuwe project krijgt het pad van het doel niet');
      assert.notEqual(s.foreignSourceMark?.filePath, target.path, 'en geen kenmerk op het doel');
      if (s.ifcSource) assert.notEqual(s.ifcSource.sha256, hash(new Uint8Array(readFileSync(target.path))), 'en niet de geschreven bytes als bron');
      assert.notEqual(saveStatusOf(s.documents.find(d => d.id === c.id)!.saveState, s.isDirty)?.kind, 'saved', 'geen "Opgeslagen"');
      assert.deepEqual(recordsOnDisk(), [], 'geen herstelrecord achtergebleven');
      if (moment === 'plaatsing') {
        // De planner bevestigde het vervangen in de bestandskiezer, en de plaatsing was al gebeurd: het doel heeft de
        // planning van het vorige project. Alleen de commit op het nieuwe project blijft weg.
        const output = new Uint8Array(readFileSync(target.path));
        assert.notEqual(hash(output), hash(plain), 'het doel is vervangen');
        assert.deepEqual(mergeProblems(bytes, output), [], 'door de opslag van het vorige project, met zijn gebouwmodel');
        assert.deepEqual(files(c), ['ander.ifc', 'model.ifc'], 'geen hulpbestand');
      } else {
        assert.deepEqual(disk(c), { 'ander.ifc': hash(plain), 'model.ifc': hash(bytes) }, 'het doel houdt zijn bytes, geen hulpbestand');
        assert.deepEqual(placesSince(from), [], 'niets verplaatst');
        assert.deepEqual(ipc.calls.slice(from).filter(call => call.wrote && call.path?.startsWith(c.dir)), [], 'nul schrijfacties in de map');
        assert.deepEqual(errorKeys(c), ['notifications.ifcSaveChangedWhileWaiting']);
      }
      if (round) assert(round.fired(), 'de laadactie gebeurde in de eerste herstelronde');
    } finally { round?.unregister(); client.dispose(); await tidy(c); }
  });
}

// ── #804 stap 6: knownbug 1896. Dezelfde inhoudscontrole (`refuseChangedDocumentWrite`) beslist op het laatste veilige
// punt van elke schrijfroute: vóór het opzijzetten van een bestaande naam, vóór de exclusieve plaatsing of aanmaak van
// een vrije naam, en vóór de hernoeming van de gewone atomaire opslag. De twee proeven met een gebouwmodel zijn die van
// de review van #1020 (ronde 2); daarna dezelfde voor een gewoon document via de opslagworker. ──────────────────────
function replaceThroughExtension(c: { context: Case['context']; store: Case['store']; id: string; state: Case['state'] }) {
  const { data } = createExtensionApi('review-r2', [], undefined, c.context, { app: c.context, showNotification() {} });
  data.loadProject({
    project: { ...data.getProject(), id: 'review-r2-ander-project', name: 'Ander project' },
    calendar: data.getCalendar(), tasks: [], sequences: [], resources: [], assignments: [],
  });
  assert.equal(c.store.getState().activeDocumentId, c.id);
  assert.notEqual(c.store.getState().project.id, c.state.project.id);
}
const autoWorker = () => createIfcSaveWorker({ createWorker: () => new InProcessWorker('auto') });
const inRecent = (store: Case['store'], path: string) =>
  store.getState().recentFiles.some(item => item.ref.kind === 'path' && item.ref.path === path);

await check('1896: ander project tijdens de tweede doellezing van Opslaan als over een bestaande naam: niets verplaatst, het doel houdt zijn bytes', async () => {
  const client = autoWorker();
  const c = await opened(bytes, client.compute);
  try {
    const target = otherFile(c);
    const originalHash = hash(readFileSync(target.path));
    assert.notEqual(c.prepared.sha256, originalHash);
    let hashAtReplacement: string | undefined, movesAtReplacement: number | undefined;
    const from = ipc.calls.length;
    ipc.faults.beforeOpen = p => {
      if (p !== target.path || !readdirSync(c.dir).some(f => isTempPath(join(c.dir, f)))) return;
      ipc.faults.beforeOpen = null;
      hashAtReplacement = hash(readFileSync(target.path));
      movesAtReplacement = placesSince(from).length;
      replaceThroughExtension(c);
    };
    clearNotices(c);
    await saveAsTo(c.store, target.path);
    assert.equal(hashAtReplacement, originalHash, 'het doel was ongewijzigd bij de projectwissel');
    assert.equal(movesAtReplacement, 0, 'het doel stond nog op zijn plaats');
    assert.equal(hash(readFileSync(target.path)), originalHash, 'de oude planning vervangt het doel niet meer');
    assert.deepEqual(placesSince(from), [], 'niets opzijgezet of geplaatst');
    assert.deepEqual(disk(c), { 'ander.ifc': originalHash, 'model.ifc': hash(bytes) }, 'het tijdelijke bestand is weg');
    assert.deepEqual(recordsOnDisk(), [], 'het herstelrecord is weg');
    assert.deepEqual(errorKeys(c), ['notifications.ifcSaveChangedWhileWaiting'], 'de bestaande melding');
    assert.equal(inRecent(c.store, target.path), false, 'niets in Recent');
    assert.notEqual(c.store.getState().filePath, target.path);
  } finally { ipc.faults.beforeOpen = null; client.dispose(); await tidy(c); }
});

await check('1896: ander project terwijl Opslaan als naar een vrije naam het hulpbestand schreef: de naam ontstaat niet', async () => {
  const client = autoWorker();
  const c = await opened(bytes, client.compute);
  const invoke = internal.invoke;
  try {
    const target = join(c.dir, 'vrije-naam.ifc');
    const from = ipc.calls.length;
    let atReplacement: { targetExists: boolean; tempHash: string } | undefined;
    internal.invoke = async (command, ...args) => {
      const result = await invoke(command, ...args);
      if (command !== 'plugin:fs|write_file' || atReplacement) return result;
      const temp = readdirSync(c.dir).find(f => isTempPath(join(c.dir, f)));
      if (!temp) return result;
      atReplacement = { targetExists: existsSync(target), tempHash: hash(readFileSync(join(c.dir, temp))) };
      replaceThroughExtension(c);
      return result;
    };
    clearNotices(c);
    await saveAsTo(c.store, target);
    assert.deepEqual(atReplacement, { targetExists: false, tempHash: c.prepared.sha256 });
    assert.equal(existsSync(target), false, 'de oude planning verschijnt niet onder de vrije naam');
    assert.deepEqual(placesSince(from), [], 'geen plaatsing');
    assert.deepEqual(files(c), ['model.ifc'], 'het tijdelijke bestand is weg');
    assert.deepEqual(errorKeys(c), ['notifications.ifcSaveChangedWhileWaiting']);
    assert.equal(inRecent(c.store, target), false, 'niets in Recent');
  } finally { internal.invoke = invoke; client.dispose(); await tidy(c); }
});

/** Een gewone planning (geen vreemd deel) op een eigen pad, één bewerking, met de opslagworker zoals in de app. */
async function openedPlain(flag: boolean, ifcSaveCompute: IfcOutputCompute) {
  const dir = join(work, `geval-${++cases}`);
  mkdirSync(dir);
  const path = join(dir, 'model.ifc');
  writeFileSync(path, plain);
  const { createAppStoreContext } = await loadStore();
  const context = createAppStoreContext({ ifcSaveCompute }), { store } = context;
  store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; });
  await store.getState().openOpenedFile({ name: 'model.ifc', content: Buffer.from(plain).toString('utf8'), bytes: plain, ref: { kind: 'path', path } });
  assert.equal(!!store.getState().ifcSource?.foreign, false, 'geen vreemd deel');
  const task = store.getState().tasks.find(t => !t.childIds.length && !t.isMilestone)!;
  store.getState().updateTask(task.id, { name: 'Gewone planning van project A' });
  store.setState(s => { s.ui.notifications = []; });
  return { dir, path, context, store, state: store.getState(), id: store.getState().activeDocumentId };
}
type PlainCase = Awaited<ReturnType<typeof openedPlain>>;
const plainFiles = (p: PlainCase) => readdirSync(p.dir).sort();
const plainErrors = (p: PlainCase) => p.store.getState().ui.notifications.filter(n => n.severity === 'error').map(n => n.messageKey);

for (const route of ['Ctrl+S op het eigen pad', 'Opslaan als over een bestaande naam', 'Opslaan als naar een vrije naam'] as const) {
  for (const flag of [false, true]) {
    await check(`1896, gewoon document (flag ${flag ? 'aan' : 'uit'}), ${route}: ander project terwijl het tijdelijke bestand klaar is: het doel blijft zoals het was`, async () => {
      const client = autoWorker();
      const p = await openedPlain(flag, client.compute);
      const invoke = internal.invoke;
      try {
        const target = route === 'Ctrl+S op het eigen pad' ? p.path : join(p.dir, route === 'Opslaan als naar een vrije naam' ? 'vrij.ifc' : 'bestaand.ifc');
        if (route === 'Opslaan als over een bestaande naam') writeFileSync(target, changedPlain);
        const before = existsSync(target) ? hash(readFileSync(target)) : null;
        let loaded = false;
        internal.invoke = async (command, ...args) => {
          const result = await invoke(command, ...args);
          if (loaded || !(command === 'plugin:fs|write_file' || command === 'plugin:fs|write_text_file')) return result;
          if (!readdirSync(p.dir).some(f => isTempPath(join(p.dir, f)))) return result;
          loaded = true;
          replaceThroughExtension(p);
          return result;
        };
        const from = ipc.calls.length, recentBefore = p.store.getState().recentFiles.map(item => item.id);
        if (route === 'Ctrl+S op het eigen pad') await p.store.getState().saveFile();
        else await saveAsTo(p.store, target);
        assert.equal(loaded, true, 'het andere project kwam toen het tijdelijke bestand er stond');
        assert.equal(existsSync(target) ? hash(readFileSync(target)) : null, before, 'het doel is niet gewijzigd');
        assert.deepEqual(ipc.calls.slice(from).filter(call => call.command === 'plugin:fs|rename'), [], 'geen hernoeming');
        assert.equal(plainFiles(p).some(f => isTempPath(join(p.dir, f))), false, 'het tijdelijke bestand is weg');
        assert.deepEqual(plainErrors(p), ['notifications.ifcSaveChangedWhileWaiting'], 'de bestaande melding');
        assert.deepEqual(p.store.getState().recentFiles.map(item => item.id), recentBefore, 'niets nieuws in Recent');
        if (route !== 'Ctrl+S op het eigen pad') assert.notEqual(p.store.getState().filePath, target, 'het nieuwe project krijgt het doel niet');
        assert.equal(p.store.getState().isDirty, true, 'het nieuwe project is niet als opgeslagen vastgelegd');
      } finally { internal.invoke = invoke; client.dispose(); }
    });
  }
}

// ── #804 stap 6: knownbug 1902. Buiten het bereik van plugin-fs (buiten de thuismap) weigert plugin-fs zowel de aanmaak
// van een hulpbestand als `lstat` erop (`forbiddenMeta`): één scope voor elke aanroep. ───────────────────────────────
const outsideHome = (c: { dir: string }) => {
  ipc.faults.forbidden = path => path.startsWith(`${c.dir}/`) && (isTempPath(path) || path.includes('.ops-vorige-'));
  ipc.faults.forbiddenMeta = true;
};

for (const route of ['Opslaan als over een bestaande naam', 'Ctrl+S op het eigen pad'] as const) {
  await check(`1902, ${route} buiten de thuismap: alleen Opslaan als, niets geschreven, het herstelrecord meteen weg; de volgende start meldt niets`, async () => {
    const c = await opened();
    try {
      const target = route === 'Ctrl+S op het eigen pad' ? null : otherFile(c);
      outsideHome(c);
      clearNotices(c);
      const from = ipc.calls.length;
      if (target) await saveAsTo(c.store, target.path);
      else await c.store.getState().saveFile();
      assert.deepEqual(errorKeys(c), [target ? 'notifications.ifcForeignNewTargetOnly' : 'notifications.ifcForeignReplaceSaveAsOnly'],
        'de melding van alleen Opslaan als');
      assert.deepEqual(disk(c), target ? { 'ander.ifc': hash(plain), 'model.ifc': hash(bytes) } : { 'model.ifc': hash(bytes) }, 'niets geschreven');
      assert.deepEqual(ipc.calls.slice(from).filter(call => call.wrote && call.path?.startsWith(c.dir)), [], 'nul schrijfacties in de map');
      assert.deepEqual(recordsOnDisk(), [], 'het herstelrecord is meteen weg');
      assert.deepEqual(await nextRound(), [], 'de volgende start meldt geen achtergebleven bestanden');
    } finally { await tidy(c); }
  });
}

await check('1902: een record van vóór de fix met hulpnamen buiten het bereik verdwijnt bij de eerstvolgende start, zonder melding', async () => {
  const c = await opened();
  try {
    const record: ReplaceRecord = { id: 'vandevorigeversie1', path: c.path, vorigeSha256: hash(bytes), pendingSha256: c.prepared.sha256 };
    writeFileSync(join(appData, replaceRecordName(record.id)), serializeReplaceRecord(record));
    outsideHome(c);
    assert.deepEqual(await nextRound(), [], 'geen melding over bestanden die de app niet mag lezen');
    assert.deepEqual(recordsOnDisk(), [], 'het record is weg');
    assert.deepEqual(await nextRound(), [], 'en komt niet terug');
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) }, 'het doel is niet aangeraakt');
  } finally { await tidy(c); }
});

await check('1902: binnen het bereik blijft een echt achtergebleven hulpbestand gemeld, met zijn record', async () => {
  const c = await opened();
  try {
    const record: ReplaceRecord = { id: 'echtachtergebleven1', path: c.path, vorigeSha256: hash(bytes), pendingSha256: c.prepared.sha256 };
    writeFileSync(join(appData, replaceRecordName(record.id)), serializeReplaceRecord(record));
    writeFileSync(userFileTempPath(c.path, record.id), new Uint8Array([1, 2, 3]));
    ipc.faults.forbiddenMeta = true; // de scope toetst ook lstat, maar dit pad valt erbinnen
    assert.deepEqual((await nextRound()).map(n => n.messageKey), ['notifications.ifcForeignReplaceLeftOver']);
    assert.equal(recordsOnDisk().length, 1, 'het record blijft');
  } finally { rmSync(userFileTempPath(c.path, 'echtachtergebleven1'), { force: true }); await tidy(c); }
});

ipc.dispose();
rmSync(work, { recursive: true, force: true });
console.log(`Eigen bestand vervangen: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
