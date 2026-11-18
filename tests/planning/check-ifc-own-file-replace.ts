// #804, knownbug 1131 stap 5: het eigen bestand met een gebouwmodel op de desktop vervangen (ontwerp §4.10,
// stappen 0 tot en met 6) en het afhandelen van restbestanden na een crash of fout (deel a), en Ctrl+S en *Opslaan* in
// de sluitvraag op die vervanging, vanaf de productie-ingang (deel b, onderaan). Op echte bestanden in een tijdelijke
// map, met de echte plugin-fs-client en het nagebootste `place_file_exclusive` (`nodeFileIpc.ts`); het herstelmanifest
// en het herstelrecord van de vervanging staan als echte bestanden in een eigen app-datamap. Elke proef na een crash of
// fout leest het record en het manifest opnieuw van schijf, ook na een volgende ronde; niets komt uit een eerder
// ingelezen toestand. Bewijst niet dat de stap van het commando werkelijk exclusief en atomair is (dat doet
// `cargo test place_file`), en niets van een echte desktopapp.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
async function opened(content: Uint8Array = bytes) {
  const dir = join(work, `geval-${++cases}`);
  mkdirSync(dir);
  const path = join(dir, 'model.ifc');
  writeFileSync(path, content);
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
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
  return { dir, path, store, state, id, prepared, unregister };
}
type Case = Awaited<ReturnType<typeof opened>>;

async function replace(c: Case, fs?: OwnFileReplaceFs, records?: ReplaceRecordStore): Promise<{ result: OwnPathReplaceResult; committed: boolean }> {
  let committed = false;
  const result = await runProjectFileWrite(() => replaceOwnPathWithRecovery({
    documentId: c.id, path: c.path, prepared: c.prepared,
    source: { bytes: c.state.ifcSource!.bytes, sha256: c.state.ifcSource!.sha256 },
    commit: () => { committed = c.store.getState().commitSavedDocument(c.id, c.state, undefined, c.prepared); },
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
function oneRecord(c: Case): ReplaceRecord {
  const records = recordsOnDisk();
  assert.equal(records.length, 1, `één herstelrecord op schijf (${records.length})`);
  const [record] = records;
  assert.deepEqual(record, { id: record.id, path: c.path, vorigeSha256: hash(bytes), pendingSha256: c.prepared.sha256 });
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
  ipc.faults.place = null; ipc.faults.writeErrorAfter = null; ipc.faults.forbidden = null; ipc.faults.beforeOpen = null;
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
async function crashAt(c: Case, where: (base: OwnFileReplaceFs, crash: () => Promise<never>) => Partial<OwnFileReplaceFs>) {
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
  await replace(c, fs, records).catch(error => { if (!(error instanceof Crash)) throw error; });
  assert(diskAtCrash, 'de crash vond plaats');
  assert.deepEqual(disk(c), diskAtCrash, 'na de crash veranderde er niets meer in de map');
  return oneRecord(c);
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
    closeDocument: async id => { await c.store.getState().closeDocumentAfterSaves(id); closed = true; },
    saveFile: () => c.store.getState().saveFileForDocument(c.id),
    clearPending: () => {}, restoreOpenerFocus: () => {}, onSavePendingChange: () => {},
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

// Met de flag uit, en voor een document zonder gebouwmodel, loopt Ctrl+S zoals op main. De reeks aanroepen aan de
// bestandsrand is vastgelegd op main (`cef70233b`), met dezelfde proef. Met de flag uit opent de app geen bestand met
// een gebouwmodel; zo'n document bestaat dan alleen als de flag na het openen uitging.
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
  });
}

ipc.dispose();
rmSync(work, { recursive: true, force: true });
console.log(`Eigen bestand vervangen: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
