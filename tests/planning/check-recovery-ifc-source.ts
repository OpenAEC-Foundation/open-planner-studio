// #804 PR 9a: de echte herstelopslag en documentacties; bronobjecten alleen op identiteit/hash.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadStore, openInStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { installNodeFileIpc } from './nodeFileIpc';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { mergeProblems, openForeign } from './ifcMergeKern';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
import { recoverySaveTarget } from '@/state/ifcForeignGuard';
import { recoveryIfcSourceFields } from '@/services/recovery/recoveryIfcSource';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';

installDeterminism();
await loadStore();
const idb = installFakeRecoveryIndexedDb();
const session = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v),
  removeItem: (k: string) => session.delete(k),
} });
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const bytes = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const dir = mkdtempSync(join(tmpdir(), 'ops-recovery-source-'));
const hash = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
type Store = Awaited<ReturnType<typeof openInStore>>['store'];
function desktop() {
  const ipc = installNodeFileIpc(), internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
  const invoke = internals.invoke;
  let target: string | null = null;
  internals.invoke = async (c, a) => c === 'plugin:dialog|save' ? target : invoke(c, a);
  return { ...ipc, choose: (p: string) => { target = p; } };
}
async function saveAs(store: Store, name: string) {
  const ipc = desktop(), target = join(dir, name); ipc.choose(target);
  try { await store.getState().saveFileAs(); assert(existsSync(target), `bestand geschreven: ${name}`); }
  finally { ipc.dispose(); }
  return new Uint8Array(readFileSync(target));
}
async function tick(store: Store) {
  await runRecoveryTick(new RecoveryDeltaTracker(), store.getState().activeDocumentId,
    store.getState().getOpenDocumentPayloads().map(({ id, payload }) => ({
      id, source: payload, ...recoverySaveTarget(payload), isDirty: payload.isDirty,
      datesAsRecorded: payload.datesAsRecorded, ...recoveryIfcSourceFields(payload, true),
    })));
  return loadRecovery();
}
async function restore(loaded: Awaited<ReturnType<typeof loadRecovery>>) {
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  const inputs = [];
  for (const doc of loaded.docs) inputs.push(await readRecoveryDocument(doc, loaded.archives, true));
  assert.equal(store.getState().restoreDocuments(inputs, loaded.activeDocumentId).skippedIds.length, 0);
  return store;
}

// Eerst proef 2: zonder uitzonderingenlijst, na een opslag met een nieuw object.
const original = (await openInStore(bytes)).store;
original.getState().addResource({ name: 'Resource vóór crash', type: 'EQUIPMENT', description: '', maxUnits: 2, costPerHour: 37.5 });
const first = await saveAs(original, 'voor-crash.ifc');
const task = original.getState().tasks.find(t => !t.isMilestone && t.childIds.length === 0)!;
original.getState().updateTask(task.id, { name: 'Bewerking na opslag' });
const loaded = await tick(original);
const ipc = desktop();
let recovered: Store;
try { recovered = await restore(loaded); } finally { ipc.dispose(); }
assert(recovered!.getState().ifcSource?.foreign, 'herstel heeft het vreemde deel');
assert.equal(recovered!.getState().foreignSourceMark?.sourceMissing, undefined);
assert.equal(recovered!.getState().ifcSource!.sha256, hash(first));
const second = await saveAs(recovered!, 'na-crash.ifc');
const reopenedFirst = await openForeign(first), reopenedSecond = await openForeign(second);
assert(reopenedSecond.resources.some(r => r.name === 'Resource vóór crash'));
assert.equal(reopenedSecond.tasks.find(t => t.id === task.id)?.name, 'Bewerking na opslag');
const resourceGuid = (d: typeof reopenedFirst) => {
  const r = d.resources.find(r => r.name === 'Resource vóór crash')!;
  return d.ifcGlobalIds?.[`res:${r.id}`];
};
assert(resourceGuid(reopenedFirst));
assert.equal(resourceGuid(reopenedSecond), resourceGuid(reopenedFirst), 'geen nieuwe GlobalId voor de opgeslagen resource');
assert.deepEqual(mergeProblems(first, second), [], 'vreemde verwijzingen en bytes intact');
console.log('PROEF 2 GROEN: twee bewerkingen, volledig heropenen, dezelfde GlobalId; geen idExceptions.');
assert(idb.store('records').size > 0);
await clearRecovery();
writeFileSync(join(dir, 'proef2-groen.txt'), 'Geen idExceptions nodig.\n');
