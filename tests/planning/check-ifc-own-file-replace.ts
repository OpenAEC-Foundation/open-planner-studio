// #804, knownbug 1131 stap 5 (deel a): het eigen bestand met een gebouwmodel op de desktop vervangen (ontwerp §4.10,
// stappen 0 tot en met 6) en de restbestanden na een crash. Op echte bestanden in een tijdelijke map, met de echte
// plugin-fs-client en het nagebootste `place_file_exclusive` (`nodeFileIpc.ts`); het herstelmanifest staat via de
// desktoptak van `recoveryStore` als echt bestand in een eigen app-datamap. Bewijst niet dat de stap van het commando
// werkelijk exclusief en atomair is (dat doet `cargo test place_file`), en niets van een echte desktopapp.
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
import { previousVersionPath, tauriOwnFileReplaceFs, type OwnFileReplaceFs } from '@/services/fileAccess/ownFileReplace';
import { userFileTempPath } from '@/services/fileAccess/atomicWrite';
import {
  ownPathReplaceNotices, replaceOwnPathWithRecovery, settleRecoveredReplaces, type OwnPathReplaceResult,
} from '@/state/ownFileReplace';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { clearRecovery, loadRecovery, type LoadedRecovery } from '@/services/recovery/recoveryStore';
import { checkRecoveryManifestVersion, RecoveryManifestError } from '@/services/recovery/recoveryManifest';
import { ifcSourceMetaFields } from '@/services/recovery/recoveryIfcSource';
import { flushRecoveryNow, registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';

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

async function replace(c: Case, fs?: OwnFileReplaceFs): Promise<{ result: OwnPathReplaceResult; committed: boolean }> {
  let committed = false;
  const result = await runProjectFileWrite(() => replaceOwnPathWithRecovery({
    documentId: c.id, path: c.path, prepared: c.prepared,
    source: { bytes: c.state.ifcSource!.bytes, sha256: c.state.ifcSource!.sha256 },
    commit: () => { committed = c.store.getState().commitSavedDocument(c.id, c.state, undefined, c.prepared); },
    now: NOW, ...(fs ? { fs } : {}),
  }));
  return { result, committed };
}
const files = (c: Case) => readdirSync(c.dir).sort();
const fileHash = (c: Case, name: string) => hash(new Uint8Array(readFileSync(join(c.dir, name))));
/** Elke naam in de map met de inhoud ervan, als sha256. */
const disk = (c: Case) => Object.fromEntries(files(c).map(name => [name, fileHash(c, name)]));
const manifestOnDisk = () => {
  const name = readdirSync(appData).find(n => /^recovery(\..+)?\.documents\.json$/.test(n));
  return name ? JSON.parse(readFileSync(join(appData, name), 'utf8')) as { version: number; documents: { id: string; ifcSource?: Record<string, unknown> }[] } : null;
};
const manifestDoc = async (id: string) => (await loadRecovery()).docs.find(d => d.id === id);
/** De `place_file_exclusive`-aanroepen tellen; `answers[n]` vervangt de n-de (vanaf 1) uitkomst. */
function placeCalls(answers: Record<number, (from: string, to: string, real: () => PlaceAnswer) => PlaceAnswer | undefined>) {
  let n = 0;
  ipc.faults.place = (from, to, real) => answers[++n]?.(from, to, real);
  return () => n;
}
/** Een ander programma doet iets vlak vóór (of na) de n-de plaatsing van de vervanging; los van het nagebootste
 *  commando, zodat het ook gebeurt als de plaatsing iets anders is (mutatie a). */
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
};
const noticeKeys = (result: OwnPathReplaceResult, path: string) => ownPathReplaceNotices(result, path).map(n => n.messageKey);
const tempOf = (c: Case, id: string) => userFileTempPath(c.path, id);
const helperId = (c: Case) => {
  const name = files(c).find(n => /^save-[0-9a-z]+\.ops-save\.tmp$/.test(n)) ?? files(c).find(n => n.includes('.ops-vorige-'))!;
  return name.startsWith('save-') ? name.slice(5, -'.ops-save.tmp'.length) : name.slice(name.indexOf('.ops-vorige-') + 12);
};

