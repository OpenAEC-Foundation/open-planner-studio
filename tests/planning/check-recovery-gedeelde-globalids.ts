import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadStore } from './ifcAppRoute';
import { installDeterminism } from './ifcPariteitKern';
import { installNodeFileIpc } from './nodeFileIpc';
import { installFakeRecoveryIndexedDb } from './fakeRecoveryIndexedDb';
import { mergeProblems, tryMerge } from './ifcMergeKern';
import { scanForeignStep } from '@/services/ifc/foreign/oldOwnHeader';
import { RecoveryDeltaTracker } from '@/services/recovery/recoveryDelta';
import { runRecoveryTick } from '@/services/recovery/recoverySnapshot';
import { loadRecovery, clearRecovery } from '@/services/recovery/recoveryStore';
import { registerRecoveryFlush } from '@/services/recovery/recoveryFlush';
import { hasPendingIfcSource } from '@/services/recovery/recoveryPendingSource';
import { replaceRecordId } from '@/services/fileAccess/replaceRecords';
import { recoverySourceDocument } from '@/state/recoverySourceDocument';
import { readRecoveryDocument } from '@/state/readRecoveryDocument';
import { buildWriteIFCInput } from '@/state/ifcSaveInput';
import { planningCanon } from '@/services/ifc/foreign/planningCanon';

installDeterminism();
await loadStore();
installFakeRecoveryIndexedDb({});
const session = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
  getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => session.set(k, v),
  removeItem: (k: string) => session.delete(k),
} });

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = mkdtempSync(join(tmpdir(), 'ops-gedeelde-globalids-'));
const hash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const SCAFFOLDERS = 'Steigerbouwers', CRANE = 'Kraanmachinisten';

type Store = ReturnType<Awaited<ReturnType<typeof loadStore>>['createAppStoreContext']>['store'];
function desktop(appDataDir?: string) {
  const ipc = installNodeFileIpc(appDataDir ? { appDataDir } : {});
  const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown, o?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__;
  const invoke = internals.invoke;
  let target: string | null = null;
  internals.invoke = async (c, a, o) => c === 'plugin:dialog|save' ? target
    : c === 'plugin:fs|read_file' ? new Uint8Array(readFileSync((a as { path: string }).path)) : invoke(c, a, o);
  return { ...ipc, choose: (p: string) => { target = p; } };
}
async function freshStore(): Promise<Store> {
  const { createAppStoreContext } = await loadStore(), { store } = createAppStoreContext();
  store.setState(s => { s.ui.featureFlags = { ifcForeignContent: true }; });
  return store;
}
async function openAt(data: Uint8Array, path: string): Promise<Store> {
  writeFileSync(path, data);
  const store = await freshStore();
  await store.getState().openOpenedFile({ name: 'bron.ifc', content: '', bytes: data, ref: { kind: 'path', path } });
  return store;
}
async function saveAs(store: Store, name: string): Promise<Uint8Array> {
  const ipc = desktop(), target = join(dir, name); ipc.choose(target);
  try { await store.getState().saveFileAs(); } finally { ipc.dispose(); }
  assert(existsSync(target), `bestand geschreven: ${name} (${store.getState().ui.notifications.map(n => n.messageKey).join(', ')})`);
  return new Uint8Array(readFileSync(target));
}
async function tick(store: Store, enabled = true) {
  const capture = desktop();
  let docs;
  try { docs = store.getState().getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, enabled)); }
  finally { capture.dispose(); }
  await runRecoveryTick(new RecoveryDeltaTracker(), store.getState().activeDocumentId, docs, undefined, undefined, () => {});
  return loadRecovery();
}
type Loaded = Awaited<ReturnType<typeof loadRecovery>>;
async function restore(loaded: Loaded, enabled = true, appDataDir?: string): Promise<Store> {
  const store = await freshStore();
  const ipc = desktop(appDataDir);
  try {
    const inputs = [];
    for (const doc of loaded.docs) inputs.push(await readRecoveryDocument(doc, loaded.archives, enabled));
    assert.equal(store.getState().restoreDocuments(inputs, loaded.activeDocumentId).skippedIds.length, 0);
  } finally { ipc.dispose(); }
  return store;
}

function resourceLine(data: Uint8Array, name: string) {
  const index = scanForeignStep(data);
  for (let c = 0; c < index.count; c++) {
    if (!index.isEntity(c) || !index.type(c).endsWith('RESOURCE')) continue;
    if (index.argTokens(c)![2] === `'${name}'`) return { stepId: index.id(c), type: index.type(c), guid: index.globalId(c) };
  }
  return null;
}
function identity(store: Store, name: string) {
  const s = store.getState(), resource = s.resources.find(r => r.name === name);
  if (!resource) return null;
  return { id: resource.id, guid: s.ifcGlobalIds?.[`res:${resource.id}`], step: s.ifcSource?.stepIds[`res:${resource.id}`] };
}
const sameIdentities = (actual: Store, expected: Store, label: string) => {
  for (const name of [SCAFFOLDERS, CRANE]) assert.deepEqual(identity(actual, name), identity(expected, name), `${label}: ${name}`);
};
const renameFirstTask = (store: Store, name: string) => {
  const task = store.getState().tasks.find(t => !t.isMilestone && t.childIds.length === 0)!;
  const previous = task.name;
  store.getState().updateTask(task.id, { name });
  return previous;
};
const mergeKinds = async (store: Store) => {
  const outcome = await tryMerge(buildWriteIFCInput(store.getState(), 'merge'), store.getState().ifcSource!);
  return outcome.ok ? 'ok' : outcome.kinds.join(',');
};

