// De proef achter `check-ifc-foreign-grens.ts`: draait alleen in een bundel waarin die check de productiegrens
// `IFC_FOREIGN_SCAN_MAX_BYTES` verlaagt tot `GRENS` (64 KiB). Zo lopen de echte routes (crashherstel, Bestand → Openen,
// Ctrl+S, de doelscan als stroom) over de grens zonder een bestand van 150 MiB. Fixronde 2 van #1127. Exit 0 = groen.
//
// `node grens.mjs web`: browser (nagebootste IndexedDB), delen 1 tot 4. `node grens.mjs desktop <map>`: nagebootste
// Tauri-IPC op die map, deel 1 voor een bron op schijf. De desktopvorm draait apart, omdat `isTauri()` dan overal waar is.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { installNodeFileIpc } from './nodeFileIpc';

export const GRENS = 65536;
const mode = process.argv[2] === 'desktop' ? 'desktop' : 'web';
const appData = process.argv[3] ?? '';

installBrowserStubs();
const reseed = installDeterminism();
const db = installFakeRecoveryIndexedDb();
if (mode === 'desktop') installNodeFileIpc({ appDataDir: appData });
console.error = () => {};
const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { readRecoveryDocument } = await import('@/state/readRecoveryDocument');
const { recoverySourceDocument } = await import('@/state/recoverySourceDocument');
const { clearRecovery, loadRecovery, saveRecovery, fullRecoverySave } = await import('@/services/recovery/recoveryStore');
const { runRecoveryTick } = await import('@/services/recovery/recoverySnapshot');
const { RecoveryDeltaTracker } = await import('@/services/recovery/recoveryDelta');
const { ownRecoveryNames } = await import('@/services/recovery/recoveryPaths');
const { SOURCE_COPY_DB } = await import('@/services/recovery/recoverySourceCopies');
const { saveTargetRef } = await import('@/services/fileAccess');
const { IFC_FOREIGN_SCAN_MAX_BYTES } = await import('@/services/ifc/foreign/foreignScan');
const { scanForeignTargetSource } = await import('@/services/ifc/foreign/targetForeignScan');
const { readsAsBytes } = await import('@/services/formatRegistry');

let checks = 0;
const diffs: string[] = [];
const eq = (label: string, got: unknown, want: unknown) => {
  checks++;
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) diffs.push(`${label}: ${g?.slice(0, 240)} ≠ ${w?.slice(0, 240)}`);
};
assert.equal(IFC_FOREIGN_SCAN_MAX_BYTES, GRENS, 'de check verlaagde de productiegrens niet');

const enc = new TextEncoder(), dec = new TextDecoder();
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const model = readFileSync('tests/fixtures/ifc-foreign/eigen-plus-model.ifc', 'utf8');
const plan = readFileSync('public/examples/showcase-verbouwing-eengezinswoning.ifc', 'utf8');
/** Precies `bytes` lang: een commentaar direct na `DATA;`. */
const pad = (text: string, bytes: number) => {
  const out = enc.encode(text.replace('\nDATA;\n', `\nDATA;\n/*${' '.repeat(bytes - enc.encode(text).length - 4)}*/`));
  assert.equal(out.length, bytes);
  return out;
};
const newStore = (flag: boolean) => {
  reseed(0x804);
  const { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = flag ? { ifcForeignContent: true } : {}; });
  return store;
};
type Store = ReturnType<typeof newStore>;
type Recovered = Awaited<ReturnType<typeof loadRecovery>>['docs'][number];
/** Een handle die de opslagronde net als een echte `FileSystemFileHandle` kan klonen: de methoden staan op het prototype.
 *  Na het klonen ontbreken ze; het herstel krijgt daarom elke keer een verse handle (`withHandle`). */
class FakeHandle {
  readonly kind = 'file';
  readonly name = 'model.ifc';
  constructor(readonly bytes: Uint8Array) {}
  async queryPermission() { return 'granted'; }
  async requestPermission() { return 'granted'; }
  async getFile() { return new File([this.bytes as BlobPart], this.name); }
}
const handleOf = (bytes: Uint8Array) => new FakeHandle(bytes) as unknown as FileSystemFileHandle;
const snapshotOf = (name: string) => plan.replace("'Refurbishment & Extension of a Family Home'", `'${name}'`);