// ── De goede weg ─────────────────────────────────────────────────────────────────────────────────────────────────

await check('goede weg: stap 0 legt pendingReplace vast (manifest 6), het doel krijgt de nieuwe versie, niets blijft achter', async () => {
  const c = await opened(), base = await tauriOwnFileReplaceFs();
  try {
    let atStep1: { manifest: ReturnType<typeof manifestOnDisk>; temp: string } | undefined;
    const { result, committed } = await replace(c, { ...base, createNew: async (p, d, m) => {
      atStep1 = { manifest: manifestOnDisk(), temp: p };
      return base.createNew(p, d, m);
    } });
    assert.deepEqual(result, { code: 'replaced', otherVersion: null, leftOver: null });
    assert.equal(committed, true, 'de geschreven versie werd de bron');
    const doc = atStep1!.manifest!.documents.find(d => d.id === c.id)!;
    assert.equal(atStep1!.manifest!.version, 6, 'met een lopende vervanging is het manifest versie 6');
    const replaceRecord = doc.ifcSource!.pendingReplace as { id: string; vorigeSha256: string; pendingSha256: string };
    assert.deepEqual(replaceRecord, { id: replaceRecord.id, vorigeSha256: hash(bytes), pendingSha256: c.prepared.sha256 });
    assert.equal(doc.ifcSource!.pendingSha256, c.prepared.sha256);
    assert.equal(atStep1!.temp, tempOf(c, replaceRecord.id), 'stap 1 schrijft naar save-<id>.ops-save.tmp met het id uit het manifest');
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256 }, 'het doel heeft de nieuwe versie, geen restbestand');
    const after = await manifestDoc(c.id);
    assert.equal(after?.ifcSource?.pendingReplace, undefined, 'stap 6 wist pendingReplace');
    assert.equal(after?.ifcSource?.pendingSha256, undefined);
    assert.equal(after?.ifcSource?.sha256, c.prepared.sha256, 'het manifest noemt de nieuwe bron');
    assert.equal(manifestOnDisk()!.version, 5, 'zonder lopende vervanging weer versie 5');
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
  } finally { await tidy(c); }
});

// ── Fouten ───────────────────────────────────────────────────────────────────────────────────────────────────────

await check('stap 0: zonder herstelronde wordt er niets geschreven (not-recorded)', async () => {
  const c = await opened();
  try {
    c.unregister();
    const writes = ipc.calls.length;
    const { result, committed } = await replace(c);
    assert.deepEqual(result, { code: 'not-recorded' });
    assert.equal(committed, false);
    assert.equal(ipc.calls.slice(writes).some(call => call.command === 'plugin:fs|write_file' || call.command === 'place_file_exclusive'), false);
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
    assert.deepEqual(noticeKeys(result, c.path), ['notifications.ifcForeignReplaceNotRecorded']);
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
      assert.deepEqual(noticeKeys(result, c.path), ['notifications.ifcForeignReplaceSaveAsOnly']);
    } finally { await tidy(c); }
  });
}

await check('stap 1: schrijffout ná de aanmaak ruimt het eigen tijdelijke bestand op; het doel blijft', async () => {
  const c = await opened();
  try {
    // Alleen het eigen tijdelijke bestand: de manifestschrijf van het herstel opent ook, en schrijft dan gewoon.
    ipc.faults.beforeOpen = p => { ipc.faults.writeErrorAfter = p.endsWith('.ops-save.tmp') ? 100 : null; };
    const { result, committed } = await replace(c);
    assert.equal(result.code, 'failed'); assert.equal(committed, false);
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
    assert.equal((await manifestDoc(c.id))?.ifcSource?.pendingReplace, undefined, 'pendingReplace gewist');
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
  } finally { await tidy(c); }
});