const model = new Uint8Array(readFileSync(join(root, 'tests/fixtures/ifc-foreign/eigen-plus-model.ifc')));
const builder = await openAt(model, join(dir, 'bouw.ifc'));
builder.getState().addResource({ name: SCAFFOLDERS, type: 'LABOR', description: '', maxUnits: 1, costPerHour: 0 });
builder.getState().addResource({ name: CRANE, type: 'LABOR', description: '', maxUnits: 1, costPerHour: 0 });
const built = await saveAs(builder, 'bouw-opgeslagen.ifc');
const scaffolders = resourceLine(built, SCAFFOLDERS)!, crane = resourceLine(built, CRANE)!;
const builtText = Buffer.from(built).toString('latin1');
assert.equal(builtText.split(`'${crane.guid}'`).length, 2, 'de GlobalId van de tweede nieuwe resource staat alleen op haar eigen regel');
const index = scanForeignStep(built);
let highest = 0, foreignHistory = '';
for (let c = 0; c < index.count; c++) {
  if (!index.isEntity(c)) continue;
  highest = Math.max(highest, Number(index.id(c)));
  if (index.type(c) === 'IFCAPPLICATION' && index.argTokens(c)![2] === "'Corpus modelleur'") foreignHistory = `#${index.id(c)}`;
}
let history = '';
for (let c = 0; c < index.count && !history; c++) {
  if (index.isEntity(c) && index.type(c) === 'IFCOWNERHISTORY' && index.argTokens(c)![1] === foreignHistory) history = `#${index.id(c)}`;
}
assert(history, 'de fixture heeft een owner history van een ander programma');
const [pset, prop, rel] = [highest + 1, highest + 2, highest + 3];
const sourceText = builtText
  .replace(`#${crane.stepId}=${crane.type}('${crane.guid}'`, `#${crane.stepId}=${crane.type}('${scaffolders.guid}'`)
  .replace(/ENDSEC;\r?\nEND-ISO-10303-21;/, end => [
    `#${pset}=IFCPROPERTYSET('1VreemdePsetOpKraanAaa',${history},'Vreemd_Planning',$,(#${prop}));`,
    `#${prop}=IFCPROPERTYSINGLEVALUE('Opmerking',$,IFCLABEL('van een ander programma'),$);`,
    `#${rel}=IFCRELDEFINESBYPROPERTIES('2VreemdeRelOpKraanAaaa',${history},$,$,(#${crane.stepId}),#${pset});`,
    end,
  ].join('\n'));
const source = Uint8Array.from(sourceText, c => c.charCodeAt(0));
assert.equal(resourceLine(source, CRANE)!.guid, scaffolders.guid, 'de bron heeft twee resources met dezelfde GlobalId');

const opened = await openAt(source, join(dir, 'sessie.ifc'));
assert(opened.getState().ifcSource?.foreign, 'de bron heeft een vreemd deel');
assert.match(identity(opened, CRANE)!.id, /-dup-2$/, 'de lezer geeft de tweede een -dup-N-id');
assert.equal(identity(opened, CRANE)!.guid, scaffolders.guid);
assert.equal(identity(opened, CRANE)!.step, Number(crane.stepId));
console.log(`BRON: ${CRANE} ${identity(opened, CRANE)!.id} op #${crane.stepId}, vreemde set #${pset} via #${rel}.`);

const original = renameFirstTask(opened, 'Bewerkt vóór de crash');
const recovered = await restore(await tick(opened));
sameIdentities(recovered, opened, 'na herstel: id, GlobalId en bron-#id als in de sessie');
assert.equal(await mergeKinds(recovered), await mergeKinds(opened), 'na herstel weigert of schrijft de merge zoals in de sessie');
renameFirstTask(opened, original); renameFirstTask(recovered, original);
assert.equal(planningCanon(buildWriteIFCInput(recovered.getState(), 'merge')), planningCanon(recovered.getState().ifcSource!.opened!),
  'na herstel en terugdraaien is de planning die van de bron');
