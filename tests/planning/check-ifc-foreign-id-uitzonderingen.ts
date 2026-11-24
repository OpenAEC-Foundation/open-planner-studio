import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { installNodeFileIpc } from './nodeFileIpc';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { mergeProblems, tryMerge } from './ifcMergeKern';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';

installDeterminism();
await loadStore();
installFakeRecoveryIndexedDb({});
const session = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v),
  removeItem: (k: string) => session.delete(k),
} });

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = mkdtempSync(join(tmpdir(), 'ops-id-uitzonderingen-'));
const TILERS = "'3MF88qqAQonUM32TrGFdCU'", PAINTERS = "'2qrZTe4qTtIvHW8Ux39K7x'";
const fixture = readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc'), 'latin1');
const dupText = fixture
  .replace(`#114=IFCLABORRESOURCE(${PAINTERS}`, `#114=IFCLABORRESOURCE(${TILERS}`)
  .replace('ENDSEC;\nEND-ISO', [
    "#900=IFCPROPERTYSET('1VreemdePsetOpSchilder',#330,'Vreemd_Planning',$,(#901));",
    "#901=IFCPROPERTYSINGLEVALUE('Opmerking',$,IFCLABEL('van een ander programma'),$);",
    "#902=IFCRELDEFINESBYPROPERTIES('2VreemdeRelOpSchilders',#330,$,$,(#114),#900);",
    'ENDSEC;\nEND-ISO',
  ].join('\n'));
assert.notEqual(dupText, fixture);
const source = Uint8Array.from(dupText, c => c.charCodeAt(0));

type Store = ReturnType<Awaited<ReturnType<typeof loadStore>>['createAppStoreContext']>['store'];
function desktop() {
  const ipc = installNodeFileIpc(), internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
  const invoke = internals.invoke;
  let target: string | null = null;
  internals.invoke = async (c, a, o) => c === 'plugin:dialog|save' ? target
    : c === 'plugin:fs|read_file' ? new Uint8Array(readFileSync((a as { path: string }).path)) : invoke(c, a, o);
  return { ...ipc, choose: (p: string) => { target = p; } };
}
async function openAt(data: Uint8Array, path: string): Promise<Store> {
  writeFileSync(path, data);
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  await store.getState().openOpenedFile({ name: 'bron.ifc', content: '', bytes: data, ref: { kind: 'path', path } });
  assert(store.getState().ifcSource?.foreign, 'de bron heeft een vreemd deel');
  return store;
}
async function saveAs(store: Store, name: string) {
  const ipc = desktop(), target = join(dir, name); ipc.choose(target);
  try { await store.getState().saveFileAs(); assert(existsSync(target), `bestand geschreven: ${name}`); }
  finally { ipc.dispose(); }
  return new Uint8Array(readFileSync(target));
}
async function tick(store: Store) {
  const capture = desktop();
  let docs;
  try { docs = store.getState().getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)); }
  finally { capture.dispose(); }
  await runRecoveryTick(new RecoveryDeltaTracker(), store.getState().activeDocumentId, docs, undefined, undefined, () => {});
  return loadRecovery();
}
async function restore(loaded: Awaited<ReturnType<typeof loadRecovery>>): Promise<Store> {
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const ipc = desktop();
  try {
    const inputs = [];
    for (const doc of loaded.docs) inputs.push(await readRecoveryDocument(doc, loaded.archives, true));
    assert.equal(store.getState().restoreDocuments(inputs, loaded.activeDocumentId).skippedIds.length, 0);
  } finally { ipc.dispose(); }
  return store;
}
function painterInFile(data: Uint8Array) {
  const index = scanForeignStep(data);
  for (let c = 0; c < index.count; c++) {
    if (!index.isEntity(c) || index.type(c) !== 'IFCLABORRESOURCE') continue;
    const args = index.argTokens(c)!;
    if (args[2] === "'Painters'") return { stepId: index.id(c), guid: index.globalId(c) };
  }
  throw new Error('geen Painters in het bestand');
}
const painterIds = (store: Store) => store.getState().resources.filter(r => r.name === 'Painters').map(r => r.id);

const notices = (store: Store) => store.getState().ui.notifications.map(n => `${n.messageKey} ${n.detail ?? ''}`.slice(0, 300));
async function scenario(label: string, edit: (store: Store) => void, saveFirst: boolean) {
  const store = await openAt(source, join(dir, `${label}.ifc`));
  edit(store);
  let base = source;
  if (saveFirst) {
    base = await saveAs(store, `${label}-eerste.ifc`).catch(e => { console.log(label, 'eerste opslag mislukt', notices(store)); throw e; });
    console.log(label, 'na opslaan', painterIds(store), painterInFile(base), mergeProblems(source, base));
  }
  const restored = await restore(await tick(store));
  console.log(label, 'na herstel', painterIds(restored), 'bron', restored.getState().ifcSource?.sha256.slice(0, 8));
  try {
    const out = await saveAs(restored, `${label}-na-herstel.ifc`);
    console.log(label, 'opslag na herstel', painterInFile(out), mergeProblems(base, out));
  } catch { console.log(label, 'opslag na herstel MISLUKT', notices(restored)); }
  await clearRecovery();
}
const renameTask = (store: Store) => { const t = store.getState().tasks.find(t => !t.isMilestone && t.childIds.length === 0)!; store.getState().updateTask(t.id, { name: 'Andere naam' }); };
const renamePainter = (store: Store) => { const r = store.getState().resources.find(r => r.name === 'Painters')!; store.getState().updateResource(r.id, { description: 'Nieuwe omschrijving' }); };
{
  const store = await openAt(source, join(dir, 'probe.ifc'));
  const restored = await restore(await tick(store));
  const outcome = await tryMerge(buildWriteIFCInput(restored.getState(), 'merge'), restored.getState().ifcSource!).catch(e => ({ ok: false as const, thrown: String(e).slice(0, 800) }));
  console.log('probe', JSON.stringify(outcome.ok ? 'ok' : 'thrown' in outcome ? outcome.thrown : outcome.error.cases.slice(0, 6)).slice(0, 2000));
  const { planningCanon } = await import('@/services/ifc/foreign/planningCanon');
  console.log('canon gelijk', planningCanon(buildWriteIFCInput(restored.getState(), 'merge')) === planningCanon(restored.getState().ifcSource!.opened!));
}