for (const [what, arrange, content, notice] of [
  ['gewijzigd', (c: Case) => writeFileSync(c.path, otherProgram), 'changed', 'notifications.ifcForeignTargetChanged'],
  ['weg', (c: Case) => rmSync(c.path), 'missing', 'notifications.ifcForeignTargetGone'],
] as const) {
  await check(`stap 2: doel ${what} vóór de vervanging: niets vervangen, het eigen tijdelijke bestand weg`, async () => {
    const c = await opened();
    try {
      arrange(c);
      const { result } = await replace(c);
      assert.deepEqual(result, { code: 'target-changed', content });
      assert.deepEqual(disk(c), what === 'weg' ? {} : { 'model.ifc': hash(otherProgram) });
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
  await check(`stap 3 ${label}: niets verplaatst, het doel blijft, het eigen tijdelijke bestand weg`, async () => {
    const c = await opened();
    try {
      placeCalls({ 1: () => answer });
      const { result } = await replace(c);
      assert.equal(result.code, code);
      assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
      assert.deepEqual(noticeKeys(result, c.path), [notice]);
    } finally { await tidy(c); }
  });
}

await check('stap 3 source-changed: onbekende stand, niets teruggezet en niets opgeruimd', async () => {
  const c = await opened();
  try {
    placeCalls({ 1: () => reject('source-changed') });
    const { result } = await replace(c);
    assert.deepEqual(result, { code: 'unknown' });
    const id = helperId(c);
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes), [`save-${id}.ops-save.tmp`]: c.prepared.sha256 }, 'het tijdelijke bestand blijft staan');
    assert.deepEqual(noticeKeys(result, c.path), ['notifications.ifcForeignPlaceUnknown']);
  } finally { await tidy(c); }
});

await check('stap 4 target-exists (een ander programma zette na stap 3 een bestand op het doel): alle drie blijven staan', async () => {
  const c = await opened();
  try {
    const { result, committed } = await replace(c, await aroundPlace(2, 'before', () => writeFileSync(c.path, otherNew)));
    assert.equal(result.code, 'target-taken'); assert.equal(committed, false);
    const id = helperId(c);
    assert.deepEqual(disk(c), {
      'model.ifc': hash(otherNew), [`model.ifc.ops-vorige-${id}`]: hash(bytes), [`save-${id}.ops-save.tmp`]: c.prepared.sha256,
    }, 'de versie van de ander, de vorige versie en de eigen uitvoer staan er alle drie');
    const [notice] = ownPathReplaceNotices(result, c.path);
    assert.equal(notice.messageKey, 'notifications.ifcForeignReplaceTargetTaken');
    assert.deepEqual(notice.params, { target: c.path, temp: tempOf(c, id), previous: previousVersionPath(c.path, id) }, 'de melding noemt de drie paden');
  } finally { await tidy(c); }
});

await check('stap 4 source-changed: onbekende stand, niets teruggezet en niets opgeruimd', async () => {
  const c = await opened();
  try {
    placeCalls({ 2: () => reject('source-changed') });
    const { result } = await replace(c);
    assert.deepEqual(result, { code: 'unknown' });
    const id = helperId(c);
    assert.deepEqual(disk(c), { [`model.ifc.ops-vorige-${id}`]: hash(bytes), [`save-${id}.ops-save.tmp`]: c.prepared.sha256 });
  } finally { await tidy(c); }
});

