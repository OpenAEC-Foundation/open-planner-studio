// #804 PR 11a: echte documentacties, volledige heropening of bewijs van nul schrijfacties.
// Bronobjecten alleen op identiteit vergelijken; nooit een assert-diff van bronbytes maken.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { openInStore, loadStore } from './ifcAppRoute';
import { installNodeFileIpc } from './nodeFileIpc';
import { installDeterminism } from './ifcPariteitKern';
import { mergeProblems, openForeign } from './ifcMergeKern';

installDeterminism();
await loadStore();
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const bytes = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const dir = mkdtempSync(join(tmpdir(), 'ops-document-save-'));
type Store = Awaited<ReturnType<typeof openInStore>>['store'];
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const longer = (store: Store) => {
  const state = store.getState(), task = state.tasks.find(t => !t.childIds.length && !t.isMilestone)!;
  state.updateTask(task.id, { time: { ...task.time, scheduleDuration: task.time.scheduleDuration + 1 } });
  store.getState().runCPM();
  return task.id;
};
let passed = 0, failed = 0;
async function check(name: string, action: () => Promise<void>) {
  console.log(`START ${name}`);
  try { await action(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`XX ${name}: ${String(error instanceof Error ? error.message : error).slice(0, 1600)}`); }
}
function desktop() {
  const ipc = installNodeFileIpc();
  const win = window as unknown as { __TAURI_INTERNALS__: { invoke: (...args: unknown[]) => Promise<unknown> } };
  const invoke = win.__TAURI_INTERNALS__.invoke;
  let answer: string | null = null, picks = 0;
  win.__TAURI_INTERNALS__.invoke = async (...args) => {
    if (args[0] === 'plugin:dialog|save') { picks++; return answer; }
    return invoke(...args);
  };
  return { ...ipc, choose: (name: string | null) => { answer = name; }, picks: () => picks };
}
await check('desktop: duur, nieuwe naam, resource, tweede nieuwe naam; volledig heropenen', async () => {
  const { store } = await openInStore(bytes);
  const ipc = desktop();
  try {
    const id = longer(store), duration = store.getState().tasks.find(t => t.id === id)!.time.scheduleDuration;
    const first = join(dir, 'eerste.ifc'); ipc.choose(first);
    await store.getState().saveFileAs();
    assert(existsSync(first), 'Opslaan als schreef een nieuw bestand');
    const output = new Uint8Array(readFileSync(first));
    assert.deepEqual(mergeProblems(bytes, output), [], 'het vreemde deel blijft bytegelijk');
    const reopened = await openForeign(output);
    assert.equal(reopened.tasks.find(t => t.id === id)!.time.scheduleDuration, duration);
    const current = store.getState();
    assert.equal(current.filePath, first); assert.equal(current.isDirty, false);
    assert.equal(hash(current.ifcSource!.bytes), hash(output), 'de nieuwe bron hoort bij de schijf');
    assert.equal(current.foreignSourceMark!.filePath, first);
    assert.equal(current.foreignSourceMark!.sha256, hash(output));
    current.addResource({ name: 'Nieuwe resource 11a' });
    const second = join(dir, 'tweede.ifc'); ipc.choose(second);
    await store.getState().saveFileAs();
    assert(existsSync(second));
    const again = new Uint8Array(readFileSync(second)), opened = await openForeign(again);
    assert.deepEqual(mergeProblems(bytes, again), []);
    assert.equal(opened.tasks.find(t => t.id === id)!.time.scheduleDuration, duration);
    assert(opened.resources.some(r => r.name === 'Nieuwe resource 11a'));
    assert.equal(store.getState().foreignSourceMark!.filePath, second);
    assert.equal(store.getState().foreignSourceMark!.sha256, hash(again));
  } finally { ipc.dispose(); }
});
rmSync(dir, { recursive: true, force: true });
console.log(`Documentopslag: ${passed} geslaagd, ${failed} mislukt.`);
if (failed) process.exitCode = 1;