/** *Herstellen* zoals `useRecoveryRestore` op main: elk document lezen, in de store zetten, en opruimen als alles terugkwam. */
async function restore(withRecord: (doc: Recovered) => Recovered = d => d) {
  const loaded = await loadRecovery();
  const input = await Promise.all(loaded.docs.map(d => readRecoveryDocument(withRecord(d), loaded.archives, true)));
  const app = newStore(true);
  const skipped = app.getState().restoreDocuments(input, loaded.activeDocumentId).skippedIds;
  if (skipped.length === 0) await clearRecovery();
  return { app, input, skipped };
}
/** Een nieuwe crashsnapshot van alle open tabbladen, via de gewone opslagronde. */
async function snapshot(app: Store, tracker = new RecoveryDeltaTracker()) {
  const s = app.getState();
  await runRecoveryTick(tracker, s.activeDocumentId, s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
}
/** Wat de planner na *Herstellen* heeft: het gebouwmodel (bronhash) en de planning. */
const restoredState = (app: Store) => {
  const s = app.getState();
  return { model: s.ifcSource?.sha256 ?? null, buildingModel: s.ifcSource?.buildingModel ?? false,
    sourceMissing: s.foreignSourceMark?.sourceMissing ?? false, project: s.project.name, firstTask: s.tasks[0]?.name ?? null, dirty: s.isDirty };
};

// ── 1. Crashherstel van een eigen bron boven de grens: model en planning terug, ook na een tweede *Herstellen* ───────
// Fixronde 2 (besluit 21 november 2026): het herstel leest zijn eigen, op lengte en SHA-256 gecontroleerde bron zonder de
// grens voor openen. Daarna een bewerking, een nieuwe crashsnapshot en nog eens *Herstellen*; opruimen zoals main.
const bytes = pad(model, GRENS + 1);
const reference = { foreign: true as const, byteLength: bytes.length, sha256: sha(bytes) };
const cases = mode === 'desktop'
  ? [{ label: 'desktop, bron op schijf', site: false, handle: false, disk: true }]
  : [
    { label: 'browser zonder handle', site: false, handle: false, disk: false },
    { label: 'browser met een handle naar het bestand', site: false, handle: true, disk: false },
    { label: 'sitebestand', site: true, handle: false, disk: false },
  ];
for (const c of cases) {
  await clearRecovery();
  const documentId = `grens-${c.label}`;
  const diskPath = join(appData, 'model.ifc');
  if (c.disk) writeFileSync(diskPath, bytes);
  await saveRecovery({
    ...fullRecoverySave(documentId, [{
      id: documentId, isDirty: true, datesAsRecorded: false, filePath: null, ifc: snapshotOf('Gecrasht tabblad'), ifcSource: reference,
      ...(c.site ? { siteFileId: 'site-model', siteFileVersion: 'v1', foreignSource: { filePath: null, siteFileId: 'site-model' } } : {}),
      ...(c.disk ? { foreignSource: { filePath: diskPath, siteFileId: null } } : {}),
    }]),
    // Met een handle geen bronkopie: dan kan alleen de handle de bytes geven.
    ...(c.disk || c.handle ? {} : { ifcSourceCopies: new Map([[documentId, { bytes, siteFileId: c.site ? 'site-model' : null, siteFileVersion: c.site ? 'v1' : null }]]) }),
  });
  // Op de desktop komt de set van een vorige start: een andere eigenaar in het manifest.
  const previousStart = () => {
    if (!c.disk) return;
    const manifest = join(appData, ownRecoveryNames.manifest);
    writeFileSync(manifest, JSON.stringify({ ...JSON.parse(readFileSync(manifest, 'utf8')), ownerId: 'vorige-start' }));
  };
  previousStart();
  const withHandle = (d: Recovered) => (c.handle && d.ifcSource ? { ...d, ifcSource: { ...d.ifcSource, handle: handleOf(bytes) } } : d);
  const first = await restore(withHandle);
  eq(`herstel ${c.label}: de bron is gelezen`, [first.input.map(i => i.sourceRestored ?? false), first.skipped], [[true], []]);
  eq(`herstel ${c.label}: model en planning terug`, restoredState(first.app),
    { model: reference.sha256, buildingModel: true, sourceMissing: false, project: 'Gecrasht tabblad', firstTask: first.app.getState().tasks[0]?.name ?? null, dirty: true });
  if (c.disk) eq(`herstel ${c.label}: het opslagdoel is het bestand`, [first.app.getState().filePath, saveTargetRef(first.app.getState())?.kind ?? null], [diskPath, 'path']);
  eq(`herstel ${c.label}: na Herstellen opgeruimd zoals main`, (await loadRecovery()).docs.length, 0);

  // Een bewerking, een nieuwe crashsnapshot en een tweede *Herstellen*.
  first.app.getState().updateTask(first.app.getState().tasks[0].id, { name: 'Bewerkt na herstel' });
  await snapshot(first.app);
  previousStart();
  const next = await loadRecovery();
  eq(`herstel ${c.label}: de nieuwe snapshot draagt bewerking en bron`, next.docs.map(d => [d.ifc.includes('Bewerkt na herstel'), d.ifcSource?.sha256 ?? null]),
    [[true, reference.sha256]]);
  const second = await restore(withHandle);
  eq(`herstel ${c.label}: tweede Herstellen, model en planning terug`, restoredState(second.app),
    { model: reference.sha256, buildingModel: true, sourceMissing: false, project: 'Gecrasht tabblad', firstTask: 'Bewerkt na herstel', dirty: true });
  eq(`herstel ${c.label}: na het tweede Herstellen opgeruimd`, [(await loadRecovery()).docs.length, mode === 'web' ? db.store('sources', SOURCE_COPY_DB).size : 0], [0, 0]);
  if (c.disk) eq(`herstel ${c.label}: het bestand op schijf ongewijzigd`, sha(readFileSync(diskPath)), reference.sha256);
}

if (mode === 'web') {
  // ── 1b. Twee tabbladen, één met een bron boven de grens: na Herstellen en sluiten komt het andere niet terug ────────
  await clearRecovery();
  await saveRecovery({
    ...fullRecoverySave('groot', [
      { id: 'groot', isDirty: true, datesAsRecorded: false, filePath: null, ifc: snapshotOf('Groot tabblad'), ifcSource: reference },
      { id: 'gezond', isDirty: true, datesAsRecorded: false, filePath: null, ifc: snapshotOf('Gezond tabblad') },
    ]),
    ifcSourceCopies: new Map([['groot', { bytes, siteFileId: null, siteFileVersion: null }]]),
  });
  const both = await restore();
  eq('twee tabbladen: allebei terug, het grote met zijn model', [both.app.getState().documents.length, both.input.map(i => i.sourceRestored ?? false)],
    [2, [true, false]]);
  const tracker = new RecoveryDeltaTracker();
  await snapshot(both.app, tracker);
  assert(both.app.getState().closeDocument('gezond'));
  await snapshot(both.app, tracker);
  const afterClosing = await loadRecovery();
  eq('twee tabbladen: na sluiten alleen het grote tabblad, met zijn bron', afterClosing.docs.map(d => [d.id, d.ifcSource?.sha256 ?? null]),
    [['groot', reference.sha256]]);
  await clearRecovery();

  // ── 1c. Bestand → Openen van hetzelfde bestand boven de grens weigert nog steeds ──────────────────────────────────
  const opener = newStore(true);
  await opener.getState().openOpenedFile({ name: 'model.ifc', content: '', bytes, ref: null });
  eq('openen boven de grens: geweigerd met de melding over de grootte', [opener.getState().filePath, opener.getState().ifcSource,
    opener.getState().ui.notifications.map(n => [n.messageKey, n.params])], [null, null, [['notifications.ifcForeignOpenTooLarge', { limit: 0 }]]]);
}

if (mode === 'web') {
// ── 2. Ctrl+S van een gewone planning boven de grens, via de echte opslagroute ─────────────────────────────────────
// Met de flag uit precies main: één schrijfactie met de wijziging. Met de flag aan weigert de doelscan het bestaande
// bestand boven de grens (knownbug 2044): niets geschreven, het bestand ongewijzigd, het document blijft gewijzigd.
for (const flag of [false, true]) {
  const original = pad(plan, GRENS + 1);
  let file: Uint8Array = original, writes = 0;
  const handle = {
    kind: 'file', name: 'planning.ifc', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    getFile: async () => new File([file as BlobPart], 'planning.ifc'),
    createWritable: async () => {
      let pending: Uint8Array = new Uint8Array();
      return {
        write: async (value: string | Uint8Array) => { pending = typeof value === 'string' ? enc.encode(value) : value; },
        close: async () => { file = pending; writes++; }, abort: async () => {},
      };
    },
  } as unknown as FileSystemFileHandle;
  const store = newStore(flag);
  const content = readsAsBytes(handle.name, { ifcBytes: flag }) ? { content: '', bytes: file } : { content: dec.decode(file) };
  await store.getState().openOpenedFile({ ...content, name: handle.name, ref: { kind: 'handle', handle } });
  eq(`opslaan flag ${flag}: geopend`, [store.getState().filePath, store.getState().tasks.length > 0], ['planning.ifc', true]);
  store.getState().updateTask(store.getState().tasks[0].id, { name: 'Gewijzigd boven de grens' });
  await store.getState().saveFile();
  const s = store.getState();
  if (!flag) {
    eq('opslaan flag uit: één schrijfactie met de wijziging, zoals main', [writes, dec.decode(file).includes('Gewijzigd boven de grens'), s.isDirty], [1, true, false]);
  } else {
    eq('opslaan flag aan: geweigerd (knownbug 2044)', [writes, sha(file) === sha(original), s.isDirty,
      s.ui.notifications.some(n => n.messageKey === 'notifications.ifcUnreadableTargetSave')], [0, true, true, true]);
  }
}

// ── 3. De doelscan als stroom op de rand: precies de grens wordt ingedeeld, één byte erboven niet ───────────────────
for (const [label, size, want] of [['precies de grens', GRENS, 'no-model'], ['één byte erboven', GRENS + 1, 'unreadable']] as const) {
  const bytes = pad(plan, size);
  const half = bytes.length >> 1;
  const segments = [bytes.subarray(0, half), bytes.subarray(half)];
  let at = 0, skip = 0;
  const source = {
    next: async () => {
      if (at >= segments.length) return null;
      const chunk = segments[at++].subarray(skip);
      skip = 0;
      return chunk;
    },
    seek: async (offset: number) => { at = offset >= half ? 1 : 0; skip = offset >= half ? offset - half : offset; },
  };
  eq(`stroom ${label}`, await scanForeignTargetSource(source, { createWorker: () => null }), want);
}
}

if (diffs.length) {
  console.log(`XX  ifc-foreign-grens (${mode}): ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-grens (${mode}): alle checks groen (${checks}; grens verlaagd tot ${GRENS} bytes)`);