const fromSession = await saveAs(opened, 'sessie-opslag.ifc'), fromRecovery = await saveAs(recovered, 'herstel-opslag.ifc');
assert.equal(hash(fromRecovery), hash(fromSession), 'herstel schrijft dezelfde bytes als de sessie');
assert.equal(hash(fromRecovery), hash(source), 'en dat is de bron zelf');
assert.deepEqual(mergeProblems(source, fromRecovery), []);
assert.deepEqual(resourceLine(fromRecovery, CRANE), { ...crane, guid: scaffolders.guid }, 'de tweede staat op haar #id met haar GlobalId');
console.log('PROEF 1 GROEN: bewerken, crash, herstel: dezelfde ids, GlobalIds en bron-#ids; daarna dezelfde opslag als de sessie.');
await clearRecovery();

const firstGone = await openAt(source, join(dir, 'eerste-weg.ifc'));
firstGone.getState().removeResource(firstGone.getState().resources.find(r => r.name === SCAFFOLDERS)!.id);
const recoveredGone = await restore(await tick(firstGone));
assert.equal(identity(recoveredGone, SCAFFOLDERS), null);
assert.deepEqual(identity(recoveredGone, CRANE), identity(firstGone, CRANE), 'de eerste houder weg: de tweede houdt toch haar identiteit');
const goneKinds = await mergeKinds(firstGone);
assert.equal(await mergeKinds(recoveredGone), goneKinds, 'na herstel weigert de merge zoals in de sessie');
assert.equal(goneKinds, 'niet-gedragen', 'main weigert hier de nieuwe GlobalId van de tweede (knownbug 2236)');
console.log('PROEF 2 GROEN: eerste houder verwijderd, crash, herstel: de tweede houdt id, GlobalId en bron-#id; de merge doet wat de sessie doet.');
await clearRecovery();

const appData = join(dir, 'appdata');
mkdirSync(appData);
const replacePath = join(dir, 'vervang.ifc');
writeFileSync(replacePath, source);
const ipc = desktop(appData);
const replacing = await freshStore();
await replacing.getState().openOpenedFile({ name: 'vervang.ifc', content: '', bytes: source, ref: { kind: 'path', path: replacePath } });
const replacingId = replacing.getState().activeDocumentId!;
const revert = renameFirstTask(replacing, 'Even anders');
renameFirstTask(replacing, revert);
assert.equal(replacing.getState().isDirty, true, 'het document is gewijzigd, de planning is die van de bron');
const crashes: { label: string; loaded: Loaded; target: string; records: number }[] = [];
const recordsNow = () => readdirSync(appData).filter(n => replaceRecordId(n) !== null).length;
const crash = async (label: string) => {
  crashes.push({ label, loaded: await loadRecovery(), target: hash(new Uint8Array(readFileSync(replacePath))), records: recordsNow() });
};
const tracker = new RecoveryDeltaTracker();
let committed = false;
const unregister = registerRecoveryFlush(async () => {
  const s = replacing.getState();
  await runRecoveryTick(tracker, s.activeDocumentId, s.getOpenDocumentPayloads().map(({ id, payload }) => recoverySourceDocument(id, payload, true)));
  if (hasPendingIfcSource()) await crash('na stap 0');
  else if (committed) { committed = false; await crash('na het vastleggen, vóór het opruimen'); }
});
let places = 0;
ipc.faults.place = async (_from, _to, real) => {
  const answer = real();
  if (++places === 2) { await crash('na het plaatsen, vóór het vastleggen'); committed = true; }
  return answer;
};
try {
  assert.equal(await replacing.getState().saveFileForDocument(replacingId), true, 'Ctrl+S op het eigen pad slaagt');
} finally { unregister(); ipc.faults.place = null; ipc.dispose(); }
assert.deepEqual(crashes.map(c => c.label), ['na stap 0', 'na het plaatsen, vóór het vastleggen', 'na het vastleggen, vóór het opruimen']);
assert.equal(recordsNow(), 0, 'na de vervanging is het herstelrecord weg');
for (const moment of crashes) {
  assert.equal(moment.target, hash(source), `${moment.label}: op het doel staat de bron`);
  assert.equal(moment.records, 1, `${moment.label}: het herstelrecord staat er nog`);
  const doc = moment.loaded.docs.find(d => d.id === replacingId)!;
  assert(doc.ifcSource?.sharedGlobalIds?.length, `${moment.label}: het manifest noemt de gedeelde GlobalIds`);
  const back = await restore(moment.loaded, true, appData);
  sameIdentities(back, replacing, `${moment.label}: na herstel`);
  const first = await saveAs(back, `vervang-herstel-${crashes.indexOf(moment)}.ifc`);
  assert.equal(hash(first), hash(source), `${moment.label}: de opslag na herstel is de bron, met de vreemde set op de tweede`);
  const second = await saveAs(back, `vervang-herstel-${crashes.indexOf(moment)}-tweede.ifc`);
  assert.deepEqual(resourceLine(second, CRANE), resourceLine(first, CRANE), `${moment.label}: een tweede opslag verandert de tweede niet`);
}
console.log('PROEF 3 GROEN: Ctrl+S op het eigen pad, crash na stap 0, na het plaatsen en vóór het opruimen: herstel houdt de identiteit.');
await clearRecovery();
