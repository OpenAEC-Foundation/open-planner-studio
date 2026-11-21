// De proef achter `check-ifc-foreign-grens.ts`: draait alleen in een bundel waarin die check de productiegrens
// `IFC_FOREIGN_SCAN_MAX_BYTES` verlaagt tot `GRENS` (64 KiB). Zo lopen de echte routes (crashherstel, Ctrl+S, de doelscan
// als stroom) over de grens zonder een bestand van 150 MiB. Fixronde 1 van #1127 (review Sol). Exit 0 = alles groen.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { installBrowserStubs, installDeterminism } from './ifcPariteitKern';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';

export const GRENS = 65536;

installBrowserStubs();
const reseed = installDeterminism();
const db = installFakeRecoveryIndexedDb();
console.error = () => {};
const { createAppStoreContext } = await import('@/state/appStoreFactory');
const { readRecoveryDocument, restoreRecoveredDocuments } = await import('@/state/readRecoveryDocument');
const { clearRecovery, loadRecovery, saveRecovery, fullRecoverySave } = await import('@/services/recovery/recoveryStore');
const { readRecoverySourceCopy, SOURCE_COPY_DB } = await import('@/services/recovery/recoverySourceCopies');
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

// ── 1. Crashherstel van een bron boven de grens: de planning terug, een melding, en de herstelset blijft ─────────────
// Een oude herstelset (zoals de app hem vóór de lagere grens schreef): planning, manifestverwijzing en de bronkopie.
const recoveryCases = [
  { label: 'browser zonder handle', over: true, site: false, handle: false },
  { label: 'browser met een handle naar het bestand', over: true, site: false, handle: true },
  { label: 'sitebestand', over: true, site: true, handle: false },
  { label: 'onder de grens (controle)', over: false, site: false, handle: false },
];
for (const c of recoveryCases) {
  const bytes = pad(model, c.over ? GRENS + 1 : GRENS);
  const documentId = `grens-${c.label}`;
  const reference = { foreign: true as const, byteLength: bytes.length, sha256: sha(bytes) };
  const snapshot = plan.replace("'Refurbishment & Extension of a Family Home'", "'Gecrasht tabblad'");
  await saveRecovery({
    ...fullRecoverySave(documentId, [{
      id: documentId, isDirty: true, datesAsRecorded: false, filePath: null, ifc: snapshot, ifcSource: reference,
      ...(c.site ? { siteFileId: 'site-model', siteFileVersion: 'v1', foreignSource: { filePath: null, siteFileId: 'site-model' } } : {}),
    }]),
    ifcSourceCopies: new Map([[documentId, { bytes, siteFileId: c.site ? 'site-model' : null, siteFileVersion: c.site ? 'v1' : null }]]),
  });
  const loaded = await loadRecovery();
  eq(`herstel ${c.label}: één document`, loaded.docs.length, 1);
  const handle = { kind: 'file', name: 'model.ifc', queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    getFile: async () => new File([bytes], 'model.ifc') } as unknown as FileSystemFileHandle;
  const record = c.handle ? { ...loaded.docs[0], ifcSource: { ...loaded.docs[0].ifcSource!, handle } } : loaded.docs[0];
  const input = await readRecoveryDocument(record, loaded.archives, true);
  eq(`herstel ${c.label}: uitkomst van de lezing`, [input.sourceRestored ?? false, input.sourceNotRestored ?? null],
    c.over ? [false, { limit: Math.floor(GRENS / (1024 * 1024)) }] : [true, null]);
  const app = newStore(true);
  await restoreRecoveredDocuments(app, [input], loaded.activeDocumentId, 0, new Map([[documentId, 'model.ifc']]));
  const s = app.getState();
  eq(`herstel ${c.label}: de planning is hersteld`, [s.tasks.length > 0, s.project.name, s.isDirty], [true, 'Gecrasht tabblad', true]);
  eq(`herstel ${c.label}: het model`, [s.ifcSource?.sha256 ?? null, s.foreignSourceMark?.sourceMissing ?? false],
    c.over ? [null, true] : [reference.sha256, false]);
  eq(`herstel ${c.label}: de melding`, s.ui.notifications.map(n => [n.messageKey, n.severity, n.sticky, n.params]),
    c.over ? [['notifications.recoveryModelNotRestored', 'error', true, { name: 'model.ifc', limit: 0 }]] : []);
  const copy = record.sourceCopyDocumentKey ? await readRecoverySourceCopy(record.sourceCopyDocumentKey, reference.sha256) : null;
  eq(`herstel ${c.label}: de bronkopie na Herstellen`, copy ? sha(copy.bytes) : null, c.over ? reference.sha256 : null);
  if (c.over) {
    // Bij een volgende start komt dezelfde set terug; Verwerpen ruimt haar op.
    const again = await loadRecovery();
    eq(`herstel ${c.label}: bij de volgende start opnieuw aangeboden`, again.docs.map(d => d.id).includes(documentId), true);
    await clearRecovery();
    eq(`herstel ${c.label}: na Verwerpen is de kopie weg`, db.store('sources', SOURCE_COPY_DB).size, 0);
  }
}

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

if (diffs.length) {
  console.log(`XX  ifc-foreign-grens: ${diffs.length} afwijking(en) van ${checks}`);
  for (const d of diffs) console.log(`   - ${d}`);
  process.exit(1);
}
console.log(`OK  ifc-foreign-grens: alle checks groen (${checks}; grens verlaagd tot ${GRENS} bytes)`);