for (const answer of [reject('unsupported', { message: 'EINVAL' }), reject('refused', { reason: 'scope' }), reject('io', { message: 'EIO' })]) {
  await check(`stap 4 ${answer.reject.code}: de vorige versie gaat exclusief terug op het doel`, async () => {
    const c = await opened();
    try {
      const count = placeCalls({ 2: () => answer });
      const { result } = await replace(c);
      assert.equal(result.code, 'failed');
      assert.equal(count(), 3, 'een derde plaatsing zette de vorige versie terug');
      assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
      assert.deepEqual(noticeKeys(result, c.path), ['notifications.ifcForeignReplaceFailed']);
    } finally { await tidy(c); }
  });
}

await check('stap 4 faalt en terugzetten ook: de melding zegt waar de vorige versie staat', async () => {
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
  } finally { await tidy(c); }
});

// ── Een ander programma schrijft tijdens de vervanging ───────────────────────────────────────────────────────────

await check('het doel verandert tussen stap 2 en 3: de versie van de ander blijft als "versie van ander programma"', async () => {
  const c = await opened();
  try {
    const { result } = await replace(c, await aroundPlace(1, 'before', () => writeFileSync(c.path, otherProgram)));
    assert.deepEqual(result, { code: 'replaced', otherVersion: join(c.dir, OTHER_COPY), leftOver: null });
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256, [OTHER_COPY]: hash(otherProgram) });
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
 * Breekt de vervanging af op `where`, met het manifest zoals het op dat moment op schijf stond. Na de "crash" mag de
 * vervanging de map niet meer veranderen (ze vangt de fout als een gewone fout op, of geeft haar door): zo is de map
 * daarna precies de stand van de crash.
 */
async function crashAt(c: Case, where: (base: OwnFileReplaceFs, crash: () => Promise<never>) => Partial<OwnFileReplaceFs>) {
  const base = await tauriOwnFileReplaceFs();
  let atCrash: LoadedRecovery | undefined, diskAtCrash: Record<string, string> | undefined;
  const crash = async (): Promise<never> => { atCrash = await loadRecovery(); diskAtCrash = disk(c); throw new Crash('crash'); };
  await replace(c, { ...base, ...where(base, crash) }).catch(error => { if (!(error instanceof Crash)) throw error; });
  assert(atCrash, 'de crash vond plaats');
  assert.deepEqual(disk(c), diskAtCrash, 'na de crash veranderde er niets meer in de map');
  return atCrash;
}
/** Herstel zoals bij de start: eerst de restbestanden, dan het document met zijn bron. */
async function recover(c: Case, atCrash: LoadedRecovery) {
  const doc = atCrash.docs.find(d => d.id === c.id)!;
  assert(doc.ifcSource?.pendingReplace, 'het manifest van de crash noemt de lopende vervanging');
  const notices = await settleRecoveredReplaces(atCrash.docs, { now: NOW });
  const restored = await readRecoveryDocument(doc, atCrash.archives, true);
  return { notices, restored };
}
/** Na herstel: een volledige versie op het doel, en die is de herstelde bron. */
function fullVersionOnTarget(c: Case, restored: Awaited<ReturnType<typeof recover>>['restored'], expected: string) {
  assert.equal(fileHash(c, 'model.ifc'), expected, 'het doel heeft een volledige versie');
  assert.equal(restored.ifcSource?.sha256, expected, 'herstel neemt die versie als bron');
  assert.equal(restored.filePath, c.path, 'en geeft het doel terug');
}
const sourceNow = (c: Case) => c.state.ifcSource!.sha256;

await check('crash na stap 0: herstel vindt de oude versie; er is niets op te ruimen', async () => {
  const c = await opened();
  try {
    const atCrash = await crashAt(c, (_b, crash) => ({ createNew: crash }));
    const { notices, restored } = await recover(c, atCrash);
    fullVersionOnTarget(c, restored, sourceNow(c));
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) }); assert.deepEqual(notices, []);
  } finally { await tidy(c); }
});

await check('crash halverwege stap 1: het onvolledige tijdelijke bestand gaat weg, de oude versie blijft', async () => {
  const c = await opened();
  try {
    const atCrash = await crashAt(c, (base, crash) => ({
      createNew: async (p, d, m) => { await base.createNew(p, d.subarray(0, d.length >> 1), m); return crash(); },
    }));
    const { notices, restored } = await recover(c, atCrash);
    fullVersionOnTarget(c, restored, sourceNow(c));
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) }); assert.deepEqual(notices, []);
  } finally { await tidy(c); }
});

for (const [step, where] of [
  ['1', (_b: OwnFileReplaceFs, crash: () => Promise<never>) => ({ content: crash })],
  ['2', (_b: OwnFileReplaceFs, crash: () => Promise<never>) => ({ place: crash })],
] as const) {
  await check(`crash na stap ${step}: de volledige nieuwe planning wordt "niet opgeslagen planning", de oude versie blijft`, async () => {
    const c = await opened();
    try {
      const atCrash = await crashAt(c, where);
      const { notices, restored } = await recover(c, atCrash);
      fullVersionOnTarget(c, restored, sourceNow(c));
      assert.deepEqual(disk(c), { 'model.ifc': hash(bytes), [UNSAVED_COPY]: c.prepared.sha256 });
      assert.deepEqual(notices.map(n => [n.messageKey, n.params]), [
        ['notifications.ifcForeignReplaceUnsavedCopy', { file: c.path, copy: join(c.dir, UNSAVED_COPY) }],
      ]);
    } finally { await tidy(c); }
  });
}

await check('crash na stap 3 (doel weg): de vorige versie gaat terug, de nieuwe planning wordt een kopie; bestanden met een ander id blijven', async () => {
  const c = await opened();
  try {
    let calls = 0;
    const atCrash = await crashAt(c, (base, crash) => ({ place: async (f, t) => (++calls === 2 ? crash() : base.place(f, t)) }));
    const id = helperId(c);
    assert.deepEqual(disk(c), { [`model.ifc.ops-vorige-${id}`]: hash(bytes), [`save-${id}.ops-save.tmp`]: c.prepared.sha256 });
    // Restbestanden van een andere vervanging (een ander id): herstel raakt ze niet aan.
    writeFileSync(join(c.dir, 'save-anderid1.ops-save.tmp'), otherNew);
    writeFileSync(join(c.dir, 'model.ifc.ops-vorige-anderid1'), otherProgram);
    const { notices, restored } = await recover(c, atCrash);
    fullVersionOnTarget(c, restored, sourceNow(c));
    assert.deepEqual(disk(c), {
      'model.ifc': hash(bytes), [UNSAVED_COPY]: c.prepared.sha256,
      'model.ifc.ops-vorige-anderid1': hash(otherProgram), 'save-anderid1.ops-save.tmp': hash(otherNew),
    });
    assert.deepEqual(notices.map(n => n.messageKey), ['notifications.ifcForeignReplaceUnsavedCopy']);
  } finally { await tidy(c); }
});

await check('crash na stap 4: de gecontroleerde vorige versie gaat weg, herstel neemt de nieuwe versie', async () => {
  const c = await opened();
  try {
    let calls = 0;
    const atCrash = await crashAt(c, (base, crash) => ({ content: async (p, e) => (++calls === 2 ? crash() : base.content(p, e)) }));
    const { notices, restored } = await recover(c, atCrash);
    fullVersionOnTarget(c, restored, c.prepared.sha256);
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256 }); assert.deepEqual(notices, []);
  } finally { await tidy(c); }
});

await check('crash na stap 4 met een gewijzigde vorige versie: die blijft als "versie van ander programma"', async () => {
  const c = await opened();
  try {
    let calls = 0;
    const atCrash = await crashAt(c, (base, crash) => ({ content: async (p, e) => {
      if (++calls < 2) return base.content(p, e);
      writeFileSync(p, otherProgram);
      return crash();
    } }));
    const { notices, restored } = await recover(c, atCrash);
    fullVersionOnTarget(c, restored, c.prepared.sha256);
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256, [OTHER_COPY]: hash(otherProgram) });
    assert.deepEqual(notices.map(n => n.messageKey), ['notifications.ifcForeignReplaceOtherVersion']);
  } finally { await tidy(c); }
});

await check('crash na stap 5: alleen de nieuwe versie, herstel neemt haar via pendingSha256', async () => {
  const c = await opened();
  try {
    const atCrash = await crashAt(c, (base, crash) => ({ remove: async p => {
      await base.remove(p);
      if (p.includes('.ops-vorige-')) await crash();
    } }));
    const { notices, restored } = await recover(c, atCrash);
    fullVersionOnTarget(c, restored, c.prepared.sha256);
    assert.deepEqual(disk(c), { 'model.ifc': c.prepared.sha256 }); assert.deepEqual(notices, []);
  } finally { await tidy(c); }
});

await check('openen: wat bij herstel niet thuiskwam, ruimt het openen van het bestand op', async () => {
  const c = await opened();
  try {
    const atCrash = await crashAt(c, (_b, crash) => ({ content: crash }));
    const broken = { read: async () => { throw new Error('niet te lezen'); }, remove: async () => {}, place: async () => ({ code: 'io' as const, message: 'x' }) };
    const atRecovery = await settleRecoveredReplaces(atCrash.docs, { fs: broken, now: NOW });
    assert(atRecovery.length > 0 && atRecovery.every(n => n.messageKey === 'notifications.ifcForeignReplaceLeftOver'), 'niets thuisgebracht, wel gemeld');
    const id = helperId(c);
    assert(existsSync(tempOf(c, id)), 'nog niet opgeruimd');
    const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
    store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
    await store.getState().openOpenedFile({ name: 'model.ifc', content: '', bytes, ref: { kind: 'path', path: c.path } });
    assert.equal(existsSync(tempOf(c, id)), false, 'bij het openen opgeruimd');
    assert(files(c).some(n => n.includes('(niet opgeslagen planning ')), 'de nieuwe planning staat als kopie');
    assert(store.getState().ui.notifications.some(n => n.messageKey === 'notifications.ifcForeignReplaceUnsavedCopy'));
  } finally { await tidy(c); }
});

// ── Het manifest en de oudere lezer ──────────────────────────────────────────────────────────────────────────────

await check('manifest: versie 6 is leesbaar, 7 niet; een ongeldige pendingReplace valt weg zonder de bron', async () => {
  checkRecoveryManifestVersion(6);
  assert.throws(() => checkRecoveryManifestVersion(7), RecoveryManifestError);
  const fingerprint = { sha256: 'a'.repeat(64), byteLength: 10, foreign: true };
  assert.deepEqual(ifcSourceMetaFields({ ifcSource: { ...fingerprint, pendingReplace: { id: 'X/..', vorigeSha256: 'a'.repeat(64), pendingSha256: 'b'.repeat(64) } } }),
    { ifcSource: fingerprint });
  const ok = { id: 'abc123', vorigeSha256: 'a'.repeat(64), pendingSha256: 'b'.repeat(64) };
  assert.deepEqual(ifcSourceMetaFields({ ifcSource: { ...fingerprint, pendingReplace: ok } }), { ifcSource: { ...fingerprint, pendingReplace: ok } });
});

await check('Ctrl+S op het eigen pad weigert in deze stap nog zoals voorheen', async () => {
  const c = await opened();
  try {
    assert.equal(await c.store.getState().saveFileForDocument(c.id), false);
    assert(c.store.getState().ui.notifications.some(n => n.messageKey === 'notifications.ifcForeignReplaceBlocked'));
    assert.deepEqual(disk(c), { 'model.ifc': hash(bytes) });
  } finally { await tidy(c); }
});

ipc.dispose();
rmSync(work, { recursive: true, force: true });
console.log(`Eigen bestand vervangen: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
